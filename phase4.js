"use strict";

/* ==================================================
   KEYSTRIKE V5
   PHASE 4 MULTIPLAYER RACING
   EXISTING SCRIPT.JS INTEGRATION
================================================== */

(() => {

const el = id => document.getElementById(id);

const client = db;

if (!client) {
  console.error("KEYSTRIKE: Supabase unavailable");
  return;
}

let activeRound = null;
let raceInterval = null;

let raceComplete = false;
let raceRunning = false;

let progressBusy = false;
let progressPending = false;

let lastProgressSent = 0;

let raceChannel = null;
let raceGeneration = 0;

let raceClockOffset = 0;

let resultsRoundId = null;

const RACE_TIMEOUT = 180;
const PROGRESS_INTERVAL = 400;

const raceInput = el("multiplayerInput");

function notify(text, type = "") {
  mpMessage(text, type);
}

function currentRoomId() {
  return mpRoom?.id || null;
}

function currentUserId() {
  return currentUser?.id || null;
}

function isHost() {
  return Boolean(
    mpRoom &&
    currentUser &&
    mpRoom.host_id === currentUser.id
  );
}

function showView(view) {
  el("multiplayerHome").hidden = view !== "home";
  el("multiplayerLobby").hidden = view !== "lobby";
  el("multiplayerRace").hidden = view !== "race";
  el("multiplayerResults").hidden = view !== "results";
}

function playerName(player) {
  return (
    player.profile?.username ||
    "Player " + player.user_id.slice(0, 6)
  );
}

function stopClock() {
  clearInterval(raceInterval);
  raceInterval = null;
}

function resetRaceState() {
  stopClock();

  activeRound = null;

  raceComplete = false;
  raceRunning = false;

  progressBusy = false;
  progressPending = false;

  lastProgressSent = 0;
  resultsRoundId = null;

  raceInput.disabled = true;
  raceInput.value = "";
}

async function databaseTime() {
  /*
    Estimate database clock offset using the
    race round's server-generated timestamp
    indirectly through the HTTP Date header
    when available.

    Date.now() remains the fallback.
  */

  return Date.now() + raceClockOffset;
}

function raceStartMs() {
  return activeRound
    ? new Date(activeRound.started_at).getTime()
    : 0;
}

/* ==================================================
   LOBBY
================================================== */

function renderLobby() {

  if (!mpRoom || !currentUser) return;

  showView("lobby");

  el("lobbyRoomCode").textContent =
    mpRoom.room_code || "------";

  el("lobbyPlayerCount").textContent =
    `${mpPlayers.length} / ${mpRoom.max_players} PLAYERS`;

  const container = el("lobbyPlayers");

  container.replaceChildren();

  for (const player of mpPlayers) {

    const name = playerName(player);

    const card = makeElement(
      "div",
      "lobby-player"
    );

    if (player.is_ready) {
      card.classList.add("ready");
    }

    const avatar = makeElement(
      "div",
      "lobby-avatar"
    );

    safeAvatar(
      avatar,
      player.profile?.avatar_url,
      name[0].toUpperCase()
    );

    const info = makeElement(
      "div",
      "lobby-player-info"
    );

    const username = makeElement(
      "strong",
      "",
      name +
      (player.user_id === currentUser.id
        ? " (YOU)"
        : "")
    );

    const details = makeElement(
      "small",
      "",
      (player.user_id === mpRoom.host_id
        ? "👑 HOST · "
        : "") +
      `⚡ ${player.profile?.best_wpm || 0} WPM`
    );

    info.append(username, details);

    const status = makeElement(
      "span",
      player.is_ready
        ? "lobby-ready-badge ready"
        : "lobby-ready-badge",
      player.is_ready
        ? "✓ READY"
        : "WAITING"
    );

    card.append(avatar, info, status);

    container.appendChild(card);
  }

  for (
    let i = mpPlayers.length;
    i < mpRoom.max_players;
    i++
  ) {

    const empty = makeElement(
      "div",
      "lobby-player",
      "+ Waiting for player..."
    );

    empty.style.opacity = ".45";

    container.appendChild(empty);
  }

  const me = mpPlayers.find(
    p => p.user_id === currentUser.id
  );

  const ready =
    mpPlayers.length >= 2 &&
    mpPlayers.length <= mpRoom.max_players &&
    mpPlayers.every(p => p.is_ready);

  const startButton = el("startMultiplayerButton");

  startButton.hidden = !isHost();

  startButton.disabled = !ready || mpBusy;

  startButton.textContent = "🏁 START RACE →";

  el("toggleReadyButton").textContent =
    me?.is_ready
      ? "✓ READY"
      : "I'M READY";

  el("toggleReadyButton").disabled =
    mpBusy || !me;

  if (mpPlayers.length < 2) {

    el("lobbyStatus").textContent =
      "Waiting for another player...";

  } else if (!ready) {

    el("lobbyStatus").textContent =
      "Waiting for everyone to ready up...";

  } else {

    el("lobbyStatus").textContent =
      "Everyone is ready! Host can start.";

  }

}

/* ==================================================
   START RACE
================================================== */

async function startMultiplayerRace() {

  if (!mpRoom || !currentUser) return;

  if (!isHost()) {
    notify("Only the host can start.", "error");
    return;
  }

  const ready =
    mpPlayers.length >= 2 &&
    mpPlayers.every(p => p.is_ready);

  if (!ready) {
    notify("Everyone must be ready.", "error");
    return;
  }

  const button = el("startMultiplayerButton");

  button.disabled = true;

  notify("Starting multiplayer race...");

  try {

    const roomId = mpRoom.id;

    const { data, error } = await client.rpc(
      "start_multiplayer_race",
      {
        target_room_id: roomId
      }
    );

    if (error) throw error;

    notify("Race started!", "success");

    await mpRefresh();

    if (mpRoom?.id === roomId) {
      await loadActiveRound();
    }

  } catch (error) {

    console.error(error);

    notify(error.message, "error");

    button.disabled = false;
  }

}

/* ==================================================
   LOAD ROUND
================================================== */

async function loadActiveRound() {

  if (
    !mpRoom ||
    mpRoom.status !== "racing" ||
    !mpRoom.current_round_id
  ) return;

  const roundId = mpRoom.current_round_id;

  if (activeRound?.id === roundId) {
    renderTracks();
    return;
  }

  const generation = raceGeneration;

  const { data, error } = await client
    .from("race_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("room_id", mpRoom.id)
    .single();

  if (error) {
    notify(error.message, "error");
    return;
  }

  if (
    generation !== raceGeneration ||
    mpRoom?.current_round_id !== roundId
  ) return;

  resetRaceState();

  activeRound = data;

  prepareRace();

}

/* ==================================================
   PREPARE RACE
================================================== */

function prepareRace() {

  if (!activeRound) return;

  showView("race");

  raceComplete = false;
  raceRunning = false;

  raceInput.value = "";
  raceInput.disabled = true;

  el("multiplayerWpm").textContent = "0";
  el("multiplayerProgress").textContent = "0%";

  el("multiplayerRaceStatus").textContent =
    "Preparing race...";

  el("multiplayerPassage").textContent =
    activeRound.passage;

  renderTracks();

  stopClock();

  raceInterval = setInterval(
    updateRaceClock,
    100
  );

  updateRaceClock();

}

/* ==================================================
   SYNCHRONIZED COUNTDOWN
================================================== */

function updateRaceClock() {

  if (!activeRound || !mpRoom) return;

  const start = raceStartMs();

  const now = Date.now() + raceClockOffset;

  const remaining = start - now;

  if (remaining > 0) {

    raceInput.disabled = true;

    el("multiplayerCountdown").hidden = false;

    el("multiplayerCountdown").textContent =
      Math.ceil(remaining / 1000);

    el("multiplayerRaceStatus").textContent =
      "🏁 RACE STARTING...";

    el("multiplayerRaceTimer").textContent =
      "0s";

    return;
  }

  el("multiplayerCountdown").hidden = true;

  const elapsed = Math.max(
    0,
    Math.floor((now - start) / 1000)
  );

  el("multiplayerRaceTimer").textContent =
    elapsed + "s";

  if (!raceRunning && !raceComplete) {

    const me = mpPlayers.find(
      p => p.user_id === currentUserId()
    );

    if (me?.finished_at) {

      raceComplete = true;

      raceInput.disabled = true;

    } else {

      raceRunning = true;

      raceInput.disabled = false;

      raceInput.focus();

      el("multiplayerRaceStatus").textContent =
        "🏎 RACE IN PROGRESS";

    }

  }

  if (elapsed >= RACE_TIMEOUT) {

    stopClock();

    raceInput.disabled = true;

    raceRunning = false;

    checkRaceCompletion();

  }

}

/* ==================================================
   TRACKS
================================================== */

function renderTracks() {

  if (!mpRoom || !currentUser) return;

  const container = el("multiplayerTracks");

  const existing = new Map();

  container.querySelectorAll(
    "[data-player-id]"
  ).forEach(track => {

    existing.set(
      track.dataset.playerId,
      track
    );

  });

  const fragment = document.createDocumentFragment();

  for (const player of mpPlayers) {

    const name = playerName(player);

    let track = existing.get(player.user_id);

    if (!track) {

      track = makeElement(
        "div",
        "multiplayer-track"
      );

      track.dataset.playerId = player.user_id;

      const label = makeElement(
        "span",
        "multiplayer-racer-name"
      );

      const line = makeElement(
        "div",
        "multiplayer-track-line"
      );

      const fill = makeElement(
        "div",
        "multiplayer-track-fill"
      );

      const car = makeElement(
        "span",
        "multiplayer-car",
        "🏎️"
      );

      line.append(fill, car);

      const progress = makeElement(
        "span",
        "multiplayer-track-progress"
      );

      track.append(label, line, progress);

    }

    track.querySelector(
      ".multiplayer-racer-name"
    ).textContent =
      name +
      (player.user_id === currentUser.id
        ? " (YOU)"
        : "");

    const progress = clamp(
      Number(player.progress) || 0,
      0,
      100
    );

    track.querySelector(
      ".multiplayer-track-fill"
    ).style.width = progress + "%";

    track.querySelector(
      ".multiplayer-track-progress"
    ).textContent =
      `${progress}% · ${player.current_wpm || 0} WPM`;

    fragment.appendChild(track);
  }

  container.replaceChildren(fragment);

  requestAnimationFrame(updateCarPositions);

}

function updateCarPositions() {

  document.querySelectorAll(
    "#multiplayerTracks .multiplayer-track"
  ).forEach(track => {

    const player = mpPlayers.find(
      p => p.user_id === track.dataset.playerId
    );

    if (!player) return;

    const line = track.querySelector(
      ".multiplayer-track-line"
    );

    const car = track.querySelector(
      ".multiplayer-car"
    );

    const distance = Math.max(
      0,
      line.clientWidth - car.offsetWidth - 8
    );

    const progress = clamp(
      Number(player.progress) || 0,
      0,
      100
    );

    car.style.transform =
      `translateX(${distance * progress / 100}px)`;

  });

}

/* ==================================================
   PASSAGE HIGHLIGHTING
================================================== */

function renderPassage() {

  if (!activeRound) return;

  const typed = raceInput.value;

  const passage = activeRound.passage;

  const container = el("multiplayerPassage");

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < passage.length; i++) {

    const character = document.createElement("span");

    character.textContent = passage[i];

    if (i < typed.length) {

      character.className =
        typed[i] === passage[i]
          ? "correct"
          : "incorrect";

    }

    fragment.appendChild(character);
  }

  container.replaceChildren(fragment);

}

/* ==================================================
   LIVE PROGRESS
================================================== */

function getCorrectPrefix() {

  if (!activeRound) return "";

  const typed = raceInput.value;

  const passage = activeRound.passage;

  let correct = 0;

  while (
    correct < typed.length &&
    correct < passage.length &&
    typed[correct] === passage[correct]
  ) {

    correct++;

  }

  return passage.slice(0, correct);

}

function updateLocalStats() {

  if (!activeRound) return;

  const typed = raceInput.value;

  const prefix = getCorrectPrefix();

  const elapsed = Math.max(
    0.1,
    (
      Date.now() +
      raceClockOffset -
      raceStartMs()
    ) / 1000
  );

  const wpm = Math.round(
    (prefix.length / 5) /
    (elapsed / 60)
  );

  const progress = Math.floor(
    prefix.length /
    activeRound.passage.length *
    100
  );

  el("multiplayerWpm").textContent =
    Math.max(0, wpm);

  el("multiplayerProgress").textContent =
    clamp(progress, 0, 100) + "%";

}

async function submitProgress() {

  if (
    !activeRound ||
    !mpRoom ||
    !raceRunning ||
    raceComplete
  ) return;

  if (progressBusy) {

    progressPending = true;
    return;

  }

  progressBusy = true;

  const roomId = mpRoom.id;
  const roundId = activeRound.id;
  const userId = currentUserId();

  const content = getCorrectPrefix();

  try {

    const { data, error } = await client.rpc(
      "submit_race_progress",
      {
        target_room_id: roomId,
        target_round_id: roundId,
        typed_content: content
      }
    );

    if (error) throw error;

    if (
      mpRoom?.id !== roomId ||
      activeRound?.id !== roundId ||
      currentUserId() !== userId
    ) return;

    el("multiplayerWpm").textContent =
      data.wpm;

    el("multiplayerProgress").textContent =
      data.progress + "%";

    const me = mpPlayers.find(
      p => p.user_id === userId
    );

    if (me) {

      me.progress = data.progress;
      me.current_wpm = data.wpm;

    }

    renderTracks();

    if (data.finished) {

      raceComplete = true;
      raceRunning = false;

      raceInput.disabled = true;

      el("multiplayerRaceStatus").textContent =
        "🏁 FINISHED! WAITING FOR PLAYERS...";

      playSound("victory");

      await checkRaceCompletion();

    }

  } catch (error) {

    console.error(
      "Multiplayer progress:",
      error
    );

    if (
      activeRound?.id === roundId &&
      mpRoom?.id === roomId
    ) {
      notify(error.message, "error");
    }

  } finally {

    progressBusy = false;

    if (progressPending && !raceComplete) {

      progressPending = false;

      setTimeout(submitProgress, 100);

    }

  }

}

/* ==================================================
   CHECK COMPLETION
================================================== */

async function checkRaceCompletion() {

  if (!mpRoom || !currentUser) return;

  const roomId = mpRoom.id;

  try {

    const { error } = await client.rpc(
      "finish_multiplayer_race",
      {
        target_room_id: roomId
      }
    );

    if (error) throw error;

    if (mpRoom?.id === roomId) {
      await mpRefresh();
    }

  } catch (error) {

    console.warn(
      "Race completion:",
      error.message
    );

  }

}

/* ==================================================
   RESULTS
================================================== */

async function renderResults() {

  if (!mpRoom?.current_round_id) return;

  const roundId = mpRoom.current_round_id;

  showView("results");

  raceRunning = false;
  raceComplete = true;

  raceInput.disabled = true;

  stopClock();

  if (resultsRoundId === roundId) return;

  const { data, error } = await client.rpc(
    "get_multiplayer_leaderboard",
    {
      target_round_id: roundId
    }
  );

  if (error) {

    notify(error.message, "error");
    return;

  }

  resultsRoundId = roundId;

  const container = el("multiplayerLeaderboard");

  container.replaceChildren();

  for (const result of data || []) {

    const item = makeElement(
      "div",
      "multiplayer-leaderboard-item"
    );

    const position = makeElement(
      "span",
      "multiplayer-position",
      "#" + result.race_position
    );

    const username = makeElement(
      "span",
      "multiplayer-leaderboard-name",
      result.username || "Player"
    );

    const speed = makeElement(
      "span",
      "multiplayer-leaderboard-wpm",
      result.wpm + " WPM"
    );

    item.append(
      position,
      username,
      speed
    );

    container.appendChild(item);
  }

  const winner = data?.[0];

  if (winner) {

    notify(
      "🏆 WINNER: " + winner.username,
      "success"
    );

  } else {

    notify(
      "Race finished. No completed results."
    );

  }

  const again = el("raceAgainButton");

  again.hidden = !isHost();

  again.disabled = false;

}

/* ==================================================
   RACE AGAIN
================================================== */

async function raceAgain() {

  if (!mpRoom || !isHost()) return;

  const button = el("raceAgainButton");

  button.disabled = true;

  try {

    const { error } = await client.rpc(
      "reset_multiplayer_room",
      {
        target_room_id: mpRoom.id
      }
    );

    if (error) throw error;

    resetRaceState();

    notify(
      "Room reset! Everyone must ready up.",
      "success"
    );

    await mpRefresh();

  } catch (error) {

    notify(error.message, "error");

  } finally {

    button.disabled = false;

  }

}

/* ==================================================
   INTEGRATE EXISTING LOBBY RENDERER
================================================== */

mpRender = function () {

  if (!mpRoom || !currentUser) return;

  if (mpRoom.status === "waiting") {

    if (activeRound) {
      resetRaceState();
    }

    renderLobby();

    return;
  }

  if (mpRoom.status === "racing") {

    showView("race");

    if (
      !activeRound ||
      activeRound.id !== mpRoom.current_round_id
    ) {

      loadActiveRound();

    } else {

      renderTracks();

    }

    return;
  }

  if (mpRoom.status === "finished") {

    renderResults();

  }

};

/* ==================================================
   EXISTING CLEANUP INTEGRATION
================================================== */

const originalCleanup = mpCleanup;

mpCleanup = async function () {

  raceGeneration++;

  resetRaceState();

  resultsRoundId = null;

  if (raceChannel) {

    const oldChannel = raceChannel;
    raceChannel = null;

    await client.removeChannel(oldChannel);

  }

  await originalCleanup();

};

/* ==================================================
   EXISTING ROOM ENTRY INTEGRATION
================================================== */

const originalEnter = mpEnter;

mpEnter = async function (roomId) {

  raceGeneration++;

  resetRaceState();

  await originalEnter(roomId);

  if (!mpRoom || mpRoom.id !== roomId) return;

  if (raceChannel) {

    await client.removeChannel(raceChannel);

  }

  raceChannel = client
    .channel(
      "ks-phase4-" +
      roomId +
      "-" +
      Date.now()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "race_rounds",
        filter: "room_id=eq." + roomId
      },
      () => mpRefresh()
    )
    .subscribe();

  await mpRefresh();

};

/* ==================================================
   OVERRIDE PLACEHOLDER BUTTON LISTENERS
================================================== */

el("startMultiplayerButton").addEventListener(
  "click",
  event => {

    event.preventDefault();
    event.stopImmediatePropagation();

    startMultiplayerRace();

  },
  true
);

el("raceAgainButton").addEventListener(
  "click",
  event => {

    event.preventDefault();
    event.stopImmediatePropagation();

    raceAgain();

  },
  true
);

/* ==================================================
   TYPING INPUT
================================================== */

raceInput.addEventListener("input", () => {

  if (
    !raceRunning ||
    raceComplete ||
    !activeRound
  ) return;

  const passage = activeRound.passage;

  if (raceInput.value.length > passage.length) {

    raceInput.value = raceInput.value.slice(
      0,
      passage.length
    );

  }

  renderPassage();

  updateLocalStats();

  const now = Date.now();

  const fullPassage =
    raceInput.value === passage;

  if (
    fullPassage ||
    now - lastProgressSent >= PROGRESS_INTERVAL
  ) {

    lastProgressSent = now;

    submitProgress();

  } else {

    progressPending = true;

  }

});

/* ==================================================
   PERIODIC RACE SYNCHRONIZATION
================================================== */

setInterval(() => {

  if (
    !mpRoom ||
    !currentUser ||
    mpRoom.status !== "racing"
  ) return;

  if (raceRunning && progressPending) {

    progressPending = false;

    submitProgress();

  }

}, 500);


/*
  Periodic completion checks:
  - Handle finished players.
  - Handle timeout.
  - Handle players leaving.
*/

setInterval(() => {

  if (
    !mpRoom ||
    !currentUser ||
    mpRoom.status !== "racing"
  ) return;

  checkRaceCompletion();

}, 5000);


/* ==================================================
   RESIZE
================================================== */

window.addEventListener(
  "resize",
  updateCarPositions
);


/* ==================================================
   VISIBILITY
================================================== */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState === "visible" &&
      mpRoom
    ) {

      mpRefresh();

    }

  }
);


/* ==================================================
   INITIALIZE
================================================== */

console.log(
  "%c🏎 KEYSTRIKE V5 PHASE 4 LOADED",
  "color:#73e0a3;font-size:18px;font-weight:bold"
);

})();

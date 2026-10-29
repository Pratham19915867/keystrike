"use strict";

/* =====================================================
   KEYSTRIKE V5
   MULTIPLAYER PHASE 4 — UPDATED ENGINE

   Features:
   - Host-only race start
   - Room settings
   - Synchronized countdown
   - Shared passage
   - Live progress and WPM
   - Animated tracks
   - Race completion
   - Leaderboard
   - Winner announcement
   - Rematch
   - Realtime synchronization
===================================================== */

(() => {

const el = id => document.getElementById(id);

if (typeof db === "undefined" || !db) {
  console.error("KEYSTRIKE: Supabase unavailable.");
  return;
}

const client = db;

const RACE_TIMEOUT = 180;
const PROGRESS_INTERVAL = 450;
const REFRESH_INTERVAL = 2500;

let activeRound = null;

let clockTimer = null;
let syncTimer = null;
let progressTimer = null;

let raceChannel = null;

let raceRunning = false;
let raceComplete = false;

let progressBusy = false;
let progressPending = false;

let lastProgressSent = 0;
let lastSubmittedLength = 0;

let resultsLoadedFor = null;

let engineGeneration = 0;
let enteringRoom = false;
let startingRace = false;
let resettingRoom = false;

const input = el("multiplayerInput");

/* =====================================================
   UTILITIES
===================================================== */

function notify(text, type = "") {
  mpMessage(text, type);
}

function showView(view) {
  el("multiplayerHome").hidden = view !== "home";
  el("multiplayerLobby").hidden = view !== "lobby";
  el("multiplayerRace").hidden = view !== "race";
  el("multiplayerResults").hidden = view !== "results";
}

function isHost() {
  return Boolean(
    mpRoom &&
    currentUser &&
    mpRoom.host_id === currentUser.id
  );
}

function playerName(player) {
  return (
    player.profile?.username ||
    "Player " + player.user_id.slice(0, 6)
  );
}

function getMyPlayer() {
  return mpPlayers.find(
    player => player.user_id === currentUser?.id
  );
}

function clearRaceTimers() {
  clearInterval(clockTimer);
  clearInterval(syncTimer);
  clearTimeout(progressTimer);

  clockTimer = null;
  syncTimer = null;
  progressTimer = null;
}

function resetRaceState() {
  clearRaceTimers();

  activeRound = null;

  raceRunning = false;
  raceComplete = false;

  progressBusy = false;
  progressPending = false;

  lastProgressSent = 0;
  lastSubmittedLength = 0;

  resultsLoadedFor = null;

  input.disabled = true;
  input.value = "";
}

/* =====================================================
   ROOM SETTINGS
===================================================== */

function getSelectedSettings() {
  return window.KeystrikeRaceSettings?.get() || {
    game_mode: "classic",
    text_mode: "words",
    time_limit: 60,
    max_players: 4,
    custom_passage: null
  };
}

async function saveRoomSettings(roomId) {
  const settings = getSelectedSettings();

  const { error } = await client.rpc(
    "update_race_room_settings",
    {
      target_room_id: roomId,

      selected_game_mode:
        settings.game_mode,

      selected_text_mode:
        settings.text_mode,

      selected_time_limit:
        Number(settings.time_limit),

      selected_max_players:
        Number(settings.max_players),

      selected_custom_passage:
        settings.custom_passage
    }
  );

  if (error) throw error;
}

/* =====================================================
   CREATE ROOM WITH SETTINGS
===================================================== */

async function createConfiguredRoom() {
  if (enteringRoom || mpBusy) return;

  if (!currentUser) {
    openAccount();
    return;
  }

  enteringRoom = true;
  mpBusy = true;

  const button = el("createRoomButton");
  button.disabled = true;

  notify("Creating your multiplayer arena...");

  try {
    const settings = getSelectedSettings();

    if (
      settings.game_mode === "custom" ||
      settings.text_mode === "custom"
    ) {
      const passage = settings.custom_passage || "";

      if (
        passage.trim().length < 30 ||
        passage.length > 1000
      ) {
        throw new Error(
          "Custom passage must contain 30–1000 characters."
        );
      }
    }

    const { data, error } = await client.rpc(
      "create_race_room"
    );

    if (error) throw error;

    const created = Array.isArray(data)
      ? data[0]
      : data;

    if (!created?.room_id) {
      throw new Error("Room creation failed.");
    }

    const roomId = created.room_id;

    try {
      await saveRoomSettings(roomId);
    } catch (settingsError) {
      // Prevent leaving an unwanted room behind.
      await client.rpc("leave_race_room", {
        target_room_id: roomId
      });

      throw settingsError;
    }

    await mpEnter(roomId);

    showToast(
      "🏁 Room created: " + created.code,
      "success"
    );

  } catch (error) {
    console.error("Room creation:", error);

    notify(error.message, "error");
    showToast(error.message, "error");

  } finally {
    enteringRoom = false;
    mpBusy = false;
    button.disabled = false;
  }
}

/* =====================================================
   LOBBY RENDERING
===================================================== */

function renderLobby() {
  if (!mpRoom || !currentUser) return;

  showView("lobby");

  el("lobbyRoomCode").textContent =
    mpRoom.room_code || "------";

  el("lobbyPlayerCount").textContent =
    `${mpPlayers.length} / ${mpRoom.max_players} PLAYERS`;

  const container = el("lobbyPlayers");

  container.replaceChildren();

  mpPlayers.forEach(player => {
    const name = playerName(player);

    const card = makeElement(
      "div",
      "lobby-player"
    );

    card.classList.toggle(
      "ready",
      Boolean(player.is_ready)
    );

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

    info.append(
      makeElement(
        "strong",
        "",
        name +
        (player.user_id === currentUser.id
          ? " (YOU)"
          : "")
      ),

      makeElement(
        "small",
        "",
        (player.user_id === mpRoom.host_id
          ? "👑 HOST · "
          : "") +
        `⚡ ${player.profile?.best_wpm || 0} WPM`
      )
    );

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
  });

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

  const me = getMyPlayer();

  const everyoneReady =
    mpPlayers.length >= 2 &&
    mpPlayers.length <= mpRoom.max_players &&
    mpPlayers.every(p => p.is_ready);

  const start = el("startMultiplayerButton");

  start.hidden = !isHost();

  start.disabled =
    !everyoneReady ||
    startingRace ||
    mpBusy;

  start.textContent = startingRace
    ? "STARTING..."
    : "🏁 START RACE →";

  el("toggleReadyButton").textContent =
    me?.is_ready
      ? "✓ READY"
      : "I'M READY";

  el("toggleReadyButton").disabled =
    !me || mpBusy;

  if (mpPlayers.length < 2) {
    el("lobbyStatus").textContent =
      "Waiting for another player...";
  } else if (!everyoneReady) {
    el("lobbyStatus").textContent =
      "Waiting for everyone to ready up...";
  } else {
    el("lobbyStatus").textContent =
      "✅ Everyone ready! Host can start.";
  }

  const existingSettings = el(
    "ksLobbyModeInfo"
  );

  if (existingSettings) {
    existingSettings.remove();
  }

  const settingsInfo = makeElement(
    "div",
    "ks-mp-settings-summary",
    `🎮 ${(mpRoom.game_mode || "classic").toUpperCase()} · ` +
    `⌨ ${(mpRoom.text_mode || "words").toUpperCase()} · ` +
    `⏱ ${mpRoom.time_limit || 60}s`
  );

  settingsInfo.id = "ksLobbyModeInfo";

  el("lobbyPlayers").before(settingsInfo);
}

/* =====================================================
   START RACE
===================================================== */

async function startMultiplayerRace() {
  if (!mpRoom || !currentUser || startingRace) {
    return;
  }

  if (!isHost()) {
    notify("Only the host can start.", "error");
    return;
  }

  if (
    mpPlayers.length < 2 ||
    !mpPlayers.every(p => p.is_ready)
  ) {
    notify(
      "At least two players must be ready.",
      "error"
    );

    return;
  }

  startingRace = true;

  const button = el("startMultiplayerButton");

  button.disabled = true;
  button.textContent = "STARTING...";

  try {
    const { error } = await client.rpc(
      "start_multiplayer_race",
      {
        target_room_id: mpRoom.id
      }
    );

    if (error) throw error;

    notify("🏁 Race starting!", "success");

    await mpRefresh();

  } catch (error) {
    console.error("Start race:", error);

    notify(error.message, "error");

  } finally {
    startingRace = false;
  }
}

/* =====================================================
   LOAD ACTIVE ROUND
===================================================== */

async function loadActiveRound() {
  if (
    !mpRoom ||
    mpRoom.status !== "racing" ||
    !mpRoom.current_round_id
  ) return;

  const roundId = mpRoom.current_round_id;

  if (activeRound?.id === roundId) {
    updateTracks();
    return;
  }

  const generation = engineGeneration;
  const roomId = mpRoom.id;

  const { data, error } = await client
    .from("race_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("room_id", roomId)
    .single();

  if (error) {
    notify(error.message, "error");
    return;
  }

  if (
    generation !== engineGeneration ||
    mpRoom?.id !== roomId ||
    mpRoom.current_round_id !== roundId
  ) return;

  resetRaceState();

  activeRound = data;

  prepareRace();
}

/* =====================================================
   PREPARE RACE
===================================================== */

function prepareRace() {
  if (!activeRound) return;

  showView("race");

  raceRunning = false;
  raceComplete = false;

  input.value = "";
  input.disabled = true;

  el("multiplayerWpm").textContent = "0";
  el("multiplayerProgress").textContent = "0%";

  el("multiplayerPassage").textContent =
    activeRound.passage;

  el("multiplayerRaceStatus").textContent =
    "Preparing multiplayer race...";

  updateTracks();

  clearInterval(clockTimer);

  clockTimer = setInterval(
    updateRaceClock,
    100
  );

  updateRaceClock();
}

/* =====================================================
   COUNTDOWN AND TIMER
===================================================== */

function updateRaceClock() {
  if (!activeRound || !mpRoom) return;

  const start = new Date(
    activeRound.started_at
  ).getTime();

  const remaining = start - Date.now();

  if (remaining > 0) {
    el("multiplayerCountdown").hidden = false;

    el("multiplayerCountdown").textContent =
      Math.ceil(remaining / 1000);

    el("multiplayerRaceStatus").textContent =
      "🏁 RACE STARTING...";

    el("multiplayerRaceTimer").textContent =
      "0s";

    input.disabled = true;

    return;
  }

  el("multiplayerCountdown").hidden = true;

  const elapsed = Math.max(
    0,
    Math.floor(
      (Date.now() - start) / 1000
    )
  );

  el("multiplayerRaceTimer").textContent =
    elapsed + "s";

  const me = getMyPlayer();

  if (me?.finished_at) {
    raceComplete = true;
    raceRunning = false;

    input.disabled = true;

    el("multiplayerRaceStatus").textContent =
      "🏁 FINISHED! Waiting for other players...";

    return;
  }

  if (!raceRunning && !raceComplete) {
    raceRunning = true;

    input.disabled = false;

    el("multiplayerRaceStatus").textContent =
      "🏎 RACE IN PROGRESS";

    input.focus();
  }

  if (elapsed >= RACE_TIMEOUT) {
    raceRunning = false;
    raceComplete = true;

    input.disabled = true;

    clearInterval(clockTimer);

    checkRaceCompletion();
  }
}

/* =====================================================
   RACE TRACKS
===================================================== */

function updateTracks() {
  if (!mpRoom || !currentUser) return;

  const container = el("multiplayerTracks");

  const existing = new Map();

  container.querySelectorAll(
    "[data-racer-id]"
  ).forEach(track => {
    existing.set(
      track.dataset.racerId,
      track
    );
  });

  const fragment = document.createDocumentFragment();

  mpPlayers.forEach((player, index) => {
    let track = existing.get(player.user_id);

    if (!track) {
      track = makeElement(
        "div",
        "multiplayer-track"
      );

      track.dataset.racerId = player.user_id;

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
        index === 0 ? "🏎️" : "🚗"
      );

      line.append(fill, car);

      const stats = makeElement(
        "span",
        "multiplayer-track-progress"
      );

      track.append(label, line, stats);
    }

    track.querySelector(
      ".multiplayer-racer-name"
    ).textContent =
      playerName(player) +
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
  });

  container.replaceChildren(fragment);

  requestAnimationFrame(updateCarPositions);
}

function updateCarPositions() {
  document.querySelectorAll(
    "#multiplayerTracks .multiplayer-track"
  ).forEach(track => {
    const player = mpPlayers.find(
      p => p.user_id === track.dataset.racerId
    );

    if (!player) return;

    const line = track.querySelector(
      ".multiplayer-track-line"
    );

    const car = track.querySelector(
      ".multiplayer-car"
    );

    const available = Math.max(
      0,
      line.clientWidth - car.offsetWidth - 8
    );

    const progress = clamp(
      Number(player.progress) || 0,
      0,
      100
    );

    car.style.transform =
      `translateX(${available * progress / 100}px)`;
  });
}

/* =====================================================
   PASSAGE RENDERING
===================================================== */

function renderPassage() {
  if (!activeRound) return;

  const typed = input.value;
  const passage = activeRound.passage;

  const container = el("multiplayerPassage");

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < passage.length; i++) {
    const span = document.createElement("span");

    span.textContent = passage[i];

    if (i < typed.length) {
      span.className =
        typed[i] === passage[i]
          ? "correct"
          : "incorrect";
    }

    fragment.appendChild(span);
  }

  container.replaceChildren(fragment);
}

/* =====================================================
   CORRECT PROGRESS
===================================================== */

function correctPrefixLength() {
  if (!activeRound) return 0;

  const typed = input.value;
  const passage = activeRound.passage;

  let correct = 0;

  while (
    correct < typed.length &&
    correct < passage.length &&
    typed[correct] === passage[correct]
  ) {
    correct++;
  }

  return correct;
}

function updateLocalStats() {
  if (!activeRound) return;

  const correct = correctPrefixLength();

  const start = new Date(
    activeRound.started_at
  ).getTime();

  const elapsed = Math.max(
    0.1,
    (Date.now() - start) / 1000
  );

  const wpm = Math.round(
    (correct / 5) /
    (elapsed / 60)
  );

  const progress = Math.floor(
    correct /
    activeRound.passage.length *
    100
  );

  el("multiplayerWpm").textContent =
    Math.max(0, wpm);

  el("multiplayerProgress").textContent =
    clamp(progress, 0, 100) + "%";
}

/* =====================================================
   SUBMIT PROGRESS TO SUPABASE
===================================================== */

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

  const correct = correctPrefixLength();

  if (
    correct === lastSubmittedLength &&
    correct !== activeRound.passage.length
  ) {
    return;
  }

  progressBusy = true;

  const roomId = mpRoom.id;
  const roundId = activeRound.id;
  const userId = currentUser?.id;

  const content =
    activeRound.passage.slice(0, correct);

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
      currentUser?.id !== userId
    ) return;

    lastSubmittedLength = correct;

    el("multiplayerWpm").textContent =
      data.wpm;

    el("multiplayerProgress").textContent =
      data.progress + "%";

    const me = getMyPlayer();

    if (me) {
      me.progress = data.progress;
      me.current_wpm = data.wpm;
    }

    updateTracks();

    if (data.finished) {
      raceComplete = true;
      raceRunning = false;

      input.disabled = true;

      el("multiplayerRaceStatus").textContent =
        "🏁 FINISHED! Waiting for results...";

      playSound("victory");

      await checkRaceCompletion();
    }

  } catch (error) {
    console.error("Race progress:", error);

    notify(error.message, "error");

  } finally {
    progressBusy = false;

    if (progressPending && !raceComplete) {
      progressPending = false;

      clearTimeout(progressTimer);

      progressTimer = setTimeout(
        submitProgress,
        100
      );
    }
  }
}

/* =====================================================
   COMPLETION CHECK
===================================================== */

async function checkRaceCompletion() {
  if (
    !mpRoom ||
    !currentUser ||
    mpRoom.status !== "racing"
  ) return;

  try {
    const { error } = await client.rpc(
      "finish_multiplayer_race",
      {
        target_room_id: mpRoom.id
      }
    );

    if (error) throw error;

    await mpRefresh();

  } catch (error) {
    console.warn(
      "Race completion:",
      error.message
    );
  }
}

/* =====================================================
   LEADERBOARD
===================================================== */

async function renderResults() {
  if (!mpRoom?.current_round_id) return;

  const roundId = mpRoom.current_round_id;

  showView("results");

  raceRunning = false;
  raceComplete = true;

  input.disabled = true;

  clearRaceTimers();

  if (resultsLoadedFor === roundId) return;

  const { data, error } = await client.rpc(
    "get_multiplayer_leaderboard",
    {
      target_round_id: roundId
    }
  );

  if (error) {
    console.error("Leaderboard:", error);

    notify(error.message, "error");
    return;
  }

  resultsLoadedFor = roundId;

  const container = el("multiplayerLeaderboard");

  container.replaceChildren();

  const results = data || [];

  const finishedIds = new Set(
    results.map(result => result.user_id)
  );

  results.forEach(result => {
    const item = makeElement(
      "div",
      "multiplayer-leaderboard-item"
    );

    const medal =
      result.race_position === 1
        ? "🥇"
        : result.race_position === 2
          ? "🥈"
          : result.race_position === 3
            ? "🥉"
            : "🏁";

    const position = makeElement(
      "span",
      "multiplayer-position",
      medal
    );

    const name = makeElement(
      "span",
      "multiplayer-leaderboard-name",
      result.username || "Player"
    );

    const speed = makeElement(
      "span",
      "multiplayer-leaderboard-wpm",
      result.wpm + " WPM"
    );

    item.append(position, name, speed);

    container.appendChild(item);
  });

  // Show participants who did not finish.

  mpPlayers
    .filter(player => !finishedIds.has(player.user_id))
    .forEach(player => {
      const item = makeElement(
        "div",
        "multiplayer-leaderboard-item"
      );

      item.append(
        makeElement(
          "span",
          "multiplayer-position",
          "—"
        ),

        makeElement(
          "span",
          "multiplayer-leaderboard-name",
          playerName(player)
        ),

        makeElement(
          "span",
          "multiplayer-leaderboard-wpm",
          "DNF"
        )
      );

      container.appendChild(item);
    });

  const winner = results[0];

  if (winner) {
    notify(
      "🏆 WINNER: " +
      (winner.username || "Player") +
      " — " +
      winner.wpm +
      " WPM!",
      "success"
    );

    if (winner.user_id === currentUser?.id) {
      playSound("victory");
    }

  } else {
    notify("Race ended without a finisher.");
  }

  const button = el("raceAgainButton");

  button.hidden = !isHost();
  button.disabled = false;
}

/* =====================================================
   RACE AGAIN
===================================================== */

async function raceAgain() {
  if (
    !mpRoom ||
    !isHost() ||
    resettingRoom
  ) return;

  resettingRoom = true;

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
    resettingRoom = false;
    button.disabled = false;
  }
}

/* =====================================================
   RENDER INTEGRATION
===================================================== */

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
      updateTracks();
    }

    return;
  }

  if (mpRoom.status === "finished") {
    renderResults();
  }
};

/* =====================================================
   ROOM ENTRY INTEGRATION
===================================================== */

const originalEnter = mpEnter;

mpEnter = async function (roomId) {
  engineGeneration++;

  resetRaceState();

  await originalEnter(roomId);

  if (!mpRoom || mpRoom.id !== roomId) {
    return;
  }

  if (raceChannel) {
    await client.removeChannel(raceChannel);
    raceChannel = null;
  }

  raceChannel = client
    .channel(
      "ks-v5-racing-" +
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

  clearInterval(syncTimer);

  syncTimer = setInterval(() => {
    if (mpRoom) {
      mpRefresh();
    }
  }, REFRESH_INTERVAL);

  await mpRefresh();
};

/* =====================================================
   ROOM CLEANUP INTEGRATION
===================================================== */

const originalCleanup = mpCleanup;

mpCleanup = async function () {
  engineGeneration++;

  resetRaceState();

  if (raceChannel) {
    const channel = raceChannel;
    raceChannel = null;

    await client.removeChannel(channel);
  }

  await originalCleanup();
};

/* =====================================================
   BUTTON EVENTS
===================================================== */

// Capture-phase listeners prevent the old placeholder
// handlers from displaying their error messages.

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

el("createRoomButton").addEventListener(
  "click",
  event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    createConfiguredRoom();
  },
  true
);

/* =====================================================
   TYPING INPUT
===================================================== */

input.addEventListener("input", () => {
  if (
    !raceRunning ||
    raceComplete ||
    !activeRound
  ) return;

  const passage = activeRound.passage;

  if (input.value.length > passage.length) {
    input.value = input.value.slice(
      0,
      passage.length
    );
  }

  renderPassage();
  updateLocalStats();

  const now = Date.now();

  if (
    input.value === passage ||
    now - lastProgressSent >= PROGRESS_INTERVAL
  ) {
    lastProgressSent = now;

    submitProgress();

  } else {
    progressPending = true;

    clearTimeout(progressTimer);

    progressTimer = setTimeout(() => {
      progressPending = false;
      lastProgressSent = Date.now();

      submitProgress();
    }, PROGRESS_INTERVAL);
  }
});

/* =====================================================
   PERIODIC COMPLETION CHECK
===================================================== */

setInterval(() => {
  if (
    !mpRoom ||
    !currentUser ||
    mpRoom.status !== "racing"
  ) return;

  checkRaceCompletion();
}, 5000);

/* =====================================================
   RESIZE
===================================================== */

window.addEventListener(
  "resize",
  updateCarPositions
);

/* =====================================================
   INITIALIZATION
===================================================== */

console.log(
  "%c🏎 KEYSTRIKE V5 MULTIPLAYER ENGINE READY",
  "color:#73e0a3;font-size:18px;font-weight:bold"
);

})();

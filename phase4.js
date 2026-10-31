"use strict";

/*
=====================================================
 KEYSTRIKE V5 — MULTIPLAYER ENGINE
 OPTIMIZED ROOM CREATION + RACE SYNCHRONIZATION

 Features:
 - Faster room creation UI
 - Immediate room-code preview
 - Non-blocking lobby clock synchronization
 - Controlled refresh requests
 - Host-only race start
 - Shared race passage
 - Synchronized countdown and timer
 - Live WPM and progress
 - Animated racing cars
 - Race rankings and leaderboard
 - Automatic race completion
 - Race again
 - Explicit leave handling
 - Closed-room detection
 - Refresh/reconnect compatibility

 Requires script.js before phase4.js.
=====================================================
*/

(() => {
  const el = id => document.getElementById(id);

  if (typeof db === "undefined" || !db) {
    console.error("KEYSTRIKE: Supabase unavailable");
    return;
  }

  const client = db;
  const input = el("multiplayerInput");

  if (!input) {
    console.error("KEYSTRIKE: Multiplayer input missing");
    return;
  }

  const PROGRESS_INTERVAL = 350;
  const REFRESH_INTERVAL = 1500;
  const CLOCK_SYNC_INTERVAL = 30000;

  let activeRound = null;

  let clockTimer = null;
  let syncTimer = null;
  let progressTimer = null;
  let clockSyncTimer = null;

  let raceChannel = null;

  let raceRunning = false;
  let raceComplete = false;

  let progressBusy = false;
  let progressPending = false;

  let lastProgressSent = 0;
  let lastSubmittedLength = 0;

  let resultsLoadedFor = null;
  let resultsLoadingFor = null;

  let engineGeneration = 0;

  let enteringRoom = false;
  let startingRace = false;
  let resettingRoom = false;
  let leavingRoom = false;

  let loadingRound = false;
  let loadingRoundId = null;

  let refreshing = false;
  let refreshQueued = false;
  let refreshPromise = null;

  let checkingCompletion = false;

  let serverClockOffset = 0;
  let clockSynchronized = false;
  let clockSyncBusy = false;

  let lastError = "";
  let lastErrorAt = 0;

  let closingRoom = false;
  let pendingRoomCode = "";

  /* =====================================================
     HELPERS
  ===================================================== */

  function notify(message, type = "") {
    mpMessage(message, type);
  }

  function reportError(error, prefix = "") {
    const message =
      prefix + (error?.message || String(error));

    console.error("KEYSTRIKE:", message);

    if (
      message !== lastError ||
      Date.now() - lastErrorAt > 5000
    ) {
      lastError = message;
      lastErrorAt = Date.now();

      notify(message, "error");
    }
  }

  function showView(view) {
    const views = {
      home: "multiplayerHome",
      lobby: "multiplayerLobby",
      race: "multiplayerRace",
      results: "multiplayerResults"
    };

    Object.entries(views).forEach(([name, id]) => {
      const node = el(id);

      if (node) {
        node.hidden = name !== view;
      }
    });
  }

  function setCreateFeedback(message, type = "") {
    const feedback = el("ksMpCreateFeedback");

    if (!feedback) return;

    feedback.textContent = message;

    feedback.classList.toggle(
      "ks-mp-create-error",
      type === "error"
    );
  }

  function setCreateButtonLoading(loading) {
    const button = el("createRoomButton");

    if (!button) return;

    button.disabled = loading;

    button.textContent = loading
      ? "⏳ CREATING ROOM..."
      : "CREATE PRIVATE ROOM →";
  }

  function showEarlyRoomCode(code) {
    if (!code) return;

    pendingRoomCode = String(code);

    setCreateFeedback(
      "🔑 ROOM CODE: " +
      pendingRoomCode +
      " · Preparing lobby..."
    );

    const lobbyCode = el("lobbyRoomCode");

    if (lobbyCode) {
      lobbyCode.textContent = pendingRoomCode;
    }
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
      "Player " + String(player.user_id).slice(0, 6)
    );
  }

  function myPlayer() {
    return mpPlayers.find(
      player => player.user_id === currentUser?.id
    );
  }

  function raceLimit() {
    const value = Number(
      activeRound?.time_limit ??
      mpRoom?.time_limit ??
      60
    );

    return [15, 30, 60, 120, 180].includes(value)
      ? value
      : 60;
  }

  /* =====================================================
     SERVER CLOCK
  ===================================================== */

  function serverNow() {
    return Date.now() + serverClockOffset;
  }

  async function synchronizeServerClock() {
    if (!currentUser || clockSyncBusy) return;

    clockSyncBusy = true;

    try {
      const before = Date.now();

      const { data, error } = await client.rpc(
        "keystrike_server_time"
      );

      const after = Date.now();

      if (error) throw error;

      const serverTime = new Date(data).getTime();

      if (!Number.isFinite(serverTime)) {
        throw new Error("Invalid server timestamp");
      }

      const midpoint = (before + after) / 2;

      serverClockOffset = serverTime - midpoint;
      clockSynchronized = true;

    } catch (error) {
      console.warn(
        "Clock sync unavailable:",
        error.message
      );
    } finally {
      clockSyncBusy = false;
    }
  }

  function startTimestamp() {
    return activeRound
      ? new Date(activeRound.started_at).getTime()
      : 0;
  }

  function raceElapsed() {
    if (!activeRound) return 0;

    return Math.max(
      0,
      (serverNow() - startTimestamp()) / 1000
    );
  }

  function timeRemaining() {
    return Math.max(
      0,
      raceLimit() - raceElapsed()
    );
  }

  /* =====================================================
     TIMERS AND STATE
  ===================================================== */

  function clearRaceTimers() {
    clearInterval(clockTimer);
    clearTimeout(progressTimer);

    clockTimer = null;
    progressTimer = null;
  }

  function clearSyncTimer() {
    clearInterval(syncTimer);
    syncTimer = null;
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
    resultsLoadingFor = null;

    loadingRound = false;
    loadingRoundId = null;

    input.value = "";
    input.disabled = true;
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

  /* =====================================================
     CREATE ROOM — OPTIMIZED
  ===================================================== */

  async function createConfiguredRoom() {
    if (enteringRoom || mpBusy) return;

    if (!currentUser) {
      openAccount();
      return;
    }

    enteringRoom = true;
    mpBusy = true;

    setCreateButtonLoading(true);

    let createdRoomId = null;
    let entered = false;

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

      pendingRoomCode = "";

      setCreateFeedback(
        "⏳ Connecting to race server..."
      );

      const createStarted = performance.now();

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

      createdRoomId = created.room_id;

      console.log(
        "KEYSTRIKE room RPC:",
        Math.round(performance.now() - createStarted),
        "ms"
      );

      // Display the code as soon as Supabase returns it.
      showEarlyRoomCode(created.code);

      const settingsStarted = performance.now();

      const { error: settingsError } = await client.rpc(
        "update_race_room_settings",
        {
          target_room_id: createdRoomId,
          selected_game_mode: settings.game_mode,
          selected_text_mode: settings.text_mode,
          selected_time_limit: Number(settings.time_limit),
          selected_max_players: Number(settings.max_players),
          selected_custom_passage:
            settings.custom_passage || null
        }
      );

      if (settingsError) throw settingsError;

      console.log(
        "KEYSTRIKE settings RPC:",
        Math.round(performance.now() - settingsStarted),
        "ms"
      );

      setCreateFeedback(
        "🔑 ROOM CODE: " +
        (pendingRoomCode || "READY") +
        " · Opening lobby..."
      );

      const entryStarted = performance.now();

      await mpEnter(createdRoomId);

      console.log(
        "KEYSTRIKE lobby entry:",
        Math.round(performance.now() - entryStarted),
        "ms"
      );

      if (
        mpRoom?.id !== createdRoomId ||
        !mpPlayers.some(
          player => player.user_id === currentUser?.id
        )
      ) {
        throw new Error(
          "Could not enter the created room."
        );
      }

      entered = true;

      setCreateFeedback("");

      showToast(
        "🏁 Room created: " +
        (created.code || mpRoom.room_code),
        "success"
      );

    } catch (error) {
      reportError(error, "Create room: ");

      setCreateFeedback(
        "⚠ " + (error?.message || "Room creation failed."),
        "error"
      );

      /*
       * Avoid calling leave_race_room automatically.
       * That RPC closes the entire room in this project.
       *
       * If the lobby fails to load after creation,
       * preserve the room for recovery rather than
       * silently closing it.
       */
      if (createdRoomId && !entered) {
        console.warn(
          "Room was created but lobby entry failed:",
          createdRoomId
        );
      }

    } finally {
      enteringRoom = false;
      mpBusy = false;

      setCreateButtonLoading(false);
    }
  }

  /* =====================================================
     LOBBY
  ===================================================== */

  function renderLobby() {
    if (!mpRoom || !currentUser) return;

    showView("lobby");

    el("lobbyRoomCode").textContent =
      mpRoom.room_code ||
      pendingRoomCode ||
      "------";

    el("lobbyPlayerCount").textContent =
      `${mpPlayers.length} / ${mpRoom.max_players} PLAYERS`;

    const container = el("lobbyPlayers");

    container.replaceChildren();

    mpPlayers.forEach(player => {
      const name = playerName(player);

      const card = makeElement(
        "div",
        "lobby-player-card lobby-player"
      );

      card.classList.toggle(
        "ready",
        Boolean(player.is_ready)
      );

      const avatar = makeElement(
        "div",
        "player-avatar lobby-avatar"
      );

      safeAvatar(
        avatar,
        player.profile?.avatar_url,
        name[0]?.toUpperCase() || "K"
      );

      const info = makeElement(
        "div",
        "player-info lobby-player-info"
      );

      info.append(
        makeElement(
          "strong",
          "",
          name +
          (
            player.user_id === currentUser.id
              ? " (YOU)"
              : ""
          )
        ),
        makeElement(
          "small",
          "",
          (
            player.user_id === mpRoom.host_id
              ? "👑 HOST · "
              : ""
          ) +
          `⚡ ${player.profile?.best_wpm || 0} WPM`
        )
      );

      const status = makeElement(
        "span",
        player.is_ready
          ? "lobby-player-ready lobby-ready-badge ready"
          : "lobby-player-waiting lobby-ready-badge",
        player.is_ready
          ? "✓ READY"
          : "WAITING"
      );

      card.append(avatar, info, status);

      container.appendChild(card);
    });

    for (
      let i = mpPlayers.length;
      i < Number(mpRoom.max_players || 4);
      i++
    ) {
      container.appendChild(
        makeElement(
          "div",
          "lobby-player-card lobby-empty-slot",
          "+ Waiting for player..."
        )
      );
    }

    const me = myPlayer();

    const everyoneReady =
      mpPlayers.length >= 2 &&
      mpPlayers.length <= mpRoom.max_players &&
      mpPlayers.every(player => player.is_ready);

    const start = el("startMultiplayerButton");

    start.hidden = !isHost();

    start.disabled =
      !everyoneReady ||
      startingRace ||
      mpBusy;

    start.textContent =
      startingRace
        ? "STARTING..."
        : "🏁 START RACE →";

    const ready = el("toggleReadyButton");

    ready.textContent =
      me?.is_ready
        ? "✓ READY"
        : "I'M READY";

    ready.disabled = !me || mpBusy;

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

    el("ksLobbyModeInfo")?.remove();

    const summary = makeElement(
      "div",
      "ks-mp-settings-summary",
      `🎮 ${(mpRoom.game_mode || "classic").toUpperCase()} · ` +
      `⌨ ${(mpRoom.text_mode || "words").toUpperCase()} · ` +
      `⏱ ${mpRoom.time_limit || 60}s`
    );

    summary.id = "ksLobbyModeInfo";

    container.before(summary);
  }

  /* =====================================================
     START RACE
  ===================================================== */

  async function startMultiplayerRace() {
    if (
      !mpRoom ||
      !currentUser ||
      startingRace
    ) return;

    if (!isHost()) {
      notify(
        "Only the host can start the race.",
        "error"
      );
      return;
    }

    if (
      mpPlayers.length < 2 ||
      !mpPlayers.every(player => player.is_ready)
    ) {
      notify(
        "Everyone must be ready.",
        "error"
      );
      return;
    }

    startingRace = true;

    const button = el("startMultiplayerButton");

    button.disabled = true;

    try {
      // Clock accuracy matters for synchronized races.
      await synchronizeServerClock();

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
      reportError(error, "Start race: ");

    } finally {
      startingRace = false;

      if (mpRoom?.status === "waiting") {
        renderLobby();
      }
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

    if (
      loadingRound &&
      loadingRoundId === roundId
    ) return;

    loadingRound = true;
    loadingRoundId = roundId;

    const generation = engineGeneration;
    const roomId = mpRoom.id;

    try {
      const { data, error } = await client
        .from("race_rounds")
        .select("*")
        .eq("id", roundId)
        .eq("room_id", roomId)
        .single();

      if (error) throw error;

      if (
        generation !== engineGeneration ||
        mpRoom?.id !== roomId ||
        mpRoom.current_round_id !== roundId
      ) return;

      resetRaceState();

      activeRound = data;

      // Race countdown still waits for clock synchronization.
      await synchronizeServerClock();

      if (
        generation !== engineGeneration ||
        mpRoom?.id !== roomId ||
        mpRoom.current_round_id !== roundId ||
        mpRoom.status !== "racing" ||
        activeRound?.id !== roundId
      ) return;

      prepareRace();

    } catch (error) {
      reportError(error, "Load race: ");

    } finally {
      loadingRound = false;
      loadingRoundId = null;
    }
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
      "Preparing race...";

    updateTracks();

    clearInterval(clockTimer);

    clockTimer = setInterval(
      updateRaceClock,
      100
    );

    updateRaceClock();
  }

  /* =====================================================
     COUNTDOWN + RACE CLOCK
  ===================================================== */

  function updateRaceClock() {
    if (
      !activeRound ||
      !mpRoom ||
      mpRoom.status !== "racing"
    ) return;

    const start = startTimestamp();
    const now = serverNow();
    const countdown = start - now;

    const countdownElement =
      el("multiplayerCountdown");

    const timerElement =
      el("multiplayerRaceTimer");

    if (countdown > 0) {
      countdownElement.hidden = false;

      countdownElement.textContent =
        Math.ceil(countdown / 1000);

      timerElement.textContent =
        raceLimit() + "s";

      el("multiplayerRaceStatus").textContent =
        "🏁 RACE STARTING...";

      input.disabled = true;
      return;
    }

    countdownElement.hidden = true;

    const remaining = timeRemaining();

    timerElement.textContent =
      Math.ceil(remaining) + "s";

    const me = myPlayer();

    if (me?.finished_at) {
      raceRunning = false;
      raceComplete = true;

      input.disabled = true;

      el("multiplayerRaceStatus").textContent =
        "🏁 FINISHED! Waiting for results...";

      return;
    }

    if (remaining <= 0) {
      raceRunning = false;
      raceComplete = true;

      input.disabled = true;

      timerElement.textContent = "0s";

      el("multiplayerRaceStatus").textContent =
        "⏱ TIME UP! Calculating results...";

      checkRaceCompletion();
      return;
    }

    if (!raceRunning && !raceComplete) {
      raceRunning = true;
      input.disabled = false;

      el("multiplayerRaceStatus").textContent =
        "🏎 RACE IN PROGRESS";

      input.focus();
    }
  }

  /* =====================================================
     LIVE TRACKS
  ===================================================== */

  function updateTracks() {
    if (!mpRoom || !currentUser) return;

    const container = el("multiplayerTracks");

    if (!container) return;

    const existing = new Map();

    container.querySelectorAll(
      "[data-racer-id]"
    ).forEach(track => {
      existing.set(
        track.dataset.racerId,
        track
      );
    });

    const fragment =
      document.createDocumentFragment();

    const ordered = [...mpPlayers].sort((a, b) => {
      if (a.finished_at && !b.finished_at) return -1;
      if (!a.finished_at && b.finished_at) return 1;

      if (a.finished_at && b.finished_at) {
        return (
          new Date(a.finished_at) -
          new Date(b.finished_at)
        );
      }

      return (
        Number(b.current_wpm || 0) -
        Number(a.current_wpm || 0)
      ) || (
        Number(b.progress || 0) -
        Number(a.progress || 0)
      );
    });

    ordered.forEach((player, index) => {
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
          player.user_id === currentUser.id
            ? "🏎️"
            : "🚗"
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
        `${index + 1}. ${playerName(player)}` +
        (
          player.user_id === currentUser.id
            ? " (YOU)"
            : ""
        );

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
        `${progress}% · ${player.current_wpm || 0} WPM` +
        (player.finished_at ? " · 🏁" : "");

      fragment.appendChild(track);
    });

    container.replaceChildren(fragment);

    requestAnimationFrame(updateCarPositions);
  }

  /* =====================================================
     CAR MOVEMENT
  ===================================================== */

  function updateCarPositions() {
    document.querySelectorAll(
      "#multiplayerTracks .multiplayer-track"
    ).forEach(track => {
      const player = mpPlayers.find(
        item => item.user_id === track.dataset.racerId
      );

      if (!player) return;

      const line = track.querySelector(
        ".multiplayer-track-line"
      );

      const car = track.querySelector(
        ".multiplayer-car"
      );

      if (!line || !car) return;

      const available = Math.max(
        0,
        line.clientWidth - car.offsetWidth - 8
      );

      const progress = clamp(
        Number(player.progress) || 0,
        0,
        100
      );

      car.style.transition =
        "transform 0.45s ease-out";

      car.style.transform =
        `translateX(${available * progress / 100}px)`;
    });
  }

  /* =====================================================
     PASSAGE HIGHLIGHTING
  ===================================================== */

  function renderPassage() {
    if (!activeRound) return;

    const typed = input.value;
    const passage = activeRound.passage;

    const fragment =
      document.createDocumentFragment();

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

    el("multiplayerPassage")
      .replaceChildren(fragment);
  }

  /* =====================================================
     CORRECT PREFIX
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

  /*
   * Existing submit_race_progress RPC accepts the
   * exact correct prefix of the shared passage.
   *
   * Typos must be corrected before the server
   * confirms additional progress.
   */

  /* =====================================================
     LOCAL STATS
  ===================================================== */

  function updateLocalStats() {
    if (!activeRound) return;

    const correct = correctPrefixLength();

    const elapsed = Math.max(
      0.1,
      raceElapsed()
    );

    const wpm = Math.round(
      (correct / 5) / (elapsed / 60)
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
     SUBMIT PROGRESS
  ===================================================== */

  async function submitProgress() {
    if (
      !activeRound ||
      !mpRoom ||
      !raceRunning ||
      raceComplete ||
      !currentUser
    ) return;

    if (progressBusy) {
      progressPending = true;
      return;
    }

    const correct = correctPrefixLength();

    if (correct <= lastSubmittedLength) return;

    progressBusy = true;

    const roomId = mpRoom.id;
    const roundId = activeRound.id;
    const userId = currentUser.id;
    const generation = engineGeneration;

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
        generation !== engineGeneration ||
        mpRoom?.id !== roomId ||
        activeRound?.id !== roundId ||
        currentUser?.id !== userId
      ) return;

      lastSubmittedLength = Math.max(
        lastSubmittedLength,
        correct
      );

      const me = myPlayer();

      if (me) {
        me.progress = Number(data.progress) || 0;
        me.current_wpm = Number(data.wpm) || 0;

        if (data.finished) {
          me.finished_at =
            new Date(serverNow()).toISOString();
        }
      }

      el("multiplayerWpm").textContent =
        data.wpm;

      el("multiplayerProgress").textContent =
        data.progress + "%";

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
      reportError(error, "Progress: ");

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
     RACE COMPLETION
  ===================================================== */

  async function checkRaceCompletion() {
    if (
      !mpRoom ||
      !currentUser ||
      mpRoom.status !== "racing" ||
      checkingCompletion
    ) return;

    checkingCompletion = true;

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
      reportError(
        error,
        "Race completion: "
      );

    } finally {
      checkingCompletion = false;
    }
  }

  /* =====================================================
     RANKING
  ===================================================== */

  function rankPlayers(players, resultMap) {
    return [...players].sort((a, b) => {
      const resultA = resultMap.get(a.user_id);
      const resultB = resultMap.get(b.user_id);

      if (resultA && !resultB) return -1;
      if (!resultA && resultB) return 1;

      if (resultA && resultB) {
        return (
          new Date(resultA.finish_time) -
          new Date(resultB.finish_time)
        );
      }

      const wpmDifference =
        Number(b.current_wpm || 0) -
        Number(a.current_wpm || 0);

      if (wpmDifference !== 0) {
        return wpmDifference;
      }

      const progressDifference =
        Number(b.progress || 0) -
        Number(a.progress || 0);

      if (progressDifference !== 0) {
        return progressDifference;
      }

      return String(a.user_id)
        .localeCompare(String(b.user_id));
    });
  }

  /* =====================================================
     RESULTS
  ===================================================== */

  async function renderResults() {
    if (!mpRoom?.current_round_id) return;

    const roundId = mpRoom.current_round_id;
    const roomId = mpRoom.id;
    const generation = engineGeneration;

    showView("results");

    raceRunning = false;
    raceComplete = true;

    input.disabled = true;

    clearRaceTimers();

    if (
      resultsLoadedFor === roundId ||
      resultsLoadingFor === roundId
    ) return;

    resultsLoadingFor = roundId;

    try {
      const { data, error } = await client.rpc(
        "get_multiplayer_leaderboard",
        {
          target_round_id: roundId
        }
      );

      if (error) throw error;

      if (
        generation !== engineGeneration ||
        mpRoom?.id !== roomId ||
        mpRoom.current_round_id !== roundId ||
        mpRoom.status !== "finished"
      ) return;

      const finishedResults = data || [];

      const resultMap = new Map(
        finishedResults.map(result => [
          result.user_id,
          result
        ])
      );

      const players = rankPlayers(
        mpPlayers,
        resultMap
      );

      const container =
        el("multiplayerLeaderboard");

      container.replaceChildren();

      players.forEach((player, index) => {
        const result = resultMap.get(
          player.user_id
        );

        const item = makeElement(
          "div",
          "multiplayer-leaderboard-item"
        );

        if (index === 0) {
          item.classList.add("winner");
        }

        const medal =
          index === 0 ? "🥇" :
          index === 1 ? "🥈" :
          index === 2 ? "🥉" : "🏁";

        const position = makeElement(
          "span",
          "multiplayer-position",
          medal
        );

        const name = makeElement(
          "span",
          "multiplayer-leaderboard-name",
          result?.username || playerName(player)
        );

        const speed = makeElement(
          "span",
          "multiplayer-leaderboard-wpm",
          `${result?.wpm ?? player.current_wpm ?? 0} WPM · ` +
          (
            result
              ? "FINISHED"
              : `${player.progress || 0}%`
          )
        );

        item.append(position, name, speed);

        container.appendChild(item);
      });

      const winner = players[0];

      if (winner) {
        const winningWpm =
          resultMap.get(winner.user_id)?.wpm ??
          winner.current_wpm ??
          0;

        notify(
          `🏆 WINNER: ${playerName(winner)} — ${winningWpm} WPM!`,
          "success"
        );

        if (winner.user_id === currentUser?.id) {
          playSound("victory");
        }
      } else {
        notify("Race finished.");
      }

      const button = el("raceAgainButton");

      button.hidden = !isHost();
      button.disabled = false;

      resultsLoadedFor = roundId;

    } catch (error) {
      reportError(error, "Leaderboard: ");

    } finally {
      if (resultsLoadingFor === roundId) {
        resultsLoadingFor = null;
      }
    }
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
      reportError(error, "Race again: ");

    } finally {
      resettingRoom = false;
      button.disabled = false;
    }
  }

  /* =====================================================
     CLOSED ROOM HANDLING
  ===================================================== */

  async function handleClosedRoom() {
    if (closingRoom) return;

    closingRoom = true;

    try {
      notify(
        "🔒 This multiplayer room has been closed.",
        "error"
      );

      await mpCleanup();

      showView("home");

    } catch (error) {
      console.warn(
        "Closed room cleanup:",
        error
      );

    } finally {
      closingRoom = false;
    }
  }

  /* =====================================================
     MAIN RENDER
  ===================================================== */

  mpRender = function () {
    if (!mpRoom || !currentUser) return;

    if (mpRoom.status === "closed") {
      handleClosedRoom();
      return;
    }

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
     CONTROLLED REFRESH QUEUE
  ===================================================== */

  const originalRefresh = mpRefresh;

  mpRefresh = function () {
    if (!mpRoom || !currentUser) {
      return Promise.resolve();
    }

    if (refreshing) {
      refreshQueued = true;

      return refreshPromise || Promise.resolve();
    }

    refreshing = true;

    refreshPromise = (async () => {
      try {
        do {
          refreshQueued = false;

          await originalRefresh();

        } while (
          refreshQueued &&
          mpRoom &&
          currentUser
        );

      } finally {
        refreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  /* =====================================================
     ROOM ENTRY — NON-BLOCKING CLOCK SYNC
  ===================================================== */

  const originalEnter = mpEnter;

  mpEnter = async function (roomId) {
    engineGeneration++;

    clearSyncTimer();
    resetRaceState();

    const previousRoomId = mpRoom?.id;

    await originalEnter(roomId);

    if (
      !mpRoom ||
      mpRoom.id !== roomId
    ) return;

    if (raceChannel) {
      const oldChannel = raceChannel;

      raceChannel = null;

      // Channel cleanup does not need to delay the lobby.
      client.removeChannel(oldChannel).catch(error => {
        console.warn(
          "Previous race channel cleanup:",
          error
        );
      });
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

    syncTimer = setInterval(() => {
      if (
        mpRoom?.id === roomId &&
        currentUser
      ) {
        mpRefresh();
      }
    }, REFRESH_INTERVAL);

    /*
     * originalEnter() already calls mpRefresh().
     *
     * Do not block lobby entry with another
     * clock synchronization and refresh.
     */
    synchronizeServerClock();

    console.log(
      "KEYSTRIKE entered room:",
      roomId,
      "previous:",
      previousRoomId || "none"
    );
  };

  /* =====================================================
     CLEANUP
  ===================================================== */

  const originalCleanup = mpCleanup;

  mpCleanup = async function () {
    engineGeneration++;

    clearSyncTimer();
    resetRaceState();

    if (raceChannel) {
      const channel = raceChannel;

      raceChannel = null;

      try {
        await client.removeChannel(channel);
      } catch (error) {
        console.warn(
          "Race channel cleanup:",
          error
        );
      }
    }

    await originalCleanup();
  };

  /* =====================================================
     EXPLICIT LEAVE
  ===================================================== */

  async function leaveMultiplayerRoom() {
    if (
      !mpRoom ||
      !currentUser ||
      leavingRoom
    ) return;

    leavingRoom = true;

    const roomId = mpRoom.id;
    const button = el("leaveRoomButton");

    if (button) button.disabled = true;

    try {
      /*
       * Database function must remain RETURNS VOID.
       * The server is responsible for closing the room.
       */
      const { error } = await client.rpc(
        "leave_race_room",
        {
          target_room_id: roomId
        }
      );

      if (error) throw error;

      await mpCleanup();

      showView("home");

      notify(
        "You left the room. Room closed.",
        "success"
      );

    } catch (error) {
      reportError(error, "Leave room: ");

    } finally {
      leavingRoom = false;

      if (button) button.disabled = false;
    }
  }

  /* =====================================================
     BUTTON EVENTS
  ===================================================== */

  function captureButton(id, handler) {
    const button = el(id);

    if (!button) return;

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        handler();
      },
      true
    );
  }

  captureButton(
    "createRoomButton",
    createConfiguredRoom
  );

  captureButton(
    "startMultiplayerButton",
    startMultiplayerRace
  );

  captureButton(
    "raceAgainButton",
    raceAgain
  );

  captureButton(
    "leaveRoomButton",
    leaveMultiplayerRoom
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
      clearTimeout(progressTimer);

      progressTimer = setTimeout(() => {
        lastProgressSent = Date.now();

        submitProgress();
      }, PROGRESS_INTERVAL);
    }
  });

  /* =====================================================
     AUTOMATIC RACE CHECKS
  ===================================================== */

  setInterval(() => {
    if (
      !mpRoom ||
      !currentUser ||
      mpRoom.status !== "racing"
    ) return;

    checkRaceCompletion();
  }, 2000);

  /* =====================================================
     CLOCK RESYNCHRONIZATION
  ===================================================== */

  clockSyncTimer = setInterval(() => {
    if (currentUser) {
      synchronizeServerClock();
    }
  }, CLOCK_SYNC_INTERVAL);

  synchronizeServerClock();

  /* =====================================================
     VISIBILITY
  ===================================================== */

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState === "visible" &&
        mpRoom
      ) {
        synchronizeServerClock();
        mpRefresh();

        if (activeRound) {
          updateRaceClock();
        }
      }
    }
  );

  /* =====================================================
     RESIZE
  ===================================================== */

  window.addEventListener(
    "resize",
    updateCarPositions
  );

  /* =====================================================
     READY
  ===================================================== */

  console.log(
    "%c🏎 KEYSTRIKE V5 MULTIPLAYER ENGINE READY",
    "color:#73e0a3;font-size:18px;font-weight:bold"
  );

})();

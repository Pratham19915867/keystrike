"use strict";

/*
=====================================================
 KEYSTRIKE V5 — ROOM PRESENCE V2

 STABILITY IMPROVEMENTS

 - 5-second heartbeat
 - 60-second server disconnect grace period
 - Automatic reconnect heartbeat
 - Visibility recovery
 - Room change protection
 - No automatic leave on refresh
 - Mobile-friendly leave button
 - Natural race finish keeps room active
 - Explicit leave closes the room through phase4.js

 Requires script.js and phase4.js.
=====================================================
*/

(() => {

  const $ = id => document.getElementById(id);

  const HEARTBEAT_INTERVAL = 5000;
  const CLEANUP_INTERVAL = 7000;
  const ROOM_CHECK_INTERVAL = 1000;

  let trackedRoomId = null;

  let heartbeatBusy = false;
  let cleanupBusy = false;

  let heartbeatRoomId = null;
  let cleanupRoomId = null;

  let lastHeartbeatAt = 0;
  let lastCleanupAt = 0;

  let initialized = false;

  /* =====================================================
     GLOBAL STATE ACCESS
  ===================================================== */

  function getRoom() {
    return typeof mpRoom !== "undefined"
      ? mpRoom
      : null;
  }

  function getUser() {
    return typeof currentUser !== "undefined"
      ? currentUser
      : null;
  }

  function getClient() {
    return typeof db !== "undefined"
      ? db
      : null;
  }

  function isActiveRoom(room) {
    return Boolean(
      room?.id &&
      room.status !== "closed"
    );
  }

  function sameRoom(roomId) {
    const room = getRoom();

    return Boolean(
      room?.id === roomId &&
      room.status !== "closed"
    );
  }

  /* =====================================================
     ROOM HEARTBEAT
  ===================================================== */

  async function sendHeartbeat(force = false) {
    const room = getRoom();
    const user = getUser();
    const client = getClient();

    if (
      !isActiveRoom(room) ||
      !user ||
      !client
    ) return;

    const roomId = room.id;
    const now = Date.now();

    if (
      heartbeatBusy &&
      heartbeatRoomId === roomId
    ) return;

    if (
      !force &&
      now - lastHeartbeatAt < 3500
    ) return;

    /*
     * Do not overlap requests.
     *
     * A request started for an old room may finish
     * after another room has been opened.
     */
    if (heartbeatBusy) return;

    heartbeatBusy = true;
    heartbeatRoomId = roomId;

    try {
      const { data, error } = await client.rpc(
        "ks_room_heartbeat",
        {
          target_room_id: roomId
        }
      );

      if (error) throw error;

      if (!sameRoom(roomId)) return;

      if (data === false) {
        console.warn(
          "KEYSTRIKE: Room membership no longer active"
        );

        /*
         * Membership may have been removed because
         * the server closed the room.
         */
        if (typeof mpRefresh === "function") {
          await mpRefresh();
        }

        return;
      }

      lastHeartbeatAt = Date.now();

    } catch (error) {
      if (!sameRoom(roomId)) return;

      console.warn(
        "KEYSTRIKE room heartbeat:",
        error.message
      );

    } finally {
      heartbeatBusy = false;
      heartbeatRoomId = null;
    }
  }

  /* =====================================================
     DISCONNECTED PLAYER CLEANUP
  ===================================================== */

  async function checkDisconnectedPlayers(force = false) {
    const room = getRoom();
    const user = getUser();
    const client = getClient();

    if (
      !isActiveRoom(room) ||
      !user ||
      !client
    ) return;

    const roomId = room.id;
    const now = Date.now();

    if (cleanupBusy) return;

    if (
      !force &&
      now - lastCleanupAt < 5000
    ) return;

    cleanupBusy = true;
    cleanupRoomId = roomId;

    try {
      /*
       * Refresh our own heartbeat before checking
       * whether another player has disconnected.
       */
      await sendHeartbeat();

      if (!sameRoom(roomId)) return;

      const { data, error } = await client.rpc(
        "ks_cleanup_disconnected_room",
        {
          target_room_id: roomId
        }
      );

      if (error) throw error;

      if (!sameRoom(roomId)) return;

      lastCleanupAt = Date.now();

      if (data === true) {
        console.log(
          "KEYSTRIKE: Room closed after disconnected player timeout"
        );

        if (typeof mpRefresh === "function") {
          await mpRefresh();
        }
      }

    } catch (error) {
      if (!sameRoom(roomId)) return;

      console.warn(
        "KEYSTRIKE disconnect cleanup:",
        error.message
      );

    } finally {
      cleanupBusy = false;
      cleanupRoomId = null;
    }
  }

  /* =====================================================
     MOBILE LEAVE BUTTON
  ===================================================== */

  function createMobileLeaveButton() {
    if ($("ksMobileLeaveButton")) return;

    const button = document.createElement("button");

    button.id = "ksMobileLeaveButton";
    button.type = "button";

    button.textContent = "🚪 LEAVE ROOM";

    button.setAttribute(
      "aria-label",
      "Leave and close multiplayer room"
    );

    button.style.cssText = `
      position: fixed;
      bottom: max(18px, env(safe-area-inset-bottom));
      right: 16px;
      z-index: 9990;
      padding: 13px 18px;
      border: 1px solid #ff6868;
      border-radius: 12px;
      background: linear-gradient(
        135deg,
        #e34753,
        #b92539
      );
      color: #ffffff;
      font-family: Inter, sans-serif;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .3px;
      cursor: pointer;
      box-shadow: 0 8px 30px rgba(0,0,0,.45);
      display: none;
      max-width: calc(100vw - 32px);
    `;

    button.addEventListener("click", () => {
      const room = getRoom();

      if (!isActiveRoom(room)) return;

      const confirmed = confirm(
        "Leave this multiplayer room?\n\n" +
        "⚠ The room will close for ALL players."
      );

      if (!confirmed) return;

      /*
       * phase4.js handles explicit leave through
       * the original leave button.
       *
       * Do not call the RPC from two places.
       */
      const originalButton = $("leaveRoomButton");

      if (
        originalButton &&
        !originalButton.disabled
      ) {
        originalButton.click();
      } else {
        alert(
          "Leave is temporarily unavailable. Please try again."
        );
      }
    });

    document.body.appendChild(button);
  }

  /* =====================================================
     MOBILE LEAVE VISIBILITY
  ===================================================== */

  function updateMobileLeaveButton() {
    const button = $("ksMobileLeaveButton");

    if (!button) return;

    const room = getRoom();

    const mobile =
      window.innerWidth <= 768;

    const active =
      isActiveRoom(room);

    button.style.display =
      mobile && active
        ? "block"
        : "none";
  }

  /* =====================================================
     ROOM TRACKING
  ===================================================== */

  function presenceLoop() {
    const room = getRoom();
    const user = getUser();

    if (
      !isActiveRoom(room) ||
      !user
    ) {
      trackedRoomId = null;
      updateMobileLeaveButton();
      return;
    }

    if (trackedRoomId !== room.id) {
      trackedRoomId = room.id;

      lastHeartbeatAt = 0;
      lastCleanupAt = 0;

      sendHeartbeat(true);
    }

    updateMobileLeaveButton();
  }

  /* =====================================================
     RECONNECT RECOVERY
  ===================================================== */

  function recoverConnection() {
    const room = getRoom();

    if (!isActiveRoom(room)) return;

    console.log(
      "KEYSTRIKE: Recovering multiplayer connection"
    );

    sendHeartbeat(true);

    if (typeof mpRefresh === "function") {
      mpRefresh();
    }
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  function initializePresenceFix() {
    if (initialized) return;

    initialized = true;

    createMobileLeaveButton();

    setInterval(
      presenceLoop,
      ROOM_CHECK_INTERVAL
    );

    setInterval(() => {
      if (
        isActiveRoom(getRoom()) &&
        getUser()
      ) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);

    setInterval(() => {
      if (
        isActiveRoom(getRoom()) &&
        getUser()
      ) {
        checkDisconnectedPlayers();
      }
    }, CLEANUP_INTERVAL);

    window.addEventListener(
      "online",
      recoverConnection
    );

    window.addEventListener(
      "focus",
      recoverConnection
    );

    window.addEventListener(
      "resize",
      updateMobileLeaveButton
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.visibilityState === "visible"
        ) {
          recoverConnection();
        }
      }
    );

    presenceLoop();

    console.log(
      "🟢 KEYSTRIKE ROOM PRESENCE V2 READY"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePresenceFix,
      { once: true }
    );
  } else {
    initializePresenceFix();
  }

})();

"use strict";

/*
==========================================
 KEYSTRIKE V5
 ROOM PRESENCE + MOBILE LEAVE FIX

 - Heartbeat every 5 seconds
 - Detect disconnected players
 - Close room after inactivity
 - Mobile-friendly leave button
 - Does not modify existing typing tests
==========================================
*/

(() => {

const $ = id => document.getElementById(id);

const HEARTBEAT_INTERVAL = 5000;
const CLEANUP_INTERVAL = 7000;

let trackedRoomId = null;
let heartbeatBusy = false;
let cleanupBusy = false;

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

/* ======================================
   ROOM HEARTBEAT
====================================== */

async function sendHeartbeat() {
  const room = getRoom();
  const user = getUser();
  const client = getClient();

  if (
    !room?.id ||
    !user ||
    !client ||
    heartbeatBusy ||
    room.status === "closed"
  ) return;

  heartbeatBusy = true;

  try {
    const { data, error } = await client.rpc(
      "ks_room_heartbeat",
      {
        target_room_id: room.id
      }
    );

    if (error) throw error;

    if (data === false) {
      console.warn(
        "KEYSTRIKE: Room membership no longer active"
      );
    }

  } catch (error) {
    console.warn(
      "KEYSTRIKE heartbeat:",
      error.message
    );

  } finally {
    heartbeatBusy = false;
  }
}

/* ======================================
   DISCONNECT CLEANUP
====================================== */

async function checkDisconnectedPlayers() {
  const room = getRoom();
  const client = getClient();

  if (
    !room?.id ||
    !getUser() ||
    !client ||
    cleanupBusy ||
    room.status === "closed"
  ) return;

  cleanupBusy = true;

  const roomId = room.id;

  try {
    const { data, error } = await client.rpc(
      "ks_cleanup_disconnected_room",
      {
        target_room_id: roomId
      }
    );

    if (error) throw error;

    if (data === true) {
      console.log(
        "KEYSTRIKE: Room closed because a player disconnected"
      );

      if (
        getRoom()?.id === roomId &&
        typeof mpRefresh === "function"
      ) {
        await mpRefresh();
      }
    }

  } catch (error) {
    console.warn(
      "KEYSTRIKE cleanup:",
      error.message
    );

  } finally {
    cleanupBusy = false;
  }
}

/* ======================================
   MOBILE LEAVE BUTTON
====================================== */

function createMobileLeaveButton() {
  if ($("ksMobileLeaveButton")) return;

  const button = document.createElement("button");

  button.id = "ksMobileLeaveButton";

  button.type = "button";

  button.textContent = "🚪 LEAVE ROOM";

  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9990;
    padding: 14px 20px;
    border: 1px solid #ff6868;
    border-radius: 12px;
    background: #dc3545;
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 8px 30px #0007;
    display: none;
    max-width: calc(100vw - 40px);
  `;

  button.addEventListener("click", () => {
    const room = getRoom();

    if (!room) return;

    const confirmed = confirm(
      "Leave this room?\n\n" +
      "The room will close for ALL players."
    );

    if (!confirmed) return;

    /*
      Use the existing LEAVE button.

      phase4.js already intercepts that click
      and calls leave_race_room.
    */

    const originalButton = $("leaveRoomButton");

    if (originalButton && !originalButton.disabled) {
      originalButton.click();
    } else {
      alert(
        "Leave is temporarily unavailable. Please try again."
      );
    }
  });

  document.body.appendChild(button);
}

/* ======================================
   BUTTON VISIBILITY
====================================== */

function updateMobileLeaveButton() {
  const button = $("ksMobileLeaveButton");

  if (!button) return;

  const room = getRoom();

  const mobile =
    window.innerWidth <= 768;

  const activeRoom =
    Boolean(
      room?.id &&
      room.status !== "closed"
    );

  button.style.display =
    mobile && activeRoom
      ? "block"
      : "none";
}

/* ======================================
   PRESENCE LOOP
====================================== */

function presenceLoop() {
  const room = getRoom();

  if (!room?.id || !getUser()) {
    trackedRoomId = null;
    updateMobileLeaveButton();
    return;
  }

  if (trackedRoomId !== room.id) {
    trackedRoomId = room.id;

    // Mark presence as soon as the room loads.
    sendHeartbeat();
  }

  updateMobileLeaveButton();
}

/* ======================================
   INITIALIZE
====================================== */

function initializePresenceFix() {
  createMobileLeaveButton();

  setInterval(
    presenceLoop,
    1000
  );

  setInterval(() => {
    if (getRoom() && getUser()) {
      sendHeartbeat();
    }
  }, HEARTBEAT_INTERVAL);

  setInterval(() => {
    if (getRoom() && getUser()) {
      checkDisconnectedPlayers();
    }
  }, CLEANUP_INTERVAL);

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
        sendHeartbeat();

        if (typeof mpRefresh === "function") {
          mpRefresh();
        }
      }
    }
  );

  console.log(
    "🟢 KEYSTRIKE ROOM PRESENCE READY"
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializePresenceFix
  );
} else {
  initializePresenceFix();
}

})();

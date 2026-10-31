"use strict";

/*
=======================================================
 KEYSTRIKE V5 — REALTIME RACE INVITATIONS

 Features:
 - Dedicated Supabase invitations
 - Realtime notifications
 - Notifications on every page
 - Invitation sound
 - Mobile-friendly popup
 - Accept and join
 - Decline
 - Invitation expiry
 - Correct room verification
 - Accepted friends only
 - Existing private chat invites preserved
 - Login/logout subscription lifecycle

 Requires:
 - script.js
 - phase4.js
 - ks_race_invitations SQL migration

 Status: Implementation — browser testing required
=======================================================
*/

(() => {

const $ = id => document.getElementById(id);

const INVITE_PREFIX = "🏎 KEYSTRIKE RACE INVITE";

const CODE_PATTERN =
  /Room code:\s*([A-Z0-9]{6})/i;

const AUTH_CHECK_INTERVAL = 1000;

const INVITE_REFRESH_INTERVAL = 15000;

const POPUP_CHECK_INTERVAL = 1000;

let inviteChannel = null;

let subscribedUserId = null;

let inviteGeneration = 0;

let inviteBusy = false;

let joiningInvite = false;

let notificationBusy = false;

let activeInvitation = null;

let invitations = new Map();

let notificationQueue = [];

let shownInvitations = new Set();

let inviteAudioContext = null;


/* =====================================================
   HELPERS
===================================================== */

function getClient() {
  return typeof db !== "undefined"
    ? db
    : null;
}

function getUser() {
  return typeof currentUser !== "undefined"
    ? currentUser
    : null;
}

function getRoom() {
  return typeof mpRoom !== "undefined"
    ? mpRoom
    : null;
}

function getFriends() {
  return typeof getAcceptedFriends === "function"
    ? getAcceptedFriends()
    : [];
}

function toast(message, type = "") {
  if (typeof showToast === "function") {
    showToast(message, type);
  }
}

function make(tag, className = "", text = "") {
  const node = document.createElement(tag);

  node.className = className;
  node.textContent = text;

  return node;
}

function isValidCode(code) {
  return /^[A-Z0-9]{6}$/.test(code);
}

function getInvitationCode(text) {
  if (
    typeof text !== "string" ||
    !text.includes(INVITE_PREFIX)
  ) {
    return null;
  }

  const match = text.match(CODE_PATTERN);

  return match
    ? match[1].toUpperCase()
    : null;
}

function invitationExpired(invitation) {
  if (!invitation?.expires_at) return true;

  return (
    new Date(invitation.expires_at).getTime() <=
    Date.now()
  );
}

function remainingSeconds(invitation) {
  return Math.max(
    0,
    Math.ceil(
      (
        new Date(invitation.expires_at).getTime() -
        Date.now()
      ) / 1000
    )
  );
}


/* =====================================================
   NOTIFICATION SOUND
===================================================== */

function playInviteSound() {
  try {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    inviteAudioContext ||= new AudioContextClass();

    if (inviteAudioContext.state === "suspended") {
      inviteAudioContext.resume();
    }

    const context = inviteAudioContext;

    const now = context.currentTime;

    const notes = [
      { frequency: 660, delay: 0 },
      { frequency: 880, delay: 0.12 },
      { frequency: 1100, delay: 0.24 }
    ];

    notes.forEach(note => {

      const oscillator = context.createOscillator();

      const gain = context.createGain();

      oscillator.type = "sine";

      oscillator.frequency.value = note.frequency;

      const start = now + note.delay;

      gain.gain.setValueAtTime(0.001, start);

      gain.gain.exponentialRampToValueAtTime(
        0.08,
        start + 0.02
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + 0.16
      );

      oscillator.connect(gain);

      gain.connect(context.destination);

      oscillator.start(start);

      oscillator.stop(start + 0.18);

    });

  } catch (error) {
    console.warn("Invitation sound unavailable:", error);
  }
}


/* =====================================================
   STYLES
===================================================== */

function installStyles() {
  if ($("ksRaceInviteStyles")) return;

  const style = document.createElement("style");

  style.id = "ksRaceInviteStyles";

  style.textContent = `

    .ks-invite-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 16px;

      background: rgba(3, 7, 15, .82);
      backdrop-filter: blur(12px);
    }

    .ks-invite-overlay[hidden] {
      display: none !important;
    }

    .ks-invite-modal {
      width: 100%;
      max-width: 470px;

      max-height: min(85vh, 700px);
      overflow-y: auto;

      padding: 24px;

      background: var(--surface, #151a22);
      color: var(--text, #e9edf5);

      border: 1px solid var(--border, #2a3240);
      border-radius: 20px;

      box-shadow: 0 25px 100px #0009;
    }

    .ks-invite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      margin-bottom: 15px;
    }

    .ks-invite-header h2 {
      font-size: 20px;
      font-weight: 900;
    }

    .ks-invite-close {
      width: 36px;
      height: 36px;

      background: var(--surface2, #1c222d);
      color: var(--text, white);

      border: 1px solid var(--border, #2a3240);
      border-radius: 9px;
    }

    .ks-invite-description {
      color: var(--muted, #828b9b);

      font-size: 12px;
      line-height: 1.7;

      margin-bottom: 18px;
    }

    .ks-invite-friend-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .ks-invite-friend {
      display: flex;
      align-items: center;
      gap: 11px;

      min-width: 0;

      padding: 12px;

      background: var(--surface2, #1c222d);

      border: 1px solid var(--border, #2a3240);
      border-radius: 12px;
    }

    .ks-invite-avatar {
      width: 43px;
      height: 43px;
      flex-shrink: 0;

      display: grid;
      place-items: center;

      overflow: hidden;

      background: linear-gradient(
        135deg,
        var(--accent, #65a8ff),
        var(--accent2, #a879ff)
      );

      color: #08101d;

      border-radius: 11px;
      font-weight: 900;
    }

    .ks-invite-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ks-invite-friend-info {
      flex: 1;
      min-width: 0;
    }

    .ks-invite-friend-info strong {
      display: block;

      font-size: 12px;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ks-invite-friend-info small {
      display: block;

      margin-top: 5px;

      font-size: 10px;
      color: var(--muted, #828b9b);

      overflow-wrap: anywhere;
    }

    .ks-invite-send {
      padding: 10px 13px;

      background: var(--accent, #65a8ff);
      color: #08101d;

      border: 0;
      border-radius: 8px;

      font-size: 10px;
      font-weight: 900;
    }

    .ks-invite-empty {
      padding: 25px 15px;

      text-align: center;

      color: var(--muted, #828b9b);

      font-size: 12px;
      line-height: 1.7;
    }

    .ks-invite-lobby-btn {
      display: block;

      width: 100%;

      margin: 15px 0;

      padding: 13px;

      background: var(--surface2, #1c222d);
      color: var(--accent, #65a8ff);

      border: 1px solid var(--accent, #65a8ff);
      border-radius: 10px;

      font-size: 12px;
      font-weight: 900;
    }

    .ks-race-challenge {
      position: fixed;

      top: 50%;
      left: 50%;

      transform: translate(-50%, -50%);

      z-index: 20001;

      width: min(420px, calc(100vw - 28px));

      padding: 28px 23px;

      background:
        radial-gradient(
          circle at top,
          color-mix(
            in srgb,
            var(--accent, #65a8ff) 15%,
            transparent
          ),
          transparent 65%
        ),
        var(--surface, #151a22);

      color: var(--text, #e9edf5);

      border: 1px solid var(--accent, #65a8ff);
      border-radius: 22px;

      box-shadow:
        0 30px 100px #000b,
        0 0 40px color-mix(
          in srgb,
          var(--accent, #65a8ff) 12%,
          transparent
        );

      text-align: center;
    }

    .ks-race-challenge[hidden] {
      display: none !important;
    }

    .ks-challenge-backdrop {
      position: fixed;
      inset: 0;

      z-index: 20000;

      background: rgba(0, 0, 0, .78);
      backdrop-filter: blur(9px);
    }

    .ks-challenge-backdrop[hidden] {
      display: none !important;
    }

    .ks-challenge-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .ks-challenge-title {
      color: var(--accent, #65a8ff);

      font-size: 13px;
      font-weight: 900;

      letter-spacing: 2px;

      margin-bottom: 15px;
    }

    .ks-challenge-sender {
      font-size: 19px;
      font-weight: 900;

      overflow-wrap: anywhere;

      margin-bottom: 12px;
    }

    .ks-challenge-room {
      padding: 13px;

      background: var(--surface2, #1c222d);

      border: 1px solid var(--border, #2a3240);
      border-radius: 10px;

      font-family: monospace;
      font-size: 18px;
      font-weight: 900;

      letter-spacing: 2px;

      margin-bottom: 13px;
    }

    .ks-challenge-expiry {
      color: var(--muted, #828b9b);

      font-size: 11px;

      margin-bottom: 20px;
    }

    .ks-challenge-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .ks-challenge-accept,
    .ks-challenge-decline {
      min-height: 45px;

      padding: 10px;

      border-radius: 10px;

      font-size: 11px;
      font-weight: 900;
    }

    .ks-challenge-accept {
      background: var(--accent, #65a8ff);
      color: #08101d;
      border: 0;
    }

    .ks-challenge-decline {
      background: var(--surface2, #1c222d);
      color: var(--text, white);

      border: 1px solid var(--border, #2a3240);
    }

    .ks-chat-join-race {
      margin-top: 7px;

      padding: 9px 13px;

      background: var(--accent, #65a8ff);
      color: #08101d;

      border: 0;
      border-radius: 8px;

      font-size: 10px;
      font-weight: 900;
    }

    @media (max-width: 480px) {

      .ks-invite-modal {
        padding: 18px;
      }

      .ks-race-challenge {
        padding: 23px 17px;
      }

      .ks-challenge-sender {
        font-size: 17px;
      }

      .ks-challenge-actions {
        grid-template-columns: 1fr;
      }

      .ks-invite-friend {
        padding: 9px;
      }

      .ks-invite-send {
        padding: 9px;
      }

    }

  `;

  document.head.appendChild(style);
}


/* =====================================================
   FRIEND INVITE MODAL
===================================================== */

function createInviteModal() {
  if ($("ksInviteOverlay")) return;

  const overlay = make(
    "div",
    "ks-invite-overlay"
  );

  overlay.id = "ksInviteOverlay";
  overlay.hidden = true;

  const modal = make(
    "div",
    "ks-invite-modal"
  );

  const header = make(
    "div",
    "ks-invite-header"
  );

  const title = make(
    "h2",
    "",
    "👥 Invite Your Friends"
  );

  const close = make(
    "button",
    "ks-invite-close",
    "✕"
  );

  close.type = "button";

  close.addEventListener(
    "click",
    closeInviteModal
  );

  header.append(title, close);

  const description = make(
    "p",
    "ks-invite-description",
    "Challenge your friends to a live multiplayer race."
  );

  const list = make(
    "div",
    "ks-invite-friend-list"
  );

  list.id = "ksInviteFriendList";

  modal.append(
    header,
    description,
    list
  );

  overlay.appendChild(modal);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeInviteModal();
    }
  });

  document.body.appendChild(overlay);
}

function closeInviteModal() {
  const overlay = $("ksInviteOverlay");

  if (overlay) {
    overlay.hidden = true;
  }
}


/* =====================================================
   SEND INVITATION
===================================================== */

async function sendInvitation(friend, button = null) {
  const room = getRoom();

  const user = getUser();

  const client = getClient();

  if (
    !room?.id ||
    !user ||
    !client ||
    inviteBusy
  ) {
    return false;
  }

  if (room.status !== "waiting") {
    toast(
      "Invitations are only available in waiting rooms.",
      "error"
    );

    return false;
  }

  if (!friend?.id || friend.id === user.id) {
    toast("Invalid recipient.", "error");
    return false;
  }

  const accepted = getFriends().some(
    item => item.id === friend.id
  );

  if (!accepted) {
    toast(
      "You can only invite accepted friends.",
      "error"
    );

    return false;
  }

  inviteBusy = true;

  if (button) {
    button.disabled = true;
    button.textContent = "SENDING...";
  }

  try {

    const { data, error } = await client.rpc(
      "ks_send_race_invitation",
      {
        p_room_id: room.id,
        p_receiver_id: friend.id
      }
    );

    if (error) throw error;

    if (!data) {
      throw new Error("Invitation ID missing.");
    }

    /*
      Preserve existing private chat invitation messages.

      This is secondary to the dedicated invitation
      record. Failure here must not cancel the
      already-created realtime invitation.
    */

    const message =
      `${INVITE_PREFIX}\n` +
      `Room code: ${room.room_code}\n` +
      `Join my KEYSTRIKE multiplayer race!`;

    const { error: chatError } = await client
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: friend.id,
        content: message
      });

    if (chatError) {
      console.warn(
        "Invitation sent; chat message unavailable:",
        chatError.message
      );
    }

    if (button) {
      button.textContent = "✓ INVITED";
    }

    toast(
      `🏎 Race invitation sent to ${friend.username}!`,
      "success"
    );

    return true;

  } catch (error) {

    console.error(
      "KEYSTRIKE invitation:",
      error
    );

    toast(error.message, "error");

    if (button) {
      button.disabled = false;
      button.textContent = "INVITE";
    }

    return false;

  } finally {
    inviteBusy = false;
  }
}

window.KeystrikeSendRaceInvite = sendInvitation;


/* =====================================================
   INVITE FRIENDS LIST
===================================================== */

function openInviteModal() {
  const room = getRoom();

  if (
    !room?.id ||
    room.status !== "waiting"
  ) {
    toast(
      "Create a waiting room before inviting friends.",
      "error"
    );

    return;
  }

  createInviteModal();

  const container = $("ksInviteFriendList");

  container.replaceChildren();

  const friends = [...getFriends()];

  const presence =
    window.KeystrikePresence;

  friends.sort((a, b) => {

    const aOnline =
      presence?.isOnline?.(a.id) ? 1 : 0;

    const bOnline =
      presence?.isOnline?.(b.id) ? 1 : 0;

    return bOnline - aOnline ||
      (a.username || "").localeCompare(
        b.username || ""
      );
  });

  if (!friends.length) {

    container.appendChild(
      make(
        "div",
        "ks-invite-empty",
        "No accepted friends yet. Add friends from Social Hub!"
      )
    );

  }

  friends.forEach(friend => {

    const row = make(
      "div",
      "ks-invite-friend"
    );

    const avatar = make(
      "div",
      "ks-invite-avatar"
    );

    if (typeof safeAvatar === "function") {

      safeAvatar(
        avatar,
        friend.avatar_url,
        friend.username?.[0]?.toUpperCase() || "K"
      );

    } else {

      avatar.textContent =
        friend.username?.[0]?.toUpperCase() || "K";

    }

    const info = make(
      "div",
      "ks-invite-friend-info"
    );

    const name = make(
      "strong",
      "",
      friend.username || "Player"
    );

    const statusText =
      presence?.get?.(friend)?.text ||
      `⚡ ${friend.best_wpm || 0} WPM`;

    const status = make(
      "small",
      "",
      statusText
    );

    info.append(name, status);

    const button = make(
      "button",
      "ks-invite-send",
      "INVITE"
    );

    button.type = "button";

    button.addEventListener("click", () => {
      sendInvitation(friend, button);
    });

    row.append(
      avatar,
      info,
      button
    );

    container.appendChild(row);

  });

  $("ksInviteOverlay").hidden = false;
}


/* =====================================================
   LOBBY INVITE BUTTON
===================================================== */

function updateInviteButton() {
  const lobby = $("multiplayerLobby");

  if (!lobby) return;

  let button = $("ksInviteFriendsButton");

  if (!button) {

    button = make(
      "button",
      "ks-invite-lobby-btn",
      "👥 INVITE FRIENDS"
    );

    button.id = "ksInviteFriendsButton";

    button.type = "button";

    button.addEventListener(
      "click",
      openInviteModal
    );

    const players = $("lobbyPlayers");

    if (players) {
      players.before(button);
    } else {
      lobby.prepend(button);
    }

  }

  const room = getRoom();

  button.hidden =
    !room ||
    room.status !== "waiting";
}


/* =====================================================
   GLOBAL RACE CHALLENGE POPUP
===================================================== */

function createChallengePopup() {
  if ($("ksRaceChallenge")) return;

  const backdrop = make(
    "div",
    "ks-challenge-backdrop"
  );

  backdrop.id = "ksChallengeBackdrop";
  backdrop.hidden = true;

  const popup = make(
    "div",
    "ks-race-challenge"
  );

  popup.id = "ksRaceChallenge";

  popup.hidden = true;

  popup.setAttribute(
    "role",
    "dialog"
  );

  popup.setAttribute(
    "aria-modal",
    "true"
  );

  popup.setAttribute(
    "aria-label",
    "Race invitation"
  );

  const icon = make(
    "div",
    "ks-challenge-icon",
    "🏎️"
  );

  const title = make(
    "div",
    "ks-challenge-title",
    "RACE CHALLENGE"
  );

  const sender = make(
    "div",
    "ks-challenge-sender"
  );

  sender.id = "ksChallengeSender";

  const room = make(
    "div",
    "ks-challenge-room"
  );

  room.id = "ksChallengeRoom";

  const expiry = make(
    "div",
    "ks-challenge-expiry"
  );

  expiry.id = "ksChallengeExpiry";

  const actions = make(
    "div",
    "ks-challenge-actions"
  );

  const accept = make(
    "button",
    "ks-challenge-accept",
    "✅ ACCEPT & JOIN"
  );

  accept.id = "ksChallengeAccept";
  accept.type = "button";

  const decline = make(
    "button",
    "ks-challenge-decline",
    "✕ DECLINE"
  );

  decline.id = "ksChallengeDecline";
  decline.type = "button";

  accept.addEventListener(
    "click",
    acceptInvitation
  );

  decline.addEventListener(
    "click",
    declineInvitation
  );

  actions.append(accept, decline);

  popup.append(
    icon,
    title,
    sender,
    room,
    expiry,
    actions
  );

  document.body.append(
    backdrop,
    popup
  );
}

function hideChallenge() {
  $("ksRaceChallenge").hidden = true;

  $("ksChallengeBackdrop").hidden = true;

  activeInvitation = null;

  showNextInvitation();
}

function showNextInvitation() {
  if (activeInvitation || joiningInvite) return;

  while (notificationQueue.length) {

    const invitation =
      notificationQueue.shift();

    if (
      invitation.status !== "pending" ||
      invitationExpired(invitation)
    ) {
      continue;
    }

    showChallenge(invitation);

    return;
  }
}

function showChallenge(invitation) {
  if (
    !invitation ||
    invitationExpired(invitation)
  ) {
    return;
  }

  activeInvitation = invitation;

  $("ksChallengeSender").textContent =
    `${invitation.sender_name || "A player"} invited you!`;

  $("ksChallengeRoom").textContent =
    `ROOM: ${invitation.room_code || "PRIVATE"}`;

  $("ksChallengeExpiry").textContent =
    `Expires in ${remainingSeconds(invitation)}s`;

  $("ksChallengeAccept").disabled = false;

  $("ksChallengeAccept").textContent =
    "✅ ACCEPT & JOIN";

  $("ksChallengeDecline").disabled = false;

  $("ksRaceChallenge").hidden = false;

  $("ksChallengeBackdrop").hidden = false;

  playInviteSound();
}


/* =====================================================
   LOAD INVITATION DETAILS
===================================================== */

async function enrichInvitation(invitation) {
  const client = getClient();

  if (!client) return invitation;

  const enriched = {
    ...invitation,
    sender_name: "Player",
    room_code: null
  };

  const [profileResult, roomResult] =
    await Promise.all([

      client
        .from("profiles")
        .select("username")
        .eq("id", invitation.sender_id)
        .maybeSingle(),

      client
        .from("race_rooms")
        .select("id,room_code,status")
        .eq("id", invitation.room_id)
        .maybeSingle()

    ]);

  if (profileResult.data) {
    enriched.sender_name =
      profileResult.data.username || "Player";
  }

  if (roomResult.error || !roomResult.data) {
    return null;
  }

  if (roomResult.data.status !== "waiting") {
    return null;
  }

  if (roomResult.data.id !== invitation.room_id) {
    return null;
  }

  enriched.room_code =
    roomResult.data.room_code;

  return enriched;
}


/* =====================================================
   QUEUE INVITATION
===================================================== */

async function processInvitation(invitation) {
  if (
    !invitation?.id ||
    invitation.status !== "pending" ||
    invitationExpired(invitation)
  ) {
    return;
  }

  const user = getUser();

  if (
    !user ||
    invitation.receiver_id !== user.id
  ) {
    return;
  }

  if (shownInvitations.has(invitation.id)) {
    return;
  }

  shownInvitations.add(invitation.id);

  const generation = inviteGeneration;

  try {

    const enriched =
      await enrichInvitation(invitation);

    if (
      generation !== inviteGeneration ||
      !enriched ||
      getUser()?.id !== user.id
    ) {
      return;
    }

    invitations.set(
      enriched.id,
      enriched
    );

    notificationQueue.push(enriched);

    showNextInvitation();

  } catch (error) {

    console.warn(
      "Invitation processing:",
      error.message
    );

  }
}


/* =====================================================
   FETCH PENDING INVITATIONS
===================================================== */

async function fetchPendingInvitations() {
  const client = getClient();

  const user = getUser();

  if (
    !client ||
    !user ||
    notificationBusy
  ) {
    return;
  }

  notificationBusy = true;

  const generation = inviteGeneration;

  try {

    const { data, error } = await client
      .from("ks_race_invitations")
      .select("*")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .gt(
        "expires_at",
        new Date().toISOString()
      )
      .order(
        "created_at",
        { ascending: false }
      )
      .limit(20);

    if (error) throw error;

    if (
      generation !== inviteGeneration ||
      getUser()?.id !== user.id
    ) {
      return;
    }

    for (const invitation of data || []) {
      await processInvitation(invitation);
    }

  } catch (error) {

    console.warn(
      "Invitation fetch:",
      error.message
    );

  } finally {

    notificationBusy = false;

  }
}


/* =====================================================
   ACCEPT INVITATION
===================================================== */

async function acceptInvitation() {
  const invitation = activeInvitation;

  if (
    !invitation ||
    joiningInvite
  ) {
    return;
  }

  if (invitationExpired(invitation)) {
    toast("Invitation expired.", "error");
    hideChallenge();
    return;
  }

  const client = getClient();

  const user = getUser();

  if (!client || !user) {
    toast("Sign in to join the race.", "error");
    return;
  }

  if (invitation.receiver_id !== user.id) {
    toast("This invitation is not for you.", "error");
    return;
  }

  if (typeof mpEnter !== "function") {
    toast("Multiplayer engine unavailable.", "error");
    return;
  }

  const existingRoom = getRoom();

  if (
    existingRoom &&
    existingRoom.id !== invitation.room_id
  ) {
    toast(
      "Leave your current room before joining another.",
      "error"
    );

    return;
  }

  joiningInvite = true;

  const acceptButton =
    $("ksChallengeAccept");

  const declineButton =
    $("ksChallengeDecline");

  acceptButton.disabled = true;
  declineButton.disabled = true;

  acceptButton.textContent = "JOINING...";

  try {

    /*
      Validate invitation server-side.
    */

    const { data, error } = await client.rpc(
      "ks_accept_race_invitation",
      {
        p_invitation_id: invitation.id
      }
    );

    if (error) throw error;

    const accepted = Array.isArray(data)
      ? data[0]
      : data;

    if (!accepted?.room_id) {
      throw new Error(
        "Invitation returned no room."
      );
    }

    if (
      accepted.room_id !== invitation.room_id
    ) {
      throw new Error(
        "Invitation room mismatch."
      );
    }

    const code =
      String(accepted.room_code || "")
        .toUpperCase();

    if (!isValidCode(code)) {
      throw new Error(
        "Invalid invitation room code."
      );
    }

    /*
      Already connected to the correct room.
    */

    if (getRoom()?.id === accepted.room_id) {

      if (typeof navigate === "function") {
        navigate("race");
      }

      if (typeof mpTab === "function") {
        mpTab();
      }

      toast(
        "Already connected to this race.",
        "success"
      );

      hideChallenge();

      return;
    }

    /*
      Join using the server-validated code.
    */

    const joinResult = await client.rpc(
      "join_race_room",
      {
        input_code: code
      }
    );

    if (joinResult.error) {
      throw joinResult.error;
    }

    const joinedRoomId =
      typeof joinResult.data === "string"
        ? joinResult.data
        : joinResult.data?.room_id;

    if (
      joinedRoomId !== accepted.room_id
    ) {
      throw new Error(
        "Joined room does not match invitation."
      );
    }

    /*
      Enter the verified room.
    */

    await mpEnter(accepted.room_id);

    if (getRoom()?.id !== accepted.room_id) {
      throw new Error(
        "Could not open the invited room."
      );
    }

    if (typeof navigate === "function") {
      navigate("race");
    }

    if (typeof mpTab === "function") {
      mpTab();
    }

    toast(
      "🏎 Joined your friend's race!",
      "success"
    );

    hideChallenge();

  } catch (error) {

    console.error(
      "Invitation acceptance:",
      error
    );

    toast(error.message, "error");

    acceptButton.disabled = false;

    declineButton.disabled = false;

    acceptButton.textContent =
      "✅ ACCEPT & JOIN";

  } finally {

    joiningInvite = false;

    if (!activeInvitation) {
      showNextInvitation();
    }

  }
}


/* =====================================================
   DECLINE INVITATION
===================================================== */

async function declineInvitation() {
  const invitation = activeInvitation;

  if (!invitation) return;

  const client = getClient();

  if (!client) return;

  $("ksChallengeDecline").disabled = true;

  try {

    const { error } = await client.rpc(
      "ks_decline_race_invitation",
      {
        p_invitation_id: invitation.id
      }
    );

    if (error) throw error;

    invitations.delete(invitation.id);

    toast("Race invitation declined.");

    hideChallenge();

  } catch (error) {

    toast(error.message, "error");

    $("ksChallengeDecline").disabled = false;

  }
}


/* =====================================================
   INVITATION EXPIRY
===================================================== */

function checkInvitationExpiry() {
  if (!activeInvitation) return;

  const seconds =
    remainingSeconds(activeInvitation);

  $("ksChallengeExpiry").textContent =
    seconds > 0
      ? `⏳ Expires in ${seconds}s`
      : "⌛ Invitation expired";

  if (seconds <= 0 && !joiningInvite) {

    toast("Race invitation expired.");

    hideChallenge();

  }
}


/* =====================================================
   REALTIME SUBSCRIPTION
===================================================== */

async function subscribeInvitations(userId) {
  const client = getClient();

  if (!client || !userId) return;

  if (subscribedUserId === userId) {
    return;
  }

  await cleanupSubscription();

  const generation = inviteGeneration;

  subscribedUserId = userId;

  inviteChannel = client
    .channel(
      `ks-race-invites-${userId}-${Date.now()}`
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ks_race_invitations",
        filter: `receiver_id=eq.${userId}`
      },
      payload => {

        if (
          generation !== inviteGeneration ||
          getUser()?.id !== userId
        ) {
          return;
        }

        processInvitation(payload.new);

      }
    )
    .subscribe(status => {

      if (status === "SUBSCRIBED") {

        console.log(
          "🔔 KEYSTRIKE INVITATIONS REALTIME CONNECTED"
        );

        fetchPendingInvitations();

      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {

        console.warn(
          "KEYSTRIKE invitations realtime:",
          status
        );

      }

    });

  fetchPendingInvitations();
}


/* =====================================================
   SUBSCRIPTION CLEANUP
===================================================== */

async function cleanupSubscription() {
  ++inviteGeneration;

  const oldChannel = inviteChannel;

  inviteChannel = null;

  subscribedUserId = null;

  invitations.clear();

  notificationQueue = [];

  shownInvitations.clear();

  activeInvitation = null;

  const popup = $("ksRaceChallenge");
  const backdrop = $("ksChallengeBackdrop");

  if (popup) popup.hidden = true;

  if (backdrop) backdrop.hidden = true;

  if (oldChannel && getClient()) {

    try {

      await getClient().removeChannel(
        oldChannel
      );

    } catch (error) {

      console.warn(
        "Invitation channel cleanup:",
        error
      );

    }

  }
}


/* =====================================================
   AUTHENTICATION WATCHER
===================================================== */

function watchAuthentication() {
  let previousUserId = null;

  setInterval(() => {

    const userId =
      getUser()?.id || null;

    if (userId === previousUserId) {
      return;
    }

    previousUserId = userId;

    if (userId) {

      subscribeInvitations(userId);

    } else {

      cleanupSubscription();

    }

  }, AUTH_CHECK_INTERVAL);
}


/* =====================================================
   LEGACY PRIVATE CHAT INVITATIONS
===================================================== */

async function joinLegacyInvitation(code) {
  if (joiningInvite) return;

  if (!isValidCode(code)) {
    toast("Invalid room code.", "error");
    return;
  }

  const client = getClient();

  const user = getUser();

  if (!client || !user) {
    toast("Sign in to join races.", "error");
    return;
  }

  if (getRoom()) {
    if (getRoom().room_code === code) {

      navigate("race");
      mpTab();

      return;
    }

    toast(
      "Leave your current room first.",
      "error"
    );

    return;
  }

  joiningInvite = true;

  try {

    /*
      Legacy chat messages contain only room codes.

      Verify that the room is still waiting.
    */

    const roomResult = await client
      .from("race_rooms")
      .select("id,room_code,status")
      .eq("room_code", code)
      .eq("status", "waiting")
      .maybeSingle();

    if (roomResult.error) {
      throw roomResult.error;
    }

    if (!roomResult.data) {
      throw new Error(
        "This race invitation is no longer available."
      );
    }

    const expectedRoomId =
      roomResult.data.id;

    const { data, error } = await client.rpc(
      "join_race_room",
      {
        input_code: code
      }
    );

    if (error) throw error;

    const joinedRoomId =
      typeof data === "string"
        ? data
        : data?.room_id;

    if (joinedRoomId !== expectedRoomId) {
      throw new Error(
        "Room changed. Please request a new invitation."
      );
    }

    await mpEnter(expectedRoomId);

    if (getRoom()?.id !== expectedRoomId) {
      throw new Error(
        "Could not enter invited room."
      );
    }

    navigate("race");
    mpTab();

    toast(
      "🏎 Joined race!",
      "success"
    );

  } catch (error) {

    toast(error.message, "error");

  } finally {

    joiningInvite = false;

  }
}


/* =====================================================
   CHAT JOIN BUTTONS
===================================================== */

function enhanceChatInvitations() {
  const container = $("chatMessages");

  if (!container) return;

  container.querySelectorAll(
    ".chat-message-bubble"
  ).forEach(bubble => {

    const code =
      getInvitationCode(bubble.textContent);

    if (!code) return;

    const wrapper =
      bubble.closest(".chat-message");

    if (!wrapper) return;

    if (
      wrapper.querySelector(
        ".ks-chat-join-race"
      )
    ) {
      return;
    }

    const button = make(
      "button",
      "ks-chat-join-race",
      "🏎 JOIN RACE →"
    );

    button.type = "button";

    button.addEventListener("click", () => {
      joinLegacyInvitation(code);
    });

    wrapper.appendChild(button);

  });
}


/* =====================================================
   CHAT OBSERVER
===================================================== */

function watchChat() {
  const container = $("chatMessages");

  if (!container) return;

  const observer = new MutationObserver(() => {
    enhanceChatInvitations();
  });

  observer.observe(container, {
    childList: true,
    subtree: true
  });

  enhanceChatInvitations();
}


/* =====================================================
   LOBBY OBSERVER
===================================================== */

function watchLobby() {
  const lobby = $("multiplayerLobby");

  if (!lobby) return;

  const observer = new MutationObserver(() => {
    updateInviteButton();
  });

  observer.observe(lobby, {
    childList: true,
    subtree: true
  });

  updateInviteButton();
}


/* =====================================================
   GLOBAL KEYBOARD EVENTS
===================================================== */

function initializeKeyboard() {
  document.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Escape") {
        return;
      }

      closeInviteModal();

    }
  );
}


/* =====================================================
   INITIALIZATION
===================================================== */

function initializeInvitations() {
  installStyles();

  createInviteModal();

  createChallengePopup();

  watchLobby();

  watchChat();

  watchAuthentication();

  initializeKeyboard();

  setInterval(
    checkInvitationExpiry,
    POPUP_CHECK_INTERVAL
  );

  setInterval(() => {

    if (getUser()) {
      fetchPendingInvitations();
    }

  }, INVITE_REFRESH_INTERVAL);

  console.log(
    "🏎 KEYSTRIKE REALTIME INVITATIONS READY"
  );
}

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initializeInvitations
  );

} else {

  initializeInvitations();

}

})();

"use strict";

/*
====================================================
 KEYSTRIKE V5
 SOCIAL PRESENCE + UI ENHANCEMENTS

 Features:
 - Supabase device session heartbeat
 - PC / Mobile / Tablet detection
 - Multiple simultaneous sessions
 - Accurate onlineUsers synchronization
 - Friends list presence
 - Player search presence
 - Private chat presence
 - Multiplayer lobby presence
 - Online friends shortcuts
 - Live player search
 - Multiplayer passage auto scroll

 Requires:
 - script.js
 - phase4.js
 - multiplayer-ui.js
 - Supabase ks_presence_* RPCs

 Existing typing and multiplayer engines preserved.
====================================================
*/

(() => {

const $ = id => document.getElementById(id);

const HEARTBEAT_INTERVAL = 15000;
const PRESENCE_REFRESH_INTERVAL = 10000;
const PRESENCE_EXPIRY = 45000;

let sessionId = null;
let sessionUserId = null;

let heartbeatTimer = null;
let presenceTimer = null;
let authWatcher = null;

let heartbeatBusy = false;
let presenceBusy = false;

let presenceGeneration = 0;

let deviceSessions = new Map();

let searchTimer = null;
let searchGeneration = 0;

let lastSearch = "";

let passageFrame = null;


/* ====================================================
   HELPERS
==================================================== */

function clientAvailable() {
  return typeof db !== "undefined" && Boolean(db);
}

function userAvailable() {
  return (
    typeof currentUser !== "undefined" &&
    Boolean(currentUser)
  );
}

function notify(message, type = "") {
  if (typeof showToast === "function") {
    showToast(message, type);
  }
}

function createElement(tag, className = "", text = "") {
  const node = document.createElement(tag);

  node.className = className;
  node.textContent = text;

  return node;
}

function getDeviceType() {
  const ua = navigator.userAgent || "";

  if (
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (
      /Android/i.test(ua) &&
      !/Mobile/i.test(ua)
    ) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  ) {
    return "Tablet";
  }

  if (
    /Android|iPhone|iPod|Mobile|Windows Phone/i.test(ua)
  ) {
    return "Mobile";
  }

  return "PC";
}

function deviceIcon(device) {
  switch (device) {
    case "Mobile":
      return "📱";

    case "Tablet":
      return "📲";

    default:
      return "💻";
  }
}

function createSessionId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;

  const hex = [...bytes]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");

  return (
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20)
  );
}


/* ====================================================
   PRESENCE STATUS
==================================================== */

function getUserSessions(userId) {
  return deviceSessions.get(userId) || [];
}

function getPresenceInfo(profile) {
  if (!profile?.id) {
    return {
      online: false,
      device: null,
      text: "⚫ OFFLINE",
      lastSeen: null
    };
  }

  const sessions = getUserSessions(profile.id);

  if (sessions.length) {
    const devices = [
      ...new Set(
        sessions.map(session => session.device_type)
      )
    ];

    const deviceText = devices
      .map(device => `${deviceIcon(device)} ${device}`)
      .join(" · ");

    return {
      online: true,
      device: devices[0],
      devices,
      text: `🟢 ONLINE · ${deviceText}`,
      lastSeen: null
    };
  }

  let lastSeen = "Last seen unavailable";

  if (profile.last_seen) {
    if (typeof formatLastSeen === "function") {
      lastSeen = formatLastSeen(profile.last_seen);
    } else {
      const timestamp = new Date(
        profile.last_seen
      ).getTime();

      if (Number.isFinite(timestamp)) {
        const minutes = Math.max(
          0,
          Math.floor((Date.now() - timestamp) / 60000)
        );

        lastSeen = minutes < 1
          ? "Last seen recently"
          : `Last seen ${minutes}m ago`;
      }
    }
  }

  return {
    online: false,
    device: profile.device_type || null,
    devices: [],
    text: `⚫ OFFLINE · ${lastSeen}`,
    lastSeen: profile.last_seen || null
  };
}

window.KeystrikePresence = {
  get: getPresenceInfo,

  isOnline(userId) {
    return getUserSessions(userId).length > 0;
  },

  getDeviceType
};


/* ====================================================
   HEARTBEAT
==================================================== */

async function sendHeartbeat() {
  if (
    !clientAvailable() ||
    !userAvailable() ||
    !sessionId ||
    heartbeatBusy
  ) {
    return;
  }

  const userId = currentUser.id;
  const activeSession = sessionId;

  if (sessionUserId !== userId) return;

  heartbeatBusy = true;

  try {
    const { error } = await db.rpc(
      "ks_presence_heartbeat",
      {
        p_session_id: activeSession,
        p_device_type: getDeviceType()
      }
    );

    if (error) throw error;

  } catch (error) {
    console.warn(
      "KEYSTRIKE presence heartbeat:",
      error.message
    );

  } finally {
    heartbeatBusy = false;
  }
}


/* ====================================================
   FETCH ONLINE SESSIONS
==================================================== */

async function refreshPresence() {
  if (
    !clientAvailable() ||
    !userAvailable() ||
    presenceBusy
  ) {
    return;
  }

  const userId = currentUser.id;
  const generation = presenceGeneration;

  presenceBusy = true;

  try {
    const { data, error } = await db.rpc(
      "ks_get_online_sessions"
    );

    if (error) throw error;

    if (
      generation !== presenceGeneration ||
      currentUser?.id !== userId
    ) {
      return;
    }

    const now = Date.now();

    const sessions = new Map();

    for (const row of data || []) {
      if (!row.user_id) continue;

      const timestamp = new Date(
        row.last_heartbeat
      ).getTime();

      if (
        !Number.isFinite(timestamp) ||
        now - timestamp > PRESENCE_EXPIRY
      ) {
        continue;
      }

      if (!sessions.has(row.user_id)) {
        sessions.set(row.user_id, []);
      }

      sessions.get(row.user_id).push({
        device_type: row.device_type || "PC",
        last_heartbeat: row.last_heartbeat
      });
    }

    deviceSessions = sessions;

    synchronizeOnlineUsers();

  } catch (error) {
    console.warn(
      "KEYSTRIKE presence refresh:",
      error.message
    );

  } finally {
    presenceBusy = false;
  }
}


/* ====================================================
   ORIGINAL onlineUsers INTEGRATION
==================================================== */

function synchronizeOnlineUsers() {
  if (typeof onlineUsers === "undefined") return;

  onlineUsers = new Set(deviceSessions.keys());

  if (typeof renderFriendsList === "function") {
    renderFriendsList();
  }

  if (typeof renderChatHeader === "function") {
    renderChatHeader();
  }

  updateOnlineCounter();

  refreshVisibleSearchStatuses();

  updateLobbyPresence();

  renderOnlineFriends();
}

function updateOnlineCounter() {
  if (typeof getAcceptedFriends !== "function") return;

  const friends = getAcceptedFriends();

  const online = friends.filter(
    friend => onlineUsers.has(friend.id)
  ).length;

  const friendsCounter = $("friendsOnlineCount");

  if (friendsCounter) {
    friendsCounter.textContent = `${online} ONLINE`;
  }

  const socialCounter = $("socialOnlineCount");

  if (socialCounter) {
    socialCounter.textContent =
      `🟢 ${online} FRIENDS ONLINE`;
  }
}


/* ====================================================
   FRIEND CARD INTEGRATION
==================================================== */

const originalCreateFriendCard =
  typeof createFriendCard === "function"
    ? createFriendCard
    : null;

if (originalCreateFriendCard) {

  createFriendCard = function(profile) {
    const card = originalCreateFriendCard(profile);

    const presence = getPresenceInfo(profile);

    const avatar = card.querySelector(".friend-avatar");

    if (avatar) {
      avatar.classList.toggle(
        "online",
        presence.online
      );
    }

    const info = card.querySelector(".friend-info");

    if (info) {
      const status = info.querySelector("small");

      if (status) {
        status.textContent = presence.text;

        status.classList.toggle(
          "online-text",
          presence.online
        );

        status.classList.add(
          "ks-presence-status"
        );
      }
    }

    return card;
  };
}


/* ====================================================
   PRIVATE CHAT HEADER
==================================================== */

const originalRenderChatHeader =
  typeof renderChatHeader === "function"
    ? renderChatHeader
    : null;

if (originalRenderChatHeader) {

  renderChatHeader = function() {
    originalRenderChatHeader();

    if (
      typeof selectedFriend === "undefined" ||
      !selectedFriend
    ) {
      return;
    }

    const status = $("chatFriendStatus");

    if (!status) return;

    const presence = getPresenceInfo(selectedFriend);

    status.textContent = presence.text;

    status.classList.toggle(
      "online",
      presence.online
    );
  };
}


/* ====================================================
   PLAYER SEARCH CARDS
==================================================== */

const originalCreateSearchPlayerCard =
  typeof createSearchPlayerCard === "function"
    ? createSearchPlayerCard
    : null;

if (originalCreateSearchPlayerCard) {

  createSearchPlayerCard = function(profile) {
    const card = originalCreateSearchPlayerCard(profile);

    const info = card.querySelector(".player-info");

    if (info) {
      const presence = getPresenceInfo(profile);

      const status = createElement(
        "small",
        "ks-presence-status",
        presence.text
      );

      status.dataset.presenceUser = profile.id;

      status.dataset.lastSeen = profile.last_seen || "";

      status.dataset.deviceType = profile.device_type || "";

      status.classList.toggle(
        "online-text",
        presence.online
      );

      info.appendChild(status);
    }

    return card;
  };
}


/* ====================================================
   UPDATE SEARCH RESULTS
==================================================== */

function refreshVisibleSearchStatuses() {
  document.querySelectorAll(
    "[data-presence-user]"
  ).forEach(node => {
    const profile = {
      id: node.dataset.presenceUser,
      last_seen: node.dataset.lastSeen || null,
      device_type: node.dataset.deviceType || null
    };

    const presence = getPresenceInfo(profile);

    node.textContent = presence.text;

    node.classList.toggle(
      "online-text",
      presence.online
    );
  });
}


/* ====================================================
   MULTIPLAYER LOBBY PRESENCE
==================================================== */

function updateLobbyPresence() {
  const lobby = $("lobbyPlayers");

  if (!lobby) return;

  if (
    typeof mpPlayers === "undefined" ||
    !Array.isArray(mpPlayers)
  ) {
    return;
  }

  const cards = lobby.querySelectorAll(
    ".lobby-player"
  );

  cards.forEach((card, index) => {
    const player = mpPlayers[index];

    if (!player) return;

    const info = card.querySelector(
      ".lobby-player-info"
    );

    if (!info) return;

    let status = info.querySelector(
      ".ks-lobby-presence"
    );

    if (!status) {
      status = createElement(
        "small",
        "ks-lobby-presence"
      );

      info.appendChild(status);
    }

    const presence = getPresenceInfo({
      id: player.user_id,
      last_seen: player.profile?.last_seen,
      device_type: player.profile?.device_type
    });

    status.textContent = presence.text;

    status.classList.toggle(
      "online-text",
      presence.online
    );
  });
}

if (typeof mpRender === "function") {
  const originalMpRender = mpRender;

  mpRender = function(...args) {
    const result = originalMpRender.apply(this, args);

    updateLobbyPresence();

    return result;
  };
}


/* ====================================================
   LIVE PLAYER SEARCH
==================================================== */

async function livePlayerSearch(query) {
  if (
    !clientAvailable() ||
    !userAvailable()
  ) {
    return;
  }

  const results = $("playerSearchResults");
  const section = $("searchResults");

  if (!results || !section) return;

  const generation = ++searchGeneration;
  const userId = currentUser.id;

  const text = query
    .trim()
    .replace(/[%_,]/g, "")
    .slice(0, 30);

  if (text.length < 2) {
    section.hidden = true;
    results.replaceChildren();
    return;
  }

  section.hidden = false;

  results.replaceChildren(
    createElement(
      "div",
      "social-empty-state",
      "Searching players..."
    )
  );

  try {
    const { data, error } = await db
      .from("profiles")
      .select(
        "id,username,avatar_url,best_wpm," +
        "average_wpm,tests_completed,last_seen,device_type"
      )
      .ilike("username", `%${text}%`)
      .neq("id", userId)
      .limit(20);

    if (error) throw error;

    if (
      generation !== searchGeneration ||
      currentUser?.id !== userId
    ) {
      return;
    }

    results.replaceChildren();

    if (!data?.length) {
      results.appendChild(
        createElement(
          "div",
          "social-empty-state",
          "No matching players."
        )
      );

      return;
    }

    for (const profile of data) {
      if (
        typeof createSearchPlayerCard === "function"
      ) {
        results.appendChild(
          createSearchPlayerCard(profile)
        );
      }
    }

  } catch (error) {
    if (generation !== searchGeneration) return;

    results.replaceChildren(
      createElement(
        "div",
        "social-empty-state",
        error.message
      )
    );
  }
}

function initializeLiveSearch() {
  const input = $("playerSearchInput");

  if (!input) return;

  input.addEventListener("input", () => {
    clearTimeout(searchTimer);

    const query = input.value.trim();

    if (query === lastSearch) return;

    lastSearch = query;

    searchTimer = setTimeout(() => {
      livePlayerSearch(query);
    }, 300);
  });
}


/* ====================================================
   ONLINE FRIEND SHORTCUTS
==================================================== */

function getOnlineFriends() {
  if (
    typeof getAcceptedFriends !== "function" ||
    typeof onlineUsers === "undefined"
  ) {
    return [];
  }

  return getAcceptedFriends().filter(
    friend => onlineUsers.has(friend.id)
  );
}

function createOnlineFriendsPanel() {
  const home = $("multiplayerHome");

  if (!home || $("ksOnlineFriendsPanel")) return;

  const panel = createElement(
    "div",
    "ks-online-friends-panel"
  );

  panel.id = "ksOnlineFriendsPanel";

  home.appendChild(panel);
}

function renderOnlineFriends() {
  const panel = $("ksOnlineFriendsPanel");

  if (!panel) return;

  const friends = getOnlineFriends();

  panel.replaceChildren();

  panel.appendChild(
    createElement(
      "h3",
      "",
      `🟢 ONLINE FRIENDS (${friends.length})`
    )
  );

  if (!friends.length) {
    panel.appendChild(
      createElement(
        "p",
        "",
        "No friends online right now."
      )
    );

    return;
  }

  friends.forEach(friend => {
    const presence = getPresenceInfo(friend);

    const button = createElement(
      "button",
      "ks-online-friend",
      `${presence.text} · ${friend.username}`
    );

    button.type = "button";

    button.addEventListener("click", () => {
      if (
        typeof mpRoom === "undefined" ||
        !mpRoom ||
        mpRoom.status !== "waiting"
      ) {
        notify(
          "Create a waiting room before inviting friends.",
          "error"
        );

        return;
      }

      if (
        typeof window.KeystrikeSendRaceInvite === "function"
      ) {
        window.KeystrikeSendRaceInvite(friend);
        return;
      }

      notify(
        "Open the room's INVITE FRIENDS menu to send an invitation."
      );

      $("ksInviteFriendsButton")?.click();
    });

    panel.appendChild(button);
  });
}


/* ====================================================
   MULTIPLAYER PASSAGE AUTO SCROLL

   race-mobile-fix.js already handles scrolling.

   Do not register another competing input listener.
==================================================== */


/* ====================================================
   SESSION LIFECYCLE
==================================================== */

function stopPresence() {
  ++presenceGeneration;

  clearInterval(heartbeatTimer);
  clearInterval(presenceTimer);

  heartbeatTimer = null;
  presenceTimer = null;

  sessionId = null;
  sessionUserId = null;

  deviceSessions = new Map();

  synchronizeOnlineUsers();
}

async function disconnectSession(
  previousSession,
  previousUser
) {
  if (
    !previousSession ||
    !previousUser ||
    !clientAvailable()
  ) {
    return;
  }

  try {
    const { error } = await db.rpc(
      "ks_presence_disconnect",
      {
        p_session_id: previousSession
      }
    );

    if (error) throw error;

  } catch (error) {
    console.warn(
      "Presence disconnect:",
      error.message
    );
  }
}

async function startPresence(userId) {
  if (!userId || !clientAvailable()) return;

  if (
    sessionUserId === userId &&
    sessionId
  ) {
    return;
  }

  const oldSession = sessionId;
  const oldUser = sessionUserId;

  stopPresence();

  if (
    oldSession &&
    oldUser &&
    oldUser === currentUser?.id
  ) {
    await disconnectSession(
      oldSession,
      oldUser
    );
  }

  sessionId = createSessionId();
  sessionUserId = userId;

  await sendHeartbeat();

  if (
    sessionUserId !== userId ||
    currentUser?.id !== userId
  ) {
    return;
  }

  await refreshPresence();

  heartbeatTimer = setInterval(() => {
    if (
      document.visibilityState === "visible"
    ) {
      sendHeartbeat();
    }
  }, HEARTBEAT_INTERVAL);

  presenceTimer = setInterval(() => {
    if (
      document.visibilityState === "visible"
    ) {
      refreshPresence();
    }
  }, PRESENCE_REFRESH_INTERVAL);
}

function watchAuthentication() {
  let lastUserId = null;

  authWatcher = setInterval(() => {
    const userId = userAvailable()
      ? currentUser.id
      : null;

    if (userId === lastUserId) return;

    lastUserId = userId;

    if (userId) {
      startPresence(userId);
    } else {
      stopPresence();
    }
  }, 1000);
}

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState !== "visible"
    ) {
      return;
    }

    if (!userAvailable()) return;

    sendHeartbeat();
    refreshPresence();
  }
);

window.addEventListener("focus", () => {
  if (!userAvailable()) return;

  sendHeartbeat();
  refreshPresence();
});


/* ====================================================
   INITIALIZATION
==================================================== */

function initializeEnhancements() {
  initializeLiveSearch();

  createOnlineFriendsPanel();
  renderOnlineFriends();

  watchAuthentication();

  console.log(
    "🟢 KEYSTRIKE V5 DEVICE PRESENCE READY"
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeEnhancements
  );
} else {
  initializeEnhancements();
}

})();

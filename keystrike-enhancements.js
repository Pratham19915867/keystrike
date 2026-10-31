"use strict";

/*
  KEYSTRIKE V5 — UI ENHANCEMENTS

  - Race passage auto-scroll
  - Live player search
  - Online friend shortcuts
  - Existing app functions preserved
*/

(() => {

const $ = id => document.getElementById(id);

let searchTimer = null;
let lastSearch = "";
let searchGeneration = 0;

/* ======================================
   PASSAGE AUTO SCROLL
====================================== */

function updatePassageScroll() {
  const passage = $("multiplayerPassage");
  const input = $("multiplayerInput");

  if (!passage || !input) return;

  const typedLength = input.value.length;

  const spans = passage.querySelectorAll("span");

  if (!spans.length) return;

  const index = Math.min(
    typedLength,
    spans.length - 1
  );

  const current = spans[index];

  if (!current) return;

  const targetTop =
    current.offsetTop -
    passage.offsetTop -
    passage.clientHeight / 3;

  passage.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "auto"
  });
}

function initializePassageScroll() {
  const input = $("multiplayerInput");

  if (!input) return;

  input.addEventListener(
    "input",
    () => requestAnimationFrame(updatePassageScroll)
  );
}

/* ======================================
   LIVE PLAYER SEARCH
====================================== */

async function livePlayerSearch(query) {
  const results = $("playerSearchResults");
  const section = $("searchResults");

  if (
    !results ||
    !section ||
    typeof db === "undefined" ||
    !db ||
    typeof currentUser === "undefined" ||
    !currentUser
  ) return;

  const generation = ++searchGeneration;

  const text = query.trim();

  if (text.length < 2) {
    section.hidden = true;
    results.replaceChildren();
    return;
  }

  section.hidden = false;

  results.replaceChildren();

  const loading = document.createElement("div");

  loading.className = "social-empty-state";
  loading.textContent = "Searching players...";

  results.appendChild(loading);

  try {
    const safeQuery = text
      .replace(/[%_,]/g, "")
      .slice(0, 30);

    const { data, error } = await db
      .from("profiles")
      .select(
        "id,username,avatar_url,best_wpm,average_wpm,tests_completed,last_seen"
      )
      .ilike("username", `%${safeQuery}%`)
      .neq("id", currentUser.id)
      .limit(20);

    if (error) throw error;

    if (generation !== searchGeneration) return;

    results.replaceChildren();

    if (!data?.length) {
      const empty = document.createElement("div");

      empty.className = "social-empty-state";
      empty.textContent = "No matching players.";

      results.appendChild(empty);
      return;
    }

    data.forEach(profile => {
      if (typeof createSearchPlayerCard === "function") {
        results.appendChild(
          createSearchPlayerCard(profile)
        );
      }
    });

  } catch (error) {
    if (generation !== searchGeneration) return;

    results.replaceChildren();

    const message = document.createElement("div");

    message.className = "social-empty-state";
    message.textContent = error.message;

    results.appendChild(message);
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

/* ======================================
   ONLINE FRIEND SHORTCUTS
====================================== */

function getOnlineFriends() {
  if (
    typeof getAcceptedFriends !== "function" ||
    typeof onlineUsers === "undefined"
  ) return [];

  return getAcceptedFriends().filter(friend =>
    onlineUsers.has(friend.id)
  );
}

function createOnlineFriendsPanel() {
  const home = $("multiplayerHome");

  if (!home) return;

  if ($("ksOnlineFriendsPanel")) return;

  const panel = document.createElement("div");

  panel.id = "ksOnlineFriendsPanel";
  panel.className = "ks-online-friends-panel";

  home.appendChild(panel);
}

function renderOnlineFriends() {
  const panel = $("ksOnlineFriendsPanel");

  if (!panel) return;

  const friends = getOnlineFriends();

  panel.replaceChildren();

  const title = document.createElement("h3");

  title.textContent =
    `🟢 ONLINE FRIENDS (${friends.length})`;

  panel.appendChild(title);

  if (!friends.length) {
    const empty = document.createElement("p");

    empty.textContent =
      "No friends online right now.";

    panel.appendChild(empty);
    return;
  }

  friends.forEach(friend => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "ks-online-friend";

    button.textContent =
      `🟢 ${friend.username} · ${friend.best_wpm || 0} WPM`;

    button.addEventListener("click", async () => {
      if (
        typeof mpRoom === "undefined" ||
        !mpRoom?.room_code
      ) {
        if (typeof showToast === "function") {
          showToast(
            "Create a room first, then invite your friend."
          );
        }

        return;
      }

      try {
        const { error } = await db
          .from("messages")
          .insert({
            sender_id: currentUser.id,
            receiver_id: friend.id,
            content:
              "🏎 KEYSTRIKE RACE INVITE\n" +
              "Room code: " + mpRoom.room_code +
              "\nJoin my KEYSTRIKE multiplayer race!"
          });

        if (error) throw error;

        showToast(
          `Invitation sent to ${friend.username}!`,
          "success"
        );

      } catch (error) {
        showToast(error.message, "error");
      }
    });

    panel.appendChild(button);
  });
}

/* ======================================
   INITIALIZATION
====================================== */

function initialize() {
  initializePassageScroll();
  initializeLiveSearch();

  createOnlineFriendsPanel();
  renderOnlineFriends();

  setInterval(renderOnlineFriends, 5000);

  console.log(
    "✨ KEYSTRIKE UI ENHANCEMENTS READY"
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );
} else {
  initialize();
}

})();

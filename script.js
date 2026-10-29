/* ==========================================
   SOCIAL SYSTEM STATE
========================================== */

let friendships = [];
let friendProfiles = new Map();

let selectedFriend = null;
let chatMessages = [];

let socialRefreshTimer = null;
let activityTimer = null;

let friendshipChannel = null;
let messageChannel = null;
let presenceChannel = null;

let onlineUsers = new Set();

let socialGeneration = 0;
let chatGeneration = 0;
let socialRefreshing = false;

let socialInitializedFor = null;

function socialMessage(message, type = "") {
  $("socialStatusMessage").textContent = message;
  $("socialStatusMessage").className =
    "social-status-message " + type;
}

function renderSocialAuth() {
  const signedIn = Boolean(currentUser);

  $("socialLoginRequired").hidden = signedIn;
  $("socialDashboard").hidden = !signedIn;

  if (!signedIn) {
    $("socialOnlineCount").textContent = "OFFLINE";
    $("socialNotification").hidden = true;
  }
}

$("socialLoginButton").addEventListener(
  "click",
  openAccount
);

/* ==========================================
   SOCIAL DATA
========================================== */

async function getProfilesByIds(ids) {
  if (!ids.length) return [];

  const { data, error } = await db
    .from("profiles")
    .select(
      "id,username,avatar_url,best_wpm,average_wpm,tests_completed,last_seen"
    )
    .in("id", ids);

  if (error) throw error;

  return data || [];
}

async function refreshSocial() {
  if (!currentUser || !db || socialRefreshing) return;

  const userId = currentUser.id;
  const generation = socialGeneration;

  socialRefreshing = true;

  try {
    const { data, error } = await db
      .from("friendships")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (
      generation !== socialGeneration ||
      currentUser?.id !== userId
    ) return;

    friendships = data || [];

    const ids = [
      ...new Set(
        friendships.map(item =>
          item.sender_id === userId
            ? item.receiver_id
            : item.sender_id
        )
      )
    ];

    const profiles = await getProfilesByIds(ids);

    if (
      generation !== socialGeneration ||
      currentUser?.id !== userId
    ) return;

    friendProfiles = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    renderFriendRequests();
    renderFriendsList();
    updateSocialNotification();

    if (selectedFriend) {
      const stillFriends = getAcceptedFriends()
        .some(item => item.id === selectedFriend.id);

      if (!stillFriends) {
        closeChat();
      } else {
        selectedFriend =
          friendProfiles.get(selectedFriend.id) ||
          selectedFriend;

        renderChatHeader();
      }
    }

    socialMessage("");
  } catch (error) {
    console.error("Social refresh failed:", error);
    socialMessage(error.message, "error");
  } finally {
    socialRefreshing = false;
  }
}

function getAcceptedFriends() {
  if (!currentUser) return [];

  return friendships
    .filter(item => item.status === "accepted")
    .map(item => {
      const id =
        item.sender_id === currentUser.id
          ? item.receiver_id
          : item.sender_id;

      return friendProfiles.get(id);
    })
    .filter(Boolean);
}

function getIncomingRequests() {
  return friendships.filter(item =>
    item.receiver_id === currentUser?.id &&
    item.status === "pending"
  );
}

function getOutgoingRequests() {
  return friendships.filter(item =>
    item.sender_id === currentUser?.id &&
    item.status === "pending"
  );
}

function updateSocialNotification() {
  const count = getIncomingRequests().length;

  $("friendRequestCount").textContent = count;
  $("socialNotification").hidden = count === 0;
}

/* ==========================================
   PLAYER SEARCH
========================================== */

$("playerSearchForm").addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    if (!currentUser || !db) {
      openAccount();
      return;
    }

    const username =
      $("playerSearchInput").value.trim();

    if (!username) {
      showToast("Enter a username.", "error");
      return;
    }

    const container = $("playerSearchResults");

    $("searchResults").hidden = false;

    container.replaceChildren(
      makeElement(
        "div",
        "social-empty-state",
        "Searching players..."
      )
    );

    try {
      const { data, error } = await db
        .from("profiles")
        .select(
          "id,username,avatar_url,best_wpm,average_wpm,tests_completed,last_seen"
        )
        .ilike("username", `%${username}%`)
        .neq("id", currentUser.id)
        .limit(20);

      if (error) throw error;

      container.replaceChildren();

      if (!data?.length) {
        container.appendChild(
          makeElement(
            "div",
            "social-empty-state",
            "No players found."
          )
        );
        return;
      }

      data.forEach(profile => {
        container.appendChild(
          createSearchPlayerCard(profile)
        );
      });
    } catch (error) {
      container.replaceChildren(
        makeElement(
          "div",
          "social-empty-state",
          error.message
        )
      );
    }
  }
);

function createSearchPlayerCard(profile) {
  const card = makeElement("div", "player-card");

  const avatar = makeElement(
    "div",
    "player-avatar",
    profile.username?.[0]?.toUpperCase() || "K"
  );

  safeAvatar(
    avatar,
    profile.avatar_url,
    profile.username?.[0]?.toUpperCase() || "K"
  );

  const info = makeElement("div", "player-info");

  const name = makeElement(
    "strong",
    "",
    profile.username
  );

  const stats = makeElement(
    "small",
    "",
    `⚡ ${profile.best_wpm || 0} WPM · ${profile.tests_completed || 0} tests`
  );

  info.append(name, stats);

  const actions = makeElement("div", "player-actions");

  const relationship = friendships.find(item =>
    (
      item.sender_id === currentUser.id &&
      item.receiver_id === profile.id
    ) ||
    (
      item.receiver_id === currentUser.id &&
      item.sender_id === profile.id
    )
  );

  const button = makeElement(
    "button",
    "social-small-btn",
    relationship
      ? relationship.status === "accepted"
        ? "FRIENDS"
        : "PENDING"
      : "+ ADD"
  );

  button.disabled = Boolean(relationship);

  button.addEventListener("click", async () => {
    if (button.disabled) return;

    button.disabled = true;

    try {
      await sendFriendRequest(profile.id);
      button.textContent = "PENDING";
    } catch (error) {
      button.disabled = false;
    }
  });

  actions.appendChild(button);

  card.append(avatar, info, actions);

  return card;
}

async function sendFriendRequest(receiverId) {
  if (!currentUser || !db) {
    throw new Error("Sign in to send friend requests.");
  }

  if (receiverId === currentUser.id) {
    throw new Error("You cannot add yourself.");
  }

  try {
    const { error } = await db
      .from("friendships")
      .insert({
        sender_id: currentUser.id,
        receiver_id: receiverId,
        status: "pending"
      });

    if (error) throw error;

    showToast("Friend request sent!", "success");

    await refreshSocial();
  } catch (error) {
    showToast(error.message, "error");
    throw error;
  }
}

/* ==========================================
   FRIEND REQUESTS
========================================== */

function renderFriendRequests() {
  const incoming = getIncomingRequests();
  const outgoing = getOutgoingRequests();

  const incomingContainer =
    $("incomingFriendRequests");

  const outgoingContainer =
    $("outgoingFriendRequests");

  incomingContainer.replaceChildren();
  outgoingContainer.replaceChildren();

  $("friendRequestCount").textContent =
    incoming.length;

  $("outgoingRequestsSection").hidden =
    outgoing.length === 0;

  if (!incoming.length) {
    incomingContainer.appendChild(
      makeElement(
        "div",
        "social-empty-state",
        "No pending friend requests."
      )
    );
  }

  incoming.forEach(request => {
    const profile =
      friendProfiles.get(request.sender_id);

    if (!profile) return;

    const card = createFriendRequestCard(
      profile,
      request,
      true
    );

    incomingContainer.appendChild(card);
  });

  outgoing.forEach(request => {
    const profile =
      friendProfiles.get(request.receiver_id);

    if (!profile) return;

    const card = createFriendRequestCard(
      profile,
      request,
      false
    );

    outgoingContainer.appendChild(card);
  });
}

function createFriendRequestCard(
  profile,
  request,
  incoming
) {
  const card = makeElement(
    "div",
    "friend-request-card"
  );

  const avatar = makeElement(
    "div",
    "friend-avatar"
  );

  safeAvatar(
    avatar,
    profile.avatar_url,
    profile.username?.[0]?.toUpperCase() || "K"
  );

  const info = makeElement("div", "friend-info");

  info.append(
    makeElement("strong", "", profile.username),
    makeElement(
      "small",
      "",
      incoming
        ? "Wants to be friends"
        : "Request pending"
    )
  );

  const actions = makeElement(
    "div",
    "request-actions"
  );

  if (incoming) {
    const accept = makeElement(
      "button",
      "social-small-btn accept",
      "✓"
    );

    accept.title = "Accept request";

    accept.addEventListener("click", async () => {
      accept.disabled = true;

      try {
        const { error } = await db.rpc(
          "accept_friend_request",
          { request_id: request.id }
        );

        if (error) throw error;

        showToast(
          `You are now friends with ${profile.username}!`,
          "success"
        );

        await refreshSocial();
      } catch (error) {
        showToast(error.message, "error");
        accept.disabled = false;
      }
    });

    const reject = makeElement(
      "button",
      "social-small-btn reject",
      "✕"
    );

    reject.title = "Reject request";

    reject.addEventListener("click", async () => {
      reject.disabled = true;

      try {
        const { error } = await db.rpc(
          "reject_friend_request",
          { request_id: request.id }
        );

        if (error) throw error;

        showToast("Request rejected.");

        await refreshSocial();
      } catch (error) {
        showToast(error.message, "error");
        reject.disabled = false;
      }
    });

    actions.append(accept, reject);
  } else {
    const cancel = makeElement(
      "button",
      "social-small-btn remove",
      "CANCEL"
    );

    cancel.addEventListener("click", async () => {
      await deleteFriendship(request.id);
    });

    actions.appendChild(cancel);
  }

  card.append(avatar, info, actions);

  return card;
}

async function deleteFriendship(requestId) {
  if (!currentUser || !db) return;

  try {
    const { error } = await db
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (error) throw error;

    showToast("Friendship updated.", "success");

    await refreshSocial();
  } catch (error) {
    showToast(error.message, "error");
  }
}

/* ==========================================
   FRIENDS LIST
========================================== */

function renderFriendsList() {
  const container = $("friendsList");

  container.replaceChildren();

  const friends = getAcceptedFriends();

  $("friendsCount").textContent = friends.length;

  const onlineCount = friends.filter(friend =>
    onlineUsers.has(friend.id)
  ).length;

  $("friendsOnlineCount").textContent =
    `${onlineCount} ONLINE`;

  if (!friends.length) {
    container.appendChild(
      makeElement(
        "div",
        "social-empty-state",
        "No friends yet. Search for players to connect!"
      )
    );
    return;
  }

  friends.sort((a, b) => {
    const aOnline = onlineUsers.has(a.id) ? 1 : 0;
    const bOnline = onlineUsers.has(b.id) ? 1 : 0;

    return bOnline - aOnline ||
      a.username.localeCompare(b.username);
  });

  friends.forEach(profile => {
    container.appendChild(
      createFriendCard(profile)
    );
  });
}

function createFriendCard(profile) {
  const card = makeElement("div", "friend-card");

  card.classList.toggle(
    "active",
    selectedFriend?.id === profile.id
  );

  const avatar = makeElement(
    "div",
    "friend-avatar"
  );

  const online = onlineUsers.has(profile.id);

  avatar.classList.toggle("online", online);

  safeAvatar(
    avatar,
    profile.avatar_url,
    profile.username?.[0]?.toUpperCase() || "K"
  );

  const info = makeElement("div", "friend-info");

  const name = makeElement(
    "strong",
    "",
    profile.username
  );

  const status = makeElement(
    "small",
    online ? "online-text" : "",
    online
      ? "● Online"
      : formatLastSeen(profile.last_seen)
  );

  const speed = makeElement(
    "small",
    "",
    `⚡ ${profile.best_wpm || 0} WPM`
  );

  info.append(name, status, speed);

  const actions = makeElement(
    "div",
    "friend-actions"
  );

  const messageButton = makeElement(
    "button",
    "social-small-btn",
    "💬"
  );

  messageButton.title = "Open chat";

  messageButton.addEventListener("click", event => {
    event.stopPropagation();
    openChat(profile);
  });

  const removeButton = makeElement(
    "button",
    "social-small-btn remove",
    "✕"
  );

  removeButton.title = "Remove friend";

  removeButton.addEventListener("click", async event => {
    event.stopPropagation();

    if (!confirm(
      `Remove ${profile.username} from your friends?`
    )) return;

    const friendship = friendships.find(item =>
      item.status === "accepted" &&
      (
        (
          item.sender_id === currentUser.id &&
          item.receiver_id === profile.id
        ) ||
        (
          item.receiver_id === currentUser.id &&
          item.sender_id === profile.id
        )
      )
    );

    if (friendship) {
      await deleteFriendship(friendship.id);
    }
  });

  actions.append(messageButton, removeButton);

  card.append(avatar, info, actions);

  card.addEventListener("click", () => {
    openChat(profile);
  });

  return card;
}

/* ==========================================
   ONLINE PRESENCE
========================================== */

/*
  Presence is advisory, not proof of identity.
  Supabase RLS protects private database data.
*/

function updateOnlineUsers() {
  if (!presenceChannel) return;

  const state = presenceChannel.presenceState();

  const users = new Set();

  for (const presences of Object.values(state)) {
    for (const presence of presences) {
      if (presence.user_id) {
        users.add(presence.user_id);
      }
    }
  }

  onlineUsers = users;

  renderFriendsList();
  renderChatHeader();

  const onlineFriends = getAcceptedFriends()
    .filter(friend => onlineUsers.has(friend.id))
    .length;

  $("socialOnlineCount").textContent =
    `🟢 ${onlineFriends} FRIENDS ONLINE`;
}

async function updateLastSeen() {
  if (!currentUser || !db) return;

  try {
    const { error } = await db.rpc(
      "update_my_last_seen"
    );

    if (error) {
      console.warn("Activity update:", error.message);
    }
  } catch (error) {
    console.warn("Activity update failed:", error);
  }
}

function initializePresence() {
  if (!currentUser || !db) return;

  const userId = currentUser.id;

  presenceChannel = db.channel(
    "keystrike-v5-presence",
    {
      config: {
        presence: {
          key: userId
        }
      }
    }
  );

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      updateOnlineUsers();
    })
    .on("presence", { event: "join" }, () => {
      updateOnlineUsers();
    })
    .on("presence", { event: "leave" }, () => {
      updateOnlineUsers();
    })
    .subscribe(async status => {
      if (
        status === "SUBSCRIBED" &&
        currentUser?.id === userId
      ) {
        await presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString()
        });
      }
    });
}

/* ==========================================
   PRIVATE CHAT
========================================== */

function renderChatHeader() {
  if (!selectedFriend) return;

  $("chatFriendName").textContent =
    selectedFriend.username;

  safeAvatar(
    $("chatFriendAvatar"),
    selectedFriend.avatar_url,
    selectedFriend.username?.[0]?.toUpperCase() || "K"
  );

  const online = onlineUsers.has(selectedFriend.id);

  $("chatFriendStatus").textContent =
    online
      ? "● Online"
      : formatLastSeen(selectedFriend.last_seen);

  $("chatFriendStatus").classList.toggle(
    "online",
    online
  );

  $("chatFriendBest").textContent =
    `${selectedFriend.best_wpm || 0} WPM`;

  $("chatFriendTests").textContent =
    selectedFriend.tests_completed || 0;
}

async function openChat(profile) {
  if (!currentUser || !db) return;

  const accepted = getAcceptedFriends()
    .some(friend => friend.id === profile.id);

  if (!accepted) {
    showToast(
      "You can only chat with accepted friends.",
      "error"
    );
    return;
  }

  selectedFriend = profile;
  chatMessages = [];

  ++chatGeneration;

  $("chatEmptyState").hidden = true;
  $("chatConversation").hidden = false;

  renderChatHeader();
  renderFriendsList();

  $("chatMessages").replaceChildren(
    makeElement(
      "div",
      "social-empty-state",
      "Loading conversation..."
    )
  );

  await loadChatMessages();

  if (window.innerWidth <= 700) {
    $("chatConversation").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function closeChat() {
  ++chatGeneration;

  selectedFriend = null;
  chatMessages = [];

  $("chatEmptyState").hidden = false;
  $("chatConversation").hidden = true;

  $("chatMessages").replaceChildren();

  renderFriendsList();
}

async function loadChatMessages() {
  if (!selectedFriend || !currentUser || !db) return;

  const friendId = selectedFriend.id;
  const userId = currentUser.id;
  const generation = chatGeneration;

  try {
    const { data, error } = await db
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const { data: clearData, error: clearError } = await db
      .from("chat_clears")
      .select("cleared_at")
      .eq("user_id", userId)
      .eq("friend_id", friendId)
      .maybeSingle();

    if (clearError) throw clearError;

    if (
      generation !== chatGeneration ||
      selectedFriend?.id !== friendId ||
      currentUser?.id !== userId
    ) return;

    const clearedAt = clearData?.cleared_at
      ? new Date(clearData.cleared_at).getTime()
      : 0;

    chatMessages = (data || [])
      .filter(message =>
        new Date(message.created_at).getTime() > clearedAt
      )
      .reverse();

    renderChatMessages();
  } catch (error) {
    console.error("Chat loading failed:", error);

    $("chatMessages").replaceChildren(
      makeElement(
        "div",
        "social-empty-state",
        error.message
      )
    );
  }
}

function renderChatMessages() {
  const container = $("chatMessages");

  container.replaceChildren();

  if (!chatMessages.length) {
    container.appendChild(
      makeElement(
        "div",
        "social-empty-state",
        "No messages yet. Say hello! 👋"
      )
    );
    return;
  }

  let previousDate = "";

  chatMessages.forEach(message => {
    const date = new Date(
      message.created_at
    ).toLocaleDateString();

    if (date !== previousDate) {
      container.appendChild(
        makeElement(
          "div",
          "chat-date-divider",
          date
        )
      );

      previousDate = date;
    }

    const own =
      message.sender_id === currentUser.id;

    const wrapper = makeElement(
      "div",
      own
        ? "chat-message own"
        : "chat-message"
    );

    const sender = makeElement(
      "div",
      "chat-message-sender",
      own
        ? "YOU"
        : selectedFriend.username
    );

    const bubble = makeElement(
      "div",
      "chat-message-bubble",
      message.content
    );

    const time = makeElement(
      "div",
      "chat-message-time",
      formatTime(message.created_at)
    );

    wrapper.append(sender, bubble, time);

    container.appendChild(wrapper);
  });

  container.scrollTop = container.scrollHeight;
}

$("chatMessageForm").addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    if (!selectedFriend || !currentUser || !db) return;

    const input = $("chatMessageInput");
    const content = input.value.trim();

    if (!content) return;

    if (content.length > 2000) {
      showToast("Message is too long.", "error");
      return;
    }

    const receiverId = selectedFriend.id;
    const button = $("sendChatButton");

    button.disabled = true;

    try {
      const { error } = await db
        .from("messages")
        .insert({
          sender_id: currentUser.id,
          receiver_id: receiverId,
          content
        });

      if (error) throw error;

      input.value = "";

      await loadChatMessages();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }
);

document.querySelectorAll("[data-quick-message]")
  .forEach(button => {
    button.addEventListener("click", () => {
      if (!selectedFriend) return;

      $("chatMessageInput").value =
        button.dataset.quickMessage;

      $("chatMessageInput").focus();
    });
  });

$("closeChatButton").addEventListener(
  "click",
  closeChat
);

/* ==========================================
   CLEAR CHAT FOR CURRENT USER
========================================== */

$("clearChatButton").addEventListener(
  "click",
  async () => {
    if (!selectedFriend || !currentUser || !db) return;

    if (!confirm(
      "Clear this conversation from your view? Your friend will still have their messages."
    )) return;

    try {
      const { error } = await db
        .from("chat_clears")
        .upsert(
          {
            user_id: currentUser.id,
            friend_id: selectedFriend.id,
            cleared_at: new Date().toISOString()
          },
          {
            onConflict: "user_id,friend_id"
          }
        );

      if (error) throw error;

      await loadChatMessages();

      showToast(
        "Conversation cleared from your view.",
        "success"
      );
    } catch (error) {
      showToast(error.message, "error");
    }
  }
);

/* ==========================================
   REALTIME SOCIAL SUBSCRIPTIONS
========================================== */

function initializeSocialRealtime() {
  if (!currentUser || !db) return;

  const userId = currentUser.id;

  friendshipChannel = db
    .channel(`keystrike-friends-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friendships",
        filter: `sender_id=eq.${userId}`
      },
      () => refreshSocial()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friendships",
        filter: `receiver_id=eq.${userId}`
      },
      () => refreshSocial()
    )
    .subscribe();

  messageChannel = db
    .channel(`keystrike-messages-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}`
      },
      () => {
        if (selectedFriend) loadChatMessages();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `sender_id=eq.${userId}`
      },
      () => {
        if (selectedFriend) loadChatMessages();
      }
    )
    .subscribe();
}

/* ==========================================
   SOCIAL INITIALIZATION
========================================== */

async function initializeSocial() {
  if (!currentUser || !db) return;

  const userId = currentUser.id;

  if (socialInitializedFor === userId) return;

  socialInitializedFor = userId;

  ++socialGeneration;

  renderSocialAuth();

  await refreshSocial();

  if (currentUser?.id !== userId) return;

  initializeSocialRealtime();
  initializePresence();

  await updateLastSeen();

  activityTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      updateLastSeen();
    }
  }, 60000);

  socialRefreshTimer = setInterval(async () => {
    if (!currentUser) return;

    await refreshSocial();

    if (selectedFriend) {
      await loadChatMessages();
    }
  }, 10000);
}

async function cleanupSocial() {
  ++socialGeneration;
  ++chatGeneration;

  clearInterval(socialRefreshTimer);
  clearInterval(activityTimer);

  socialRefreshTimer = null;
  activityTimer = null;

  const channels = [
    friendshipChannel,
    messageChannel,
    presenceChannel
  ];

  friendshipChannel = null;
  messageChannel = null;
  presenceChannel = null;

  if (db) {
    await Promise.all(
      channels
        .filter(Boolean)
        .map(channel => db.removeChannel(channel))
    );
  }

  friendships = [];
  friendProfiles = new Map();

  selectedFriend = null;
  chatMessages = [];

  onlineUsers = new Set();

  socialInitializedFor = null;

  $("friendsList").replaceChildren();
  $("incomingFriendRequests").replaceChildren();
  $("outgoingFriendRequests").replaceChildren();

  $("searchResults").hidden = true;

  $("friendsCount").textContent = "0";
  $("friendRequestCount").textContent = "0";
  $("friendsOnlineCount").textContent = "0 ONLINE";

  $("chatEmptyState").hidden = false;
  $("chatConversation").hidden = true;

  $("socialNotification").hidden = true;

  renderSocialAuth();
}

$("refreshSocialButton").addEventListener(
  "click",
  refreshSocial
);

$("refreshFriendsButton").addEventListener(
  "click",
  refreshSocial
);

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    currentUser
  ) {
    updateLastSeen();
    refreshSocial();

    if (selectedFriend) loadChatMessages();
  }
});

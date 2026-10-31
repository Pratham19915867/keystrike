"use strict";

/*
=====================================================
 KEYSTRIKE V5 — LIVE CHAT EXPERIENCE

 - Global incoming message notifications
 - Notification sound
 - Per-friend unread badges
 - Social navigation unread dot
 - WhatsApp-style typing indicator
 - Supabase Realtime Broadcast
 - Database-backed read state
 - Multi-device read synchronization

 Requires script.js before this file.
=====================================================
*/

(() => {
  const $ = id => document.getElementById(id);

  if (typeof db === "undefined" || !db) {
    console.warn("KEYSTRIKE Chat Live: Supabase unavailable");
    return;
  }

  const client = db;

  const REFRESH_INTERVAL = 12000;
  const TYPING_TIMEOUT = 3200;
  const TYPING_THROTTLE = 900;

  let activeUserId = null;

  let messageChannelLive = null;
  let readChannelLive = null;
  let typingChannelLive = null;

  let unreadCounts = new Map();

  let unreadTimer = null;
  let authTimer = null;
  let typingStopTimer = null;

  let lastTypingSent = 0;
  let lastTypingFriendId = null;

  let remoteTypingTimers = new Map();

  let notificationAudio = null;
  let recentMessageIds = new Map();

  let unreadLoading = false;
  let unreadQueued = false;

  const escapeHTML = value =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  /* =====================================================
     STYLES / ELEMENTS
  ===================================================== */

  function ensureUI() {
    if (!$("ksChatNotificationStack")) {
      const stack = document.createElement("div");

      stack.id = "ksChatNotificationStack";
      stack.className = "ks-chat-notification-stack";
      stack.setAttribute("aria-live", "polite");

      document.body.appendChild(stack);
    }

    if (!$("ksChatTypingLive")) {
      const indicator = document.createElement("div");

      indicator.id = "ksChatTypingLive";
      indicator.className = "ks-chat-typing-live";
      indicator.hidden = true;

      indicator.innerHTML = `
        <span class="ks-chat-typing-avatar">💬</span>

        <div class="ks-chat-typing-content">
          <strong id="ksChatTypingName">
            Typing...
          </strong>

          <span class="ks-chat-typing-dots">
            <i></i><i></i><i></i>
          </span>
        </div>
      `;

      const chatMessages = $("chatMessages");

      if (chatMessages) {
        chatMessages.after(indicator);
      }
    }
  }

  /* =====================================================
     NOTIFICATION SOUND
  ===================================================== */

  function playNotificationSound() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) return;

      notificationAudio ||= new AudioContextClass();

      if (notificationAudio.state === "suspended") {
        notificationAudio.resume();
      }

      const now = notificationAudio.currentTime;

      [660, 880].forEach((frequency, index) => {
        const oscillator =
          notificationAudio.createOscillator();

        const gain =
          notificationAudio.createGain();

        oscillator.type = "sine";

        oscillator.frequency.value = frequency;

        const start = now + index * 0.095;

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          0.045,
          start + 0.012
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + 0.17
        );

        oscillator.connect(gain);
        gain.connect(notificationAudio.destination);

        oscillator.start(start);
        oscillator.stop(start + 0.18);
      });

    } catch (error) {
      console.warn(
        "Chat notification sound unavailable:",
        error
      );
    }
  }

  /* =====================================================
     FRIEND LOOKUP
  ===================================================== */

  function friendProfile(userId) {
    if (!userId) return null;

    return friendProfiles?.get(userId) ||
      getAcceptedFriends().find(
        friend => friend.id === userId
      ) ||
      null;
  }

  function friendName(userId) {
    const profile = friendProfile(userId);

    return profile?.username ||
      "KEYSTRIKE Player";
  }

  /* =====================================================
     GLOBAL MESSAGE POPUP
  ===================================================== */

  function showMessageNotification(message) {
    const stack = $("ksChatNotificationStack");

    if (!stack) return;

    const senderId = message.sender_id;

    const profile = friendProfile(senderId);

    const name = friendName(senderId);

    const card = document.createElement("button");

    card.type = "button";
    card.className = "ks-chat-notification";

    const avatar = document.createElement("div");

    avatar.className = "ks-chat-notification-avatar";

    safeAvatar(
      avatar,
      profile?.avatar_url,
      name.charAt(0).toUpperCase()
    );

    const content = document.createElement("div");

    content.className =
      "ks-chat-notification-content";

    const title = document.createElement("strong");
    title.textContent = "💬 " + name;

    const preview = document.createElement("span");
    preview.textContent = message.content || "New message";

    content.append(title, preview);

    const arrow = document.createElement("span");

    arrow.className = "ks-chat-notification-arrow";
    arrow.textContent = "↗";

    card.append(avatar, content, arrow);

    card.addEventListener("click", () => {
      card.remove();

      const friend = friendProfile(senderId);

      if (friend) {
        navigate("social");
        openChat(friend);
      } else {
        navigate("social");
      }
    });

    stack.prepend(card);

    while (stack.children.length > 3) {
      stack.lastElementChild.remove();
    }

    setTimeout(() => {
      card.classList.add("ks-chat-notification-out");

      setTimeout(() => card.remove(), 350);
    }, 6500);

    playNotificationSound();
  }

  /* =====================================================
     UNREAD COUNTS
  ===================================================== */

  function updateFriendBadges() {
    const container = $("friendsList");

    if (!container) return;

    const cards = container.querySelectorAll(
      ".friend-card"
    );

    const friends = getAcceptedFriends();

    /*
     * Existing renderFriendsList() creates one card
     * per sorted friend.
     */
    const sortedFriends = [...friends].sort((a, b) => {
      const aOnline = onlineUsers.has(a.id) ? 1 : 0;
      const bOnline = onlineUsers.has(b.id) ? 1 : 0;

      return bOnline - aOnline ||
        a.username.localeCompare(b.username);
    });

    cards.forEach((card, index) => {
      const friend = sortedFriends[index];

      if (!friend) return;

      let badge = card.querySelector(
        ".ks-chat-unread-badge"
      );

      const count =
        unreadCounts.get(friend.id) || 0;

      if (count <= 0) {
        badge?.remove();
        return;
      }

      if (!badge) {
        badge = document.createElement("span");

        badge.className =
          "ks-chat-unread-badge";

        const info = card.querySelector(
          ".friend-info"
        );

        if (info) {
          info.appendChild(badge);
        } else {
          card.appendChild(badge);
        }
      }

      badge.textContent =
        count > 99 ? "99+" : String(count);

      badge.title =
        `${count} unread message${count === 1 ? "" : "s"}`;
    });

    const total = [...unreadCounts.values()]
      .reduce((sum, count) => sum + count, 0);

    updateGlobalUnread(total);
  }

  function updateGlobalUnread(total) {
    let badge = $("ksSocialUnreadBadge");

    if (!badge) {
      badge = document.createElement("span");

      badge.id = "ksSocialUnreadBadge";
      badge.className = "ks-social-unread-badge";

      const button = $("socialNavButton");

      button?.appendChild(badge);
    }

    badge.hidden = total <= 0;

    badge.textContent =
      total > 99 ? "99+" : String(total);

    document.title =
      total > 0
        ? `(${total}) KEYSTRIKE V5`
        : "KEYSTRIKE V5 — Competitive Typing Arena";
  }

  async function refreshUnread() {
    if (!activeUserId) return;

    if (unreadLoading) {
      unreadQueued = true;
      return;
    }

    unreadLoading = true;

    try {
      do {
        unreadQueued = false;

        const userId = activeUserId;

        const { data, error } = await client.rpc(
          "ks_get_unread_chats"
        );

        if (error) throw error;

        if (activeUserId !== userId) return;

        unreadCounts = new Map(
          (data || []).map(item => [
            item.friend_id,
            Number(item.unread_count) || 0
          ])
        );

        updateFriendBadges();

      } while (unreadQueued && activeUserId);

    } catch (error) {
      console.warn(
        "Unread messages refresh:",
        error.message
      );
    } finally {
      unreadLoading = false;
    }
  }

  async function markRead(friendId) {
    if (!activeUserId || !friendId) return;

    try {
      const { error } = await client.rpc(
        "ks_mark_chat_read",
        {
          p_friend_id: friendId
        }
      );

      if (error) throw error;

      unreadCounts.delete(friendId);

      updateFriendBadges();

      refreshUnread();

    } catch (error) {
      console.warn(
        "Mark chat read:",
        error.message
      );
    }
  }

  /* =====================================================
     MESSAGE REALTIME
  ===================================================== */

  function rememberMessage(id) {
    if (!id) return false;

    if (recentMessageIds.has(id)) {
      return false;
    }

    recentMessageIds.set(id, Date.now());

    for (const [messageId, timestamp] of recentMessageIds) {
      if (Date.now() - timestamp > 60000) {
        recentMessageIds.delete(messageId);
      }
    }

    return true;
  }

  async function onIncomingMessage(payload) {
    const message = payload?.new;

    if (
      !message ||
      message.receiver_id !== activeUserId
    ) return;

    if (!rememberMessage(message.id)) return;

    const senderId = message.sender_id;

    const chatIsOpen =
      selectedFriend?.id === senderId &&
      !$("chatConversation")?.hidden &&
      $("socialPage")?.classList.contains("active") &&
      document.visibilityState === "visible";

    if (chatIsOpen) {
      await markRead(senderId);
    } else {
      unreadCounts.set(
        senderId,
        (unreadCounts.get(senderId) || 0) + 1
      );

      updateFriendBadges();

      showMessageNotification(message);
    }

    setTimeout(refreshUnread, 500);
  }

  /* =====================================================
     TYPING INDICATOR
  ===================================================== */

  function hideTypingIndicator() {
    const indicator = $("ksChatTypingLive");

    if (indicator) {
      indicator.hidden = true;
    }
  }

  function showTypingIndicator(userId) {
    if (
      !selectedFriend ||
      selectedFriend.id !== userId ||
      $("chatConversation")?.hidden
    ) return;

    const indicator = $("ksChatTypingLive");

    if (!indicator) return;

    $("ksChatTypingName").textContent =
      friendName(userId) + " is typing";

    indicator.hidden = false;

    clearTimeout(remoteTypingTimers.get(userId));

    remoteTypingTimers.set(
      userId,
      setTimeout(() => {
        hideTypingIndicator();
        remoteTypingTimers.delete(userId);
      }, TYPING_TIMEOUT)
    );
  }

  async function sendTyping(typing) {
    if (
      !activeUserId ||
      !selectedFriend ||
      !typingChannelLive
    ) return;

    const friendId = selectedFriend.id;

    try {
      await typingChannelLive.send({
        type: "broadcast",
        event: "chat-typing",
        payload: {
          sender_id: activeUserId,
          receiver_id: friendId,
          typing: Boolean(typing)
        }
      });
    } catch (error) {
      console.warn(
        "Typing broadcast:",
        error.message
      );
    }
  }

  function onTypingInput() {
    if (
      !activeUserId ||
      !selectedFriend ||
      !$("chatMessageInput")?.value
    ) {
      return;
    }

    const now = Date.now();

    if (
      selectedFriend.id !== lastTypingFriendId ||
      now - lastTypingSent >= TYPING_THROTTLE
    ) {
      lastTypingSent = now;
      lastTypingFriendId = selectedFriend.id;

      sendTyping(true);
    }

    clearTimeout(typingStopTimer);

    typingStopTimer = setTimeout(() => {
      sendTyping(false);
      lastTypingFriendId = null;
    }, 1400);
  }

  function onRemoteTyping(payload) {
    const data = payload?.payload;

    if (
      !data ||
      data.receiver_id !== activeUserId ||
      data.sender_id === activeUserId
    ) return;

    if (!friendProfile(data.sender_id)) return;

    if (data.typing) {
      showTypingIndicator(data.sender_id);
    } else {
      clearTimeout(
        remoteTypingTimers.get(data.sender_id)
      );

      remoteTypingTimers.delete(data.sender_id);

      hideTypingIndicator();
    }
  }

  /* =====================================================
     SUPABASE CHANNELS
  ===================================================== */

  function startRealtime(userId) {
    messageChannelLive = client
      .channel(`ks-chat-live-messages-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`
        },
        onIncomingMessage
      )
      .subscribe();

    readChannelLive = client
      .channel(`ks-chat-read-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ks_chat_read_state",
          filter: `user_id=eq.${userId}`
        },
        () => refreshUnread()
      )
      .subscribe();

    /*
     * Shared typing channel; payload is filtered
     * by receiver_id and accepted friendship.
     *
     * Broadcast payload is advisory UI data.
     */
    typingChannelLive = client
      .channel("ks-private-chat-typing-v1")
      .on(
        "broadcast",
        { event: "chat-typing" },
        onRemoteTyping
      )
      .subscribe();
  }

  function stopRealtime() {
    [
      messageChannelLive,
      readChannelLive,
      typingChannelLive
    ].filter(Boolean).forEach(channel => {
      client.removeChannel(channel).catch(console.warn);
    });

    messageChannelLive = null;
    readChannelLive = null;
    typingChannelLive = null;
  }

  /* =====================================================
     AUTH SESSION
  ===================================================== */

  function syncAuth() {
    const userId = currentUser?.id || null;

    if (userId === activeUserId) return;

    stopRealtime();

    clearInterval(unreadTimer);

    unreadTimer = null;
    activeUserId = userId;

    unreadCounts.clear();
    recentMessageIds.clear();

    updateFriendBadges();

    hideTypingIndicator();

    if (!userId) return;

    startRealtime(userId);

    refreshUnread();

    unreadTimer = setInterval(
      refreshUnread,
      REFRESH_INTERVAL
    );
  }

  /* =====================================================
     CHAT OPEN / CLOSE WATCHER
  ===================================================== */

  let previousOpenFriendId = null;

  function watchOpenChat() {
    const chatVisible =
      selectedFriend &&
      !$("chatConversation")?.hidden;

    const friendId =
      chatVisible ? selectedFriend.id : null;

    if (friendId !== previousOpenFriendId) {
      previousOpenFriendId = friendId;

      hideTypingIndicator();

      clearTimeout(typingStopTimer);

      if (friendId && activeUserId) {
        markRead(friendId);
      }
    }

    updateFriendBadges();
  }

  /* =====================================================
     INITIALIZE
  ===================================================== */

  function initialize() {
    ensureUI();

    $("chatMessageInput")?.addEventListener(
      "input",
      onTypingInput
    );

    $("chatMessageForm")?.addEventListener(
      "submit",
      () => {
        sendTyping(false);
        clearTimeout(typingStopTimer);
      }
    );

    $("closeChatButton")?.addEventListener(
      "click",
      () => {
        sendTyping(false);
        hideTypingIndicator();
      }
    );

    authTimer = setInterval(() => {
      syncAuth();
      watchOpenChat();
    }, 900);

    syncAuth();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  console.log(
    "💬 KEYSTRIKE V5 LIVE CHAT READY"
  );

})();

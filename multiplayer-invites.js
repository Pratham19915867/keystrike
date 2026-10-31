"use strict";

/*
 =========================================
 KEYSTRIKE V5 — FRIEND RACE INVITATIONS
 =========================================

 Features:
 - Invite friends directly from race lobby
 - Send room invitations through private chat
 - One-click JOIN RACE from chat
 - No room code typing required
 - Existing friend/chat systems preserved
*/

(() => {
  const $ = id => document.getElementById(id);

  const INVITE_PREFIX = "🏎 KEYSTRIKE RACE INVITE";
  const CODE_PATTERN = /Room code:\s*([A-Z0-9]{6})/i;

  let inviteBusy = false;
  let joiningInvite = false;

  function toast(text, type = "") {
    if (typeof showToast === "function") {
      showToast(text, type);
    }
  }

  function getRoom() {
    return typeof mpRoom !== "undefined"
      ? mpRoom
      : null;
  }

  function getFriends() {
    if (typeof getAcceptedFriends !== "function") {
      return [];
    }

    return getAcceptedFriends();
  }

  function make(tag, className = "", text = "") {
    const node = document.createElement(tag);

    node.className = className;
    node.textContent = text;

    return node;
  }

  /* =====================================
     INVITE MODAL
  ===================================== */

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
      "Invite friends directly to your private race."
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

    if (overlay) overlay.hidden = true;
  }

  /* =====================================
     SEND INVITATION
  ===================================== */

  async function sendInvitation(friend, button) {
    const room = getRoom();

    if (
      inviteBusy ||
      !room ||
      !currentUser ||
      !db
    ) return;

    if (room.status !== "waiting") {
      toast(
        "Invitations are available while waiting.",
        "error"
      );
      return;
    }

    const accepted = getFriends().some(
      item => item.id === friend.id
    );

    if (!accepted) {
      toast("This player is not in your friends list.", "error");
      return;
    }

    inviteBusy = true;

    button.disabled = true;
    button.textContent = "SENDING...";

    try {
      const message =
        `${INVITE_PREFIX}\n` +
        `Room code: ${room.room_code}\n` +
        `Join my KEYSTRIKE multiplayer race!`;

      const { error } = await db
        .from("messages")
        .insert({
          sender_id: currentUser.id,
          receiver_id: friend.id,
          content: message
        });

      if (error) throw error;

      button.textContent = "✓ INVITED";

      toast(
        `Invitation sent to ${friend.username}!`,
        "success"
      );

    } catch (error) {
      console.error("Invite failed:", error);

      button.disabled = false;
      button.textContent = "INVITE";

      toast(error.message, "error");

    } finally {
      inviteBusy = false;
    }
  }

  /* =====================================
     FRIEND LIST
  ===================================== */

  function openInviteModal() {
    const room = getRoom();

    if (!room || room.status !== "waiting") {
      toast(
        "Create a room before inviting friends.",
        "error"
      );
      return;
    }

    createInviteModal();

    const container = $("ksInviteFriendList");

    container.replaceChildren();

    const friends = getFriends();

    if (!friends.length) {
      container.appendChild(
        make(
          "div",
          "ks-invite-empty",
          "No accepted friends yet. Add friends from the Social tab!"
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

      info.append(
        make(
          "strong",
          "",
          friend.username || "Player"
        ),
        make(
          "small",
          "",
          `⚡ ${friend.best_wpm || 0} WPM`
        )
      );

      const button = make(
        "button",
        "ks-invite-send",
        "INVITE"
      );

      button.type = "button";

      button.addEventListener("click", () => {
        sendInvitation(friend, button);
      });

      row.append(avatar, info, button);

      container.appendChild(row);
    });

    $("ksInviteOverlay").hidden = false;
  }

  /* =====================================
     LOBBY INVITE BUTTON
  ===================================== */

  function updateInviteButton() {
    const lobby = $("multiplayerLobby");

    if (!lobby) return;

    const room = getRoom();

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

    button.hidden =
      !room ||
      room.status !== "waiting";
  }

  /* =====================================
     INVITATION DETECTION
  ===================================== */

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

  /* =====================================
     JOIN ROOM FROM CHAT
  ===================================== */

  async function joinInvitedRoom(code) {
    if (joiningInvite) return;

    if (!currentUser || !db) {
      toast("Sign in to join the race.", "error");

      if (typeof openAccount === "function") {
        openAccount();
      }

      return;
    }

    if (typeof mpEnter !== "function") {
      toast("Multiplayer engine unavailable.", "error");
      return;
    }

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      toast("Invalid invitation code.", "error");
      return;
    }

    if (getRoom()?.room_code === code) {
      navigate("race");
      mpTab();
      toast("You are already in this room.");
      return;
    }

    if (getRoom()) {
      toast(
        "Leave your current room before joining another.",
        "error"
      );
      return;
    }

    joiningInvite = true;

    toast("Joining friend's race...");

    try {
      const { data, error } = await db.rpc(
        "join_race_room",
        {
          input_code: code
        }
      );

      if (error) throw error;

      await mpEnter(data);

      if (getRoom()?.id !== data) {
        throw new Error(
          "Could not open the joined room."
        );
      }

      navigate("race");
      mpTab();

      toast(
        "🏎 Joined your friend's race!",
        "success"
      );

    } catch (error) {
      console.error("Invite join:", error);

      toast(error.message, "error");

    } finally {
      joiningInvite = false;
    }
  }

  /* =====================================
     CHAT INVITE BUTTONS
  ===================================== */

  function enhanceChatInvitations() {
    const container = $("chatMessages");

    if (!container) return;

    container.querySelectorAll(
      ".chat-message-bubble"
    ).forEach(bubble => {
      const code = getInvitationCode(
        bubble.textContent
      );

      if (!code) return;

      const wrapper = bubble.closest(
        ".chat-message"
      );

      if (!wrapper) return;

      if (wrapper.querySelector(
        ".ks-chat-join-race"
      )) return;

      const button = make(
        "button",
        "ks-chat-join-race",
        "🏎 JOIN RACE →"
      );

      button.type = "button";

      button.addEventListener("click", () => {
        joinInvitedRoom(code);
      });

      wrapper.appendChild(button);
    });
  }

  /* =====================================
     CHAT INVITE DETECTION
  ===================================== */

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

  /* =====================================
     LOBBY DETECTION
  ===================================== */

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

  /* =====================================
     INITIALIZATION
  ===================================== */

  function initializeInvites() {
    createInviteModal();
    watchLobby();
    watchChat();

    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeInviteModal();
        }
      }
    );

    console.log(
      "👥 KEYSTRIKE FRIEND INVITES READY"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeInvites
    );
  } else {
    initializeInvites();
  }

})();

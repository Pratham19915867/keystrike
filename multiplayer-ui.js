/* ==========================================
   KEYSTRIKE V5
   MULTIPLAYER ARENA SETTINGS + ROOM PREVIEW
========================================== */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const MODES = [
    {
      id: "classic",
      icon: "🏎️",
      name: "CLASSIC RACE",
      description: "First to finish wins"
    },
    {
      id: "sprint",
      icon: "⚡",
      name: "SPEED SPRINT",
      description: "Race against the clock"
    },
    {
      id: "accuracy",
      icon: "🎯",
      name: "ACCURACY DUEL",
      description: "Precision determines victory"
    },
    {
      id: "code",
      icon: "💻",
      name: "CODE BATTLE",
      description: "Race with programming text"
    },
    {
      id: "custom",
      icon: "📝",
      name: "CUSTOM RACE",
      description: "Create your own challenge"
    }
  ];

  const TEXT_OPTIONS = [
    { id: "words", name: "Words" },
    { id: "quote", name: "Quote" },
    { id: "code", name: "Code" },
    { id: "punctuation", name: "Punctuation" },
    { id: "numbers", name: "Numbers" },
    { id: "custom", name: "Custom" }
  ];

  const TIME_OPTIONS = [15, 30, 60, 120, 180];

  const PLAYER_OPTIONS = [2, 3, 4];

  let selectedMode = "classic";
  let selectedText = "words";
  let selectedTime = 60;
  let selectedPlayers = 4;

  function getSettings() {
    return {
      game_mode: selectedMode,
      text_mode: selectedText,
      time_limit: selectedTime,
      max_players: selectedPlayers,
      custom_passage:
        $("ksMpCustomPassage")?.value.trim() || null
    };
  }

  /*
   * Keep the existing API available immediately.
   * phase4.js uses KeystrikeRaceSettings.get().
   */
  window.KeystrikeRaceSettings = {
    get: getSettings
  };

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getMode() {
    return (
      MODES.find((mode) => mode.id === selectedMode) ||
      MODES[0]
    );
  }

  function getTextLabel() {
    return (
      TEXT_OPTIONS.find(
        (option) => option.id === selectedText
      )?.name || "Words"
    );
  }

  function createModeCards() {
    return MODES.map((mode) => {
      const active =
        mode.id === selectedMode ? " active" : "";

      return `
        <button
          type="button"
          class="ks-mp-mode-card${active}"
          data-ks-mode="${mode.id}"
          aria-pressed="${mode.id === selectedMode}"
        >
          <span class="ks-mp-mode-icon">
            ${mode.icon}
          </span>

          <strong>
            ${escapeHTML(mode.name)}
          </strong>

          <small>
            ${escapeHTML(mode.description)}
          </small>
        </button>
      `;
    }).join("");
  }

  function createTextChoices() {
    return TEXT_OPTIONS.map((option) => {
      return `
        <button
          type="button"
          class="ks-mp-choice"
          data-ks-text="${option.id}"
        >
          ${escapeHTML(option.name)}
        </button>
      `;
    }).join("");
  }

  function createTimeChoices() {
    return TIME_OPTIONS.map((time) => {
      return `
        <button
          type="button"
          class="ks-mp-choice"
          data-ks-time="${time}"
        >
          ${time}s
        </button>
      `;
    }).join("");
  }

  function createPlayerChoices() {
    return PLAYER_OPTIONS.map((players) => {
      return `
        <button
          type="button"
          class="ks-mp-choice"
          data-ks-players="${players}"
        >
          ${players} Players
        </button>
      `;
    }).join("");
  }

  function buildSettingsPanel() {
    const panel = document.createElement("section");

    panel.id = "ksMultiplayerSettings";
    panel.className = "ks-mp-settings-panel";

    panel.innerHTML = `
      <div class="ks-mp-settings-heading">

        <div class="ks-mp-eyebrow">
          <span class="ks-mp-live-dot"></span>
          MULTIPLAYER ARENA
        </div>

        <h2>
          Create Your Battle
        </h2>

        <p>
          Customize your race, challenge your friends,
          and compete for the fastest finish.
        </p>

      </div>

      <div class="ks-mp-setting-section">

        <div class="ks-mp-setting-title">
          01 / SELECT GAME MODE
        </div>

        <div class="ks-mp-mode-grid">
          ${createModeCards()}
        </div>

      </div>

      <div
        class="ks-mp-setting-section"
        id="ksMpTextOptions"
      >

        <div class="ks-mp-setting-title">
          02 / PASSAGE TYPE
        </div>

        <div class="ks-mp-choice-group">
          ${createTextChoices()}
        </div>

      </div>

      <div
        class="ks-mp-custom-wrapper"
        id="ksMpCustomWrapper"
        hidden
      >

        <div class="ks-mp-setting-title">
          YOUR CUSTOM PASSAGE
        </div>

        <textarea
          id="ksMpCustomPassage"
          class="ks-mp-custom-input"
          placeholder="Enter your custom racing passage (30–1000 characters)..."
          maxlength="1000"
          spellcheck="false"
        ></textarea>

        <div
          class="ks-mp-character-count"
          id="ksMpCharacterCount"
        >
          0 / 1000 characters
        </div>

      </div>

      <div class="ks-mp-setting-section">

        <div class="ks-mp-setting-title">
          03 / RACE DURATION
        </div>

        <div class="ks-mp-choice-group">
          ${createTimeChoices()}
        </div>

      </div>

      <div class="ks-mp-setting-section">

        <div class="ks-mp-setting-title">
          04 / MAXIMUM PLAYERS
        </div>

        <div class="ks-mp-choice-group">
          ${createPlayerChoices()}
        </div>

      </div>

      <div
        class="ks-mp-settings-summary"
        id="ksMpSettingsSummary"
        aria-live="polite"
      ></div>
    `;

    return panel;
  }

  function enhanceCreateCard(home) {
    const createButton = $("createRoomButton");

    if (!createButton) return;

    const card = createButton.closest(
      ".multiplayer-action-card"
    );

    if (!card) return;

    card.classList.add("ks-mp-create-card");

    /*
     * Keep the original Create Room button.
     * phase4.js already attaches its room creation handler.
     */
    const originalIcon = card.querySelector(
      ".multiplayer-action-icon"
    );

    if (originalIcon) {
      originalIcon.classList.add(
        "ks-mp-create-original-icon"
      );
    }

    const title = card.querySelector("h3");

    if (title) {
      title.textContent = "Ready to Race?";
    }

    const description = card.querySelector("p");

    if (description) {
      description.textContent =
        "Your private racing arena is one click away.";
    }

    if (!$("ksMpRacePreview")) {
      const preview = document.createElement("div");

      preview.id = "ksMpRacePreview";
      preview.className = "ks-mp-race-preview";

      preview.innerHTML = `
        <div class="ks-mp-preview-heading">

          <span>
            YOUR RACE CONFIGURATION
          </span>

          <span class="ks-mp-preview-status">
            ● READY
          </span>

        </div>

        <div class="ks-mp-preview-rows">

          <div class="ks-mp-preview-row">

            <span>
              🎮 Game Mode
            </span>

            <strong id="ksMpPreviewMode">
              Classic Race
            </strong>

          </div>

          <div class="ks-mp-preview-row">

            <span>
              📝 Passage
            </span>

            <strong id="ksMpPreviewText">
              Words
            </strong>

          </div>

          <div class="ks-mp-preview-row">

            <span>
              ⏱️ Duration
            </span>

            <strong id="ksMpPreviewTime">
              60 Seconds
            </strong>

          </div>

          <div class="ks-mp-preview-row">

            <span>
              👥 Players
            </span>

            <strong id="ksMpPreviewPlayers">
              4 Players
            </strong>

          </div>

        </div>

      `;

      createButton.before(preview);
    }

    if (!$("ksMpRoomBenefits")) {
      const benefits = document.createElement("div");

      benefits.id = "ksMpRoomBenefits";
      benefits.className = "ks-mp-room-benefits";

      benefits.innerHTML = `
        <span>
          🔒 Private Room
        </span>

        <span>
          ⚡ Real-time Racing
        </span>
      `;

      createButton.before(benefits);
    }

    createButton.classList.add(
      "ks-mp-primary-create-button"
    );

    if (!$("ksMpCreateFeedback")) {
      const feedback = document.createElement("div");

      feedback.id = "ksMpCreateFeedback";
      feedback.className = "ks-mp-create-feedback";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");

      createButton.after(feedback);
    }

    if (!$("ksMpHowItWorks")) {
      const guide = document.createElement("div");

      guide.id = "ksMpHowItWorks";
      guide.className = "ks-mp-how-it-works";

      guide.innerHTML = `
        <div class="ks-mp-how-title">
          HOW IT WORKS
        </div>

        <div class="ks-mp-how-step">
          <span>01</span>
          <p>Create your private race room</p>
        </div>

        <div class="ks-mp-how-step">
          <span>02</span>
          <p>Share the room code with friends</p>
        </div>

        <div class="ks-mp-how-step">
          <span>03</span>
          <p>Wait until everyone is ready</p>
        </div>

        <div class="ks-mp-how-step">
          <span>04</span>
          <p>Host starts the race — fastest wins!</p>
        </div>
      `;

      card.appendChild(guide);
    }

    /*
     * Decorative feedback only.
     * Do not intercept or replace phase4.js listeners.
     */
    if (!createButton.dataset.ksPreviewFeedback) {
      createButton.dataset.ksPreviewFeedback = "1";

      createButton.addEventListener("click", () => {
        const feedback = $("ksMpCreateFeedback");

        if (!feedback) return;

        feedback.textContent =
          "⏳ Preparing your private race room...";

        window.setTimeout(() => {
          if (!feedback.isConnected) return;

          feedback.textContent = "";
        }, 12000);
      });
    }

    const joinCard = $("joinRoomForm")?.closest(
      ".multiplayer-action-card"
    );

    if (joinCard) {
      joinCard.classList.add("ks-mp-join-card");
    }

    home.classList.add("ks-mp-enhanced-home");
  }

  function updateEverything() {
    const panel = $("ksMultiplayerSettings");

    if (!panel) return;

    panel.querySelectorAll("[data-ks-mode]").forEach(
      (button) => {
        const active =
          button.dataset.ksMode === selectedMode;

        button.classList.toggle("active", active);
        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );

    panel.querySelectorAll("[data-ks-text]").forEach(
      (button) => {
        const active =
          button.dataset.ksText === selectedText;

        button.classList.toggle("active", active);
        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );

    panel.querySelectorAll("[data-ks-time]").forEach(
      (button) => {
        const active =
          Number(button.dataset.ksTime) ===
          selectedTime;

        button.classList.toggle("active", active);
        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );

    panel.querySelectorAll(
      "[data-ks-players]"
    ).forEach((button) => {
      const active =
        Number(button.dataset.ksPlayers) ===
        selectedPlayers;

      button.classList.toggle("active", active);
      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });

    const customWrapper = $("ksMpCustomWrapper");

    if (customWrapper) {
      customWrapper.hidden =
        selectedText !== "custom";
    }

    const passage = $("ksMpCustomPassage");

    const characterCount = $("ksMpCharacterCount");

    if (passage && characterCount) {
      const length = passage.value.trim().length;

      characterCount.textContent =
        `${length} / 1000 characters`;

      characterCount.classList.toggle(
        "ks-mp-count-invalid",
        selectedText === "custom" &&
        length > 0 &&
        length < 30
      );
    }

    const mode = getMode();

    const summary = $("ksMpSettingsSummary");

    if (summary) {
      summary.textContent =
        `${mode.name}  •  ${getTextLabel()}  •  ` +
        `${selectedTime}s  •  ${selectedPlayers} Players`;
    }

    const previewMode = $("ksMpPreviewMode");
    const previewText = $("ksMpPreviewText");
    const previewTime = $("ksMpPreviewTime");
    const previewPlayers = $("ksMpPreviewPlayers");

    if (previewMode) {
      previewMode.textContent = mode.name;
    }

    if (previewText) {
      previewText.textContent = getTextLabel();
    }

    if (previewTime) {
      previewTime.textContent =
        `${selectedTime} Seconds`;
    }

    if (previewPlayers) {
      previewPlayers.textContent =
        `${selectedPlayers} Players`;
    }
  }

  function bindSettings(panel) {
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("button");

      if (!button || !panel.contains(button)) return;

      if (button.dataset.ksMode) {
        selectedMode = button.dataset.ksMode;

        if (selectedMode === "code") {
          selectedText = "code";
        } else if (selectedMode === "custom") {
          selectedText = "custom";
        } else if (
          selectedText === "custom" ||
          selectedText === "code"
        ) {
          selectedText = "words";
        }

        updateEverything();
        return;
      }

      if (button.dataset.ksText) {
        selectedText = button.dataset.ksText;

        /*
         * Preserve explicit code/custom modes.
         * The backend receives both game_mode and text_mode.
         */
        updateEverything();
        return;
      }

      if (button.dataset.ksTime) {
        selectedTime = Number(
          button.dataset.ksTime
        );

        updateEverything();
        return;
      }

      if (button.dataset.ksPlayers) {
        selectedPlayers = Number(
          button.dataset.ksPlayers
        );

        updateEverything();
      }
    });

    $("ksMpCustomPassage")?.addEventListener(
      "input",
      updateEverything
    );
  }

  function init() {
    const home = $("multiplayerHome");

    if (!home) return;

    if (!$("ksMultiplayerSettings")) {
      const panel = buildSettingsPanel();

      home.prepend(panel);

      bindSettings(panel);
    }

    enhanceCreateCard(home);

    updateEverything();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();

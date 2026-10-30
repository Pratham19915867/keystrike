"use strict";

/*
  KEYSTRIKE V5
  MULTIPLAYER ROOM SETTINGS — UI FIX

  Fixes:
  - Settings remain inside multiplayerHome
  - CREATE / JOIN section stays visible
  - Summary updates immediately
  - Mode, text, time and player selection sync
  - No MutationObserver loops
  - Existing racing engine API preserved
*/

(() => {
  const $ = id => document.getElementById(id);

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

  let selectedMode = "classic";
  let selectedText = "words";
  let selectedTime = 60;
  let selectedPlayers = 4;

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function createSection(title) {
    const section = element(
      "div",
      "ks-mp-setting-section"
    );

    section.appendChild(
      element("div", "ks-mp-setting-title", title)
    );

    return section;
  }

  function createChoice(label, value, selected, callback) {
    const button = element(
      "button",
      "ks-mp-choice",
      label
    );

    button.type = "button";
    button.dataset.value = String(value);
    button.classList.toggle("active", selected);

    button.addEventListener("click", callback);

    return button;
  }

  function updateGroup(group, value) {
    group.querySelectorAll(".ks-mp-choice")
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.value === String(value)
        );
      });
  }

  function buildRoomSettings() {
    const home = $("multiplayerHome");

    if (!home || $("ksMultiplayerSettings")) return;

    const panel = element(
      "div",
      "ks-mp-settings-panel"
    );

    panel.id = "ksMultiplayerSettings";

    const heading = element(
      "div",
      "ks-mp-settings-heading"
    );

    heading.append(
      element("div", "eyebrow", "CONFIGURE YOUR ARENA"),
      element("h2", "", "Create Your Battle."),
      element(
        "p",
        "",
        "Choose your race mode, passage and competition settings."
      )
    );

    panel.appendChild(heading);

    // GAME MODES

    const modeSection = createSection("🎮 SELECT GAME MODE");
    const modeGrid = element("div", "ks-mp-mode-grid");

    MODES.forEach(mode => {
      const button = element(
        "button",
        "ks-mp-mode-card"
      );

      button.type = "button";
      button.dataset.mode = mode.id;

      button.append(
        element("span", "ks-mp-mode-icon", mode.icon),
        element("strong", "", mode.name),
        element("small", "", mode.description)
      );

      button.addEventListener("click", () => {
        selectedMode = mode.id;

        if (selectedMode === "code") {
          selectedText = "code";
        } else if (selectedMode === "custom") {
          selectedText = "custom";
        }

        updateEverything();
      });

      modeGrid.appendChild(button);
    });

    modeSection.appendChild(modeGrid);
    panel.appendChild(modeSection);

    // TEXT TYPES

    const textSection = createSection("⌨️ TEXT TYPE");

    const textGroup = element(
      "div",
      "ks-mp-choice-group"
    );

    textGroup.id = "ksMpTextOptions";

    const textOptions = [
      ["Words", "words"],
      ["Quote", "quote"],
      ["Code", "code"],
      ["Punctuation", "punctuation"],
      ["Numbers", "numbers"],
      ["Custom", "custom"]
    ];

    textOptions.forEach(([label, value]) => {
      textGroup.appendChild(
        createChoice(
          label,
          value,
          value === selectedText,
          () => {
            selectedText = value;
            updateEverything();
          }
        )
      );
    });

    textSection.appendChild(textGroup);

    // CUSTOM PASSAGE

    const customWrapper = element(
      "div",
      "ks-mp-custom-wrapper"
    );

    customWrapper.id = "ksMpCustomWrapper";
    customWrapper.hidden = true;

    const customInput = document.createElement("textarea");

    customInput.id = "ksMpCustomPassage";
    customInput.className = "ks-mp-custom-input";
    customInput.placeholder =
      "Enter your custom typing passage (30–1000 characters)...";

    customInput.maxLength = 1000;
    customInput.rows = 4;

    customWrapper.appendChild(customInput);
    textSection.appendChild(customWrapper);
    panel.appendChild(textSection);

    // TIME LIMIT

    const timeSection = createSection("⏱️ TIME LIMIT");
    const timeGroup = element("div", "ks-mp-choice-group");

    [15, 30, 60, 120, 180].forEach(seconds => {
      timeGroup.appendChild(
        createChoice(
          seconds + "s",
          seconds,
          seconds === selectedTime,
          () => {
            selectedTime = seconds;
            updateEverything();
          }
        )
      );
    });

    timeSection.appendChild(timeGroup);
    panel.appendChild(timeSection);

    // MAX PLAYERS

    const playerSection = createSection("👥 MAX PLAYERS");
    const playerGroup = element("div", "ks-mp-choice-group");

    [2, 3, 4].forEach(count => {
      playerGroup.appendChild(
        createChoice(
          count + " PLAYERS",
          count,
          count === selectedPlayers,
          () => {
            selectedPlayers = count;
            updateEverything();
          }
        )
      );
    });

    playerSection.appendChild(playerGroup);
    panel.appendChild(playerSection);

    // SUMMARY

    const summary = element(
      "div",
      "ks-mp-settings-summary"
    );

    summary.id = "ksMpSettingsSummary";

    panel.appendChild(summary);

    /*
      IMPORTANT:
      The panel must be INSIDE multiplayerHome.

      This keeps room creation settings together
      with CREATE ROOM and JOIN ROOM buttons.
    */

    home.prepend(panel);

    function updateEverything() {
      modeGrid.querySelectorAll(".ks-mp-mode-card")
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.mode === selectedMode
          );
        });

      updateGroup(textGroup, selectedText);
      updateGroup(timeGroup, selectedTime);
      updateGroup(playerGroup, selectedPlayers);

      customWrapper.hidden =
        selectedText !== "custom" &&
        selectedMode !== "custom";

      const mode = MODES.find(
        item => item.id === selectedMode
      );

      summary.textContent =
        `${mode.icon} ${mode.name} · ` +
        `${selectedText.toUpperCase()} · ` +
        `${selectedTime}s · ` +
        `${selectedPlayers} PLAYERS`;
    }

    updateEverything();
  }

  // API expected by phase4.js

  window.KeystrikeRaceSettings = {
    get() {
      return {
        game_mode: selectedMode,
        text_mode: selectedText,
        time_limit: selectedTime,
        max_players: selectedPlayers,
        custom_passage:
          $("ksMpCustomPassage")?.value.trim() || null
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      buildRoomSettings
    );
  } else {
    buildRoomSettings();
  }

  console.log("🎮 KEYSTRIKE MULTIPLAYER UI FIX LOADED");
})();

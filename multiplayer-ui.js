"use strict";

/* =====================================================
   KEYSTRIKE V5
   MULTIPLAYER V6 INTERFACE
===================================================== */

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

function element(tag, className, text = "") {
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
    element(
      "div",
      "ks-mp-setting-title",
      title
    )
  );

  return section;
}

function createChoice(
  label,
  value,
  selected,
  onClick
) {
  const button = element(
    "button",
    "ks-mp-choice",
    label
  );

  button.type = "button";

  button.dataset.value = value;

  button.classList.toggle(
    "active",
    selected
  );

  button.addEventListener("click", onClick);

  return button;
}

function updateGroup(group, value) {
  group.querySelectorAll(
    ".ks-mp-choice"
  ).forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.value === String(value)
    );

  });
}

function buildRoomSettings() {

  const home = $("multiplayerHome");

  if (!home) return;

  if ($("ksMultiplayerSettings")) return;

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
    element(
      "div",
      "eyebrow",
      "CONFIGURE YOUR ARENA"
    ),
    element(
      "h2",
      "",
      "Create Your Battle."
    ),
    element(
      "p",
      "",
      "Choose your race mode, passage and competition settings."
    )
  );

  panel.appendChild(heading);

  /* GAME MODES */

  const modeSection = createSection(
    "🎮 SELECT GAME MODE"
  );

  const modeGrid = element(
    "div",
    "ks-mp-mode-grid"
  );

  MODES.forEach(mode => {

    const button = element(
      "button",
      "ks-mp-mode-card"
    );

    button.type = "button";

    button.dataset.mode = mode.id;

    const icon = element(
      "span",
      "ks-mp-mode-icon",
      mode.icon
    );

    const name = element(
      "strong",
      "",
      mode.name
    );

    const description = element(
      "small",
      "",
      mode.description
    );

    button.append(
      icon,
      name,
      description
    );

    button.addEventListener("click", () => {

      selectedMode = mode.id;

      modeGrid.querySelectorAll(
        ".ks-mp-mode-card"
      ).forEach(card => {

        card.classList.toggle(
          "active",
          card.dataset.mode === selectedMode
        );

      });

      if (selectedMode === "code") {
        selectedText = "code";
      }

      if (selectedMode === "custom") {
        selectedText = "custom";
      }

      updateTextSelection();

    });

    modeGrid.appendChild(button);

  });

  modeSection.appendChild(modeGrid);

  panel.appendChild(modeSection);

  /* TEXT TYPE */

  const textSection = createSection(
    "⌨️ TEXT TYPE"
  );

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

    const button = createChoice(
      label,
      value,
      value === selectedText,
      () => {

        selectedText = value;

        updateTextSelection();

      }
    );

    textGroup.appendChild(button);

  });

  textSection.appendChild(textGroup);

  /* CUSTOM PASSAGE */

  const customWrapper = element(
    "div",
    "ks-mp-custom-wrapper"
  );

  customWrapper.id = "ksMpCustomWrapper";

  customWrapper.hidden = true;

  const customInput = document.createElement(
    "textarea"
  );

  customInput.id = "ksMpCustomPassage";

  customInput.className =
    "ks-mp-custom-input";

  customInput.placeholder =
    "Enter your custom typing passage (30–1000 characters)...";

  customInput.maxLength = 1000;

  customInput.rows = 4;

  customWrapper.appendChild(customInput);

  textSection.appendChild(customWrapper);

  panel.appendChild(textSection);

  /* TIME LIMIT */

  const timeSection = createSection(
    "⏱️ TIME LIMIT"
  );

  const timeGroup = element(
    "div",
    "ks-mp-choice-group"
  );

  [
    15,
    30,
    60,
    120,
    180
  ].forEach(seconds => {

    const button = createChoice(
      seconds + "s",
      seconds,
      seconds === selectedTime,
      () => {

        selectedTime = seconds;

        updateGroup(
          timeGroup,
          selectedTime
        );

      }
    );

    timeGroup.appendChild(button);

  });

  timeSection.appendChild(timeGroup);

  panel.appendChild(timeSection);

  /* PLAYER LIMIT */

  const playerSection = createSection(
    "👥 MAX PLAYERS"
  );

  const playerGroup = element(
    "div",
    "ks-mp-choice-group"
  );

  [2, 3, 4].forEach(count => {

    const button = createChoice(
      count + " PLAYERS",
      count,
      count === selectedPlayers,
      () => {

        selectedPlayers = count;

        updateGroup(
          playerGroup,
          selectedPlayers
        );

      }
    );

    playerGroup.appendChild(button);

  });

  playerSection.appendChild(playerGroup);

  panel.appendChild(playerSection);

  /* SUMMARY */

  const summary = element(
    "div",
    "ks-mp-settings-summary"
  );

  summary.id = "ksMpSettingsSummary";

  summary.textContent =
    "🏎️ CLASSIC RACE · WORDS · 60s · 4 PLAYERS";

  panel.appendChild(summary);

  home.parentNode.insertBefore(
    panel,
    home
  );

  function updateTextSelection() {

    updateGroup(
      textGroup,
      selectedText
    );

    customWrapper.hidden =
      selectedText !== "custom" &&
      selectedMode !== "custom";

    updateSummary();

  }

  function updateSummary() {

    const mode = MODES.find(
      item => item.id === selectedMode
    );

    summary.textContent =
      `${mode.icon} ${mode.name} · ` +
      `${selectedText.toUpperCase()} · ` +
      `${selectedTime}s · ` +
      `${selectedPlayers} PLAYERS`;

  }

  const observer = new MutationObserver(
    updateSummary
  );

  observer.observe(modeGrid, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class"]
  });

  modeGrid.querySelector(
    '[data-mode="classic"]'
  )?.classList.add("active");

  updateSummary();

}

/* =====================================================
   EXPORT SETTINGS FOR THE RACING ENGINE
===================================================== */

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

/* =====================================================
   INITIALIZE
===================================================== */

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    buildRoomSettings
  );

} else {

  buildRoomSettings();

}

console.log(
  "🎮 KEYSTRIKE MULTIPLAYER UI READY"
);

})();

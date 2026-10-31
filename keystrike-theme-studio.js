"use strict";

/*
=====================================================
 KEYSTRIKE V5 — CUSTOM THEME STUDIO V2
 Fixed Settings integration and theme persistence.
=====================================================
*/

(() => {
  const STORAGE_KEY = "ks_v5_theme_studio";

  const PRESETS = {
    cyber: {
      label: "Cyber",
      icon: "⚡",
      primary: "#65a8ff",
      accent: "#a879ff",
      background: "#090d15",
      surface: "#151b27",
      keyboard: "#65a8ff"
    },

    ocean: {
      label: "Ocean",
      icon: "🌊",
      primary: "#35c9ff",
      accent: "#20e2c1",
      background: "#06131d",
      surface: "#102532",
      keyboard: "#35c9ff"
    },

    inferno: {
      label: "Inferno",
      icon: "🔥",
      primary: "#ff7049",
      accent: "#ffb454",
      background: "#180b0b",
      surface: "#291715",
      keyboard: "#ff7049"
    },

    matrix: {
      label: "Matrix",
      icon: "💚",
      primary: "#42ef89",
      accent: "#b9ff59",
      background: "#050f09",
      surface: "#102017",
      keyboard: "#42ef89"
    },

    sakura: {
      label: "Sakura",
      icon: "🌸",
      primary: "#ff83bc",
      accent: "#bc8cff",
      background: "#160d1c",
      surface: "#29182f",
      keyboard: "#ff83bc"
    },

    emerald: {
      label: "Emerald",
      icon: "💎",
      primary: "#37e6a0",
      accent: "#81f7d2",
      background: "#071811",
      surface: "#112a21",
      keyboard: "#37e6a0"
    },

    sunset: {
      label: "Sunset",
      icon: "🌅",
      primary: "#ff9659",
      accent: "#ff5c83",
      background: "#190d17",
      surface: "#30202b",
      keyboard: "#ff9659"
    },

    golden: {
      label: "Golden",
      icon: "👑",
      primary: "#ffd166",
      accent: "#ffab40",
      background: "#141108",
      surface: "#292416",
      keyboard: "#ffd166"
    }
  };

  const DEFAULT_CUSTOM = {
    ...PRESETS.cyber,
    glow: 55,
    fontSize: 29,
    animations: true
  };

  const $ = id => document.getElementById(id);

  let stored = null;

  try {
    stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "null"
    );
  } catch {
    stored = null;
  }

  const existingSettings = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("ks_v3_settings") || "{}"
      );
    } catch {
      return {};
    }
  })();

  let state = {
    preset:
      stored?.preset ||
      existingSettings.theme ||
      "cyber",

    colors: {
      ...DEFAULT_CUSTOM,
      ...(stored?.colors || {})
    }
  };

  if (
    state.preset !== "custom" &&
    !PRESETS[state.preset]
  ) {
    state.preset = "cyber";
  }

  function validHex(value) {
    return (
      typeof value === "string" &&
      /^#[0-9a-f]{6}$/i.test(value)
    );
  }

  function rgb(hex) {
    const value = hex.replace("#", "");

    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  }

  function rgba(hex, alpha) {
    const [r, g, b] = rgb(hex);

    return `rgba(${r},${g},${b},${alpha})`;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn("Theme save:", error);
    }
  }

  function currentColors() {
    if (state.preset === "custom") {
      return {
        ...DEFAULT_CUSTOM,
        ...state.colors
      };
    }

    return {
      ...DEFAULT_CUSTOM,
      ...(PRESETS[state.preset] || PRESETS.cyber)
    };
  }

  function applyTheme() {
    const colors = currentColors();

    const root = document.documentElement;
    const body = document.body;

    if (!body) return;

    const primary = validHex(colors.primary)
      ? colors.primary
      : DEFAULT_CUSTOM.primary;

    const accent = validHex(colors.accent)
      ? colors.accent
      : DEFAULT_CUSTOM.accent;

    const background = validHex(colors.background)
      ? colors.background
      : DEFAULT_CUSTOM.background;

    const surface = validHex(colors.surface)
      ? colors.surface
      : DEFAULT_CUSTOM.surface;

    const keyboard = validHex(colors.keyboard)
      ? colors.keyboard
      : DEFAULT_CUSTOM.keyboard;

    const glow = Math.max(
      0,
      Math.min(100, Number(colors.glow) || 0)
    );

    const fontSize = Math.max(
      17,
      Math.min(42, Number(colors.fontSize) || 29)
    );

    root.style.setProperty(
      "--ks-studio-primary",
      primary
    );

    root.style.setProperty(
      "--ks-studio-accent",
      accent
    );

    root.style.setProperty(
      "--ks-studio-background",
      background
    );

    root.style.setProperty(
      "--ks-studio-surface",
      surface
    );

    root.style.setProperty(
      "--ks-studio-keyboard",
      keyboard
    );

    root.style.setProperty(
      "--ks-studio-primary-glow",
      rgba(primary, glow / 300)
    );

    root.style.setProperty(
      "--ks-studio-accent-glow",
      rgba(accent, glow / 350)
    );

    root.style.setProperty(
      "--ks-studio-keyboard-rgb",
      rgb(keyboard).join(",")
    );

    root.style.setProperty(
      "--font-size",
      fontSize + "px"
    );

    body.dataset.themeStudio = state.preset;

    body.classList.toggle(
      "ks-studio-no-animation",
      colors.animations === false
    );

    /*
     * Keep base theme compatible with script.js.
     * Custom uses Cyber as its underlying legacy theme.
     */
    const legacyTheme =
      state.preset === "custom"
        ? "cyber"
        : state.preset;

    if (body.dataset.theme !== legacyTheme) {
      body.dataset.theme = legacyTheme;
    }

    updatePreview();
  }

  function updatePreview() {
    const preview = $("ksThemeLivePreview");

    if (!preview) return;

    const colors = currentColors();

    preview.style.background = colors.background;
    preview.style.borderColor = colors.primary;

    const title = preview.querySelector(
      ".ks-theme-preview-title"
    );

    if (title) {
      title.style.color = colors.primary;
    }

    const card = preview.querySelector(
      ".ks-theme-preview-card"
    );

    if (card) {
      card.style.background = colors.surface;
      card.style.borderColor = colors.accent;
    }

    const button = preview.querySelector(
      ".ks-theme-preview-button"
    );

    if (button) {
      button.style.background = colors.primary;

      button.style.boxShadow =
        `0 0 25px ${rgba(colors.primary, .25)}`;
    }

    preview.querySelectorAll(
      ".ks-theme-preview-key"
    ).forEach(key => {
      key.style.color = colors.keyboard;
      key.style.borderColor = colors.keyboard;
    });
  }

  function colorRow(key, title, description) {
    return `
      <label class="ks-theme-control">
        <span>
          <strong>${title}</strong>
          <small>${description}</small>
        </span>

        <input
          type="color"
          data-ks-color="${key}"
          value="${DEFAULT_CUSTOM[key]}"
        >
      </label>
    `;
  }

  function buildStudio() {
    /*
     * Important fix:
     * The real Settings scroll area is .settings-scroll,
     * NOT #settingsPanel itself.
     */
    const scrollArea = document.querySelector(
      "#settingsPanel .settings-scroll"
    );

    if (!scrollArea || $("ksThemeStudio")) return;

    const studio = document.createElement("section");

    studio.id = "ksThemeStudio";
    studio.className = "ks-theme-studio";

    studio.innerHTML = `
      <div class="ks-theme-heading">
        <span>🎨 PERSONALIZATION</span>
        <h2>Custom Theme Studio</h2>
        <p>Build your perfect typing arena.</p>
      </div>

      <div class="ks-theme-section-title">
        CHOOSE A THEME
      </div>

      <div class="ks-theme-preset-grid">
        ${Object.entries(PRESETS).map(
          ([id, preset]) => `
            <button
              type="button"
              class="ks-theme-preset"
              data-ks-preset="${id}"
            >
              <span class="ks-theme-preset-icon">
                ${preset.icon}
              </span>

              <strong>${preset.label}</strong>

              <span
                class="ks-theme-preset-color"
                style="background:${preset.primary}"
              ></span>
            </button>
          `
        ).join("")}
      </div>

      <button
        type="button"
        id="ksThemeCustomButton"
        class="ks-theme-custom-button"
      >
        ✨ CREATE YOUR OWN THEME
      </button>

      <div class="ks-theme-section-title">
        CUSTOMIZE COLORS
      </div>

      <div class="ks-theme-controls">
        ${colorRow(
          "primary",
          "Primary",
          "Buttons and highlights"
        )}

        ${colorRow(
          "accent",
          "Accent",
          "Borders and secondary effects"
        )}

        ${colorRow(
          "background",
          "Background",
          "Website background"
        )}

        ${colorRow(
          "surface",
          "Cards",
          "Panel backgrounds"
        )}

        ${colorRow(
          "keyboard",
          "Keyboard RGB",
          "Keyboard lighting"
        )}
      </div>

      <div class="ks-theme-range-group">
        <div class="ks-theme-range-heading">
          <strong>✨ Glow Intensity</strong>
          <span id="ksThemeGlowValue">55%</span>
        </div>

        <input
          id="ksThemeGlow"
          type="range"
          min="0"
          max="100"
        >
      </div>

      <div class="ks-theme-range-group">
        <div class="ks-theme-range-heading">
          <strong>🔤 Typing Font Size</strong>
          <span id="ksThemeFontValue">29px</span>
        </div>

        <input
          id="ksThemeFont"
          type="range"
          min="17"
          max="42"
        >
      </div>

      <label class="ks-theme-animation-toggle">
        <span>⚡ Theme Animations</span>

        <input
          id="ksThemeAnimations"
          type="checkbox"
        >
      </label>

      <div class="ks-theme-section-title">
        LIVE PREVIEW
      </div>

      <div
        class="ks-theme-live-preview"
        id="ksThemeLivePreview"
      >
        <div class="ks-theme-preview-title">
          KEYSTRIKE V5
        </div>

        <div class="ks-theme-preview-card">
          <span>⚡ 120 WPM</span>
          <span>🎯 98% ACCURACY</span>
        </div>

        <div class="ks-theme-preview-keys">
          <span class="ks-theme-preview-key">K</span>
          <span class="ks-theme-preview-key">E</span>
          <span class="ks-theme-preview-key">Y</span>
          <span class="ks-theme-preview-key">S</span>
        </div>

        <div class="ks-theme-preview-button">
          START TYPING →
        </div>
      </div>

      <div class="ks-theme-actions">
        <button
          type="button"
          class="ks-theme-save"
          id="ksThemeSave"
        >
          💾 SAVE
        </button>

        <button
          type="button"
          class="ks-theme-reset"
          id="ksThemeReset"
        >
          ↺ RESET
        </button>
      </div>

      <p
        id="ksThemeMessage"
        class="ks-theme-message"
        aria-live="polite"
      ></p>
    `;

    const resetButton = $("resetSettings");

    if (resetButton) {
      resetButton.before(studio);
    } else {
      scrollArea.appendChild(studio);
    }

    bindEvents();
    syncControls();
    applyTheme();
  }

  function syncControls() {
    const colors = currentColors();

    document.querySelectorAll(
      "[data-ks-color]"
    ).forEach(input => {
      const key = input.dataset.ksColor;

      if (validHex(colors[key])) {
        input.value = colors[key];
      }
    });

    const glow = colors.glow ?? 55;
    const fontSize = colors.fontSize ?? 29;

    if ($("ksThemeGlow")) {
      $("ksThemeGlow").value = glow;
      $("ksThemeGlowValue").textContent =
        glow + "%";
    }

    if ($("ksThemeFont")) {
      $("ksThemeFont").value = fontSize;
      $("ksThemeFontValue").textContent =
        fontSize + "px";
    }

    if ($("ksThemeAnimations")) {
      $("ksThemeAnimations").checked =
        colors.animations !== false;
    }

    document.querySelectorAll(
      "[data-ks-preset]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.ksPreset === state.preset
      );
    });

    $("ksThemeCustomButton")?.classList.toggle(
      "active",
      state.preset === "custom"
    );
  }

  function selectPreset(id) {
    if (!PRESETS[id]) return;

    state.preset = id;

    saveState();
    syncControls();
    applyTheme();
  }

  function activateCustom() {
    if (state.preset !== "custom") {
      state.colors = {
        ...currentColors()
      };
    }

    state.preset = "custom";

    saveState();
    syncControls();
    applyTheme();
  }

  function updateCustom(key, value) {
    if (state.preset !== "custom") {
      activateCustom();
    }

    state.colors[key] = value;

    syncControls();
    applyTheme();
    saveState();
  }

  function bindEvents() {
    document.querySelectorAll(
      "[data-ks-preset]"
    ).forEach(button => {
      button.addEventListener("click", () => {
        selectPreset(button.dataset.ksPreset);
      });
    });

    $("ksThemeCustomButton").addEventListener(
      "click",
      activateCustom
    );

    document.querySelectorAll(
      "[data-ks-color]"
    ).forEach(input => {
      input.addEventListener("input", () => {
        updateCustom(
          input.dataset.ksColor,
          input.value
        );
      });
    });

    $("ksThemeGlow").addEventListener(
      "input",
      event => {
        updateCustom(
          "glow",
          Number(event.target.value)
        );
      }
    );

    $("ksThemeFont").addEventListener(
      "input",
      event => {
        updateCustom(
          "fontSize",
          Number(event.target.value)
        );
      }
    );

    $("ksThemeAnimations").addEventListener(
      "change",
      event => {
        updateCustom(
          "animations",
          event.target.checked
        );
      }
    );

    $("ksThemeSave").addEventListener(
      "click",
      () => {
        saveState();

        $("ksThemeMessage").textContent =
          "✓ Theme saved successfully!";
      }
    );

    $("ksThemeReset").addEventListener(
      "click",
      () => {
        state = {
          preset: "cyber",
          colors: {
            ...DEFAULT_CUSTOM
          }
        };

        saveState();
        syncControls();
        applyTheme();

        $("ksThemeMessage").textContent =
          "Default theme restored.";
      }
    );
  }

  function bindLegacyThemes() {
    document.querySelectorAll(
      ".theme-choice"
    ).forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.themeChoice;

        if (PRESETS[id]) {
          selectPreset(id);
        }
      });
    });
  }

  function initialize() {
    buildStudio();
    bindLegacyThemes();
    applyTheme();
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

})();

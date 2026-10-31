"use strict";

/*
=====================================================
 KEYSTRIKE V5 — CUSTOM THEME STUDIO
 Compatible with existing script.js settings.
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

  const CUSTOM_DEFAULT = {
    ...PRESETS.cyber,
    glow: 55,
    fontSize: 29,
    animations: true
  };

  let savedState = null;

  try {
    savedState = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "null"
    );
  } catch {
    savedState = null;
  }

  let state = {
    preset: savedState?.preset || "cyber",
    colors: {
      ...CUSTOM_DEFAULT,
      ...(savedState?.colors || {})
    }
  };

  const $ = id => document.getElementById(id);

  const root = document.documentElement;

  function validHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function hexToRGB(hex) {
    const normalized = hex.replace("#", "");

    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16)
    ];
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexToRGB(hex);

    return `rgba(${r},${g},${b},${alpha})`;
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn("Theme storage:", error);
    }
  }

  function getCurrentColors() {
    if (state.preset === "custom") {
      return state.colors;
    }

    return {
      ...CUSTOM_DEFAULT,
      ...(PRESETS[state.preset] || PRESETS.cyber)
    };
  }

  function applyColors() {
    const colors = getCurrentColors();

    const primary = validHex(colors.primary)
      ? colors.primary
      : CUSTOM_DEFAULT.primary;

    const accent = validHex(colors.accent)
      ? colors.accent
      : CUSTOM_DEFAULT.accent;

    const background = validHex(colors.background)
      ? colors.background
      : CUSTOM_DEFAULT.background;

    const surface = validHex(colors.surface)
      ? colors.surface
      : CUSTOM_DEFAULT.surface;

    const keyboard = validHex(colors.keyboard)
      ? colors.keyboard
      : CUSTOM_DEFAULT.keyboard;

    const glow = Math.max(
      0,
      Math.min(100, Number(colors.glow) || 0)
    );

    const fontSize = Math.max(
      18,
      Math.min(42, Number(colors.fontSize) || 29)
    );

    const animations = colors.animations !== false;

    document.body.dataset.themeStudio = state.preset;

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
      "--ks-studio-glow",
      String(glow / 100)
    );

    root.style.setProperty(
      "--ks-studio-primary-rgb",
      hexToRGB(primary).join(",")
    );

    root.style.setProperty(
      "--ks-studio-accent-rgb",
      hexToRGB(accent).join(",")
    );

    root.style.setProperty(
      "--ks-studio-keyboard-rgb",
      hexToRGB(keyboard).join(",")
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
      "--font-size",
      fontSize + "px"
    );

    document.body.classList.toggle(
      "ks-studio-no-animation",
      !animations
    );

    /*
     * Existing themes use body[data-theme].
     * Preserve those theme names for compatibility.
     */
    if (PRESETS[state.preset]) {
      document.body.dataset.theme = state.preset;
    }

    updatePreview();
  }

  function updatePreview() {
    const colors = getCurrentColors();

    const preview = $("ksThemeLivePreview");

    if (!preview) return;

    preview.style.background =
      colors.background;

    preview.style.borderColor =
      colors.primary;

    const title = preview.querySelector(
      ".ks-theme-preview-title"
    );

    if (title) {
      title.style.color = colors.primary;
    }

    const button = preview.querySelector(
      ".ks-theme-preview-button"
    );

    if (button) {
      button.style.background = colors.primary;
      button.style.boxShadow =
        `0 0 25px ${rgba(colors.primary, .25)}`;
    }

    const card = preview.querySelector(
      ".ks-theme-preview-card"
    );

    if (card) {
      card.style.background = colors.surface;
      card.style.borderColor = colors.accent;
    }

    const keys = preview.querySelectorAll(
      ".ks-theme-preview-key"
    );

    keys.forEach(key => {
      key.style.borderColor = colors.keyboard;
      key.style.color = colors.keyboard;
    });
  }

  function createPresetButtons() {
    return Object.entries(PRESETS)
      .map(([id, preset]) => `
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
      `)
      .join("");
  }

  function createColorControl(
    key,
    label,
    description
  ) {
    return `
      <label class="ks-theme-control">

        <span>
          <strong>${label}</strong>
          <small>${description}</small>
        </span>

        <input
          type="color"
          data-ks-color="${key}"
          value="${CUSTOM_DEFAULT[key]}"
        >

      </label>
    `;
  }

  function buildStudio() {
    const panel = $("settingsPanel");

    if (!panel || $("ksThemeStudio")) return;

    const studio = document.createElement("section");

    studio.id = "ksThemeStudio";
    studio.className = "ks-theme-studio";

    studio.innerHTML = `
      <div class="ks-theme-heading">
        <span>🎨 PERSONALIZATION</span>
        <h2>Custom Theme Studio</h2>
        <p>
          Design your own KEYSTRIKE experience.
        </p>
      </div>

      <div class="ks-theme-section-title">
        PREMIUM THEMES
      </div>

      <div class="ks-theme-preset-grid">
        ${createPresetButtons()}
      </div>

      <button
        type="button"
        id="ksThemeCustomButton"
        class="ks-theme-custom-button"
      >
        ✨ CREATE CUSTOM THEME
      </button>

      <div class="ks-theme-section-title">
        CUSTOM COLORS
      </div>

      <div class="ks-theme-controls">

        ${createColorControl(
          "primary",
          "Primary Color",
          "Main interface highlights"
        )}

        ${createColorControl(
          "accent",
          "Accent Color",
          "Secondary glow and borders"
        )}

        ${createColorControl(
          "background",
          "Background",
          "Main website background"
        )}

        ${createColorControl(
          "surface",
          "Card Background",
          "Panels and surfaces"
        )}

        ${createColorControl(
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
          value="55"
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
          min="18"
          max="42"
          value="29"
        >

      </div>

      <label class="ks-theme-animation-toggle">

        <span>
          ⚡ Theme Animations
        </span>

        <input
          id="ksThemeAnimations"
          type="checkbox"
          checked
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
          id="ksThemeSave"
          class="ks-theme-save"
        >
          💾 SAVE THEME
        </button>

        <button
          type="button"
          id="ksThemeReset"
          class="ks-theme-reset"
        >
          ↺ RESET
        </button>

      </div>

      <div
        id="ksThemeMessage"
        class="ks-theme-message"
        aria-live="polite"
      ></div>
    `;

    panel.appendChild(studio);

    bindEvents();
    syncControls();
    applyColors();
  }

  function syncControls() {
    const colors = getCurrentColors();

    document.querySelectorAll(
      "[data-ks-color]"
    ).forEach(input => {
      const key = input.dataset.ksColor;

      if (validHex(colors[key])) {
        input.value = colors[key];
      }
    });

    $("ksThemeGlow").value =
      colors.glow ?? 55;

    $("ksThemeGlowValue").textContent =
      (colors.glow ?? 55) + "%";

    $("ksThemeFont").value =
      colors.fontSize ?? 29;

    $("ksThemeFontValue").textContent =
      (colors.fontSize ?? 29) + "px";

    $("ksThemeAnimations").checked =
      colors.animations !== false;

    document.querySelectorAll(
      "[data-ks-preset]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.ksPreset === state.preset
      );
    });

    $("ksThemeCustomButton").classList.toggle(
      "active",
      state.preset === "custom"
    );
  }

  function selectPreset(id) {
    if (!PRESETS[id]) return;

    state.preset = id;

    /*
     * Keep custom colors saved while browsing presets.
     */
    save();
    syncControls();
    applyColors();
  }

  function activateCustom() {
    if (state.preset !== "custom") {
      state.colors = {
        ...getCurrentColors()
      };
    }

    state.preset = "custom";

    save();
    syncControls();
    applyColors();
  }

  function updateCustom(key, value) {
    if (state.preset !== "custom") {
      activateCustom();
    }

    state.colors[key] = value;

    syncControls();
    applyColors();
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
        save();

        $("ksThemeMessage").textContent =
          "✓ Theme saved successfully!";

        setTimeout(() => {
          $("ksThemeMessage").textContent = "";
        }, 3000);
      }
    );

    $("ksThemeReset").addEventListener(
      "click",
      () => {
        state = {
          preset: "cyber",
          colors: {
            ...CUSTOM_DEFAULT
          }
        };

        save();
        syncControls();
        applyColors();

        $("ksThemeMessage").textContent =
          "Default theme restored.";
      }
    );
  }

  /*
   * Synchronize old settings theme buttons.
   */
  function bindExistingThemes() {
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

  /*
   * script.js owns --font-size and body[data-theme].
   * Re-apply studio settings after existing settings
   * updates, without replacing any original functions.
   */
  function observeThemeChanges() {
    const observer = new MutationObserver(() => {
      if (!document.body) return;

      if (
        state.preset !== "custom" &&
        PRESETS[document.body.dataset.theme] &&
        document.body.dataset.theme !== state.preset
      ) {
        state.preset = document.body.dataset.theme;
        save();
        syncControls();
      }

      applyColors();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
  }

  function initialize() {
    buildStudio();
    bindExistingThemes();
    applyColors();
    observeThemeChanges();
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

"use strict";

/* ==========================================
   KEYSTRIKE V5
   SOCIAL & REAL MULTIPLAYER

   PHASE 1: FRIENDS
   PHASE 2: PRIVATE CHAT
   PHASE 3: REAL MULTIPLAYER ROOMS

   Supabase-backed room management
========================================== */

/* ==========================================
   UTILITIES
========================================== */

const $ = id => document.getElementById(id);

const SUPABASE_URL =
  "https://fdajbwzsmctyyhviizpp.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_aah0J9gO_zrT4yBHES9n6g_i6tEmTAY";

const db = window.supabase
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    )
  : null;

function storageGet(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    return value === null
      ? fallback
      : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Storage unavailable:", error);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showToast(message, type = "") {
  const toast = $("ksToast");

  if (!toast) return;

  toast.textContent = message;
  toast.className = "ks-toast " + type;
  toast.hidden = false;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

function formatTime(date) {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLastSeen(date) {
  if (!date) return "Offline";

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(date).getTime()) / 1000
    )
  );

  if (seconds < 60) return "Active recently";

  if (seconds < 3600) {
    return `Last active ${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `Last active ${Math.floor(seconds / 3600)}h ago`;
  }

  return `Last active ${Math.floor(seconds / 86400)}d ago`;
}

function safeAvatar(container, url, fallback = "K") {
  if (!container) return;

  container.replaceChildren();

  if (url && /^https:\/\//i.test(url)) {
    const image = document.createElement("img");

    image.alt = "Profile photo";
    image.referrerPolicy = "no-referrer";

    image.onerror = () => {
      container.textContent = fallback;
    };

    image.src = url;
    container.appendChild(image);
  } else {
    container.textContent = fallback;
  }
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  element.className = className;
  element.textContent = text;

  return element;
}

/* ==========================================
   WORD DATA
========================================== */

const commonWords = `
the be to of and a in that have i it for not on with
he as you do at this but his by from they we say her she
or an will my one all would there their what so up out
if about who get which go me when make can like time no
just him know take people into year your good some could
them see other than then now look only come its over
think also back after use two how our work first well
way even new want because any these give day most us
is are was were been being has had did does should may
might must more much many few little very always never
sometimes often again still here where why while before
during between under above near far around across through
every each both either another same different important
small large big great high low long short old young
early late fast slow strong quick easy hard simple clear
right wrong true false real world life home house room
door window table chair book page paper pen pencil school
class lesson teacher student learn study read write speak
listen hear sound music song voice word letter sentence
number question answer idea story problem solution result
change start stop begin end finish complete continue wait
move run walk jump play game race win lose score point
level speed power energy light dark color blue green red
black white yellow orange purple silver gold sky cloud
rain snow wind sun moon star planet space earth water
fire air ground tree leaf flower grass mountain river
ocean beach lake forest road street city town village
country place area field garden park path bridge train
car bus bike plane boat ship travel trip journey map
north south east west left right front behind inside
outside open close enter exit find search discover build
create design develop code type test practice improve
focus skill talent effort success progress challenge goal
dream future past present today tomorrow yesterday morning
evening night hour minute second moment clock watch date
week month season spring summer autumn winter monday
tuesday wednesday thursday friday saturday sunday happy
sad calm quiet loud funny kind honest brave smart clever
bright fresh clean safe warm cool hot cold soft smooth
rough sharp sweet sour bitter salty fresh delicious food
bread rice fruit apple banana orange mango grape lemon
milk coffee tea juice breakfast lunch dinner kitchen
plate cup glass spoon fork knife salt sugar butter
family friend brother sister mother father parent child
baby person human team group member partner player leader
guest account profile history record statistics accuracy
consistency keyboard mouse screen monitor laptop computer
internet network browser website server client database
system program function variable object array string value
input output event button menu setting option theme font
animation particle effect feature update version project
`.trim().split(/\s+/);

const advancedWords = `
algorithm architecture asynchronous authentication
authorization compatibility configuration consistency
cryptography cybersecurity decentralization decomposition
determination differentiation distribution documentation
efficiency electromagnetic encapsulation environment
exceptional exponential functionality globalization
implementation infrastructure initialization integration
interoperability javascript keyboard optimization
orchestration parallelism performance persistence
polymorphism prioritization probability productivity
professional programming representation responsiveness
serialization synchronization telecommunications
transformation troubleshooting virtualization
visualization accessibility accountability
administration artificial intelligence biodiversity
biotechnology collaboration computational
concentration consciousness consideration
constitutional contemporary cryptocurrency
demonstration development discrimination
entrepreneurship experimentation extraordinary
fundamental generalization heterogeneous
identification imagination independence
individuality industrialization information
innovation institutional instrumentation
international interpretation investigation
mathematics methodology microprocessor
multidimensional neuroscience observation
organization participation perseverance
philosophical precipitation presentation
psychological recommendation reconstruction
refrigeration reliability responsibility
revolutionary sustainability technological
transmission transportation understanding
unprecedented
`.trim().split(/\s+/);

const quotes = [
  "The secret of getting ahead is getting started.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Great things are done by a series of small things brought together.",
  "It always seems impossible until it is done.",
  "The future depends on what you do today.",
  "Practice does not make perfect. Practice makes progress.",
  "Do not watch the clock. Do what it does. Keep going.",
  "Your only limit is the amount of effort you are willing to give."
];

const codeSamples = [
  "const message = 'Hello world';",
  "function add(a, b) { return a + b; }",
  "const square = n => n * n;",
  "let score = 0; score += 10;",
  "const active = true;",
  "if (score > 50) { console.log('Win'); }",
  "const numbers = [1, 2, 3, 4, 5];",
  "for (let i = 0; i < 10; i++) { console.log(i); }",
  "const user = { name: 'Alex', level: 5 };",
  "document.querySelector('button').click();",
  "const result = numbers.filter(n => n > 2);",
  "async function load() { return await fetch('/api'); }"
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomWord() {
  return randomItem(commonWords);
}

/* ==========================================
   SETTINGS
========================================== */

const defaults = {
  theme: "cyber",
  fontSize: 29,
  typingAnimations: true,
  smoothCaret: true,
  screenShake: false,
  rgbKeyboard: true,
  particlesEnabled: true,
  animatedBackground: true,
  keyboardSounds: true,
  errorSounds: true,
  soundStyle: "mechanical",
  volume: 35
};

let settings = {
  ...defaults,
  ...storageGet("ks_v3_settings", {})
};

const toggleSettings = [
  "typingAnimations",
  "smoothCaret",
  "screenShake",
  "rgbKeyboard",
  "particlesEnabled",
  "animatedBackground",
  "keyboardSounds",
  "errorSounds"
];

function saveSettings() {
  storageSet("ks_v3_settings", settings);
}

function applySettings() {
  document.body.dataset.theme = settings.theme;

  document.documentElement.style.setProperty(
    "--font-size",
    settings.fontSize + "px"
  );

  document.body.classList.toggle(
    "no-typing-animations",
    !settings.typingAnimations
  );

  document.body.classList.toggle(
    "no-smooth-caret",
    !settings.smoothCaret
  );

  document.body.classList.toggle(
    "rgb-enabled",
    settings.rgbKeyboard
  );

  document.body.classList.toggle(
    "no-background-animation",
    !settings.animatedBackground
  );

  toggleSettings.forEach(key => {
    if ($(key)) $(key).checked = settings[key];
  });

  $("fontSizeSetting").value = settings.fontSize;
  $("fontSizeValue").textContent = settings.fontSize;

  $("volumeSetting").value = settings.volume;
  $("volumeValue").textContent = settings.volume;

  $("soundStyle").value = settings.soundStyle;

  document.querySelectorAll(".theme-choice").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.themeChoice === settings.theme
    );
  });

  $("quickSound").textContent =
    settings.keyboardSounds ? "🔊" : "🔇";

  requestAnimationFrame(updateCaret);
}

function openSettings() {
  $("settingsOverlay").classList.add("show");
  $("settingsPanel").classList.add("open");
}

function closeSettings() {
  $("settingsOverlay").classList.remove("show");
  $("settingsPanel").classList.remove("open");
}

$("settingsButton").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", closeSettings);
$("settingsOverlay").addEventListener("click", closeSettings);

toggleSettings.forEach(key => {
  $(key).addEventListener("change", event => {
    settings[key] = event.target.checked;
    saveSettings();
    applySettings();
  });
});

document.querySelectorAll(".theme-choice").forEach(button => {
  button.addEventListener("click", () => {
    settings.theme = button.dataset.themeChoice;
    saveSettings();
    applySettings();
  });
});

$("fontSizeSetting").addEventListener("input", event => {
  settings.fontSize = Number(event.target.value);
  saveSettings();
  applySettings();
});

$("volumeSetting").addEventListener("input", event => {
  settings.volume = Number(event.target.value);
  saveSettings();
  applySettings();
});

$("soundStyle").addEventListener("change", event => {
  settings.soundStyle = event.target.value;
  saveSettings();
});

$("resetSettings").addEventListener("click", () => {
  settings = { ...defaults };
  saveSettings();
  applySettings();
});

$("quickSound").addEventListener("click", () => {
  settings.keyboardSounds = !settings.keyboardSounds;
  saveSettings();
  applySettings();
});

/* ==========================================
   SOUND ENGINE
========================================== */

let audioContext = null;

function playSound(type = "correct") {
  if (type === "correct" && !settings.keyboardSounds) return;
  if (type === "error" && !settings.errorSounds) return;
  if (settings.volume <= 0) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    audioContext ||= new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    let frequency = 550;
    let length = .045;

    if (settings.soundStyle === "soft") {
      frequency = 420;
      length = .065;
      oscillator.type = "sine";
    } else if (settings.soundStyle === "arcade") {
      frequency = 720;
      length = .08;
      oscillator.type = "square";
    } else {
      oscillator.type = "triangle";
    }

    if (type === "error") {
      frequency = 150;
      length = .12;
      oscillator.type = "sawtooth";
    }

    if (type === "victory") {
      frequency = 950;
      length = .2;
    }

    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(
      Math.max(.001, settings.volume / 100 * .065),
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      .001,
      now + length
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + length + .01);
  } catch (error) {
    console.warn("Audio unavailable:", error);
  }
}

function animateKeyboard(key, correct) {
  const normalized = key.toLowerCase();

  const element = [...document.querySelectorAll(".key")]
    .find(item => item.dataset.key === normalized);

  if (!element) return;

  element.classList.remove(
    "pressed",
    "key-correct",
    "key-incorrect"
  );

  void element.offsetWidth;

  element.classList.add(
    "pressed",
    correct ? "key-correct" : "key-incorrect"
  );

  setTimeout(() => {
    element.classList.remove(
      "pressed",
      "key-correct",
      "key-incorrect"
    );
  }, 150);
}

function shakeArena() {
  if (!settings.screenShake) return;

  const arena = $("typingArena");

  arena.classList.remove("shake");
  void arena.offsetWidth;
  arena.classList.add("shake");
}

function createParticles(element) {
  if (!settings.particlesEnabled || !element) return;

  const rect = element.getBoundingClientRect();

  for (let i = 0; i < 5; i++) {
    const particle = document.createElement("span");

    particle.className = "particle";

    particle.style.left =
      rect.left + rect.width / 2 + "px";

    particle.style.top =
      rect.top + rect.height / 2 + "px";

    particle.style.setProperty(
      "--dx",
      (Math.random() * 70 - 35) + "px"
    );

    particle.style.setProperty(
      "--dy",
      (Math.random() * 70 - 35) + "px"
    );

    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 650);
  }
}

/* ==========================================
   AUTHENTICATION
========================================== */

let currentUser = null;
let currentProfile = null;
let cloudResults = [];

let authMode = "login";
let authGeneration = 0;

function accountMessage(message, type = "") {
  $("authMessage").textContent = message;
  $("authMessage").className = "auth-message " + type;
}

function openAccount() {
  $("accountModal").classList.add("show");
  accountMessage("");
  renderAccount();
}

function closeAccount() {
  $("accountModal").classList.remove("show");
}

$("profileButton").addEventListener("click", openAccount);
$("closeAccount").addEventListener("click", closeAccount);

$("accountModal").addEventListener("click", event => {
  if (event.target === $("accountModal")) closeAccount();
});

function renderAccount() {
  const signedIn = Boolean(currentUser);

  $("loggedOutView").hidden = signedIn;
  $("loggedInView").hidden = !signedIn;

  $("accountTitle").textContent =
    signedIn ? "Your profile." : "Welcome back.";

  if (!signedIn) {
    $("profileName").textContent = "Guest";
    safeAvatar($("navAvatar"), null, "G");
    return;
  }

  const name =
    currentProfile?.username ||
    currentUser.user_metadata?.full_name ||
    currentUser.email?.split("@")[0] ||
    "Player";

  const avatar =
    currentProfile?.avatar_url ||
    currentUser.user_metadata?.avatar_url ||
    null;

  $("profileName").textContent = name;
  $("accountDisplayName").textContent = name;

  $("accountEmail").textContent =
    currentUser.email || "Signed in";

  $("usernameInput").value =
    currentProfile?.username || "";

  safeAvatar(
    $("navAvatar"),
    avatar,
    name[0].toUpperCase()
  );

  safeAvatar(
    $("accountAvatar"),
    avatar,
    name[0].toUpperCase()
  );

  const summary = calculateSummary(cloudResults);

  $("accountBest").textContent =
    currentProfile?.best_wpm ?? summary.best;

  $("accountTests").textContent =
    currentProfile?.tests_completed ?? summary.tests;
}

$("googleLoginButton").addEventListener("click", async () => {
  if (!db) {
    accountMessage("Supabase library did not load.", "error");
    return;
  }

  accountMessage("Redirecting to Google...");

  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:
        window.location.origin + window.location.pathname
    }
  });

  if (error) accountMessage(error.message, "error");
});

$("switchAuthMode").addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";

  $("emailAuthButton").textContent =
    authMode === "login" ? "LOG IN" : "CREATE ACCOUNT";

  $("switchAuthMode").textContent =
    authMode === "login"
      ? "Create an account"
      : "Already have an account? Log in";

  accountMessage("");
});

$("emailAuthForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    accountMessage("Supabase unavailable.", "error");
    return;
  }

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  const button = $("emailAuthButton");
  button.disabled = true;

  try {
    const result = authMode === "signup"
      ? await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              window.location.origin + window.location.pathname
          }
        })
      : await db.auth.signInWithPassword({
          email,
          password
        });

    if (result.error) throw result.error;

    if (authMode === "signup" && !result.data.session) {
      accountMessage(
        "Account created. Check your email for confirmation.",
        "success"
      );
    } else {
      accountMessage("Successfully signed in!", "success");
    }
  } catch (error) {
    accountMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

async function sendPasswordReset() {
  if (!db) return;

  const email =
    currentUser?.email || $("authEmail").value.trim();

  if (!email) {
    accountMessage("Enter your email address first.", "error");
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo:
      window.location.origin + window.location.pathname
  });

  accountMessage(
    error
      ? error.message
      : "If this email has an account, a password reset link will be sent.",
    error ? "error" : "success"
  );
}

$("forgotPasswordButton").addEventListener(
  "click",
  sendPasswordReset
);

$("changePasswordButton").addEventListener(
  "click",
  sendPasswordReset
);

$("saveUsernameButton").addEventListener("click", async () => {
  if (!currentUser || !db) return;

  const username = $("usernameInput").value.trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    accountMessage(
      "Username must be 3–20 letters, numbers or underscores.",
      "error"
    );
    return;
  }

  const { data, error } = await db
    .from("profiles")
    .update({ username })
    .eq("id", currentUser.id)
    .select()
    .single();

  if (error) {
    accountMessage(
      error.code === "23505"
        ? "This username is already taken."
        : error.message,
      "error"
    );
    return;
  }

  currentProfile = data;

  renderAccount();
  accountMessage("Username updated!", "success");

  refreshSocial();
});

$("logoutButton").addEventListener("click", async () => {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    accountMessage(error.message, "error");
  } else {
    closeAccount();
  }
});

async function loadProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function loadCloudResults(userId) {
  const { data, error } = await db
    .from("typing_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return data || [];
}

async function refreshAccount(user) {
  const generation = ++authGeneration;
  const previousId = currentUser?.id || null;
  const nextId = user?.id || null;

  currentUser = user;
  currentProfile = null;
  cloudResults = [];

  if (previousId !== nextId) {
    await cleanupSocial();
    await cleanupMultiplayer();
  }

  renderAccount();
  updateStatsPage();
  updatePersonalBest();
  renderSocialAuth();

  if (!user || !db) return;

  try {
    const [profile, results] = await Promise.all([
      loadProfile(user.id),
      loadCloudResults(user.id)
    ]);

    if (generation !== authGeneration) return;

    currentProfile = profile;
    cloudResults = results;

    renderAccount();
    updateStatsPage();
    updatePersonalBest();

    if (previousId !== nextId) {
      await initializeSocial();
      await restoreMultiplayerRoom();
    }
  } catch (error) {
    if (generation !== authGeneration) return;

    console.error("Cloud data error:", error);

    $("statsSource").textContent =
      "Could not load cloud stats. Check Supabase setup.";

    accountMessage(
      "Cloud account data unavailable: " + error.message,
      "error"
    );

    if (previousId !== nextId) {
      await initializeSocial();
      await restoreMultiplayerRoom();
    }
  }
}

function initializeAuth() {
  if (!db) {
    console.warn("Supabase SDK unavailable.");
    return;
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      setTimeout(async () => {
        openAccount();

        const password = prompt(
          "Enter your new password (minimum 6 characters):"
        );

        if (password === null) return;

        if (password.length < 6) {
          accountMessage(
            "Password must contain at least 6 characters.",
            "error"
          );
          return;
        }

        const { error } = await db.auth.updateUser({
          password
        });

        accountMessage(
          error
            ? error.message
            : "Password changed successfully.",
          error ? "error" : "success"
        );
      }, 100);
    }

    if (
      event === "SIGNED_IN" ||
      event === "SIGNED_OUT" ||
      event === "INITIAL_SESSION" ||
      event === "USER_UPDATED"
    ) {
      setTimeout(() => {
        refreshAccount(session?.user || null);
      }, 0);
    }
  });
}

async function saveCloudResult(result) {
  if (!currentUser || !db) return;

  const userId = currentUser.id;

  const payload = {
    user_id: userId,
    wpm: result.wpm,
    accuracy: result.accuracy,
    consistency: result.consistency,
    duration: result.duration,
    mode: result.mode,
    difficulty: result.difficulty
  };

  try {
    const { data, error } = await db
      .from("typing_results")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    if (currentUser?.id !== userId) return;

    cloudResults.unshift(data);

    renderAccount();
    updateStatsPage();
    updatePersonalBest();

    $("sessionStatus").textContent = "CLOUD SAVED";
  } catch (error) {
    console.error("Result save failed:", error);

    $("sessionStatus").textContent =
      "CLOUD SAVE FAILED";
  }
}

"use strict";

/* ========================================
   KEYSTRIKE V4
   ======================================== */

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

/* ========================================
   STORAGE
   ======================================== */

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

/* ========================================
   WORD DATA
   ======================================== */

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

/* ========================================
   SETTINGS
   ======================================== */

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
    if ($(key)) {
      $(key).checked = settings[key];
    }
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

/* ========================================
   SOUND ENGINE
   ======================================== */

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

/* ========================================
   ACCOUNT / SUPABASE
   ======================================== */

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
  if (event.target === $("accountModal")) {
    closeAccount();
  }
});

function safeAvatar(container, url, fallback) {
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

  safeAvatar($("navAvatar"), avatar, name[0].toUpperCase());
  safeAvatar($("accountAvatar"), avatar, name[0].toUpperCase());

  const summary = calculateSummary(cloudResults);

  $("accountBest").textContent = summary.best;
  $("accountTests").textContent = summary.tests;
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

  if (error) {
    accountMessage(error.message, "error");
  }
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
    let result;

    if (authMode === "signup") {
      result = await db.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin + window.location.pathname
        }
      });
    } else {
      result = await db.auth.signInWithPassword({
        email,
        password
      });
    }

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

  if (error) {
    accountMessage(error.message, "error");
  } else {
    accountMessage(
      "If this email has an account, a password reset link will be sent.",
      "success"
    );
  }
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

  currentUser = user;
  currentProfile = null;
  cloudResults = [];

  renderAccount();
  updateStatsPage();
  updatePersonalBest();

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

  } catch (error) {
    if (generation !== authGeneration) return;

    console.error("Cloud data error:", error);

    $("statsSource").textContent =
      "Could not load cloud stats. Check Supabase SQL setup.";

    accountMessage(
      "Cloud account data unavailable: " + error.message,
      "error"
    );
  }
}

async function initializeAuth() {
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

    $("sessionStatus").textContent = "CLOUD SAVE FAILED";
  }
}

/* ========================================
   TYPING TEST
   ======================================== */

let mode = "words";
let duration = 30;
let difficulty = "common";

let punctuationEnabled = false;
let numbersEnabled = false;

let targetText = "";
let typedText = "";

let charElements = [];

let started = false;
let finished = false;

let startTime = 0;
let elapsed = 0;

let timerInterval = null;

let wpmSamples = [];
let lastSample = -1;

let restartArmed = false;

const typingInput = $("typingInput");

function generateText() {
  if (mode === "quote") {
    return Array.from(
      { length: 16 },
      () => randomItem(quotes)
    ).join(" ");
  }

  if (mode === "code") {
    return Array.from(
      { length: 25 },
      () => randomItem(codeSamples)
    ).join(" ");
  }

  const source =
    difficulty === "advanced"
      ? advancedWords
      : commonWords;

  const words = [];

  for (let i = 0; i < 300; i++) {
    let word = randomItem(source);

    if (numbersEnabled && Math.random() < .15) {
      word = String(Math.floor(Math.random() * 10000));
    }

    if (punctuationEnabled && Math.random() < .22) {
      word += randomItem([",", ".", "!", "?", ";", ":"]);
    }

    words.push(word);
  }

  return words.join(" ");
}

function renderInitialText() {
  const display = $("wordsDisplay");

  display.replaceChildren();

  const fragment = document.createDocumentFragment();

  charElements = [];

  for (const character of targetText) {
    const span = document.createElement("span");

    span.className = "char";
    span.textContent = character;

    fragment.appendChild(span);
    charElements.push(span);
  }

  display.appendChild(fragment);

  $("wordsViewport").scrollTop = 0;

  requestAnimationFrame(updateCaret);
}

function updateCharacters(previousText = "") {
  const maxLength = Math.max(
    previousText.length,
    typedText.length
  );

  for (let i = 0; i < maxLength; i++) {
    const element = charElements[i];

    if (!element) continue;

    element.classList.remove(
      "correct",
      "incorrect",
      "pop"
    );

    if (i < typedText.length) {
      const correct = typedText[i] === targetText[i];

      element.classList.add(
        correct ? "correct" : "incorrect"
      );

      if (
        settings.typingAnimations &&
        i >= previousText.length
      ) {
        void element.offsetWidth;
        element.classList.add("pop");
      }
    }
  }

  updateCaret();
}

/*
  IMPORTANT V4 FIX:

  We use the viewport's real scrollTop instead of
  accumulating transform offsets.

  The display never receives a translateY transform.

  This prevents text from drifting off-screen.
*/

function updateCaret() {
  const viewport = $("wordsViewport");
  const display = $("wordsDisplay");
  const caret = $("typingCaret");

  if (!viewport || !display || !caret) return;

  if (!charElements.length) return;

  const index = Math.min(
    typedText.length,
    charElements.length - 1
  );

  const character = charElements[index];

  if (!character) return;

  const viewportRect = viewport.getBoundingClientRect();
  const charRect = character.getBoundingClientRect();

  const lineHeight =
    parseFloat(getComputedStyle(display).lineHeight) ||
    settings.fontSize * 1.85;

  const naturalTop =
    charRect.top -
    viewportRect.top +
    viewport.scrollTop;

  const naturalLeft =
    charRect.left - viewportRect.left;

  const visibleTop = viewport.scrollTop;
  const visibleBottom =
    visibleTop + viewport.clientHeight;

  // Keep the active line inside the three-line viewport.
  // Scroll one line at a time for stable, predictable movement.

  if (naturalTop + lineHeight > visibleBottom + 1) {
    viewport.scrollTop =
      Math.max(0, naturalTop - lineHeight * 2);
  } else if (naturalTop < visibleTop - 1) {
    viewport.scrollTop =
      Math.max(0, naturalTop);
  }

  let x = naturalLeft;

  if (typedText.length >= charElements.length) {
    x += charRect.width;
  }

  const y = naturalTop - viewport.scrollTop;

  caret.style.transform =
    `translate(${x}px, ${y + (lineHeight - settings.fontSize * 1.35) / 2}px)`;
}

function getStats() {
  let correct = 0;
  let incorrect = 0;

  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === targetText[i]) {
      correct++;
    } else {
      incorrect++;
    }
  }

  const seconds = started
    ? Math.max(
        .001,
        finished
          ? elapsed
          : (performance.now() - startTime) / 1000
      )
    : 0;

  const wpm = seconds > 0
    ? Math.round((correct / 5) / (seconds / 60))
    : 0;

  const accuracy = typedText.length
    ? Math.round(correct / typedText.length * 100)
    : 100;

  return {
    correct,
    incorrect,
    wpm: Math.max(0, wpm),
    accuracy
  };
}

function getConsistency() {
  if (wpmSamples.length < 2) return 100;

  const average =
    wpmSamples.reduce((a, b) => a + b, 0) /
    wpmSamples.length;

  if (average <= 0) return 100;

  const variance =
    wpmSamples.reduce(
      (sum, value) => sum + (value - average) ** 2,
      0
    ) / wpmSamples.length;

  const deviation = Math.sqrt(variance);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - deviation / average * 100)
    )
  );
}

function updateStats() {
  const stats = getStats();

  $("wpm").textContent = stats.wpm;
  $("accuracy").textContent = stats.accuracy + "%";
  $("consistency").textContent = getConsistency() + "%";
}

function startTest() {
  if (started || finished) return;

  started = true;
  startTime = performance.now();

  $("sessionStatus").textContent = "TYPING";

  timerInterval = setInterval(() => {
    elapsed = Math.min(
      duration,
      (performance.now() - startTime) / 1000
    );

    $("timer").textContent = Math.max(
      0,
      Math.ceil(duration - elapsed)
    );

    const currentSecond = Math.floor(elapsed);

    if (currentSecond !== lastSample) {
      lastSample = currentSecond;
      wpmSamples.push(getStats().wpm);
    }

    updateStats();

    if (elapsed >= duration) {
      finishTest(true);
    }

  }, 100);
}

function finishTest(timed = false) {
  if (finished) return;

  finished = true;

  clearInterval(timerInterval);
  timerInterval = null;

  if (timed) {
    elapsed = duration;
  } else {
    elapsed = Math.max(
      .001,
      (performance.now() - startTime) / 1000
    );
  }

  const stats = getStats();

  const result = {
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    consistency: getConsistency(),
    correct: stats.correct,
    incorrect: stats.incorrect,
    duration,
    mode,
    difficulty,
    date: new Date().toISOString()
  };

  $("finalWpm").textContent = result.wpm;
  $("finalAccuracy").textContent = result.accuracy + "%";
  $("finalCorrect").textContent = result.correct;
  $("finalIncorrect").textContent = result.incorrect;

  $("finalConsistency").textContent =
    result.consistency + "%";

  const oldBest = getPersonalBest();

  const isRecord =
    timed &&
    result.wpm > oldBest &&
    result.accuracy >= 90;

  $("newRecordMessage").hidden = !isRecord;

  /*
    Guest results stay local.
    Signed-in results are saved to Supabase.

    Cloud statistics are unverified practice results,
    not tamper-proof competitive rankings.
  */

  if (currentUser) {
    saveCloudResult(result);
  } else {
    const history = storageGet("ks_history", []);

    history.unshift(result);

    storageSet("ks_history", history.slice(0, 50));

    if (isRecord) {
      storageSet("ks_best", result.wpm);
    }
  }

  updatePersonalBest();

  $("sessionStatus").textContent = "COMPLETE";

  $("resultsModal").classList.add("show");

  typingInput.blur();

  playSound("victory");
}

function resetTest() {
  clearInterval(timerInterval);

  timerInterval = null;

  started = false;
  finished = false;

  startTime = 0;
  elapsed = 0;

  typedText = "";

  wpmSamples = [];
  lastSample = -1;

  restartArmed = false;

  targetText = generateText();

  typingInput.value = "";
  typingInput.disabled = false;

  $("timer").textContent = duration;
  $("wpm").textContent = "0";
  $("accuracy").textContent = "100%";
  $("consistency").textContent = "100%";

  $("sessionStatus").textContent = "READY";

  $("resultsModal").classList.remove("show");

  renderInitialText();
}

typingInput.addEventListener("input", () => {
  if (finished) return;

  const previousText = typedText;

  let nextText = typingInput.value;

  if (nextText.length > targetText.length) {
    nextText = nextText.slice(0, targetText.length);
    typingInput.value = nextText;
  }

  if (nextText.length === 0 && !started) {
    typedText = "";
    updateCharacters(previousText);
    return;
  }

  if (!started && nextText.length) {
    startTest();
  }

  typedText = nextText;

  updateCharacters(previousText);

  if (typedText.length > previousText.length) {
    const index = typedText.length - 1;

    const key = typedText[index];
    const correct = key === targetText[index];

    animateKeyboard(key, correct);
    playSound(correct ? "correct" : "error");

    if (!correct) {
      shakeArena();
    } else if (Math.random() < .035) {
      createParticles(charElements[index]);
    }
  }

  updateStats();

  if (typedText.length >= targetText.length) {
    finishTest(false);
  }
});

$("typingWrapper").addEventListener("click", () => {
  if (!finished) typingInput.focus();
});

function setActiveOption(selector, value, datasetName) {
  document.querySelectorAll(selector).forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset[datasetName] === String(value)
    );
  });
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;

    setActiveOption("[data-mode]", mode, "mode");

    resetTest();
  });
});

document.querySelectorAll("[data-time]").forEach(button => {
  button.addEventListener("click", () => {
    duration = Number(button.dataset.time);

    setActiveOption("[data-time]", duration, "time");

    resetTest();
  });
});

document.querySelectorAll("[data-difficulty]").forEach(button => {
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty;

    setActiveOption(
      "[data-difficulty]",
      difficulty,
      "difficulty"
    );

    resetTest();
  });
});

$("punctuationButton").addEventListener("click", () => {
  punctuationEnabled = !punctuationEnabled;

  $("punctuationButton").classList.toggle(
    "enabled",
    punctuationEnabled
  );

  resetTest();
});

$("numbersButton").addEventListener("click", () => {
  numbersEnabled = !numbersEnabled;

  $("numbersButton").classList.toggle(
    "enabled",
    numbersEnabled
  );

  resetTest();
});

$("restartButton").addEventListener("click", resetTest);
$("quitButton").addEventListener("click", resetTest);

$("tryAgainButton").addEventListener("click", () => {
  resetTest();
  typingInput.focus();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if ($("accountModal").classList.contains("show")) {
      closeAccount();
      return;
    }

    if ($("settingsPanel").classList.contains("open")) {
      closeSettings();
      return;
    }

    if ($("resultsModal").classList.contains("show")) {
      resetTest();
      return;
    }

    if ($("typePage").classList.contains("active")) {
      resetTest();
    }

    return;
  }

  if (
    !$("typePage").classList.contains("active") ||
    $("accountModal").classList.contains("show") ||
    $("settingsPanel").classList.contains("open")
  ) {
    return;
  }

  if (event.key === "Tab") {
    if (document.activeElement === typingInput) {
      event.preventDefault();
      restartArmed = true;
    }
  } else if (event.key === "Enter" && restartArmed) {
    event.preventDefault();

    restartArmed = false;

    resetTest();
    typingInput.focus();

  } else if (event.key !== "Shift") {
    restartArmed = false;
  }
});

/* ========================================
   BOT RACING
   ======================================== */

let raceActive = false;
let raceCountdownTimer = null;
let raceInterval = null;

let raceText = "";
let raceStartTime = 0;

let raceBots = [];
let raceFinishedPlayers = [];

let playerRaceProgress = 0;

function getBotSpeedRange() {
  const difficulty = $("raceDifficulty").value;

  const ranges = {
    easy: [22, 38],
    medium: [38, 58],
    hard: [60, 85],
    insane: [85, 125]
  };

  return ranges[difficulty];
}

function createRaceTracks() {
  const names = ["YOU", "BOT NOVA", "BOT ACE", "BOT FLASH"];

  $("raceTracks").replaceChildren();

  names.forEach((name, index) => {
    const track = document.createElement("div");

    track.className = "race-track";
    track.dataset.racer = index;

    const label = document.createElement("span");
    label.className = "racer-name";
    label.textContent = name;

    const line = document.createElement("div");
    line.className = "track-line";

    const car = document.createElement("span");
    car.className = "race-car";
    car.textContent = index === 0 ? "🏎" : "🚗";

    line.appendChild(car);

    const percent = document.createElement("span");
    percent.className = "race-percent";
    percent.textContent = "0%";

    track.append(label, line, percent);

    $("raceTracks").appendChild(track);
  });
}

function updateRaceCar(index, progress) {
  const track = document.querySelector(
    `.race-track[data-racer="${index}"]`
  );

  if (!track) return;

  const line = track.querySelector(".track-line");
  const car = track.querySelector(".race-car");

  const availableWidth =
    Math.max(0, line.clientWidth - car.offsetWidth - 8);

  car.style.transform =
    `translateX(${availableWidth * progress}px)`;

  track.querySelector(".race-percent").textContent =
    Math.round(progress * 100) + "%";
}

function renderRaceText() {
  $("raceText").replaceChildren();

  const input = $("raceInput").value;

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < raceText.length; i++) {
    const span = document.createElement("span");

    span.textContent = raceText[i];

    if (i < input.length) {
      span.className =
        input[i] === raceText[i]
          ? "correct"
          : "incorrect";
    }

    fragment.appendChild(span);
  }

  $("raceText").appendChild(fragment);
}

function stopRace() {
  raceActive = false;

  clearInterval(raceCountdownTimer);
  clearInterval(raceInterval);

  raceCountdownTimer = null;
  raceInterval = null;

  $("raceCountdown").classList.remove("show");

  $("raceInput").disabled = true;
}

function startRace() {
  stopRace();

  $("raceResult").hidden = true;

  raceText = Array.from(
    { length: 75 },
    () => randomWord()
  ).join(" ");

  $("raceInput").value = "";
  $("raceInput").disabled = true;

  $("raceWpm").textContent = "0";
  $("raceProgress").textContent = "0%";

  $("raceStatus").textContent = "Race starting...";

  playerRaceProgress = 0;
  raceFinishedPlayers = [];

  const [minSpeed, maxSpeed] = getBotSpeedRange();

  raceBots = Array.from({ length: 3 }, (_, index) => ({
    id: index + 1,
    speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
    progress: 0,
    finished: false
  }));

  createRaceTracks();
  renderRaceText();

  let countdown = 3;

  $("raceCountdown").textContent = countdown;
  $("raceCountdown").classList.add("show");

  raceCountdownTimer = setInterval(() => {
    countdown--;

    if (countdown > 0) {
      $("raceCountdown").textContent = countdown;
      return;
    }

    clearInterval(raceCountdownTimer);

    $("raceCountdown").classList.remove("show");

    raceActive = true;
    raceStartTime = performance.now();

    $("raceStatus").textContent = "RACE IN PROGRESS";

    $("raceInput").disabled = false;
    $("raceInput").focus();

    raceInterval = setInterval(updateRace, 100);

  }, 1000);
}

function finishRace() {
  if (!raceActive) return;

  stopRace();

  const position =
    raceFinishedPlayers.indexOf(0) + 1;

  $("raceStatus").textContent = "RACE FINISHED";

  $("raceResult").hidden = false;

  $("raceResult").textContent =
    `🏁 YOU FINISHED #${position} OF 4`;

  const oldBest = storageGet("ks_best_race", 0);

  if (!oldBest || position < oldBest) {
    storageSet("ks_best_race", position);
  }

  playSound("victory");
}

function updateRace() {
  if (!raceActive) return;

  const seconds =
    (performance.now() - raceStartTime) / 1000;

  for (const bot of raceBots) {
    if (bot.finished) continue;

    const expectedCharacters =
      bot.speed * 5 * seconds / 60;

    bot.progress = Math.min(
      1,
      expectedCharacters / raceText.length
    );

    updateRaceCar(bot.id, bot.progress);

    if (bot.progress >= 1) {
      bot.finished = true;
      raceFinishedPlayers.push(bot.id);
    }
  }

  if (raceFinishedPlayers.length === 3) {
    $("raceStatus").textContent =
      "BOTS FINISHED — COMPLETE YOUR RACE";
  }
}

$("startRaceButton").addEventListener("click", startRace);

$("raceInput").addEventListener("input", () => {
  if (!raceActive) return;

  let input = $("raceInput").value;

  if (input.length > raceText.length) {
    input = input.slice(0, raceText.length);
    $("raceInput").value = input;
  }

  renderRaceText();

  let correct = 0;

  for (let i = 0; i < input.length; i++) {
    if (input[i] === raceText[i]) {
      correct++;
    }
  }

  const seconds = Math.max(
    .001,
    (performance.now() - raceStartTime) / 1000
  );

  const wpm = Math.round(
    (correct / 5) / (seconds / 60)
  );

  $("raceWpm").textContent = wpm;

  // Progress is based on position; a valid finish
  // requires the entire passage to match.

  playerRaceProgress = input.length / raceText.length;

  updateRaceCar(0, playerRaceProgress);

  $("raceProgress").textContent =
    Math.round(playerRaceProgress * 100) + "%";

  if (input === raceText) {
    raceFinishedPlayers.push(0);
    finishRace();
  }
});

/* ========================================
   SURVIVAL MODE
   ======================================== */

let survivalActive = false;
let survivalHealth = 100;
let survivalScore = 0;
let survivalCurrentWord = "";

function nextSurvivalWord() {
  survivalCurrentWord = randomWord();

  $("survivalWord").textContent = survivalCurrentWord;
  $("survivalInput").value = "";
}

function endSurvival() {
  survivalActive = false;

  $("survivalInput").disabled = true;

  $("survivalMessage").textContent =
    `Game over! Final score: ${survivalScore}`;

  $("startSurvivalButton").textContent =
    "PLAY AGAIN";
}

function startSurvival() {
  survivalActive = true;
  survivalHealth = 100;
  survivalScore = 0;

  $("survivalHealth").textContent = 100;
  $("survivalScore").textContent = 0;
  $("healthFill").style.width = "100%";

  $("survivalMessage").textContent =
    "Stay accurate. Every mistake costs 10 health.";

  $("startSurvivalButton").textContent =
    "RESTART SURVIVAL";

  $("survivalInput").disabled = false;

  nextSurvivalWord();

  $("survivalInput").focus();
}

$("startSurvivalButton").addEventListener(
  "click",
  startSurvival
);

$("survivalInput").addEventListener("input", () => {
  if (!survivalActive) return;

  const input = $("survivalInput").value;

  if (!survivalCurrentWord.startsWith(input)) {
    survivalHealth = Math.max(
      0,
      survivalHealth - 10
    );

    $("survivalHealth").textContent = survivalHealth;
    $("healthFill").style.width = survivalHealth + "%";

    $("survivalInput").value = input.slice(0, -1);

    playSound("error");

    if (survivalHealth <= 0) {
      endSurvival();
    }

    return;
  }

  if (input === survivalCurrentWord) {
    survivalScore += 10;

    $("survivalScore").textContent = survivalScore;

    playSound("correct");

    nextSurvivalWord();
  }
});

/* ========================================
   SPEED RUSH
   ======================================== */

let rushActive = false;
let rushScore = 0;
let rushTimer = null;
let rushStartTime = 0;
let rushCurrentWord = "";

function nextRushWord() {
  rushCurrentWord = randomWord();

  $("rushWord").textContent = rushCurrentWord;
  $("rushInput").value = "";
}

function endRush() {
  if (!rushActive) return;

  rushActive = false;

  clearInterval(rushTimer);
  rushTimer = null;

  $("rushInput").disabled = true;

  const best = storageGet("ks_rush_best", 0);

  if (rushScore > best) {
    storageSet("ks_rush_best", rushScore);
  }

  $("rushMessage").textContent =
    `Time up! You completed ${rushScore} words.`;

  $("startRushButton").textContent =
    "PLAY AGAIN";

  playSound("victory");
}

function startRush() {
  clearInterval(rushTimer);

  rushActive = true;
  rushScore = 0;

  rushStartTime = performance.now();

  $("rushScore").textContent = 0;
  $("rushTimer").textContent = 60;

  $("rushInput").disabled = false;

  $("startRushButton").textContent =
    "RESTART RUSH";

  $("rushMessage").textContent =
    "Type as many words as possible!";

  nextRushWord();

  $("rushInput").focus();

  rushTimer = setInterval(() => {
    const remaining = Math.max(
      0,
      Math.ceil(
        60 -
        (performance.now() - rushStartTime) / 1000
      )
    );

    $("rushTimer").textContent = remaining;

    if (remaining <= 0) {
      endRush();
    }

  }, 100);
}

$("startRushButton").addEventListener(
  "click",
  startRush
);

$("rushInput").addEventListener("input", () => {
  if (!rushActive) return;

  const input = $("rushInput").value;

  if (input === rushCurrentWord) {
    rushScore++;

    $("rushScore").textContent = rushScore;

    playSound("correct");

    nextRushWord();

  } else if (!rushCurrentWord.startsWith(input)) {
    playSound("error");
  }
});

/* ========================================
   STATS
   ======================================== */

function calculateSummary(results) {
  const tests = results.length;

  const best = tests
    ? Math.max(...results.map(item => Number(item.wpm) || 0))
    : 0;

  const average = tests
    ? Math.round(
        results.reduce(
          (sum, item) => sum + (Number(item.wpm) || 0),
          0
        ) / tests
      )
    : 0;

  return {
    best,
    tests,
    average
  };
}

function getCurrentHistory() {
  return currentUser
    ? cloudResults
    : storageGet("ks_history", []);
}

function getPersonalBest() {
  if (currentUser) {
    return calculateSummary(cloudResults).best;
  }

  return storageGet("ks_best", 0);
}

function updatePersonalBest() {
  $("personalBest").textContent =
    getPersonalBest() + " WPM";
}

function updateStatsPage() {
  const history = getCurrentHistory();

  const summary = calculateSummary(history);

  $("statsBest").textContent = summary.best;
  $("statsTests").textContent = summary.tests;
  $("statsAverage").textContent = summary.average;

  const bestRace = storageGet("ks_best_race", 0);

  $("statsRace").textContent =
    bestRace ? "#" + bestRace : "—";

  $("statsSource").textContent =
    currentUser
      ? "Account statistics synced with Supabase. Bot race records remain on this device."
      : "Guest statistics are stored on this device. Log in to save future typing tests to your account.";

  const container = $("testHistory");

  container.replaceChildren();

  if (!history.length) {
    const empty = document.createElement("p");

    empty.style.color = "var(--muted)";
    empty.style.fontSize = "12px";

    empty.textContent = "No typing tests completed yet.";

    container.appendChild(empty);

    return;
  }

  history.slice(0, 20).forEach(result => {
    const item = document.createElement("div");

    item.className = "history-item";

    const date = document.createElement("span");

    date.textContent = new Date(
      result.created_at || result.date || Date.now()
    ).toLocaleDateString();

    const details = document.createElement("span");

    details.textContent =
      `${result.mode || "words"} · ${result.duration || 30}s`;

    const speed = document.createElement("strong");

    speed.textContent = `${result.wpm} WPM`;

    item.append(date, details, speed);

    container.appendChild(item);
  });
}

/* ========================================
   NAVIGATION
   ======================================== */

function navigate(page) {
  const target = $(page + "Page");

  if (!target) return;

  document.querySelectorAll(".page").forEach(element => {
    element.classList.remove("active");
  });

  target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  closeSettings();
  closeAccount();

  clearInterval(timerInterval);
  timerInterval = null;

  stopRace();

  if (survivalActive) {
    survivalActive = false;
    $("survivalInput").disabled = true;
  }

  if (rushActive) {
    rushActive = false;
    clearInterval(rushTimer);
    $("rushInput").disabled = true;
  }

  if (page === "type") {
    resetTest();
  }

  if (page === "stats") {
    updateStatsPage();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.page);
  });
});

$("logo").addEventListener("click", event => {
  event.preventDefault();
  navigate("type");
});

/* ========================================
   RESIZE HANDLING
   ======================================== */

window.addEventListener("resize", () => {
  requestAnimationFrame(updateCaret);

  if (raceText) {
    updateRaceCar(0, playerRaceProgress);

    raceBots.forEach(bot => {
      updateRaceCar(bot.id, bot.progress);
    });
  }
});

/* ========================================
   INITIALIZATION
   ======================================== */

function initialize() {
  applySettings();

  createRaceTracks();

  updatePersonalBest();
  updateStatsPage();

  resetTest();

  renderAccount();

  initializeAuth();

  console.log(
    "%c⚡ KEYSTRIKE V4 READY",
    "color:#65a8ff;font-size:22px;font-weight:bold"
  );
}

initialize();
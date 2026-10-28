/* ==========================================
   KEYSTRIKE V3 — COMPLETE GAME ENGINE
========================================== */

const $ = id => document.getElementById(id);

const commonWords = `
the be to of and a in that have i it for not on with
he as you do at this but his by from they we say her
she or an will my one all would there their what so up
out if about who get which go me when make can like time
no just him know take people into year your good some
could them see other than then now look only come its
over think also back after use two how our work first
well way even new want because any these give day most
us are was were been being has had did done may might
must should very much more less many few every each
another same different great small large little right
left high low fast slow quick speed accuracy typing
keyboard practice improve skill focus rhythm smooth flow
perfect precision strike power level player game race
friend online world digital code design build create
future amazing champion victory battle challenge master
`.trim().split(/\s+/);

const advancedWords = `
algorithm asynchronous architecture authentication
authorization infrastructure synchronization
implementation optimization configuration cryptography
encapsulation polymorphism abstraction interoperability
computational visualization responsiveness concurrency
parallelism documentation accessibility transformation
decomposition functionality characterization
extraordinary sophisticated communication collaboration
consistency professionalism experimentation determination
comprehension miscellaneous independent substantial
unprecedented revolutionary technological differentiation
`.trim().split(/\s+/);

const quotes = [
  "The secret of getting ahead is getting started.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Great things are done by a series of small things brought together.",
  "The future depends on what you do today.",
  "It always seems impossible until it is done.",
  "Focus on being productive instead of busy."
];

const codeSamples = [
  "const speed = 120;",
  "let accuracy = 100;",
  "function greet() { return 'hello'; }",
  "const sum = (a, b) => a + b;",
  "if (score > best) { best = score; }",
  "const result = items.filter(Boolean);",
  "for (let i = 0; i < 10; i++) {}",
  "document.querySelector('.app');",
  "console.log('KEYSTRIKE');"
];

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

let settings = { ...defaults };

function storageGet(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
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

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/* ==========================================
   SETTINGS
========================================== */

function loadSettings() {
  const saved = storageGet("ks_v3_settings", {});
  settings = { ...defaults, ...saved };
  applySettings();
}

function saveSettings() {
  storageSet("ks_v3_settings", settings);
  applySettings();
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

  document.querySelectorAll(".theme-choice").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.themeChoice === settings.theme
    );
  });

  [
    "typingAnimations",
    "smoothCaret",
    "screenShake",
    "rgbKeyboard",
    "particlesEnabled",
    "animatedBackground",
    "keyboardSounds",
    "errorSounds"
  ].forEach(id => {
    $(id).checked = settings[id];
  });

  $("fontSizeSetting").value = settings.fontSize;
  $("fontSizeValue").textContent = settings.fontSize + "px";

  $("soundStyle").value = settings.soundStyle;

  $("volumeSetting").value = settings.volume;
  $("volumeValue").textContent = settings.volume + "%";

  $("quickSound").textContent =
    settings.keyboardSounds ? "♫" : "♫̸";

  if (typeof updateCaret === "function") {
    requestAnimationFrame(updateCaret);
  }
}

$("settingsButton").onclick = () => {
  $("settingsOverlay").classList.add("show");
  $("settingsPanel").classList.add("open");
};

function closeSettings() {
  $("settingsOverlay").classList.remove("show");
  $("settingsPanel").classList.remove("open");
}

$("closeSettings").onclick = closeSettings;
$("settingsOverlay").onclick = closeSettings;

document.querySelectorAll(".theme-choice").forEach(btn => {
  btn.onclick = () => {
    settings.theme = btn.dataset.themeChoice;
    saveSettings();
  };
});

[
  "typingAnimations",
  "smoothCaret",
  "screenShake",
  "rgbKeyboard",
  "particlesEnabled",
  "animatedBackground",
  "keyboardSounds",
  "errorSounds"
].forEach(id => {
  $(id).onchange = event => {
    settings[id] = event.target.checked;
    saveSettings();
  };
});

$("fontSizeSetting").oninput = event => {
  settings.fontSize = Number(event.target.value);
  saveSettings();
};

$("volumeSetting").oninput = event => {
  settings.volume = Number(event.target.value);
  saveSettings();
};

$("soundStyle").onchange = event => {
  settings.soundStyle = event.target.value;
  saveSettings();
};

$("resetSettings").onclick = () => {
  settings = { ...defaults };
  saveSettings();
};

$("quickSound").onclick = () => {
  settings.keyboardSounds = !settings.keyboardSounds;
  saveSettings();
};

/* ==========================================
   AUDIO ENGINE
========================================== */

let audioContext = null;

function playSound(type = "correct") {
  if (settings.volume <= 0) return;

  if (type === "error" && !settings.errorSounds) return;
  if (type === "correct" && !settings.keyboardSounds) return;

  try {
    const AudioClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioClass) return;

    if (!audioContext) {
      audioContext = new AudioClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    let frequency = 500;
    let duration = 0.045;
    let wave = "triangle";

    if (type === "error") {
      frequency = 170;
      duration = 0.12;
      wave = "sawtooth";
    } else if (type === "victory") {
      frequency = 880;
      duration = 0.25;
      wave = "sine";
    } else if (settings.soundStyle === "soft") {
      frequency = 350;
      duration = 0.035;
      wave = "sine";
    } else if (settings.soundStyle === "arcade") {
      frequency = 850;
      duration = 0.07;
      wave = "square";
    } else {
      frequency = 620 + Math.random() * 90;
      duration = 0.035;
      wave = "triangle";
    }

    oscillator.type = wave;

    oscillator.frequency.setValueAtTime(frequency, now);

    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(60, frequency * 0.45),
      now + duration
    );

    const amplitude = Math.max(
      0.0001,
      settings.volume / 100 * 0.09
    );

    gain.gain.setValueAtTime(amplitude, now);

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);

  } catch (error) {
    console.warn("Audio unavailable:", error);
  }
}

/* ==========================================
   VISUAL EFFECTS
========================================== */

function animateKeyboard(key, correct) {
  const normalized = key.toLowerCase();

  const element = Array.from(
    document.querySelectorAll(".key")
  ).find(el => el.dataset.key === normalized);

  if (!element) return;

  clearTimeout(element._timer);

  element.classList.remove(
    "pressed",
    "key-correct",
    "key-incorrect"
  );

  void element.offsetWidth;

  element.classList.add("pressed");
  element.classList.add(
    correct ? "key-correct" : "key-incorrect"
  );

  element._timer = setTimeout(() => {
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
  if (!settings.particlesEnabled) return;

  const rect = element.getBoundingClientRect();

  for (let i = 0; i < 5; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";

    particle.style.left = rect.left + rect.width / 2 + "px";
    particle.style.top = rect.top + rect.height / 2 + "px";

    particle.style.setProperty(
      "--dx",
      (Math.random() * 90 - 45) + "px"
    );

    particle.style.setProperty(
      "--dy",
      (Math.random() * -80 - 10) + "px"
    );

    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 650);
  }
}

/* ==========================================
   TYPING ENGINE
========================================== */

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

let previousInputLength = 0;
let restartArmed = false;

function generateText() {
  if (mode === "quote") {
    return Array.from(
      { length: 15 },
      () => randomItem(quotes)
    ).join(" ");
  }

  if (mode === "code") {
    return Array.from(
      { length: 40 },
      () => randomItem(codeSamples)
    ).join(" ");
  }

  const bank =
    difficulty === "advanced"
      ? advancedWords
      : commonWords;

  const words = [];

  for (let i = 0; i < 350; i++) {
    let word = randomItem(bank);

    if (numbersEnabled && Math.random() < 0.12) {
      word = String(Math.floor(Math.random() * 10000));
    }

    if (punctuationEnabled) {
      if (Math.random() < 0.1) {
        word = word[0].toUpperCase() + word.slice(1);
      }

      if (Math.random() < 0.12) {
        word += randomItem([",", ".", "!", "?", ";"]);
      }
    }

    words.push(word);
  }

  return words.join(" ");
}

function renderInitialText() {
  const fragment = document.createDocumentFragment();

  charElements = [];

  for (let i = 0; i < targetText.length; i++) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = targetText[i];

    fragment.appendChild(span);
    charElements.push(span);
  }

  $("wordsDisplay").replaceChildren(fragment);
}

function updateCharacters() {
  for (let i = 0; i < charElements.length; i++) {
    const element = charElements[i];

    if (i < typedText.length) {
      element.classList.toggle(
        "correct",
        typedText[i] === targetText[i]
      );

      element.classList.toggle(
        "incorrect",
        typedText[i] !== targetText[i]
      );
    } else {
      element.classList.remove("correct", "incorrect");
    }
  }

  if (
    settings.typingAnimations &&
    typedText.length > previousInputLength
  ) {
    const index = typedText.length - 1;
    const element = charElements[index];

    if (element) {
      element.classList.remove("pop");
      void element.offsetWidth;
      element.classList.add("pop");
    }
  }

  previousInputLength = typedText.length;

  updateCaret();
}

/* SMOOTH CARET + THREE-LINE SCROLL */

function updateCaret() {
  const index = Math.min(
    typedText.length,
    charElements.length - 1
  );

  const target = charElements[index];

  if (!target) return;

  const display = $("wordsDisplay");
  const viewport = $("wordsViewport");
  const caret = $("typingCaret");

  const displayRect = display.getBoundingClientRect();
  const charRect = target.getBoundingClientRect();

  const lineHeight = parseFloat(
    getComputedStyle(display).lineHeight
  );

  const previousScroll =
    Number(display.dataset.scrollY || 0);

  const rawY =
    charRect.top - displayRect.top + previousScroll;

  const currentLine = Math.max(
    0,
    Math.round(rawY / lineHeight)
  );

  const scrollY = currentLine * lineHeight;

  display.style.transform =
    `translateY(-${scrollY}px)`;

  display.dataset.scrollY = scrollY;

  // Position relative to viewport after scrolling.

  const x = charRect.left - displayRect.left;

  const y =
    currentLine * lineHeight - scrollY +
    (lineHeight - caret.offsetHeight) / 2;

  caret.style.transform =
    `translate(${x}px, ${y}px)`;

  viewport.scrollTop = 0;
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
    ? Math.min(
        duration,
        (performance.now() - startTime) / 1000
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
    accuracy,
    seconds
  };
}

function getConsistency() {
  if (wpmSamples.length < 2) return 100;

  const mean =
    wpmSamples.reduce((a, b) => a + b, 0) /
    wpmSamples.length;

  if (!mean) return 100;

  const variance =
    wpmSamples.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) / wpmSamples.length;

  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 - Math.sqrt(variance) / mean * 100
      )
    )
  );
}

function updateStats() {
  const stats = getStats();

  $("wpm").textContent = stats.wpm;
  $("accuracy").textContent = stats.accuracy;

  const second = Math.floor(stats.seconds);

  if (
    started &&
    !finished &&
    second > 0 &&
    second !== lastSample
  ) {
    lastSample = second;
    wpmSamples.push(stats.wpm);
  }

  $("consistency").textContent = getConsistency();
}

function startTest() {
  if (started || finished) return;

  started = true;
  startTime = performance.now();

  $("sessionStatus").textContent = "● TEST IN PROGRESS";

  timerInterval = setInterval(() => {
    elapsed = (performance.now() - startTime) / 1000;

    $("timer").textContent = Math.max(
      0,
      Math.ceil(duration - elapsed)
    );

    updateStats();

    if (elapsed >= duration) {
      finishTest();
    }
  }, 100);
}

function finishTest() {
  if (finished) return;

  clearInterval(timerInterval);
  timerInterval = null;

  finished = true;
  $("typingInput").disabled = true;

  const stats = getStats();

  $("finalWpm").textContent = stats.wpm;
  $("finalAccuracy").textContent = stats.accuracy + "%";
  $("finalCorrect").textContent = stats.correct;
  $("finalIncorrect").textContent = stats.incorrect;
  $("finalConsistency").textContent = getConsistency() + "%";

  $("sessionStatus").textContent = "● SESSION COMPLETE";

  const history = storageGet("ks_history", []);

  history.unshift({
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    mode,
    duration,
    date: new Date().toLocaleDateString()
  });

  storageSet("ks_history", history.slice(0, 50));

  const best = storageGet("ks_best", 0);

  const newRecord =
    stats.seconds >= duration - 0.2 &&
    stats.wpm > best;

  $("newRecordMessage").hidden = !newRecord;

  if (newRecord) {
    storageSet("ks_best", stats.wpm);
    updatePersonalBest();
    playSound("victory");
  }

  $("resultsModal").classList.add("show");
}

function resetTest() {
  clearInterval(timerInterval);
  timerInterval = null;

  started = false;
  finished = false;

  startTime = 0;
  elapsed = 0;

  typedText = "";
  previousInputLength = 0;

  wpmSamples = [];
  lastSample = -1;

  targetText = generateText();

  $("typingInput").disabled = false;
  $("typingInput").value = "";

  $("wordsDisplay").style.transform = "translateY(0)";
  $("wordsDisplay").dataset.scrollY = "0";

  $("timer").textContent = duration;
  $("wpm").textContent = "0";
  $("accuracy").textContent = "100";
  $("consistency").textContent = "100";

  $("sessionStatus").textContent = "● READY TO TYPE";

  $("resultsModal").classList.remove("show");

  restartArmed = false;

  renderInitialText();

  requestAnimationFrame(updateCaret);

  $("typingInput").focus();
}

$("typingInput").addEventListener("input", event => {
  if (finished) return;

  const input = event.target;

  if (input.value.length > targetText.length) {
    input.value = input.value.slice(0, targetText.length);
  }

  typedText = input.value;

  if (!started && typedText.length) {
    startTest();
  }

  updateCharacters();
  updateStats();

  if (typedText.length >= targetText.length) {
    finishTest();
  }
});

$("typingInput").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    resetTest();
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    restartArmed = true;
    return;
  }

  if (restartArmed && event.key === "Enter") {
    event.preventDefault();
    resetTest();
    return;
  }

  restartArmed = false;

  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    finished
  ) return;

  if (event.key.length !== 1) return;

  const position = $("typingInput").value.length;

  const correct = event.key === targetText[position];

  animateKeyboard(event.key, correct);

  playSound(correct ? "correct" : "error");

  if (!correct) {
    shakeArena();
  } else {
    const element = charElements[position];

    if (
      element &&
      targetText[position] === " " &&
      settings.particlesEnabled
    ) {
      createParticles(element);
    }
  }
});

$("typingWrapper").onclick = () => {
  $("typingInput").focus();
};

$("restartButton").onclick = resetTest;
$("quitButton").onclick = resetTest;
$("tryAgainButton").onclick = resetTest;

/* TEST OPTIONS */

function activateGroup(selector, clicked) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.classList.remove("active");
  });

  clicked.classList.add("active");
}

document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.onclick = () => {
    activateGroup("[data-mode]", btn);
    mode = btn.dataset.mode;
    resetTest();
  };
});

document.querySelectorAll("[data-time]").forEach(btn => {
  btn.onclick = () => {
    activateGroup("[data-time]", btn);
    duration = Number(btn.dataset.time);
    resetTest();
  };
});

document.querySelectorAll("[data-difficulty]").forEach(btn => {
  btn.onclick = () => {
    activateGroup("[data-difficulty]", btn);
    difficulty = btn.dataset.difficulty;
    resetTest();
  };
});

$("punctuationButton").onclick = () => {
  punctuationEnabled = !punctuationEnabled;

  $("punctuationButton").classList.toggle(
    "enabled",
    punctuationEnabled
  );

  resetTest();
};

$("numbersButton").onclick = () => {
  numbersEnabled = !numbersEnabled;

  $("numbersButton").classList.toggle(
    "enabled",
    numbersEnabled
  );

  resetTest();
};

function updatePersonalBest() {
  $("personalBest").textContent =
    storageGet("ks_best", 0) + " WPM";
}

/* ==========================================
   TYPING RACE GAME
========================================== */

let raceActive = false;
let raceTimer = null;
let raceCountdownTimer = null;

let raceText = "";
let raceStartTime = 0;
let raceFinishOrder = [];

let racers = [];

function createRaceTracks() {
  $("raceTracks").replaceChildren();

  racers.forEach((racer, index) => {
    const row = document.createElement("div");
    row.className = "race-track";

    const name = document.createElement("span");
    name.className = "racer-name";
    name.textContent = racer.name;

    const track = document.createElement("div");
    track.className = "track-line";

    const car = document.createElement("div");
    car.className = "race-car";
    car.textContent = index === 0 ? "🏎️" : "🚗";

    track.appendChild(car);

    const percent = document.createElement("span");
    percent.className = "race-percent";
    percent.textContent = "0%";

    row.append(name, track, percent);
    $("raceTracks").appendChild(row);

    racer.carElement = car;
    racer.trackElement = track;
    racer.percentElement = percent;
  });
}

function renderRaceText() {
  const typed = $("raceInput").value;

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < raceText.length; i++) {
    const span = document.createElement("span");
    span.textContent = raceText[i];

    if (i < typed.length) {
      span.className =
        typed[i] === raceText[i]
          ? "correct"
          : "incorrect";
    }

    fragment.appendChild(span);
  }

  $("raceText").replaceChildren(fragment);
}

function updateRaceCar(racer) {
  const trackWidth = racer.trackElement.clientWidth;

  // Reserve enough space for the car and finish flag.
  const usableWidth = Math.max(0, trackWidth - 65);

  racer.carElement.style.transform =
    `translateX(${usableWidth * racer.progress / 100}px)`;

  racer.percentElement.textContent =
    Math.round(racer.progress) + "%";
}

function getBotSpeedRange() {
  const difficulty = $("raceDifficulty").value;

  const ranges = {
    easy: [25, 40],
    medium: [40, 65],
    hard: [65, 95],
    insane: [95, 130]
  };

  return ranges[difficulty];
}

function startRace() {
  stopRace();

  raceText = Array.from(
    { length: 75 },
    () => randomItem(commonWords)
  ).join(" ");

  $("raceInput").value = "";
  $("raceInput").disabled = true;

  $("raceWpm").textContent = "0 WPM";
  $("raceProgress").textContent = "0%";

  $("raceResult").hidden = true;
  $("raceStatus").textContent = "STARTING...";

  raceFinishOrder = [];

  const [min, max] = getBotSpeedRange();

  racers = [
    { name: "YOU", progress: 0, speed: 0, finished: false },
    { name: "BOT ALPHA", progress: 0, speed: min + Math.random() * (max - min), finished: false },
    { name: "BOT BETA", progress: 0, speed: min + Math.random() * (max - min), finished: false },
    { name: "BOT GAMMA", progress: 0, speed: min + Math.random() * (max - min), finished: false }
  ];

  createRaceTracks();
  renderRaceText();

  let count = 3;

  $("raceCountdown").classList.add("show");
  $("raceCountdown").textContent = count;

  raceCountdownTimer = setInterval(() => {
    count--;

    if (count > 0) {
      $("raceCountdown").textContent = count;
      return;
    }

    clearInterval(raceCountdownTimer);
    raceCountdownTimer = null;

    $("raceCountdown").classList.remove("show");

    raceActive = true;
    raceStartTime = performance.now();

    $("raceInput").disabled = false;
    $("raceInput").focus();

    $("raceStatus").textContent = "RACE IN PROGRESS";

    raceTimer = setInterval(updateRace, 100);
  }, 1000);
}

function updateRace() {
  if (!raceActive) return;

  const elapsedSeconds =
    (performance.now() - raceStartTime) / 1000;

  const typed = $("raceInput").value;

  const player = racers[0];

  let correct = 0;

  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === raceText[i]) correct++;
  }

  player.progress =
    Math.min(100, correct / raceText.length * 100);

  const playerWpm = elapsedSeconds > 0
    ? Math.round((correct / 5) / (elapsedSeconds / 60))
    : 0;

  $("raceWpm").textContent = playerWpm + " WPM";
  $("raceProgress").textContent =
    Math.round(player.progress) + "%";

  const elapsedMinutes = elapsedSeconds / 60;

  racers.slice(1).forEach(bot => {
    if (bot.finished) return;

    const expectedCharacters =
      bot.speed * 5 * elapsedMinutes;

    bot.progress = Math.min(
      100,
      expectedCharacters / raceText.length * 100
    );
  });

  racers.forEach(racer => {
    updateRaceCar(racer);

    if (racer.progress >= 100 && !racer.finished) {
      racer.finished = true;
      raceFinishOrder.push(racer.name);
    }
  });

  if (player.finished) {
    finishRace();
  } else if (raceFinishOrder.length === racers.length - 1) {
    // Let the player continue even after all bots finish.
    $("raceStatus").textContent = "BOTS FINISHED — KEEP TYPING!";
  }
}

function finishRace() {
  if (!raceActive) return;

  raceActive = false;

  clearInterval(raceTimer);
  raceTimer = null;

  $("raceInput").disabled = true;
  $("raceStatus").textContent = "RACE COMPLETE";

  const position = raceFinishOrder.indexOf("YOU") + 1;

  const messages = [
    "🥇 1ST PLACE — CHAMPION!",
    "🥈 2ND PLACE — GREAT RACE!",
    "🥉 3RD PLACE — NICE TRY!",
    "🏁 4TH PLACE — KEEP PRACTICING!"
  ];

  $("raceResult").hidden = false;
  $("raceResult").textContent =
    messages[position - 1] || "RACE COMPLETE";

  const bestRace = storageGet("ks_best_race", 5);

  if (position < bestRace) {
    storageSet("ks_best_race", position);
  }

  if (position === 1) {
    playSound("victory");
  }
}

function stopRace() {
  raceActive = false;

  clearInterval(raceTimer);
  clearInterval(raceCountdownTimer);

  raceTimer = null;
  raceCountdownTimer = null;

  $("raceCountdown").classList.remove("show");
  $("raceInput").disabled = true;
}

$("raceInput").addEventListener("input", () => {
  if (!raceActive) return;

  if ($("raceInput").value.length > raceText.length) {
    $("raceInput").value =
      $("raceInput").value.slice(0, raceText.length);
  }

  renderRaceText();
  updateRace();
});

$("raceInput").addEventListener("keydown", event => {
  if (!raceActive || event.key.length !== 1) return;

  const index = $("raceInput").value.length;
  const correct = event.key === raceText[index];

  playSound(correct ? "correct" : "error");
});

$("startRaceButton").onclick = startRace;

/* ==========================================
   SURVIVAL MODE
========================================== */

let survivalActive = false;
let survivalHealth = 100;
let survivalScore = 0;
let survivalWord = "";

function nextSurvivalWord() {
  survivalWord = randomItem(commonWords);
  $("survivalWord").textContent = survivalWord;
  $("survivalInput").value = "";
}

function startSurvival() {
  survivalActive = true;
  survivalHealth = 100;
  survivalScore = 0;

  $("survivalHealth").textContent = survivalHealth;
  $("survivalScore").textContent = survivalScore;
  $("healthFill").style.width = "100%";

  $("survivalInput").disabled = false;
  $("survivalMessage").textContent =
    "Survive! Every incorrect key costs 10 health.";

  nextSurvivalWord();
  $("survivalInput").focus();
}

function endSurvival() {
  survivalActive = false;
  $("survivalInput").disabled = true;
  $("survivalWord").textContent = "GAME OVER";
  $("survivalMessage").textContent =
    `Final score: ${survivalScore} words. Try again!`;
}

$("survivalInput").addEventListener("keydown", event => {
  if (!survivalActive || event.key.length !== 1) return;

  const index = $("survivalInput").value.length;
  const correct = event.key === survivalWord[index];

  if (!correct) {
    event.preventDefault();

    survivalHealth = Math.max(0, survivalHealth - 10);

    $("survivalHealth").textContent = survivalHealth;
    $("healthFill").style.width = survivalHealth + "%";

    playSound("error");

    if (survivalHealth <= 0) {
      endSurvival();
    }
  } else {
    playSound("correct");
  }
});

$("survivalInput").addEventListener("input", () => {
  if (!survivalActive) return;

  if ($("survivalInput").value === survivalWord) {
    survivalScore++;
    $("survivalScore").textContent = survivalScore;
    playSound("victory");
    nextSurvivalWord();
  }
});

$("startSurvivalButton").onclick = startSurvival;

/* ==========================================
   SPEED RUSH
========================================== */

let rushActive = false;
let rushScore = 0;
let rushWord = "";
let rushTimerInterval = null;
let rushStartTime = 0;

function nextRushWord() {
  rushWord = randomItem(commonWords);
  $("rushWord").textContent = rushWord;
  $("rushInput").value = "";
}

function startRush() {
  clearInterval(rushTimerInterval);

  rushActive = true;
  rushScore = 0;
  rushStartTime = performance.now();

  $("rushScore").textContent = "0";
  $("rushTimer").textContent = "60";

  $("rushInput").disabled = false;
  $("rushMessage").textContent = "GO! TYPE AS FAST AS YOU CAN!";

  nextRushWord();
  $("rushInput").focus();

  rushTimerInterval = setInterval(() => {
    const elapsed =
      (performance.now() - rushStartTime) / 1000;

    const remaining = Math.max(0, Math.ceil(60 - elapsed));

    $("rushTimer").textContent = remaining;

    if (elapsed >= 60) {
      endRush();
    }
  }, 100);
}

function endRush() {
  rushActive = false;

  clearInterval(rushTimerInterval);
  rushTimerInterval = null;

  $("rushInput").disabled = true;
  $("rushWord").textContent = "TIME UP!";

  $("rushMessage").textContent =
    `You typed ${rushScore} words in 60 seconds!`;

  const best = storageGet("ks_rush_best", 0);

  if (rushScore > best) {
    storageSet("ks_rush_best", rushScore);
  }

  playSound("victory");
}

$("rushInput").addEventListener("input", () => {
  if (!rushActive) return;

  if ($("rushInput").value === rushWord) {
    rushScore++;

    $("rushScore").textContent = rushScore;

    playSound("correct");
    nextRushWord();
  }
});

$("rushInput").addEventListener("keydown", event => {
  if (!rushActive || event.key.length !== 1) return;

  const index = $("rushInput").value.length;
  const correct = event.key === rushWord[index];

  if (!correct) {
    playSound("error");
  }
});

$("startRushButton").onclick = startRush;

/* ==========================================
   STATISTICS
========================================== */

function updateStatsPage() {
  const history = storageGet("ks_history", []);

  $("statsBest").textContent = storageGet("ks_best", 0);
  $("statsTests").textContent = history.length;

  const average = history.length
    ? Math.round(
        history.reduce((sum, test) => sum + test.wpm, 0)
        / history.length
      )
    : 0;

  $("statsAverage").textContent = average;

  const bestRace = storageGet("ks_best_race", 5);

  $("statsRace").textContent =
    bestRace <= 4 ? "#" + bestRace : "—";

  const container = $("testHistory");
  container.replaceChildren();

  if (!history.length) {
    container.textContent = "No completed tests yet.";
    return;
  }

  history.slice(0, 10).forEach(test => {
    const row = document.createElement("div");
    row.className = "history-item";

    const date = document.createElement("span");
    date.textContent = `${test.date} • ${test.mode} • ${test.duration}s`;

    const result = document.createElement("strong");
    result.textContent = `${test.wpm} WPM • ${test.accuracy}%`;

    row.append(date, result);
    container.appendChild(row);
  });
}

/* ==========================================
   NAVIGATION
========================================== */

function navigate(page) {
  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.page === page
    );
  });

  const pageElement = $(page + "Page");

  if (pageElement) {
    pageElement.classList.add("active");
  }

  closeSettings();

  clearInterval(timerInterval);
  timerInterval = null;

  stopRace();

  if (rushActive) {
    clearInterval(rushTimerInterval);
    rushTimerInterval = null;
    rushActive = false;
    $("rushInput").disabled = true;
  }

  if (survivalActive) {
    survivalActive = false;
    $("survivalInput").disabled = true;
  }

  if (page === "type") {
    resetTest();
  }

  if (page === "stats") {
    updateStatsPage();
  }

  window.scrollTo(0, 0);
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => navigate(btn.dataset.page);
});

$("logo").onclick = event => {
  event.preventDefault();
  navigate("type");
};

$("profileButton").onclick = () => {
  alert(
    "⚡ KEYSTRIKE ACCOUNTS\n\n" +
    "Real login, friends, chat, and online multiplayer " +
    "will be added using Supabase."
  );
};

/* ==========================================
   INITIALIZATION
========================================== */

function initialize() {
  loadSettings();
  updatePersonalBest();
  resetTest();

  console.log(
    "%c⚡ KEYSTRIKE V3 READY",
    "color:#65a8ff;font-size:22px;font-weight:bold"
  );
}

initialize();
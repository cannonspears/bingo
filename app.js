// ===== STATE =====
const DEFAULT_CELLS = [
  "20 pushups",
  "Make your bed",
  "5 min walk",
  "Drink water",
  "Stretch arms",
  "10 jumping jacks",
  "Tidy desk",
  "Deep breaths",
  "Text a friend",
  "Do the dishes",
  "10 squats",
  "Wipe counters",
  "Read a page",
  "Journal 1 min",
  "Cold water face",
  "Dance break",
];

let state = {
  mode: "25/5",
  phase: "work",
  timeLeft: 25 * 60,
  running: false,
  pomoCount: 0,
  cells: [],
  bingoAcknowledged: false,
  volMusic: 60,
  volSfx: 80,
  mutedMusic: false,
  mutedSfx: false,
  autoStart: false,
  notificationsEnabled: false,
  darkMode: false,
  // Scoring
  scoreCurrentDate: "", // local date string YYYY-MM-DD for today's session
  scoreCurrent: 0, // points earned today
  scoreYesterday: 0,
  scoreAllTime: 0, // displayed all-time: max(scoreAllTimeBase, scoreCurrent)
  scoreAllTimeBase: 0, // all-time peak from previous days only, never decremented
  // Track which bingo lines have already been awarded a bonus to avoid double-counting
  awardedLines: [],
  // Track which lines have already triggered the bingo modal (separate from scoring)
  celebratedLines: [],
};

let timerInterval = null;

// ===== LOCAL STORAGE =====
function saveState() {
  localStorage.setItem("bingoBreakState", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("bingoBreakState");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed, running: false };
      if (state.timeLeft <= 0) resetTimer(false);
    } catch (e) {
      console.warn("Could not parse saved state", e);
    }
  }
  if (!Array.isArray(state.cells) || state.cells.length !== 16) {
    state.cells = DEFAULT_CELLS.map((text) => ({ text, count: 0 }));
  }
  // Migrate old boolean `completed` cells to numeric `count`
  state.cells = state.cells.map((c) => {
    if (typeof c.count !== "number") {
      return { text: c.text, count: c.completed ? 1 : 0 };
    }
    return c;
  });
  if (!Array.isArray(state.awardedLines)) state.awardedLines = [];
  if (!Array.isArray(state.celebratedLines)) state.celebratedLines = [];

  // Daily score rollover using device local date
  const todayStr = localDateString();
  if (state.scoreCurrentDate !== todayStr) {
    const yesterdayStr = localDateString(-1);
    if (state.scoreCurrentDate === yesterdayStr) {
      state.scoreYesterday = state.scoreCurrent;
    }
    // Lock in yesterday's score as the permanent all-time base before resetting today
    state.scoreAllTimeBase = Math.max(
      state.scoreAllTimeBase || 0,
      state.scoreCurrent,
    );
    state.scoreAllTime = state.scoreAllTimeBase;
    state.scoreCurrent = 0;
    state.scoreCurrentDate = todayStr;
    state.awardedLines = [];
    state.celebratedLines = [];
    state.cells = state.cells.map((c) => ({ ...c, count: 0 }));
    state.bingoAcknowledged = false;
  }
}

// ===== SCORING =====
// Returns local date as YYYY-MM-DD string, offset by `dayOffset` days
function localDateString(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Multiplier for repeat completions: count 1=1.0, 2=1.2, 3=1.5, 4=1.8, 5=2.0
const COUNT_MULTIPLIERS = [0, 1.0, 1.2, 1.5, 1.8, 2.0];

function pointsForCell(count) {
  if (count < 1 || count > 5) return 0;
  return Math.round(5 * COUNT_MULTIPLIERS[count]);
}

function addScore(pts) {
  state.scoreCurrent += pts;
  state.scoreAllTime = Math.max(
    state.scoreAllTimeBase || 0,
    state.scoreCurrent,
  );
  saveState();
  updateScoreUI();
}

function updateScoreUI() {
  const el = document.getElementById("score-current");
  const elY = document.getElementById("score-yesterday");
  const elA = document.getElementById("score-alltime");
  if (el) el.textContent = state.scoreCurrent;
  if (elY) elY.textContent = state.scoreYesterday;
  if (elA) elA.textContent = state.scoreAllTime;
}

// All 10 winning lines (4 rows, 4 cols, 2 diagonals) as sorted index strings
const BINGO_LINES = [
  [0, 1, 2, 3], // rows
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [0, 4, 8, 12], // cols
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  [0, 5, 10, 15], // diagonals
  [3, 6, 9, 12],
];

function lineKey(line) {
  return line.join(",");
}

function checkAndAwardLines() {
  let newLines = 0;
  for (const line of BINGO_LINES) {
    const key = lineKey(line);
    if (state.awardedLines.includes(key)) continue;
    if (line.every((i) => state.cells[i].count >= 1)) {
      state.awardedLines.push(key);
      newLines++;
    }
  }
  if (newLines > 0) {
    const bonus = newLines * 20;
    addScore(bonus);
    showScorePopup(`+${bonus} Line Bonus! 🎯`);
  }

  // Blackout: all 16 cells completed at least once
  if (!state.blackoutAwarded && state.cells.every((c) => c.count >= 1)) {
    state.blackoutAwarded = true;
    addScore(100);
    showScorePopup("+100 BLACKOUT! 🔥");
  }
}

let popupTimeout = null;
function showScorePopup(msg) {
  let popup = document.getElementById("score-popup");
  if (!popup) return;
  popup.textContent = msg;
  popup.classList.add("visible");
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => popup.classList.remove("visible"), 2200);
}

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function sfxVolume() {
  return state.mutedSfx ? 0 : state.volSfx / 100;
}

// ===== SOUND ENGINE =====
// Three themes × three events (start, pause, done)
// All synthesized via Web Audio API — no file loads.

function theme() {
  return state.soundTheme || "chime";
}

// --- helpers ---
function makeOsc(ctx, type, freq, startT, stopT, vol, freqEnd) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startT);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, stopT);
  gain.gain.setValueAtTime(vol, startT);
  gain.gain.exponentialRampToValueAtTime(0.001, stopT);
  osc.start(startT);
  osc.stop(stopT + 0.01);
}

// ── CHIME ──
function chimeStart(ctx, vol, t) {
  // Warm descending sine — the original start click
  makeOsc(ctx, "sine", 880, t, t + 0.12, vol * 0.4, 440);
}
function chimePause(ctx, vol, t) {
  // Two soft descending tones, gentle and understated
  makeOsc(ctx, "sine", 660, t, t + 0.18, vol * 0.35, 440);
  makeOsc(ctx, "sine", 440, t + 0.14, t + 0.32, vol * 0.25, 330);
}
function chimeDone(ctx, vol, t) {
  // Original triple-ring chime
  [0, 0.35, 0.7].forEach((offset) => {
    makeOsc(ctx, "sine", 1318, t + offset, t + offset + 0.5, vol * 0.6);
    makeOsc(ctx, "sine", 1975, t + offset, t + offset + 0.4, vol * 0.3);
  });
}

// ── BEEP ──
function beepStart(ctx, vol, t) {
  // Short crisp square pulse, rising
  makeOsc(ctx, "square", 440, t, t + 0.08, vol * 0.25, 660);
}
function beepPause(ctx, vol, t) {
  // Two descending square pulses
  makeOsc(ctx, "square", 660, t, t + 0.08, vol * 0.2);
  makeOsc(ctx, "square", 440, t + 0.12, t + 0.2, vol * 0.2);
}
function beepDone(ctx, vol, t) {
  // Three evenly-spaced square beeps at fixed pitch
  [0, 0.22, 0.44].forEach((offset) => {
    makeOsc(ctx, "square", 880, t + offset, t + offset + 0.14, vol * 0.3);
  });
}

// ── BELL ──
function bellStart(ctx, vol, t) {
  // Triangle wave with long decay — single struck note
  makeOsc(ctx, "triangle", 740, t, t + 0.55, vol * 0.5, 600);
}
function bellPause(ctx, vol, t) {
  // Two slightly flat triangle tones trailing off
  makeOsc(ctx, "triangle", 600, t, t + 0.5, vol * 0.4, 500);
  makeOsc(ctx, "triangle", 500, t + 0.28, t + 0.75, vol * 0.25, 420);
}
function bellDone(ctx, vol, t) {
  // Three struck bell tones in ascending pitch
  makeOsc(ctx, "triangle", 523, t, t + 0.8, vol * 0.5, 440);
  makeOsc(ctx, "triangle", 659, t + 0.35, t + 1.1, vol * 0.5, 587);
  makeOsc(ctx, "triangle", 784, t + 0.7, t + 1.45, vol * 0.5, 698);
}

// ── Public dispatchers ──
function playStartClick() {
  const ctx = getAudioCtx();
  const vol = sfxVolume();
  if (vol === 0) return;
  const t = ctx.currentTime;
  if (theme() === "beep") beepStart(ctx, vol, t);
  else if (theme() === "bell") bellStart(ctx, vol, t);
  else chimeStart(ctx, vol, t);
}

function playPause() {
  const ctx = getAudioCtx();
  const vol = sfxVolume();
  if (vol === 0) return;
  const t = ctx.currentTime;
  if (theme() === "beep") beepPause(ctx, vol, t);
  else if (theme() === "bell") bellPause(ctx, vol, t);
  else chimePause(ctx, vol, t);
}

function playTimerDone() {
  const ctx = getAudioCtx();
  const vol = sfxVolume();
  if (vol === 0) return;
  const t = ctx.currentTime;
  if (theme() === "beep") beepDone(ctx, vol, t);
  else if (theme() === "bell") bellDone(ctx, vol, t);
  else chimeDone(ctx, vol, t);
}

// ===== BACKGROUND MUSIC =====
let MUSIC_FILES = []; // populated from music/manifest.json at startup
let musicAudio = null;

async function loadMusicManifest() {
  try {
    const res = await fetch("music/manifest.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tracks = await res.json();
    if (Array.isArray(tracks) && tracks.length > 0) {
      MUSIC_FILES = tracks.map((t) =>
        typeof t === "string"
          ? {
              file: `music/${t}`,
              title: t.replace(/\.mp3$/i, ""),
              artist: "",
              license: "",
              url: "",
            }
          : { ...t, file: `music/${t.file}` },
      );
    } else {
      console.warn(
        "music/manifest.json is empty or invalid — no music will play.",
      );
    }
  } catch (e) {
    console.warn(
      "Could not load music/manifest.json — no background music will play.",
      e,
    );
  }
}

function pickRandomTrack() {
  if (MUSIC_FILES.length === 0) return null;
  return MUSIC_FILES[Math.floor(Math.random() * MUSIC_FILES.length)];
}

function updateNowPlaying(track) {
  const npEl = document.getElementById("now-playing");
  const npIcon = document.getElementById("np-icon");
  const npTrack = document.getElementById("np-track");
  const npArtist = document.getElementById("np-artist");
  const npUrl = document.getElementById("np-url");
  const npLicense = document.getElementById("np-license");

  if (!track) {
    // Idle state — always visible but dimmed
    npEl.classList.add("now-playing-idle");
    npIcon.style.animation = "none";
    npTrack.textContent = "No music playing";
    npArtist.textContent = "Music plays during work sessions";
    npUrl.classList.add("hidden");
    npLicense.textContent = "";
    return;
  }

  // Active state
  npEl.classList.remove("now-playing-idle");
  npIcon.style.animation = "";
  npTrack.textContent = track.title || "Unknown Track";
  npArtist.textContent = track.artist || "";

  if (track.url) {
    npUrl.href = track.url;
    npUrl.textContent = "↗ Source";
    npUrl.classList.remove("hidden");
  } else {
    npUrl.classList.add("hidden");
  }

  npLicense.textContent = track.license || "";
}

function startMusic() {
  stopMusic();
  const track = pickRandomTrack();
  if (!track) return;
  musicAudio = new Audio(track.file);
  musicAudio.loop = false;
  musicAudio.volume = 0; // start at 0 for fade-in
  musicAudio.onerror = () => {
    musicAudio = null;
    updateNowPlaying(null);
  };
  musicAudio.addEventListener("ended", () => {
    if (state.running && state.phase === "work") startMusic();
  });
  musicAudio.play().catch((e) => {
    console.warn("Music playback failed:", e);
  });
  updateNowPlaying(track);
  fadeInMusic();
}

function fadeInMusic() {
  if (!musicAudio) return;
  const targetVol = state.mutedMusic ? 0 : state.volMusic / 100;
  const steps = 25;
  const interval = 500 / steps;
  let step = 0;
  const fadeTimer = setInterval(() => {
    step++;
    if (!musicAudio) {
      clearInterval(fadeTimer);
      return;
    }
    musicAudio.volume = Math.min(targetVol, (step / steps) * targetVol);
    if (step >= steps) clearInterval(fadeTimer);
  }, interval);
}

function stopMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.src = "";
    musicAudio = null;
  }
  updateNowPlaying(null);
}

function applyMusicVolume() {
  if (musicAudio) {
    musicAudio.volume = state.mutedMusic ? 0 : state.volMusic / 100;
  }
}

// ===== NOTIFICATIONS =====
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission !== "granted") {
        state.notificationsEnabled = false;
        document.getElementById("toggle-notifs").checked = false;
        document.getElementById("notifs-desc").textContent = "Off";
        saveState();
      }
    });
  }
}

function sendNotification(title, body) {
  if (!state.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  new Notification(title, { body, icon: "" });
}

// ===== TIMER =====
function workMinutes() {
  return state.mode === "50/10" ? 50 : 25;
}
function breakMinutes() {
  return state.mode === "50/10" ? 10 : 5;
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  playStartClick();
  if (state.phase === "work") startMusic();
  updateTimerUI();
  saveState();
  timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  stopMusic();
  playPause();
  updateTimerUI();
  saveState();
}

function resetTimer(save = true) {
  pauseTimer();
  state.phase = "work";
  state.timeLeft = workMinutes() * 60;
  state.running = false;
  updateTimerUI();
  if (save) saveState();
}

function tick() {
  if (state.timeLeft > 0) {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft % 5 === 0) saveState();
  } else {
    phaseComplete();
  }
}

function phaseComplete() {
  stopMusic();
  pauseTimer();
  playTimerDone();

  if (state.phase === "work") {
    state.pomoCount++;
    state.phase = "break";
    state.timeLeft = breakMinutes() * 60;
    updatePomoCount();
    sendNotification(
      "Work session done! ☕",
      `Enjoy your ${breakMinutes()}-minute break.`,
    );
    showPhaseModal(
      "☕",
      `Work session done! Enjoy your ${breakMinutes()}-minute break.`,
    );
  } else {
    state.phase = "work";
    state.timeLeft = workMinutes() * 60;
    sendNotification("Break's over! 💪", "Time to focus.");
    showPhaseModal("💪", "Break's over! Ready to focus?");
  }

  updateTimerUI();
  saveState();

  // Auto-start next session if enabled
  if (state.autoStart) {
    setTimeout(() => {
      document.getElementById("phase-modal").classList.add("hidden");
      startTimer();
    }, 2000);
  }
}

function showPhaseModal(emoji, msg) {
  document.getElementById("phase-modal-emoji").textContent = emoji;
  document.getElementById("phase-modal-msg").textContent = msg;
  document.getElementById("phase-modal").classList.remove("hidden");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatTime(
    state.timeLeft,
  );
}

function updateTimerUI() {
  const display = document.getElementById("timer-display");
  const phaseLabel = document.getElementById("phase-label");
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");
  const header = document.getElementById("main-header");

  display.textContent = formatTime(state.timeLeft);

  if (state.phase === "work") {
    phaseLabel.textContent = "Work Session";
    phaseLabel.className = "";
    display.className = state.running ? "running" : "";
    header.classList.toggle("header-work", state.running);
    header.classList.remove("header-break");
  } else {
    phaseLabel.textContent = "Break Time!";
    phaseLabel.className = "break-phase";
    display.className = state.running ? "running break-phase" : "break-phase";
    header.classList.toggle("header-break", state.running);
    header.classList.remove("header-work");
  }

  if (!state.running) {
    header.classList.remove("header-work", "header-break");
  }

  btnStart.disabled = state.running;
  btnPause.disabled = !state.running;
}

function updatePomoCount() {
  document.getElementById("pomo-number").textContent = state.pomoCount;
}

// ===== SETTINGS =====
function applyMode(mode) {
  pauseTimer();
  state.mode = mode;
  state.phase = "work";
  state.timeLeft = workMinutes() * 60;
  updateTimerUI();
  saveState();
}

function applyDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);
  document.getElementById("darkmode-desc").textContent = enabled ? "On" : "Off";
}

function initSettings() {
  // Flip card
  const flipCard = document.getElementById("timer-flip-card");
  document.getElementById("btn-open-settings").addEventListener("click", () => {
    syncFlipCardHeight();
    flipCard.classList.add("flipped");
  });
  document
    .getElementById("btn-close-settings")
    .addEventListener("click", () => {
      flipCard.classList.remove("flipped");
      setTimeout(() => {
        document.querySelector(".flip-card-inner").style.height = "";
      }, 680);
    });

  // Timer mode radios
  document.querySelectorAll("input[name='pomo-mode']").forEach((radio) => {
    if (radio.value === state.mode) radio.checked = true;
    radio.addEventListener("change", (e) => {
      if (e.target.checked) applyMode(e.target.value);
    });
  });

  // Sound theme radios — save selection and play a preview start sound
  document.querySelectorAll("input[name='sound-theme']").forEach((radio) => {
    if (radio.value === (state.soundTheme || "chime")) radio.checked = true;
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        state.soundTheme = e.target.value;
        saveState();
        playStartClick(); // preview the start sound for the chosen theme
      }
    });
  });

  // Volume controls
  initVolumeControls();

  // Auto-start toggle
  const toggleAutostart = document.getElementById("toggle-autostart");
  toggleAutostart.checked = state.autoStart;
  document.getElementById("autostart-desc").textContent = state.autoStart
    ? "On"
    : "Off";
  toggleAutostart.addEventListener("change", () => {
    state.autoStart = toggleAutostart.checked;
    document.getElementById("autostart-desc").textContent = state.autoStart
      ? "On"
      : "Off";
    saveState();
  });

  // Notifications toggle
  const toggleNotifs = document.getElementById("toggle-notifs");
  toggleNotifs.checked = state.notificationsEnabled;
  document.getElementById("notifs-desc").textContent =
    state.notificationsEnabled ? "On" : "Off";
  toggleNotifs.addEventListener("change", () => {
    state.notificationsEnabled = toggleNotifs.checked;
    document.getElementById("notifs-desc").textContent =
      state.notificationsEnabled ? "On" : "Off";
    if (state.notificationsEnabled) requestNotificationPermission();
    saveState();
  });

  // Dark mode toggle
  const toggleDark = document.getElementById("toggle-darkmode");
  toggleDark.checked = state.darkMode;
  applyDarkMode(state.darkMode);
  toggleDark.addEventListener("change", () => {
    state.darkMode = toggleDark.checked;
    applyDarkMode(state.darkMode);
    saveState();
  });

  // Reset board (settings panel button)
  document
    .getElementById("btn-reset-bingo-settings")
    .addEventListener("click", () => {
      if (
        confirm(
          "Reshuffle the bingo card and clear all marks? Today's score will also reset.",
        )
      ) {
        const texts = state.cells.map((c) => c.text);
        const shuffled = shuffleCells(
          texts.map((text) => ({ text, count: 0 })),
        );
        state.cells = shuffled;
        state.bingoAcknowledged = false;
        state.awardedLines = [];
        state.celebratedLines = [];
        state.blackoutAwarded = false;
        state.scoreCurrent = 0;
        updateScoreUI();
        saveState();
        renderBingoGrid();
      }
    });

  // Reset all scores
  document.getElementById("btn-reset-scores").addEventListener("click", () => {
    if (
      confirm(
        "Wipe all scores — today, yesterday, and all-time? This cannot be undone.",
      )
    ) {
      state.scoreCurrent = 0;
      state.scoreYesterday = 0;
      state.scoreAllTime = 0;
      state.scoreAllTimeBase = 0;
      saveState();
      updateScoreUI();
    }
  });
}

function syncFlipCardHeight() {
  const front = document.querySelector(".flip-card-front");
  const back = document.querySelector(".flip-card-back");
  const inner = document.querySelector(".flip-card-inner");
  // Temporarily release the back's height constraint to measure its natural content height
  back.style.height = "auto";
  const frontH = front.scrollHeight;
  const backH = back.scrollHeight;
  // Restore back to fill the inner container
  back.style.height = "";
  inner.style.height = Math.max(frontH, backH) + "px";
}

function initVolumeControls() {
  const sliderMusic = document.getElementById("vol-music");
  const sliderSfx = document.getElementById("vol-sfx");
  const valMusic = document.getElementById("vol-music-val");
  const valSfx = document.getElementById("vol-sfx-val");
  const btnMuteMusic = document.getElementById("btn-mute-music");
  const btnMuteSfx = document.getElementById("btn-mute-sfx");

  sliderMusic.value = state.volMusic;
  valMusic.textContent = state.volMusic;
  sliderSfx.value = state.volSfx;
  valSfx.textContent = state.volSfx;
  updateMuteButton(btnMuteMusic, state.mutedMusic);
  updateMuteButton(btnMuteSfx, state.mutedSfx);

  sliderMusic.addEventListener("input", () => {
    state.volMusic = parseInt(sliderMusic.value);
    valMusic.textContent = state.volMusic;
    if (state.volMusic > 0) {
      state.mutedMusic = false;
      updateMuteButton(btnMuteMusic, false);
    }
    applyMusicVolume();
    saveState();
  });

  sliderSfx.addEventListener("input", () => {
    state.volSfx = parseInt(sliderSfx.value);
    valSfx.textContent = state.volSfx;
    if (state.volSfx > 0) {
      state.mutedSfx = false;
      updateMuteButton(btnMuteSfx, false);
    }
    saveState();
  });

  btnMuteMusic.addEventListener("click", () => {
    state.mutedMusic = !state.mutedMusic;
    updateMuteButton(btnMuteMusic, state.mutedMusic);
    applyMusicVolume();
    saveState();
  });

  btnMuteSfx.addEventListener("click", () => {
    state.mutedSfx = !state.mutedSfx;
    updateMuteButton(btnMuteSfx, state.mutedSfx);
    saveState();
  });
}

function updateMuteButton(btn, muted) {
  btn.textContent = muted ? "Off" : "On";
  btn.classList.toggle("muted", muted);
}

// ===== BINGO GRID =====
function shuffleCells(cells) {
  const arr = [...cells];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderBingoGrid() {
  const grid = document.getElementById("bingo-grid");
  grid.innerHTML = "";

  state.cells.forEach((cell, i) => {
    const div = document.createElement("div");
    const countClass =
      cell.count > 0 ? ` completed completed-${cell.count}` : "";
    div.className = "bingo-cell" + countClass;
    div.dataset.index = i;

    const span = document.createElement("span");
    span.className = "cell-text" + (cell.text ? "" : " placeholder");
    span.textContent = cell.text || "Click to add...";
    div.appendChild(span);

    if (cell.count > 0) {
      const pip = document.createElement("span");
      pip.className = "cell-count-pip";
      pip.textContent = "★".repeat(cell.count);
      div.appendChild(pip);
    }

    div.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleCell(i);
    });

    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (state.cells[i].count > 0) {
        state.cells[i].count--;
        recalculateScore();
        saveState();
        renderBingoGrid();
      }
    });

    grid.appendChild(div);
  });
}

function recalculateScore() {
  let pts = 0;
  state.cells.forEach((c) => {
    for (let n = 1; n <= c.count; n++) {
      pts += pointsForCell(n) - pointsForCell(n - 1);
    }
  });
  pts += state.awardedLines.length * 20;
  if (state.blackoutAwarded) pts += 100;
  state.scoreCurrent = pts;
  // All-time is always the max of the locked base (previous days) and today's live score
  state.scoreAllTime = Math.max(
    state.scoreAllTimeBase || 0,
    state.scoreCurrent,
  );
  updateScoreUI();
}

function toggleCell(index) {
  const cell = state.cells[index];
  const prevCount = cell.count;

  if (prevCount < 5) {
    cell.count = prevCount + 1;
    const pts = pointsForCell(cell.count) - pointsForCell(prevCount);
    addScore(pts);
    const multiplierLabels = ["", "", "×1.2", "×1.5", "×1.8", "×2.0"];
    if (cell.count >= 2)
      showScorePopup(`+${pts} pts ${multiplierLabels[cell.count]}`);
    else showScorePopup(`+${pts} pts`);
    checkAndAwardLines();
  } else {
    return;
  }

  saveState();
  renderBingoGrid();
  checkBingo();
}

function checkBingo() {
  const c = state.cells;
  const done = (i) => c[i].count >= 1;

  for (const line of BINGO_LINES) {
    const key = lineKey(line);
    if (state.celebratedLines.includes(key)) continue; // modal already shown for this line
    if (line.every(done)) {
      state.celebratedLines.push(key);
      showBingoModal();
      return; // one modal at a time; next new line fires on next click
    }
  }
}

function showBingoModal() {
  document.getElementById("bingo-modal").classList.remove("hidden");
}

// ===== CUSTOMIZE MODAL =====
function openCustomizeModal() {
  const list = document.getElementById("customize-list");
  list.innerHTML = "";

  state.cells.forEach((cell, i) => {
    const row = document.createElement("div");
    row.className = "customize-row";

    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 50;
    input.placeholder = `Break idea ${i + 1}…`;
    input.value = cell.text;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const inputs = list.querySelectorAll("input");
        const next = inputs[i + 1];
        if (next) next.focus();
        else document.getElementById("btn-customize-save").focus();
      }
    });

    row.appendChild(num);
    row.appendChild(input);
    list.appendChild(row);
  });

  document.getElementById("customize-modal").classList.remove("hidden");
  list.querySelectorAll("input")[0].focus();
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function saveCustomize() {
  const inputs = document.querySelectorAll("#customize-list input");
  const texts = Array.from(inputs).map((inp) => inp.value.trim());
  const filled = texts.map((t, i) => t || DEFAULT_CELLS[i] || "");

  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filled[i], filled[j]] = [filled[j], filled[i]];
  }

  state.cells = filled.map((text) => ({ text, count: 0 }));
  state.bingoAcknowledged = false;
  saveState();
  renderBingoGrid();
  closeCustomizeModal();
}

function loadDefaultsIntoModal() {
  const inputs = document.querySelectorAll("#customize-list input");
  DEFAULT_CELLS.forEach((text, i) => {
    if (inputs[i]) inputs[i].value = text;
  });
}

// ===== INIT =====
async function init() {
  // Load music manifest first so tracks are ready when user hits Start
  await loadMusicManifest();

  loadState();

  // Timer buttons
  document.getElementById("btn-start").addEventListener("click", startTimer);
  document.getElementById("btn-pause").addEventListener("click", pauseTimer);
  document
    .getElementById("btn-reset")
    .addEventListener("click", () => resetTimer(true));

  // Settings (includes flip card, all toggles, volume, reset buttons)
  initSettings();

  // Customize modal
  document
    .getElementById("btn-open-customize")
    .addEventListener("click", openCustomizeModal);
  document
    .getElementById("btn-customize-cancel")
    .addEventListener("click", closeCustomizeModal);
  document
    .getElementById("btn-customize-save")
    .addEventListener("click", saveCustomize);
  document
    .getElementById("btn-customize-defaults")
    .addEventListener("click", loadDefaultsIntoModal);
  document.getElementById("customize-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("customize-modal"))
      closeCustomizeModal();
  });

  // Bingo modal
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("bingo-modal").classList.add("hidden");
  });

  // Phase complete modal
  document
    .getElementById("btn-close-phase-modal")
    .addEventListener("click", () => {
      document.getElementById("phase-modal").classList.add("hidden");
    });

  updateTimerUI();
  updatePomoCount();
  updateScoreUI();
  renderBingoGrid();
}

document.addEventListener("DOMContentLoaded", init);

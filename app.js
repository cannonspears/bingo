// ===================================================================
// BINGO BREAK — app.js
// All original game logic preserved.
// New additions: card deck engine, progress bar, updated UI bindings.
// ===================================================================

// ===== STATE =====
const DEFAULT_CELLS = [
  "20 pushups", "Make your bed", "5 min walk", "Drink water",
  "Stretch arms", "10 jumping jacks", "Tidy desk", "Deep breaths",
  "Text a friend", "Do the dishes", "10 squats", "Wipe counters",
  "Read a page", "Journal 1 min", "Cold water face", "Dance break",
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
  soundTheme: "chime",
  scoreCurrentDate: "",
  scoreCurrent: 0,
  scoreYesterday: 0,
  scoreAllTime: 0,
  scoreAllTimeBase: 0,
  awardedLines: [],
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
  state.cells = state.cells.map((c) => {
    if (typeof c.count !== "number") {
      return { text: c.text, count: c.completed ? 1 : 0 };
    }
    return c;
  });
  if (!Array.isArray(state.awardedLines))    state.awardedLines    = [];
  if (!Array.isArray(state.celebratedLines)) state.celebratedLines = [];

  // Daily score rollover
  const todayStr = localDateString();
  if (state.scoreCurrentDate !== todayStr) {
    const yesterdayStr = localDateString(-1);
    if (state.scoreCurrentDate === yesterdayStr) {
      state.scoreYesterday = state.scoreCurrent;
    }
    state.scoreAllTimeBase = Math.max(state.scoreAllTimeBase || 0, state.scoreCurrent);
    state.scoreAllTime     = state.scoreAllTimeBase;
    state.scoreCurrent     = 0;
    state.scoreCurrentDate = todayStr;
    state.awardedLines     = [];
    state.celebratedLines  = [];
    state.cells            = state.cells.map((c) => ({ ...c, count: 0 }));
    state.bingoAcknowledged = false;
  }
}

// ===== SCORING =====
function localDateString(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const COUNT_MULTIPLIERS = [0, 1.0, 1.2, 1.5, 1.8, 2.0];

function pointsForCell(count) {
  if (count < 1 || count > 5) return 0;
  return Math.round(5 * COUNT_MULTIPLIERS[count]);
}

function addScore(pts) {
  state.scoreCurrent += pts;
  state.scoreAllTime  = Math.max(state.scoreAllTimeBase || 0, state.scoreCurrent);
  saveState();
  updateScoreUI();
}

function updateScoreUI() {
  const el  = document.getElementById("score-current");
  const elY = document.getElementById("score-yesterday");
  const elA = document.getElementById("score-alltime");
  if (el)  el.textContent  = state.scoreCurrent;
  if (elY) elY.textContent = state.scoreYesterday;
  if (elA) elA.textContent = state.scoreAllTime;
}

const BINGO_LINES = [
  [0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15],
  [0,4,8,12], [1,5,9,13], [2,6,10,14], [3,7,11,15],
  [0,5,10,15], [3,6,9,12],
];

function lineKey(line) { return line.join(","); }

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
  if (!state.blackoutAwarded && state.cells.every((c) => c.count >= 1)) {
    state.blackoutAwarded = true;
    addScore(100);
    showScorePopup("+100 BLACKOUT! 🔥");
  }
}

let popupTimeout = null;
function showScorePopup(msg) {
  const popup = document.getElementById("score-popup");
  if (!popup) return;
  popup.textContent = msg;
  popup.classList.add("visible");
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => popup.classList.remove("visible"), 2200);
}

// ===== SOUND ENGINE =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Prime the AudioContext on the first user gesture so it's running before sounds are needed
function primeAudioCtx() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

async function ensureAudioCtxRunning() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}
function sfxVolume() { return state.volSfx / 100 || 0.8; }
function theme()     { return state.soundTheme || "chime"; }

function makeOsc(ctx, type, freq, startT, stopT, vol, freqEnd) {
  const osc  = ctx.createOscillator();
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

// Chime
function chimeStart(ctx, vol, t) { makeOsc(ctx, "sine", 880, t, t+0.12, vol*0.4, 440); }
function chimePause(ctx, vol, t) {
  makeOsc(ctx, "sine", 660, t, t+0.18, vol*0.35, 440);
  makeOsc(ctx, "sine", 440, t+0.14, t+0.32, vol*0.25, 330);
}
function chimeDone(ctx, vol, t) {
  [0, 0.35, 0.7].forEach((o) => {
    makeOsc(ctx, "sine", 1318, t+o, t+o+0.5, vol*0.6);
    makeOsc(ctx, "sine", 1975, t+o, t+o+0.4, vol*0.3);
  });
}

// Beep
function beepStart(ctx, vol, t) { makeOsc(ctx, "square", 440, t, t+0.08, vol*0.25, 660); }
function beepPause(ctx, vol, t) {
  makeOsc(ctx, "square", 660, t, t+0.08, vol*0.2);
  makeOsc(ctx, "square", 440, t+0.12, t+0.2, vol*0.2);
}
function beepDone(ctx, vol, t) {
  [0, 0.22, 0.44].forEach((o) => makeOsc(ctx, "square", 880, t+o, t+o+0.14, vol*0.3));
}

// Bell
function bellStart(ctx, vol, t) { makeOsc(ctx, "triangle", 740, t, t+0.55, vol*0.5, 600); }
function bellPause(ctx, vol, t) {
  makeOsc(ctx, "triangle", 600, t, t+0.5, vol*0.4, 500);
  makeOsc(ctx, "triangle", 500, t+0.28, t+0.75, vol*0.25, 420);
}
function bellDone(ctx, vol, t) {
  makeOsc(ctx, "triangle", 523, t, t+0.8, vol*0.5, 440);
  makeOsc(ctx, "triangle", 659, t+0.35, t+1.1, vol*0.5, 587);
  makeOsc(ctx, "triangle", 784, t+0.7, t+1.45, vol*0.5, 698);
}

async function playStartClick() {
  const ctx = await ensureAudioCtxRunning();
  const vol = sfxVolume();
  const t = ctx.currentTime;
  if (theme() === "beep") beepStart(ctx, vol, t);
  else if (theme() === "bell") bellStart(ctx, vol, t);
  else chimeStart(ctx, vol, t);
}
async function playPause() {
  const ctx = await ensureAudioCtxRunning();
  const vol = sfxVolume();
  const t = ctx.currentTime;
  if (theme() === "beep") beepPause(ctx, vol, t);
  else if (theme() === "bell") bellPause(ctx, vol, t);
  else chimePause(ctx, vol, t);
}
async function playTimerDone() {
  const ctx = await ensureAudioCtxRunning();
  const vol = sfxVolume();
  const t = ctx.currentTime;
  if (theme() === "beep") beepDone(ctx, vol, t);
  else if (theme() === "bell") bellDone(ctx, vol, t);
  else chimeDone(ctx, vol, t);
}

// ===== BACKGROUND MUSIC =====
let MUSIC_FILES = [];
let musicAudio  = null;

async function loadMusicManifest() {
  try {
    const res = await fetch("music/manifest.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tracks = await res.json();
    if (Array.isArray(tracks) && tracks.length > 0) {
      MUSIC_FILES = tracks.map((t) =>
        typeof t === "string"
          ? { file: `music/${t}`, title: t.replace(/\.mp3$/i, ""), artist: "", license: "", url: "" }
          : { ...t, file: `music/${t.file}` },
      );
    }
  } catch (e) {
    console.warn("Could not load music/manifest.json — no background music will play.", e);
  }
}

// Shuffle queue — exhausts all tracks before any repeat
let shuffleQueue = [];

function buildShuffleQueue() {
  const arr = [...MUSIC_FILES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  shuffleQueue = arr;
}

function pickNextTrack() {
  if (!MUSIC_FILES.length) return null;
  if (!shuffleQueue.length) buildShuffleQueue();
  return shuffleQueue.shift();
}

function updateNowPlaying(track) {
  const npEl      = document.getElementById("now-playing");
  const npIcon    = document.getElementById("np-icon");
  const npTrack   = document.getElementById("np-track");
  const npArtist  = document.getElementById("np-artist");
  const npUrl     = document.getElementById("np-url");
  const npLicense = document.getElementById("np-license");

  if (!track) {
    npEl.classList.add("now-playing-idle");
    npIcon.style.animation = "none";
    npTrack.textContent    = "No music playing";
    npArtist.textContent   = "Music plays during work sessions";
    npUrl.classList.add("hidden");
    npLicense.textContent  = "";
    return;
  }
  npEl.classList.remove("now-playing-idle");
  npIcon.style.animation = "";
  npTrack.textContent    = track.title  || "Unknown Track";
  npArtist.textContent   = track.artist || "";
  if (track.url) {
    npUrl.href = track.url;
    npUrl.textContent = "↗ Source";
    npUrl.classList.remove("hidden");
  } else {
    npUrl.classList.add("hidden");
  }
  npLicense.textContent = track.license || "";
}

function startMusic(fromEnded = false) {
  // If not chaining from a natural end, explicitly stop any current track first
  // and reset the shuffle queue so a new work session starts fresh
  if (!fromEnded) {
    stopMusic();
    buildShuffleQueue();
  }

  const track = pickNextTrack();
  if (!track) return;

  const audio  = new Audio(track.file);
  audio.loop   = false;
  audio.volume = 0;
  musicAudio   = audio;

  audio.onerror = () => {
    if (musicAudio === audio) { musicAudio = null; updateNowPlaying(null); }
  };

  audio.addEventListener("ended", () => {
    // Only chain if this is still the active track and the timer is still running
    if (musicAudio !== audio) return;
    musicAudio = null; // clear before starting next to avoid double-trigger
    if (state.running && state.phase === "work") startMusic(true);
  });

  audio.play().catch((e) => console.warn("Music playback failed:", e));
  updateNowPlaying(track);
  fadeInMusic();
}

function fadeInMusic() {
  if (!musicAudio) return;
  const audio     = musicAudio; // capture this specific instance
  const targetVol = state.mutedMusic ? 0 : state.volMusic / 100;
  const steps = 25, interval = 500 / steps;
  let step = 0;
  const fadeTimer = setInterval(() => {
    step++;
    if (musicAudio !== audio) { clearInterval(fadeTimer); return; } // track was replaced
    audio.volume = Math.min(targetVol, (step / steps) * targetVol);
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
  if (musicAudio) musicAudio.volume = state.mutedMusic ? 0 : state.volMusic / 100;
}

// ===== NOTIFICATIONS =====
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm !== "granted") {
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
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "" });
}

// ===== TIMER =====
function workMinutes()  { return state.mode === "50/10" ? 50 : 25; }
function breakMinutes() { return state.mode === "50/10" ? 10 :  5; }
function totalSeconds() { return (state.phase === "work" ? workMinutes() : breakMinutes()) * 60; }

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
  state.phase    = "work";
  state.timeLeft = workMinutes() * 60;
  state.running  = false;
  updateTimerUI();
  if (save) saveState();
}

function tick() {
  if (state.timeLeft > 0) {
    state.timeLeft--;
    updateTimerDisplay();
    updateProgressBar();
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
    state.phase    = "break";
    state.timeLeft = breakMinutes() * 60;
    updatePomoCount();
    sendNotification("Work session done! ☕", `Enjoy your ${breakMinutes()}-minute break.`);
    showPhaseModal("☕", `Work session done! Enjoy your ${breakMinutes()}-minute break.`);
  } else {
    state.phase    = "work";
    state.timeLeft = workMinutes() * 60;
    sendNotification("Break's over! 💪", "Time to focus.");
    showPhaseModal("💪", "Break's over! Ready to focus?");
  }

  updateTimerUI();
  saveState();

  if (state.autoStart) {
    setTimeout(() => {
      document.getElementById("phase-modal").classList.add("hidden");
      startTimer();
    }, 2000);
  }
}

function showPhaseModal(emoji, msg) {
  document.getElementById("phase-modal-emoji").textContent = emoji;
  document.getElementById("phase-modal-msg").textContent   = msg;
  document.getElementById("phase-modal").classList.remove("hidden");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatTime(state.timeLeft);
}

function updateProgressBar() {
  const fill  = document.getElementById("timer-progress-fill");
  if (!fill) return;
  const total = totalSeconds();
  const pct   = total > 0 ? (state.timeLeft / total) * 100 : 100;
  fill.style.width = pct + "%";
  fill.classList.toggle("break-phase", state.phase === "break");
}

function updateTimerUI() {
  const display   = document.getElementById("timer-display");
  const phaseLabel = document.getElementById("phase-label");
  const btnStart  = document.getElementById("btn-start");
  const btnPause  = document.getElementById("btn-pause");
  const header    = document.getElementById("main-header");
  // Also update the card title
  const cardTitle = document.getElementById("card-title-0");

  display.textContent = formatTime(state.timeLeft);

  if (state.phase === "work") {
    phaseLabel.textContent = "Work Session";
    phaseLabel.className   = "phase-label";
    display.className      = "timer-digits" + (state.running ? " running" : "");
    if (cardTitle) cardTitle.textContent = "Work Session";
    header.classList.toggle("header-work", state.running);
    header.classList.remove("header-break");
    btnStart.classList.remove("break-mode");
    btnPause.classList.remove("break-mode");
  } else {
    phaseLabel.textContent = "Break Time!";
    phaseLabel.className   = "phase-label break-phase";
    display.className      = "timer-digits break-phase" + (state.running ? " running" : "");
    if (cardTitle) cardTitle.textContent = "Break Time!";
    header.classList.toggle("header-break", state.running);
    header.classList.remove("header-work");
    btnStart.classList.add("break-mode");
    btnPause.classList.add("break-mode");
  }

  if (!state.running) header.classList.remove("header-work", "header-break");

  btnStart.disabled = state.running;
  btnPause.disabled = !state.running;

  updateProgressBar();
}

function updatePomoCount() {
  document.getElementById("pomo-number").textContent = state.pomoCount;
}

// ===== SETTINGS =====
function applyMode(mode) {
  pauseTimer();
  state.mode     = mode;
  state.phase    = "work";
  state.timeLeft = workMinutes() * 60;
  updateTimerUI();
  saveState();
}

function applyDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);
  document.getElementById("darkmode-desc").textContent = enabled ? "On" : "Off";
}

function initSettings() {
  // Timer mode radios
  document.querySelectorAll("input[name='pomo-mode']").forEach((radio) => {
    if (radio.value === state.mode) radio.checked = true;
    radio.addEventListener("change", (e) => { if (e.target.checked) applyMode(e.target.value); });
  });

  // Sound theme radios — preview always plays regardless of SFX mute
  // If a previously saved state had "beep", fall back to "chime"
  if (state.soundTheme === "beep") state.soundTheme = "chime";
  document.querySelectorAll("input[name='sound-theme']").forEach((radio) => {
    if (radio.value === (state.soundTheme || "chime")) radio.checked = true;
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        state.soundTheme = e.target.value;
        saveState();
        // Preview: temporarily bypass mute
        const wasMuted = state.mutedSfx;
        state.mutedSfx = false;
        playStartClick();
        state.mutedSfx = wasMuted;
      }
    });
  });

  // Volume controls
  initVolumeControls();

  // Auto-start
  const toggleAutostart = document.getElementById("toggle-autostart");
  toggleAutostart.checked = state.autoStart;
  document.getElementById("autostart-desc").textContent = state.autoStart ? "On" : "Off";
  toggleAutostart.addEventListener("change", () => {
    state.autoStart = toggleAutostart.checked;
    document.getElementById("autostart-desc").textContent = state.autoStart ? "On" : "Off";
    saveState();
  });

  // Dark mode
  const toggleDark = document.getElementById("toggle-darkmode");
  toggleDark.checked = state.darkMode;
  applyDarkMode(state.darkMode);
  toggleDark.addEventListener("change", () => {
    state.darkMode = toggleDark.checked;
    applyDarkMode(state.darkMode);
    saveState();
  });

  // Reset board
  document.getElementById("btn-reset-bingo-settings").addEventListener("click", () => {
    if (confirm("Reshuffle the bingo card and clear all marks? Today's score will also reset.")) {
      const texts    = state.cells.map((c) => c.text);
      const shuffled = shuffleCells(texts.map((text) => ({ text, count: 0 })));
      state.cells             = shuffled;
      state.bingoAcknowledged = false;
      state.awardedLines      = [];
      state.celebratedLines   = [];
      state.blackoutAwarded   = false;
      state.scoreCurrent      = 0;
      updateScoreUI();
      saveState();
      renderBingoGrid();
    }
  });

  // Reset scores
  document.getElementById("btn-reset-scores").addEventListener("click", () => {
    if (confirm("Wipe all scores — today, yesterday, and all-time? This cannot be undone.")) {
      state.scoreCurrent  = 0;
      state.scoreYesterday = 0;
      state.scoreAllTime  = 0;
      state.scoreAllTimeBase = 0;
      saveState();
      updateScoreUI();
    }
  });
}

function initVolumeControls() {
  const toggleMusic = document.getElementById("toggle-music");
  const toggleSfx   = document.getElementById("toggle-sfx");

  // Music is "on" when NOT muted
  toggleMusic.checked = !state.mutedMusic;
  document.getElementById("music-desc").textContent = state.mutedMusic ? "Off" : "On";
  toggleSfx.checked = !state.mutedSfx;
  document.getElementById("sfx-desc").textContent = state.mutedSfx ? "Off" : "On";

  toggleMusic.addEventListener("change", () => {
    state.mutedMusic = !toggleMusic.checked;
    document.getElementById("music-desc").textContent = state.mutedMusic ? "Off" : "On";
    applyMusicVolume();
    saveState();
  });
  toggleSfx.addEventListener("change", () => {
    state.mutedSfx = !toggleSfx.checked;
    document.getElementById("sfx-desc").textContent = state.mutedSfx ? "Off" : "On";
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
    div.className  = "bingo-cell" + (cell.count > 0 ? ` completed completed-${cell.count}` : "");
    div.dataset.index = i;

    const span = document.createElement("span");
    span.className   = "cell-text" + (cell.text ? "" : " placeholder");
    span.textContent = cell.text || "Click to add...";
    div.appendChild(span);

    if (cell.count > 0) {
      const pip = document.createElement("span");
      pip.className   = "cell-count-pip";
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
    for (let n = 1; n <= c.count; n++) pts += pointsForCell(n) - pointsForCell(n - 1);
  });
  pts += state.awardedLines.length * 20;
  if (state.blackoutAwarded) pts += 100;
  state.scoreCurrent = pts;
  state.scoreAllTime = Math.max(state.scoreAllTimeBase || 0, state.scoreCurrent);
  updateScoreUI();
}

function toggleCell(index) {
  const cell      = state.cells[index];
  const prevCount = cell.count;
  if (prevCount >= 5) return;

  cell.count = prevCount + 1;
  const pts  = pointsForCell(cell.count) - pointsForCell(prevCount);
  addScore(pts);

  const multiplierLabels = ["", "", "×1.2", "×1.5", "×1.8", "×2.0"];
  showScorePopup(cell.count >= 2 ? `+${pts} pts ${multiplierLabels[cell.count]}` : `+${pts} pts`);

  checkAndAwardLines();
  saveState();
  renderBingoGrid();
  checkBingo();
}

function checkBingo() {
  const c    = state.cells;
  const done = (i) => c[i].count >= 1;
  for (const line of BINGO_LINES) {
    const key = lineKey(line);
    if (state.celebratedLines.includes(key)) continue;
    if (line.every(done)) {
      state.celebratedLines.push(key);
      showBingoModal();
      return;
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
    const row   = document.createElement("div");
    row.className = "customize-row";
    const num   = document.createElement("span");
    num.className   = "row-num";
    num.textContent = i + 1;
    const input = document.createElement("input");
    input.type        = "text";
    input.maxLength   = 50;
    input.placeholder = `Break idea ${i + 1}…`;
    input.value       = cell.text;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const inputs = list.querySelectorAll("input");
        const next   = inputs[i + 1];
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
  const texts  = Array.from(inputs).map((inp) => inp.value.trim());
  const filled = texts.map((t, i) => t || DEFAULT_CELLS[i] || "");
  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filled[i], filled[j]] = [filled[j], filled[i]];
  }
  state.cells             = filled.map((text) => ({ text, count: 0 }));
  state.bingoAcknowledged = false;
  saveState();
  renderBingoGrid();
  closeCustomizeModal();
}

function loadDefaultsIntoModal() {
  const inputs = document.querySelectorAll("#customize-list input");
  DEFAULT_CELLS.forEach((text, i) => { if (inputs[i]) inputs[i].value = text; });
}

// =================================================================
// CARD DECK ENGINE
// =================================================================
const CARD_COUNT = 4;
const MAX_VISIBLE_DEPTH = 3; // peek capped regardless of total card count

// Read CSS custom properties for peek offsets
function getPeek(prop) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(prop)) || 11;
}

const cards   = () => Array.from(document.querySelectorAll(".card"));
const navBtns = () => Array.from(document.querySelectorAll(".bnav"));

let deckOrder  = [0, 1, 2, 3];
let activeCard = 0;

function transformForDepth(depth) {
  if (depth === 0) return "translate(0px, 0px)";
  const px = getPeek("--peek-x");
  const py = getPeek("--peek-y");
  const capped = Math.min(depth, MAX_VISIBLE_DEPTH);
  return `translate(${px * capped}px, ${py * capped}px)`;
}

function layoutDeck(animate = true) {
  const allCards = cards();
  allCards.forEach((card, cardIdx) => {
    const depth = deckOrder.indexOf(cardIdx);

    if (animate) card.classList.add("animating");
    else         card.classList.remove("animating");

    card.classList.remove("depth-0","depth-1","depth-2","depth-3");
    card.classList.add(`depth-${Math.min(depth, MAX_VISIBLE_DEPTH)}`);
    card.style.transform = transformForDepth(depth);
    card.style.zIndex    = CARD_COUNT - depth;
  });

  if (animate) {
    clearTimeout(layoutDeck._t);
    layoutDeck._t = setTimeout(() => cards().forEach(c => c.classList.remove("animating")), 460);
  }
}

function goTo(targetIdx, direction) {
  if (targetIdx === activeCard) return;
  if (direction === undefined) direction = targetIdx > activeCard ? 1 : -1;

  // Unflip the card we're leaving (no animation, instant reset)
  const leavingCard = document.querySelector(`.card[data-card="${activeCard}"]`);
  if (leavingCard && flippedCards.has(activeCard)) {
    flippedCards.delete(activeCard);
    leavingCard.classList.remove("flipped", "flipping");
  }

  let steps = 0;
  while (deckOrder[0] !== targetIdx && steps < CARD_COUNT) {
    if (direction > 0) { deckOrder.push(deckOrder.shift()); }
    else               { deckOrder.unshift(deckOrder.pop()); }
    steps++;
  }

  activeCard = targetIdx;
  layoutDeck(true);
  syncBottomNav();
}

function syncBottomNav() {
  navBtns().forEach((b, i) => b.classList.toggle("active", i === activeCard));
}

// Bottom nav
function initBottomNav() {
  navBtns().forEach((btn, i) => {
    btn.addEventListener("click", () => goTo(i));
  });
}

// Keyboard
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo((activeCard + 1) % CARD_COUNT,  1);
    if (e.key === "ArrowLeft")  goTo((activeCard - 1 + CARD_COUNT) % CARD_COUNT, -1);
  });
}

// Click non-top card to navigate to it
function initCardClicks() {
  cards().forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (!card.classList.contains("depth-0")) {
        goTo(i);
        e.stopPropagation();
      }
    });
  });
}

// =================================================================
// CARD FLIP ENGINE
// =================================================================
const flippedCards = new Set();

function flipCard(cardIdx) {
  const card = document.querySelector(`.card[data-card="${cardIdx}"]`);
  if (!card) return;

  // Force animation re-trigger by removing class, forcing reflow, then re-adding
  card.classList.remove("flipping");
  void card.offsetWidth; // reflow
  card.classList.add("flipping");
  setTimeout(() => card.classList.remove("flipping"), 580);

  if (flippedCards.has(cardIdx)) {
    flippedCards.delete(cardIdx);
    card.classList.remove("flipped");
  } else {
    flippedCards.add(cardIdx);
    card.classList.add("flipped");
  }
}

function initFlipCorners() {
  document.querySelectorAll(".flip-corner").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardIdx = parseInt(btn.dataset.card);
      flipCard(cardIdx);
    });
  });
}

// ── Drag / swipe ──
let drag = null;

function onPointerDown(e) {
  const card = e.currentTarget;
  if (!card.classList.contains("depth-0")) return;
  // Don't start drag if clicking the flip corner area
  if (e.target.closest(".flip-corner")) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  drag = { startX: clientX, startY: clientY, currentX: 0, velocityX: 0, lastX: clientX, lastT: Date.now(), moved: false };
  card.classList.remove("animating");
}

function onPointerMove(e) {
  if (!drag) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - drag.startX;
  const dy = clientY - drag.startY;

  // If vertical movement dominates first, hand back to scroll
  if (!drag.moved && Math.abs(dy) > Math.abs(dx) + 6) { drag = null; return; }
  if (Math.abs(dx) > 4) drag.moved = true;
  if (!drag.moved) return;

  e.preventDefault();

  const now  = Date.now();
  const dt   = now - drag.lastT || 1;
  drag.velocityX = (clientX - drag.lastX) / dt;
  drag.lastX     = clientX;
  drag.lastT     = now;
  drag.currentX  = dx;

  // Move top card with drag
  const topCard = cards()[deckOrder[0]];
  topCard.style.transform = `translate(${dx}px, 0px) rotate(${dx * 0.012}deg)`;
}

function onPointerUp() {
  if (!drag) return;

  const topCard = cards()[deckOrder[0]];
  const dx  = drag.currentX;
  const vel = drag.velocityX;

  const THRESH_PX  = 80;
  const THRESH_VEL = 0.4;

  const didDrag = Math.abs(dx) > THRESH_PX || Math.abs(vel) > THRESH_VEL;

  topCard.classList.add("animating");

  if (didDrag) {
    // Exit in whichever direction the user dragged, but always advance forward
    const exitX = dx >= 0 ? "110vw" : "-110vw";
    const exitRot = dx >= 0 ? "8deg" : "-8deg";
    topCard.style.transform = `translate(${exitX}, 0px) rotate(${exitRot})`;
    setTimeout(() => {
      topCard.style.transform = "";
      goTo((activeCard + 1) % CARD_COUNT, 1);
    }, 180);
  } else {
    topCard.style.transform = transformForDepth(0);
  }

  drag = null;
}

function initDrag() {
  cards().forEach(card => {
    card.addEventListener("mousedown",  onPointerDown);
    card.addEventListener("touchstart", onPointerDown, { passive: true });
  });
  document.addEventListener("mousemove",  onPointerMove);
  document.addEventListener("mouseup",    onPointerUp);
  document.addEventListener("touchmove",  onPointerMove, { passive: false });
  document.addEventListener("touchend",   onPointerUp);
}

// =================================================================
// INIT
// =================================================================
async function init() {
  await loadMusicManifest();
  loadState();

  // Prime AudioContext on the very first user gesture anywhere on the page
  // so it's in "running" state before the first button click needs it
  const primeOnce = () => { primeAudioCtx(); document.removeEventListener("pointerdown", primeOnce); };
  document.addEventListener("pointerdown", primeOnce);

  // Timer buttons
  document.getElementById("btn-start").addEventListener("click", startTimer);
  document.getElementById("btn-pause").addEventListener("click", pauseTimer);
  document.getElementById("btn-reset").addEventListener("click", () => resetTimer(true));

  // Settings
  initSettings();

  // Customize modal
  document.getElementById("btn-open-customize").addEventListener("click", openCustomizeModal);
  document.getElementById("btn-customize-cancel").addEventListener("click", closeCustomizeModal);
  document.getElementById("btn-customize-save").addEventListener("click", saveCustomize);
  document.getElementById("btn-customize-defaults").addEventListener("click", loadDefaultsIntoModal);
  document.getElementById("customize-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("customize-modal")) closeCustomizeModal();
  });

  // Bingo modal
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("bingo-modal").classList.add("hidden");
  });

  // Phase modal
  document.getElementById("btn-close-phase-modal").addEventListener("click", () => {
    document.getElementById("phase-modal").classList.add("hidden");
  });

  // Deck engine
  layoutDeck(false);
  initBottomNav();
  initKeyboard();
  initCardClicks();
  initFlipCorners();
  initDrag();

  // Initial UI state
  updateTimerUI();
  updatePomoCount();
  updateScoreUI();
  renderBingoGrid();
}

document.addEventListener("DOMContentLoaded", init);

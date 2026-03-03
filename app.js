// ===================================================================
// BINGO BREAK — app.js  (v2)
// 5-card deck: Work | Break | Now Playing | Achievements | Settings
// ===================================================================

// ===== DEFAULTS =====
const DEFAULT_BREAK_CELLS = [
  "20 pushups", "Make your bed", "5 min walk", "Drink water",
  "Stretch arms", "10 jumping jacks", "Tidy desk", "Deep breaths",
  "Text a friend", "Do the dishes", "10 squats", "Wipe counters",
  "Read a page", "Journal 1 min", "Cold water face", "Dance break",
];

const DEFAULT_WORK_CELLS = [
  "Clear inbox",    "Write outline",  "Review notes",
  "Plan next task", "Deep work block","Send follow-up",
  "Read article",   "Tidy desktop",   "Log progress",
];

const GENRES = ["lofi", "guitar", "classical", "ambient", "piano"];

const GENRE_META = {
  lofi:      { label: "Lo-Fi",     desc: "Mellow beats for sustained focus",        color: "#7c5cbf", bg: "#f0ebff" },
  guitar:    { label: "Guitar",    desc: "Warm acoustic tones to keep you grounded", color: "#c0622b", bg: "#fff3eb" },
  classical: { label: "Classical", desc: "Timeless compositions for deep thinking",  color: "#2b6cc0", bg: "#ebf3ff" },
  ambient:   { label: "Ambient",   desc: "Atmospheric soundscapes for flow state",   color: "#2b9c6e", bg: "#ebfff6" },
  piano:     { label: "Piano",     desc: "Solo piano for calm, steady work",         color: "#9c2b7c", bg: "#ffebf9" },
};

// ===== STATE =====
let state = {
  mode:   "25/5",
  phase:  "work",
  timeLeft: 25 * 60,
  running:  false,
  pomoCount: 0,

  breakCells: [],
  workCells:  [],

  bingoAcknowledged: false,
  workBingoAcknowledged: false,

  volMusic: 60,
  volSfx:   80,
  mutedMusic: false,
  mutedSfx:   false,
  autoStart:  false,
  notificationsEnabled: false,
  darkMode:   false,
  soundTheme: "chime",

  activeGenre: "lofi",

  scoreCurrentDate: "",
  scoreWorkToday:   0,
  scoreBreakToday:  0,
  scoreWorkYesterday:  0,
  scoreBreakYesterday: 0,
  scoreWorkAllTime:  0,
  scoreBreakAllTime: 0,
  scoreWorkAllTimeBase:  0,
  scoreBreakAllTimeBase: 0,

  awardedBreakLines: [],
  celebratedBreakLines: [],
  blackoutBreakAwarded: false,

  awardedWorkLines: [],
  celebratedWorkLines: [],
  blackoutWorkAwarded: false,
};

let timerInterval = null;

// ===== LOCAL STORAGE =====
function saveState() {
  localStorage.setItem("bingoBreakState2", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("bingoBreakState2");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed, running: false };
      if (state.timeLeft <= 0) resetTimer(false);
    } catch (e) {
      console.warn("Could not parse saved state", e);
    }
  }

  // Break cells (4×4 = 16)
  if (!Array.isArray(state.breakCells) || state.breakCells.length !== 16) {
    state.breakCells = DEFAULT_BREAK_CELLS.map(text => ({ text, count: 0 }));
  }
  state.breakCells = state.breakCells.map(c =>
    typeof c.count !== "number" ? { text: c.text, count: c.completed ? 1 : 0 } : c
  );

  // Work cells (3×3 = 9)
  if (!Array.isArray(state.workCells) || state.workCells.length !== 9) {
    state.workCells = DEFAULT_WORK_CELLS.map(text => ({ text, count: 0 }));
  }
  state.workCells = state.workCells.map(c =>
    typeof c.count !== "number" ? { text: c.text, count: c.completed ? 1 : 0 } : c
  );

  if (!Array.isArray(state.awardedBreakLines))    state.awardedBreakLines    = [];
  if (!Array.isArray(state.celebratedBreakLines)) state.celebratedBreakLines = [];
  if (!Array.isArray(state.awardedWorkLines))     state.awardedWorkLines     = [];
  if (!Array.isArray(state.celebratedWorkLines))  state.celebratedWorkLines  = [];

  // Daily score rollover
  const todayStr = localDateString();
  if (state.scoreCurrentDate !== todayStr) {
    const yesterdayStr = localDateString(-1);
    if (state.scoreCurrentDate === yesterdayStr) {
      state.scoreWorkYesterday  = state.scoreWorkToday;
      state.scoreBreakYesterday = state.scoreBreakToday;
    }
    state.scoreWorkAllTimeBase  = Math.max(state.scoreWorkAllTimeBase  || 0, state.scoreWorkToday);
    state.scoreBreakAllTimeBase = Math.max(state.scoreBreakAllTimeBase || 0, state.scoreBreakToday);
    state.scoreWorkAllTime  = state.scoreWorkAllTimeBase;
    state.scoreBreakAllTime = state.scoreBreakAllTimeBase;
    state.scoreWorkToday  = 0;
    state.scoreBreakToday = 0;
    state.scoreCurrentDate = todayStr;

    state.awardedBreakLines    = [];
    state.celebratedBreakLines = [];
    state.blackoutBreakAwarded = false;
    state.breakCells = state.breakCells.map(c => ({ ...c, count: 0 }));

    state.awardedWorkLines    = [];
    state.celebratedWorkLines = [];
    state.blackoutWorkAwarded = false;
    state.workCells = state.workCells.map(c => ({ ...c, count: 0 }));

    state.bingoAcknowledged     = false;
    state.workBingoAcknowledged = false;
  }
}

// ===== HELPERS =====
function localDateString(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ===== SCORING =====
// Break: 5 pts base. Work: 25 pts base (5×). Same multipliers.
const COUNT_MULTIPLIERS = [0, 1.0, 1.2, 1.5, 1.8, 2.0];

function basePointsForCell(count, isWork) {
  if (count < 1 || count > 5) return 0;
  return Math.round((isWork ? 25 : 5) * COUNT_MULTIPLIERS[count]);
}

function addScore(pts, isWork) {
  if (isWork) {
    state.scoreWorkToday  += pts;
    state.scoreWorkAllTime = Math.max(state.scoreWorkAllTimeBase || 0, state.scoreWorkToday);
  } else {
    state.scoreBreakToday  += pts;
    state.scoreBreakAllTime = Math.max(state.scoreBreakAllTimeBase || 0, state.scoreBreakToday);
  }
  saveState();
  updateScoreUI();
}

function totalToday()     { return state.scoreWorkToday  + state.scoreBreakToday; }
function totalYesterday() { return state.scoreWorkYesterday + state.scoreBreakYesterday; }
function totalAllTime()   { return state.scoreWorkAllTime   + state.scoreBreakAllTime; }

function updateScoreUI() {
  // Minimal inline score on Work card
  const workInline  = document.getElementById("work-score-inline");
  const breakInline = document.getElementById("break-score-inline");
  if (workInline)  workInline.textContent  = state.scoreWorkToday;
  if (breakInline) breakInline.textContent = state.scoreBreakToday;

  // Full breakdown on Points card (card 3)
  const ids = {
    "pts-work-today":      state.scoreWorkToday,
    "pts-break-today":     state.scoreBreakToday,
    "pts-total-today":     totalToday(),
    "pts-total-yesterday": totalYesterday(),
    "pts-total-alltime":   totalAllTime(),
    "pts-work-alltime":    state.scoreWorkAllTime,
    "pts-break-alltime":   state.scoreBreakAllTime,
  };
  for (const [id, val] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
}

// ===== BINGO LINES =====
const BREAK_LINES = [
  [0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],
  [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],
  [0,5,10,15],[3,6,9,12],
];
const WORK_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function lineKey(line) { return line.join(","); }

function checkAndAwardLines(isWork) {
  const lines       = isWork ? WORK_LINES       : BREAK_LINES;
  const awardedKey  = isWork ? "awardedWorkLines"  : "awardedBreakLines";
  const cells       = isWork ? state.workCells    : state.breakCells;
  const bonusPts    = isWork ? 100 : 20;
  let newLines = 0;

  for (const line of lines) {
    const key = lineKey(line);
    if (state[awardedKey].includes(key)) continue;
    if (line.every(i => cells[i].count >= 1)) {
      state[awardedKey].push(key);
      newLines++;
    }
  }
  if (newLines > 0) {
    const bonus = newLines * bonusPts;
    addScore(bonus, isWork);
    showScorePopup(`+${bonus} Line Bonus! 🎯`);
  }

  const blackoutKey = isWork ? "blackoutWorkAwarded" : "blackoutBreakAwarded";
  if (!state[blackoutKey] && cells.every(c => c.count >= 1)) {
    state[blackoutKey] = true;
    const bbonus = isWork ? 500 : 100;
    addScore(bbonus, isWork);
    showScorePopup(`+${bbonus} BLACKOUT! 🔥`);
  }
}

let popupTimeout = null;
function showScorePopup(msg) {
  const popup = document.getElementById("score-popup-global");
  if (!popup) return;
  popup.textContent = msg;
  popup.classList.add("visible");
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => popup.classList.remove("visible"), 2200);
}

// ===== SOUND ENGINE =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }
function primeAudioCtx() { const ctx = getAudioCtx(); if (ctx.state === "suspended") ctx.resume(); }
async function ensureAudioCtxRunning() { const ctx = getAudioCtx(); if (ctx.state === "suspended") await ctx.resume(); return ctx; }
function sfxVolume() { return state.mutedSfx ? 0 : (state.volSfx / 100 || 0.8); }
function theme()     { return state.soundTheme || "chime"; }

function makeOsc(ctx, type, freq, startT, stopT, vol, freqEnd) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startT);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, stopT);
  gain.gain.setValueAtTime(vol, startT);
  gain.gain.exponentialRampToValueAtTime(0.001, stopT);
  osc.start(startT); osc.stop(stopT + 0.01);
}

function chimeStart(ctx,vol,t){ makeOsc(ctx,"sine",880,t,t+.12,vol*.4,440); }
function chimePause(ctx,vol,t){ makeOsc(ctx,"sine",660,t,t+.18,vol*.35,440); makeOsc(ctx,"sine",440,t+.14,t+.32,vol*.25,330); }
function chimeDone(ctx,vol,t) { [0,.35,.7].forEach(o=>{ makeOsc(ctx,"sine",1318,t+o,t+o+.5,vol*.6); makeOsc(ctx,"sine",1975,t+o,t+o+.4,vol*.3); }); }
function bellStart(ctx,vol,t) { makeOsc(ctx,"triangle",740,t,t+.55,vol*.5,600); }
function bellPause(ctx,vol,t) { makeOsc(ctx,"triangle",600,t,t+.5,vol*.4,500); makeOsc(ctx,"triangle",500,t+.28,t+.75,vol*.25,420); }
function bellDone(ctx,vol,t)  { makeOsc(ctx,"triangle",523,t,t+.8,vol*.5,440); makeOsc(ctx,"triangle",659,t+.35,t+1.1,vol*.5,587); makeOsc(ctx,"triangle",784,t+.7,t+1.45,vol*.5,698); }

async function playStartClick() { const ctx=await ensureAudioCtxRunning(),vol=sfxVolume(),t=ctx.currentTime; theme()==="bell"?bellStart(ctx,vol,t):chimeStart(ctx,vol,t); }
async function playPause()      { const ctx=await ensureAudioCtxRunning(),vol=sfxVolume(),t=ctx.currentTime; theme()==="bell"?bellPause(ctx,vol,t):chimePause(ctx,vol,t); }
async function playTimerDone()  { const ctx=await ensureAudioCtxRunning(),vol=sfxVolume(),t=ctx.currentTime; theme()==="bell"?bellDone(ctx,vol,t):chimeDone(ctx,vol,t); }

// ===== MUSIC ENGINE =====
let genreTracks = {};  // { lofi: [...], guitar: [...], ... }
let shuffleQueue = [];
let musicAudio   = null;

async function loadAllManifests() {
  await Promise.all(GENRES.map(async genre => {
    try {
      const res = await fetch(`music/${genre}/manifest.json`);
      if (!res.ok) return;
      const tracks = await res.json();
      if (Array.isArray(tracks) && tracks.length) {
        genreTracks[genre] = tracks.map(t =>
          typeof t === "string"
            ? { file: `music/${genre}/${t}`, title: t.replace(/\.mp3$/i,""), artist:"", license:"", url:"" }
            : { ...t, file: `music/${genre}/${t.file}` }
        );
      }
    } catch(e) { /* genre folder missing — silent skip */ }
  }));
}

function currentGenreTracks() {
  return genreTracks[state.activeGenre] || [];
}

function buildShuffleQueue() {
  const arr = [...currentGenreTracks()];
  for (let i = arr.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  shuffleQueue = arr;
}

function pickNextTrack() {
  if (!currentGenreTracks().length) return null;
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
  if (!npEl) return;

  if (!track) {
    npEl.classList.add("now-playing-idle");
    if (npIcon) npIcon.style.animation = "none";
    if (npTrack) npTrack.textContent  = "No music playing";
    if (npArtist) npArtist.textContent = "Select a genre and start a session";
    if (npUrl) npUrl.classList.add("hidden");
    if (npLicense) npLicense.textContent = "";
    return;
  }
  npEl.classList.remove("now-playing-idle");
  if (npIcon) npIcon.style.animation = "";
  if (npTrack)   npTrack.textContent   = track.title  || "Unknown Track";
  if (npArtist)  npArtist.textContent  = track.artist || "";
  if (npUrl) {
    if (track.url) { npUrl.href = track.url; npUrl.textContent = "↗ Source"; npUrl.classList.remove("hidden"); }
    else npUrl.classList.add("hidden");
  }
  if (npLicense) npLicense.textContent = track.license || "";
}

function startMusic(fromEnded = false) {
  if (!fromEnded) { stopMusic(); buildShuffleQueue(); }
  const track = pickNextTrack();
  if (!track) return;
  const audio = new Audio(track.file);
  audio.loop   = false;
  audio.volume = 0;
  musicAudio   = audio;
  audio.onerror = () => { if (musicAudio===audio) { musicAudio=null; updateNowPlaying(null); } };
  audio.addEventListener("ended", () => {
    if (musicAudio !== audio) return;
    musicAudio = null;
    if (state.running && state.phase === "work") startMusic(true);
  });
  audio.play().catch(e => console.warn("Music playback failed:", e));
  updateNowPlaying(track);
  fadeInMusic();
}

function fadeInMusic() {
  if (!musicAudio) return;
  const audio = musicAudio;
  const target = state.mutedMusic ? 0 : state.volMusic/100;
  const steps=25, interval=500/steps; let step=0;
  const t = setInterval(() => {
    step++;
    if (musicAudio!==audio) { clearInterval(t); return; }
    audio.volume = Math.min(target, (step/steps)*target);
    if (step>=steps) clearInterval(t);
  }, interval);
}

function stopMusic() {
  if (musicAudio) { musicAudio.pause(); musicAudio.src=""; musicAudio=null; }
  updateNowPlaying(null);
}

function applyMusicVolume() {
  if (musicAudio) musicAudio.volume = state.mutedMusic ? 0 : state.volMusic/100;
}

function switchGenre(genre) {
  state.activeGenre = genre;
  saveState();
  applyGenreTheme(genre);
  updateGenreButtons();
  // Restart music if currently playing work session
  if (state.running && state.phase === "work") {
    stopMusic();
    buildShuffleQueue();
    startMusic();
  }
}

function applyGenreTheme(genre) {
  const meta = GENRE_META[genre] || GENRE_META.lofi;
  const card = document.querySelector('.card-music');
  if (!card) return;
  card.style.setProperty('--genre-color', meta.color);
  card.style.setProperty('--genre-bg',    meta.bg);
  // Also update CSS root so genre-btn active glow works globally
  document.documentElement.style.setProperty('--genre-color', meta.color);
  document.documentElement.style.setProperty('--genre-bg',    meta.bg);
  // Update stripe color
  const stripe = card.querySelector('.card-stripe-music');
  if (stripe) stripe.style.background = meta.color;
  // Update mood display
  const moodName = document.getElementById('genre-mood-name');
  const moodDesc = document.getElementById('genre-mood-desc');
  if (moodName) moodName.textContent = meta.label;
  if (moodDesc) moodDesc.textContent = meta.desc;
  // Tint now-playing icon
  const npIcon = document.getElementById('np-icon');
  if (npIcon) npIcon.style.color = meta.color;
}

function updateGenreButtons() {
  document.querySelectorAll(".genre-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.genre === state.activeGenre);
  });
}

// ===== NOTIFICATIONS =====
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(perm => {
      if (perm !== "granted") {
        state.notificationsEnabled = false;
        const el = document.getElementById("toggle-notifs");
        if (el) el.checked = false;
        saveState();
      }
    });
  }
}

function sendNotification(title, body) {
  if (!state.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body });
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
    updateTimerDisplays();
    updateProgressBars();
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
    // Auto-navigate to Break card
    goTo(1);
  } else {
    state.phase    = "work";
    state.timeLeft = workMinutes() * 60;
    sendNotification("Break's over! 💪", "Time to focus.");
    showPhaseModal("💪", "Break's over! Ready to focus?");
    // Auto-navigate to Work card
    goTo(0);
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
  const m = Math.floor(seconds/60).toString().padStart(2,"0");
  const s = (seconds % 60).toString().padStart(2,"0");
  return `${m}:${s}`;
}

function updateTimerDisplays() {
  document.querySelectorAll(".timer-display").forEach(el => {
    el.textContent = formatTime(state.timeLeft);
  });
}

function updateProgressBars() {
  const total = totalSeconds();
  const pct   = total > 0 ? (state.timeLeft / total) * 100 : 100;
  document.querySelectorAll(".timer-progress-fill").forEach(fill => {
    fill.style.width = pct + "%";
    fill.classList.toggle("break-phase", state.phase === "break");
  });
}

function updateTimerUI() {
  updateTimerDisplays();
  updateProgressBars();

  const isWork    = state.phase === "work";
  const isRunning = state.running;

  // Timer block lives only on Work card
  // Mirror timer on both Work and Break cards — dim whichever phase is inactive
  const workBlock  = document.getElementById("timer-block-work");
  const breakBlock = document.getElementById("timer-block-break");
  if (workBlock)  workBlock.classList.toggle("timer-dimmed", !isWork);
  if (breakBlock) breakBlock.classList.toggle("timer-dimmed",  isWork);

  // Phase labels
  document.querySelectorAll(".phase-label-work").forEach(el => {
    el.classList.toggle("inactive-phase", !isWork);
    el.classList.remove("break-phase");
  });
  document.querySelectorAll(".phase-label-break").forEach(el => {
    el.classList.toggle("inactive-phase", isWork);
    el.classList.toggle("break-phase", !isWork);
  });

  // Phase label on Work card
  document.querySelectorAll(".phase-label-work").forEach(el => {
    el.textContent = isWork ? "Work Session" : "Break in progress";
    el.classList.toggle("break-phase", !isWork);
  });

  // Timer digits color
  document.querySelectorAll(".timer-digits").forEach(el => {
    el.classList.toggle("break-phase", !isWork);
    el.classList.toggle("running", isRunning);
  });

  // Buttons
  const btnStarts = document.querySelectorAll(".btn-start");
  const btnPauses = document.querySelectorAll(".btn-pause");
  btnStarts.forEach(b => { b.disabled = isRunning; b.classList.toggle("break-mode", !isWork); });
  btnPauses.forEach(b => { b.disabled = !isRunning; b.classList.toggle("break-mode", !isWork); });

  // Header
  const header = document.getElementById("main-header");
  header.classList.toggle("header-work",  isWork  && isRunning);
  header.classList.toggle("header-break", !isWork && isRunning);
  if (!isRunning) header.classList.remove("header-work","header-break");
}

function updatePomoCount() {
  document.querySelectorAll(".pomo-number").forEach(el => el.textContent = state.pomoCount);
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
  const el = document.getElementById("darkmode-desc");
  if (el) el.textContent = enabled ? "On" : "Off";
}

function initSettings() {
  // Timer mode
  document.querySelectorAll("input[name='pomo-mode']").forEach(radio => {
    if (radio.value === state.mode) radio.checked = true;
    radio.addEventListener("change", e => { if (e.target.checked) applyMode(e.target.value); });
  });

  // Sound theme
  if (state.soundTheme === "beep") state.soundTheme = "chime";
  document.querySelectorAll("input[name='sound-theme']").forEach(radio => {
    if (radio.value === (state.soundTheme||"chime")) radio.checked = true;
    radio.addEventListener("change", e => {
      if (e.target.checked) {
        state.soundTheme = e.target.value;
        saveState();
        const wasMuted = state.mutedSfx;
        state.mutedSfx = false;
        playStartClick();
        state.mutedSfx = wasMuted;
      }
    });
  });

  // Volume toggles
  const toggleMusic = document.getElementById("toggle-music");
  const toggleSfx   = document.getElementById("toggle-sfx");
  if (toggleMusic) {
    toggleMusic.checked = !state.mutedMusic;
    document.getElementById("music-desc").textContent = state.mutedMusic ? "Off" : "On";
    toggleMusic.addEventListener("change", () => {
      state.mutedMusic = !toggleMusic.checked;
      document.getElementById("music-desc").textContent = state.mutedMusic ? "Off" : "On";
      applyMusicVolume();
      saveState();
    });
  }
  if (toggleSfx) {
    toggleSfx.checked = !state.mutedSfx;
    document.getElementById("sfx-desc").textContent = state.mutedSfx ? "Off" : "On";
    toggleSfx.addEventListener("change", () => {
      state.mutedSfx = !toggleSfx.checked;
      document.getElementById("sfx-desc").textContent = state.mutedSfx ? "Off" : "On";
      saveState();
    });
  }

  // Auto-start
  const toggleAutostart = document.getElementById("toggle-autostart");
  if (toggleAutostart) {
    toggleAutostart.checked = state.autoStart;
    document.getElementById("autostart-desc").textContent = state.autoStart ? "On" : "Off";
    toggleAutostart.addEventListener("change", () => {
      state.autoStart = toggleAutostart.checked;
      document.getElementById("autostart-desc").textContent = state.autoStart ? "On" : "Off";
      saveState();
    });
  }

  // Dark mode
  const toggleDark = document.getElementById("toggle-darkmode");
  if (toggleDark) {
    toggleDark.checked = state.darkMode;
    applyDarkMode(state.darkMode);
    toggleDark.addEventListener("change", () => {
      state.darkMode = toggleDark.checked;
      applyDarkMode(state.darkMode);
      saveState();
    });
  }

  // Reset break board
  const btnResetBreak = document.getElementById("btn-reset-break-board");
  if (btnResetBreak) {
    btnResetBreak.addEventListener("click", () => {
      if (confirm("Reshuffle break bingo card and clear all marks? Today's break score resets too.")) {
        state.breakCells           = shuffleCells(DEFAULT_BREAK_CELLS.map(text => ({text, count:0})));
        state.bingoAcknowledged    = false;
        state.awardedBreakLines    = [];
        state.celebratedBreakLines = [];
        state.blackoutBreakAwarded = false;
        state.scoreBreakToday      = 0;
        saveState();
        renderBreakGrid();
        updateScoreUI();
      }
    });
  }

  // Reset work board
  const btnResetWork = document.getElementById("btn-reset-work-board");
  if (btnResetWork) {
    btnResetWork.addEventListener("click", () => {
      if (confirm("Reset work task grid and clear all marks? Today's work score resets too.")) {
        state.workCells              = DEFAULT_WORK_CELLS.map(text => ({text, count:0}));
        state.workBingoAcknowledged  = false;
        state.awardedWorkLines       = [];
        state.celebratedWorkLines    = [];
        state.blackoutWorkAwarded    = false;
        state.scoreWorkToday         = 0;
        saveState();
        renderWorkGrid();
        updateScoreUI();
      }
    });
  }

  // Reset all scores
  const btnResetScores = document.getElementById("btn-reset-scores");
  if (btnResetScores) {
    btnResetScores.addEventListener("click", () => {
      if (confirm("Wipe ALL scores — today, yesterday, and all-time? This cannot be undone.")) {
        state.scoreWorkToday = state.scoreBreakToday = 0;
        state.scoreWorkYesterday = state.scoreBreakYesterday = 0;
        state.scoreWorkAllTime = state.scoreBreakAllTime = 0;
        state.scoreWorkAllTimeBase = state.scoreBreakAllTimeBase = 0;
        saveState();
        updateScoreUI();
      }
    });
  }
}

// ===== GRIDS =====
function shuffleCells(cells) {
  const arr = [...cells];
  for (let i=arr.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

function renderGrid(cells, containerId, isWork) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = "";

  cells.forEach((cell, i) => {
    const div = document.createElement("div");
    div.className = "bingo-cell" + (cell.count > 0 ? ` completed completed-${cell.count}` : "") + (isWork ? " work-cell" : "");
    div.dataset.index = i;

    const span = document.createElement("span");
    span.className   = "cell-text" + (cell.text ? "" : " placeholder");
    span.textContent = cell.text || "Click to add…";
    div.appendChild(span);

    if (cell.count > 0 && !isWork) {
      const pip = document.createElement("span");
      pip.className   = "cell-count-pip";
      pip.textContent = "★".repeat(cell.count);
      div.appendChild(pip);
    }

    div.addEventListener("click", e => { if (e.target.tagName === "INPUT") return; toggleCell(i, isWork); });
    div.addEventListener("contextmenu", e => {
      e.preventDefault();
      if (cells[i].count > 0) {
        cells[i].count--;
        recalculateScore();
        saveState();
        renderGrid(cells, containerId, isWork);
      }
    });

    grid.appendChild(div);
  });
}

function renderBreakGrid() { renderGrid(state.breakCells, "break-grid", false); }
function renderWorkGrid()  { renderGrid(state.workCells,  "work-grid",  true);  }

function recalculateScore() {
  let workPts = 0, breakPts = 0;
  state.workCells.forEach(c => {
    for (let n=1; n<=c.count; n++) workPts += basePointsForCell(n,true) - basePointsForCell(n-1,true);
  });
  state.breakCells.forEach(c => {
    for (let n=1; n<=c.count; n++) breakPts += basePointsForCell(n,false) - basePointsForCell(n-1,false);
  });
  workPts  += state.awardedWorkLines.length  * 100;
  breakPts += state.awardedBreakLines.length * 20;
  if (state.blackoutWorkAwarded)  workPts  += 500;
  if (state.blackoutBreakAwarded) breakPts += 100;
  state.scoreWorkToday  = workPts;
  state.scoreBreakToday = breakPts;
  state.scoreWorkAllTime  = Math.max(state.scoreWorkAllTimeBase  ||0, workPts);
  state.scoreBreakAllTime = Math.max(state.scoreBreakAllTimeBase ||0, breakPts);
  updateScoreUI();
}

function toggleCell(index, isWork) {
  const cells     = isWork ? state.workCells : state.breakCells;
  const cell      = cells[index];
  const prevCount = cell.count;
  const maxCount  = isWork ? 1 : 5; // work tasks: one-off only

  if (prevCount >= maxCount) return;

  cell.count = prevCount + 1;
  const pts  = basePointsForCell(cell.count, isWork) - basePointsForCell(prevCount, isWork);
  addScore(pts, isWork);

  if (isWork) {
    showScorePopup(`+${pts} pts ✓`);
  } else {
    const multiplierLabels = ["","","×1.2","×1.5","×1.8","×2.0"];
    showScorePopup(cell.count >= 2 ? `+${pts} pts ${multiplierLabels[cell.count]}` : `+${pts} pts`);
  }

  checkAndAwardLines(isWork);
  saveState();

  if (isWork) {
    renderWorkGrid();
    checkBingo(true);
  } else {
    renderBreakGrid();
    checkBingo(false);
  }
}

function checkBingo(isWork) {
  const lines      = isWork ? WORK_LINES       : BREAK_LINES;
  const cells      = isWork ? state.workCells  : state.breakCells;
  const celebKey   = isWork ? "celebratedWorkLines" : "celebratedBreakLines";

  for (const line of lines) {
    const key = lineKey(line);
    if (state[celebKey].includes(key)) continue;
    if (line.every(i => cells[i].count >= 1)) {
      state[celebKey].push(key);
      showBingoModal(isWork);
      return;
    }
  }
}

function showBingoModal(isWork) {
  const modal = document.getElementById("bingo-modal");
  const title = document.getElementById("bingo-modal-title");
  const msg   = document.getElementById("bingo-modal-msg");
  if (title) title.textContent = isWork ? "✅ Goal Complete!" : "🎉 BINGO!";
  if (msg)   msg.textContent   = isWork ? "Line cleared — great work session!" : "Keep completing your break activities!";
  if (modal) modal.classList.remove("hidden");
}

// ===== CUSTOMIZE MODALS =====
function openCustomizeModal(isWork) {
  const cells    = isWork ? state.workCells  : state.breakCells;
  const defaults = isWork ? DEFAULT_WORK_CELLS : DEFAULT_BREAK_CELLS;
  const modal    = document.getElementById("customize-modal");
  const title    = document.getElementById("customize-modal-title");
  const list     = document.getElementById("customize-list");
  const saveBtn  = document.getElementById("btn-customize-save");

  if (title) title.textContent = isWork ? "✏ Customize Work Tasks" : "✏ Customize Break Items";
  list.innerHTML = "";
  saveBtn.dataset.isWork = isWork ? "1" : "0";

  cells.forEach((cell, i) => {
    const row   = document.createElement("div");
    row.className = "customize-row";
    const num   = document.createElement("span");
    num.className   = "row-num";
    num.textContent = i + 1;
    const input = document.createElement("input");
    input.type = "text"; input.maxLength = 50;
    input.placeholder = isWork ? `Work task ${i+1}…` : `Break idea ${i+1}…`;
    input.value = cell.text;
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const inputs = list.querySelectorAll("input");
        const next = inputs[i+1];
        if (next) next.focus();
        else document.getElementById("btn-customize-save").focus();
      }
    });
    row.appendChild(num); row.appendChild(input);
    list.appendChild(row);
  });

  modal.classList.remove("hidden");
  list.querySelectorAll("input")[0].focus();
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function saveCustomize() {
  const isWork  = document.getElementById("btn-customize-save").dataset.isWork === "1";
  const defaults = isWork ? DEFAULT_WORK_CELLS : DEFAULT_BREAK_CELLS;
  const inputs  = document.querySelectorAll("#customize-list input");
  const texts   = Array.from(inputs).map(inp => inp.value.trim());
  const filled  = texts.map((t,i) => t || defaults[i] || "");

  if (isWork) {
    state.workCells = filled.map(text => ({ text, count: 0 }));
    state.awardedWorkLines    = [];
    state.celebratedWorkLines = [];
    state.blackoutWorkAwarded = false;
    renderWorkGrid();
  } else {
    // shuffle break items
    const shuffled = [...filled];
    for (let i=shuffled.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
    state.breakCells = shuffled.map(text => ({ text, count: 0 }));
    state.awardedBreakLines    = [];
    state.celebratedBreakLines = [];
    state.blackoutBreakAwarded = false;
    renderBreakGrid();
  }
  state.bingoAcknowledged = false;
  saveState();
  closeCustomizeModal();
}

function loadDefaultsIntoModal() {
  const isWork   = document.getElementById("btn-customize-save").dataset.isWork === "1";
  const defaults = isWork ? DEFAULT_WORK_CELLS : DEFAULT_BREAK_CELLS;
  const inputs   = document.querySelectorAll("#customize-list input");
  defaults.forEach((text, i) => { if (inputs[i]) inputs[i].value = text; });
}

// ===================================================================
// CARD DECK ENGINE
// ===================================================================
const CARD_COUNT = 5;
const MAX_VISIBLE_DEPTH = 3;

function getPeek(prop) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(prop)) || 11;
}

const cards   = () => Array.from(document.querySelectorAll(".card"));
const navBtns = () => Array.from(document.querySelectorAll(".bnav"));

let deckOrder  = [0,1,2,3,4];
let activeCard = 0;

function transformForDepth(depth) {
  if (depth === 0) return "translate(0px, 0px)";
  const px = getPeek("--peek-x"), py = getPeek("--peek-y");
  return `translate(${px * Math.min(depth, MAX_VISIBLE_DEPTH)}px, ${py * Math.min(depth, MAX_VISIBLE_DEPTH)}px)`;
}

function layoutDeck(animate = true) {
  cards().forEach((card, cardIdx) => {
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

  const leavingCard = document.querySelector(`.card[data-card="${activeCard}"]`);
  if (leavingCard && flippedCards.has(activeCard)) {
    flippedCards.delete(activeCard);
    leavingCard.classList.remove("flipped","flipping");
  }

  let steps = 0;
  while (deckOrder[0] !== targetIdx && steps < CARD_COUNT) {
    if (direction > 0) deckOrder.push(deckOrder.shift());
    else               deckOrder.unshift(deckOrder.pop());
    steps++;
  }
  activeCard = targetIdx;
  layoutDeck(true);
  syncBottomNav();
}

function syncBottomNav() {
  navBtns().forEach((b,i) => b.classList.toggle("active", i === activeCard));
}

function initBottomNav() {
  navBtns().forEach((btn,i) => btn.addEventListener("click", () => goTo(i)));
}

function initKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") goTo((activeCard+1) % CARD_COUNT,  1);
    if (e.key === "ArrowLeft")  goTo((activeCard-1+CARD_COUNT) % CARD_COUNT, -1);
  });
}

function initCardClicks() {
  cards().forEach((card,i) => {
    card.addEventListener("click", e => {
      if (!card.classList.contains("depth-0")) { goTo(i); e.stopPropagation(); }
    });
  });
}

// ===================================================================
// CARD FLIP ENGINE
// ===================================================================
const flippedCards = new Set();

function flipCard(cardIdx) {
  const card = document.querySelector(`.card[data-card="${cardIdx}"]`);
  if (!card) return;
  card.classList.remove("flipping");
  void card.offsetWidth;
  card.classList.add("flipping");
  setTimeout(() => card.classList.remove("flipping"), 580);
  if (flippedCards.has(cardIdx)) { flippedCards.delete(cardIdx); card.classList.remove("flipped"); }
  else                            { flippedCards.add(cardIdx);    card.classList.add("flipped"); }
}

function initFlipCorners() {
  document.querySelectorAll(".flip-corner").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      flipCard(parseInt(btn.dataset.card));
    });
  });
}

// Drag/swipe
let drag = null;

function onPointerDown(e) {
  const card = e.currentTarget;
  if (!card.classList.contains("depth-0")) return;
  if (e.target.closest(".flip-corner")) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  drag = { startX:clientX, startY:clientY, currentX:0, velocityX:0, lastX:clientX, lastT:Date.now(), moved:false };
  card.classList.remove("animating");
}

function onPointerMove(e) {
  if (!drag) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx=clientX-drag.startX, dy=clientY-drag.startY;
  if (!drag.moved && Math.abs(dy) > Math.abs(dx)+6) { drag=null; return; }
  if (Math.abs(dx) > 4) drag.moved = true;
  if (!drag.moved) return;
  e.preventDefault();
  const now=Date.now(), dt=now-drag.lastT||1;
  drag.velocityX=(clientX-drag.lastX)/dt; drag.lastX=clientX; drag.lastT=now; drag.currentX=dx;
  const topCard=cards()[deckOrder[0]];
  topCard.style.transform = `translate(${dx}px, 0px) rotate(${dx*.012}deg)`;
}

function onPointerUp() {
  if (!drag) return;
  const topCard=cards()[deckOrder[0]];
  const dx=drag.currentX, vel=drag.velocityX;
  const didDrag = Math.abs(dx)>80 || Math.abs(vel)>0.4;
  topCard.classList.add("animating");
  if (didDrag) {
    const exitX=dx>=0?"110vw":"-110vw", exitRot=dx>=0?"8deg":"-8deg";
    topCard.style.transform = `translate(${exitX}, 0px) rotate(${exitRot})`;
    setTimeout(() => {
      topCard.style.transform = "";
      goTo((activeCard+1) % CARD_COUNT, 1);
    }, 180);
  } else {
    topCard.style.transform = transformForDepth(0);
  }
  drag = null;
}

function initDrag() {
  cards().forEach(card => {
    card.addEventListener("mousedown",  onPointerDown);
    card.addEventListener("touchstart", onPointerDown, { passive:true });
  });
  document.addEventListener("mousemove",  onPointerMove);
  document.addEventListener("mouseup",    onPointerUp);
  document.addEventListener("touchmove",  onPointerMove, { passive:false });
  document.addEventListener("touchend",   onPointerUp);
}

// ===================================================================
// INIT
// ===================================================================
async function init() {
  await loadAllManifests();
  loadState();

  const primeOnce = () => { primeAudioCtx(); document.removeEventListener("pointerdown", primeOnce); };
  document.addEventListener("pointerdown", primeOnce);

  // Timer buttons (multiple instances mirrored on Work + Break cards)
  document.querySelectorAll(".btn-start").forEach(btn => btn.addEventListener("click", startTimer));
  document.querySelectorAll(".btn-pause").forEach(btn => btn.addEventListener("click", pauseTimer));
  document.querySelectorAll(".btn-reset").forEach(btn => btn.addEventListener("click", () => resetTimer(true)));

  // Settings
  initSettings();

  // Customize modals
  document.getElementById("btn-open-customize-work")?.addEventListener("click",  () => openCustomizeModal(true));
  document.getElementById("btn-open-customize-break")?.addEventListener("click", () => openCustomizeModal(false));
  document.getElementById("btn-customize-cancel")?.addEventListener("click",     closeCustomizeModal);
  document.getElementById("btn-customize-save")?.addEventListener("click",       saveCustomize);
  document.getElementById("btn-customize-defaults")?.addEventListener("click",   loadDefaultsIntoModal);
  document.getElementById("customize-modal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("customize-modal")) closeCustomizeModal();
  });

  // Bingo modal
  document.getElementById("btn-close-modal")?.addEventListener("click", () => {
    document.getElementById("bingo-modal").classList.add("hidden");
  });

  // Phase modal
  document.getElementById("btn-close-phase-modal")?.addEventListener("click", () => {
    document.getElementById("phase-modal").classList.add("hidden");
  });

  // Genre buttons
  document.querySelectorAll(".genre-btn").forEach(btn => {
    btn.addEventListener("click", () => switchGenre(btn.dataset.genre));
  });

  // Deck engine
  layoutDeck(false);
  initBottomNav();
  initKeyboard();
  initCardClicks();
  initFlipCorners();
  initDrag();

  // Apply saved genre theme
  applyGenreTheme(state.activeGenre);
  updateGenreButtons();

  // Initial renders
  updateTimerUI();
  updatePomoCount();
  updateScoreUI();
  renderBreakGrid();
  renderWorkGrid();
}

document.addEventListener("DOMContentLoaded", init);

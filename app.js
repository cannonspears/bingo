// ===================================================================
// BINGO BREAK — app.js  (v2)
// 5-card deck: Work | Break | Now Playing | Achievements | Settings
// ===================================================================

// ===== DEFAULTS =====
const DEFAULT_BREAK_TABS = {
  all: [
    "20 pushups",
    "Drink water",
    "5 min walk",
    "Tidy desk",
    "Deep breaths",
    "Journal 1 min",
    "10 squats",
    "Text a friend",
    "Stretch arms",
    "Read a page",
    "Dance break",
    "Wipe counters",
    "Cold water face",
    "Gratitude note",
    "10 jumping jacks",
    "Step outside",
  ],
  body: [
    "20 pushups",
    "5 min walk",
    "Stretch arms",
    "30 jumping jacks",
    "20 squats",
    "20 bicep curls",
    "2x 30s planks",
    "20 crunches",
    "Neck rolls",
    "20 Calf raises",
    "Wall sits",
    "20 tricep ext",
    "Leg stretches",
    "Shoulder rolls",
    "20 sec plank",
    "Arm stretches",
  ],
  mind: [
    "Journal",
    "Read from a book",
    "Do nothing",
    "Gratitude note",
    "Free draw",
    "Memorize something",
    "Write a tiny story",
    "Positive affirmation",
    "Box breathing",
    "Memory recall",
    "Reframe a situation",
    "Read poetry",
    "Brain teaser",
    "Visualise a goal",
    "Tech-free walk",
    "Word association game",
  ],
  home: [
    "Make your bed",
    "Tidy desk",
    "Do the dishes",
    "Wipe counters",
    "Clean litterbox",
    "Take out trash",
    "Water plants",
    "Sweep a room",
    "Fold laundry",
    "Wipe mirrors",
    "Quick vacuum",
    "Clear floor clutter",
    "Wipe stovetop",
    "Organise a drawer",
    "Refill water pitcher",
    "Family appreciation note",
  ],
};

// Keep legacy single array for migration
const DEFAULT_BREAK_CELLS = DEFAULT_BREAK_TABS.body;

const DEFAULT_WORK_CELLS = []; // Work list is user-defined, starts empty

const STATIONS = [
  {
    id: "lofi",
    label: "Lofi Girl",
    videoId: "jfKfPfyJRdk",
    color: "#7c5cbf",
    bg: "#f0ebff",
  },
  {
    id: "jazz",
    label: "Jazz Café",
    videoId: "HuFYqnbVbzY",
    color: "#c0622b",
    bg: "#fff3eb",
  },
  {
    id: "classical",
    label: "Classical",
    videoId: "jXAEIWcGXwE",
    color: "#2b6cc0",
    bg: "#ebf3ff",
  },
  {
    id: "ambient",
    label: "Ambient",
    videoId: "xORCbIptqcc",
    color: "#2b9c6e",
    bg: "#ebfff6",
  },
  {
    id: "chillhop",
    label: "Chillhop",
    videoId: "5yx6BWlEVcY",
    color: "#9c2b7c",
    bg: "#ffebf9",
  },
];

// ===== STATE =====
let state = {
  mode: "25/5",
  phase: "work",
  timeLeft: 25 * 60,
  running: false,
  pomoCount: 0,
  breakCount: 0,
  lastActivityAt: null,

  // Legacy single array kept for migration; tabs replace it
  breakCells: [],
  workCells: [],

  // Break tabs: body / mind / home
  breakTabs: { all: [], body: [], mind: [], home: [] },
  activeBreakTab: "all",

  // Work focus mode
  focusedTaskIndex: -1,
  showDoneTasks: false,

  bingoAcknowledged: false,
  workBingoAcknowledged: false,

  tickingEnabled: false,

  // 7-day history [{date, work, brk}] — most recent last
  scoreHistory: [],
  volSfx: 80,
  mutedMusic: false,
  mutedSfx: false,
  autoStart: false,
  autoplayWork: true,
  autoplayBreak: true,
  autoplayDefaulted: true,
  notificationsEnabled: false,
  darkMode: false,
  soundTheme: "chime",

  activeGenre: "lofi",
  musicPlaying: false,

  // Custom timer settings (in minutes)
  customWorkMinutes: null,
  customBreakMinutes: null,

  volMusic: 60,
  scoreWorkToday: 0,
  scoreBreakToday: 0,
  scoreWorkYesterday: 0,
  scoreBreakYesterday: 0,
  scoreWorkAllTime: 0,
  scoreBreakAllTime: 0,
  scoreWorkAllTimeBase: 0,
  scoreBreakAllTimeBase: 0,

  // Per-tab break line/blackout tracking
  lineCompletions: { all: {}, body: {}, mind: {}, home: {} },
  blackoutCompletions: { all: 0, body: 0, mind: 0, home: 0 },
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

  // Migrate existing users to autoplay-on defaults (one-time, if they haven't explicitly changed it)
  if (!state.autoplayDefaulted) {
    state.autoplayWork = true;
    state.autoplayBreak = true;
    state.autoplayDefaulted = true;
  }

  // Work cells — user-defined task list, no defaults
  if (!Array.isArray(state.workCells)) {
    state.workCells = [];
  }
  state.workCells = state.workCells.map((c) =>
    typeof c.count !== "number"
      ? { text: c.text, count: c.completed ? 1 : 0 }
      : c,
  );

  // Break tabs — migrate from legacy single breakCells if needed
  const TABS = ["all", "body", "mind", "home"];
  if (!state.breakTabs || typeof state.breakTabs !== "object") {
    state.breakTabs = {};
  }
  TABS.forEach((tab) => {
    if (
      !Array.isArray(state.breakTabs[tab]) ||
      state.breakTabs[tab].length !== 16
    ) {
      state.breakTabs[tab] = DEFAULT_BREAK_TABS[tab].map((text) => ({
        text,
        count: 0,
      }));
    }
    state.breakTabs[tab] = state.breakTabs[tab].map((c) =>
      typeof c.count !== "number"
        ? { text: c.text, count: c.completed ? 1 : 0 }
        : c,
    );
  });

  // Per-tab line tracking
  if (
    !state.lineCompletions ||
    typeof state.lineCompletions !== "object" ||
    Array.isArray(state.lineCompletions)
  ) {
    state.lineCompletions = { all: {}, body: {}, mind: {}, home: {} };
  }
  if (
    !state.blackoutCompletions ||
    typeof state.blackoutCompletions !== "object" ||
    Array.isArray(state.blackoutCompletions)
  ) {
    state.blackoutCompletions = { all: 0, body: 0, mind: 0, home: 0 };
  }
  TABS.forEach((tab) => {
    if (
      typeof state.lineCompletions[tab] !== "object" ||
      Array.isArray(state.lineCompletions[tab])
    )
      state.lineCompletions[tab] = {};
    if (typeof state.blackoutCompletions[tab] !== "number")
      state.blackoutCompletions[tab] = 0;
  });

  if (!Array.isArray(state.scoreHistory)) state.scoreHistory = [];
  if (typeof state.tickingEnabled !== "boolean") state.tickingEnabled = false;
  if (typeof state.focusedTaskIndex !== "number") state.focusedTaskIndex = -1;
  if (typeof state.showDoneTasks !== "boolean") state.showDoneTasks = false;
  if (!["all", ...TABS].includes(state.activeBreakTab))
    state.activeBreakTab = "all";

  // Daily score rollover
  const todayStr = localDateString();
  if (state.scoreCurrentDate !== todayStr) {
    const yesterdayStr = localDateString(-1);
    if (state.scoreCurrentDate === yesterdayStr) {
      state.scoreWorkYesterday = state.scoreWorkToday;
      state.scoreBreakYesterday = state.scoreBreakToday;
    }
    state.scoreWorkAllTimeBase = Math.max(
      state.scoreWorkAllTimeBase || 0,
      state.scoreWorkToday,
    );
    state.scoreBreakAllTimeBase = Math.max(
      state.scoreBreakAllTimeBase || 0,
      state.scoreBreakToday,
    );
    state.scoreWorkAllTime = state.scoreWorkAllTimeBase;
    state.scoreBreakAllTime = state.scoreBreakAllTimeBase;

    // Archive before resetting so we store the actual earned values
    const archivedDate = state.scoreCurrentDate;
    const archivedWork = state.scoreWorkToday;
    const archivedBrk = state.scoreBreakToday;

    state.scoreWorkToday = 0;
    state.scoreBreakToday = 0;
    state.scoreCurrentDate = todayStr;

    if (archivedDate) {
      state.scoreHistory.push({
        date: archivedDate,
        work: archivedWork,
        brk: archivedBrk,
      });
      // Keep only last 7 days
      if (state.scoreHistory.length > 7)
        state.scoreHistory = state.scoreHistory.slice(-7);
    }

    // Reset all break tabs
    TABS.forEach((tab) => {
      state.lineCompletions[tab] = {};
      state.blackoutCompletions[tab] = 0;
      state.breakTabs[tab] = state.breakTabs[tab].map((c) => ({
        ...c,
        count: 0,
      }));
    });

    // Reset work task completions (keep the task list itself)
    state.workCells = state.workCells.map((c) => ({ ...c, count: 0 }));

    state.bingoAcknowledged = false;
    state.workBingoAcknowledged = false;

    // Reset session counters only if inactive for 4+ hours (so working past midnight doesn't interrupt a session)
    const hoursInactive = state.lastActivityAt
      ? (Date.now() - state.lastActivityAt) / 3_600_000
      : Infinity;
    if (hoursInactive >= 4) {
      state.pomoCount = 0;
      state.breakCount = 0;
    }

    state.focusedTaskIndex = -1;
  }
}

// ===== HELPERS =====
function localDateString(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ===== SCORING =====
// Work: 10 pts flat per task (one completion only).
// Break: +1 pt per star (1,2,3,4,5 cumulative).
function basePointsForCell(count, isWork) {
  if (count < 1 || count > 5) return 0;
  if (isWork) return 10;
  return count;
}

function addScore(pts, isWork) {
  if (isWork) {
    state.scoreWorkToday += pts;
    state.scoreWorkAllTime = Math.max(
      state.scoreWorkAllTimeBase || 0,
      state.scoreWorkToday,
    );
  } else {
    state.scoreBreakToday += pts;
    state.scoreBreakAllTime = Math.max(
      state.scoreBreakAllTimeBase || 0,
      state.scoreBreakToday,
    );
  }
  saveState();
  updateScoreUI();
}

function totalToday() {
  return state.scoreWorkToday + state.scoreBreakToday;
}
function totalYesterday() {
  return state.scoreWorkYesterday + state.scoreBreakYesterday;
}
function totalAllTime() {
  return state.scoreWorkAllTime + state.scoreBreakAllTime;
}

function updateScoreUI() {
  // Minimal inline score on Work card
  const workInline = document.getElementById("work-score-inline");
  const breakInline = document.getElementById("break-score-inline");
  if (workInline) workInline.textContent = state.scoreWorkToday;
  if (breakInline) breakInline.textContent = state.scoreBreakToday;

  // Full breakdown on Points card (card 3)
  const ids = {
    "pts-work-today": state.scoreWorkToday,
    "pts-break-today": state.scoreBreakToday,
    "pts-total-today": totalToday(),
    "pts-total-yesterday": totalYesterday(),
    "pts-total-alltime": totalAllTime(),
    "pts-work-alltime": state.scoreWorkAllTime,
    "pts-break-alltime": state.scoreBreakAllTime,
  };
  for (const [id, val] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  renderHistoryChart();
}

// ===== BINGO LINES =====
const BREAK_LINES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  [0, 5, 10, 15],
  [3, 6, 9, 12],
];
function lineKey(line) {
  return line.join(",");
}

function checkAndAwardBreakLines(tabKey) {
  const tab = tabKey || state.activeBreakTab;
  const cells = state.breakTabs[tab];
  const lineCompletions = state.lineCompletions[tab];

  let completedLines = [];

  // Check each line
  for (const line of BREAK_LINES) {
    const key = lineKey(line);

    // Line is complete if ALL cells in line have count >= 1
    const isComplete = line.every((i) => cells[i].count >= 1);

    if (isComplete) {
      // Get the minimum star count in this line
      const minStarInLine = Math.min(...line.map((i) => cells[i].count));

      // Check if this is a NEW completion at this star level
      // If minStarInLine stars is new (we haven't tracked it yet), award it
      const prevCompletion = lineCompletions[key] || 0;

      if (minStarInLine > prevCompletion) {
        // This is a new completion! Update the tracking
        lineCompletions[key] = minStarInLine;
        completedLines.push({
          line: line,
          lineKey: key,
          completionNum: minStarInLine,
        });
      }
    }
  }

  // Award points for new line completions
  if (completedLines.length > 0) {
    for (const completed of completedLines) {
      const points = completed.completionNum * 10; // 10, 20, 30, 40, 50
      addScore(points, false);
      showScorePopup(`+${points} Line! 🎯`);
      showLineAnimation(completed.line, completed.completionNum);
    }
  }

  // Check blackout - same logic
  const allComplete = cells.every((c) => c.count >= 1);
  if (allComplete) {
    const minStarOverall = Math.min(...cells.map((c) => c.count));
    const prevBlackouts = state.blackoutCompletions[tab] || 0;

    if (minStarOverall > prevBlackouts) {
      // New blackout completion!
      state.blackoutCompletions[tab] = minStarOverall;
      const points = minStarOverall * 100; // 100, 200, 300, 400, 500
      addScore(points, false);
      showScorePopup(`+${points} BLACKOUT! 🔥`);
      showBlackoutAnimation();

      // Also glow all the lines that make up this blackout
      for (const line of BREAK_LINES) {
        showLineAnimation(line, minStarOverall, true); // true = blackout glow
      }
    }
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
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
function primeAudioCtx() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();
}
async function ensureAudioCtxRunning() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}
function sfxVolume() {
  return state.mutedSfx ? 0 : state.volSfx / 100 || 0.8;
}
function theme() {
  return state.soundTheme || "chime";
}

function makeOsc(ctx, type, freq, startT, stopT, vol, freqEnd) {
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
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

function chimeStart(ctx, vol, t) {
  makeOsc(ctx, "sine", 880, t, t + 0.12, vol * 0.4, 440);
}
function chimePause(ctx, vol, t) {
  makeOsc(ctx, "sine", 660, t, t + 0.18, vol * 0.35, 440);
  makeOsc(ctx, "sine", 440, t + 0.14, t + 0.32, vol * 0.25, 330);
}
function chimeDone(ctx, vol, t) {
  [0, 0.35, 0.7].forEach((o) => {
    makeOsc(ctx, "sine", 1318, t + o, t + o + 0.5, vol * 0.6);
    makeOsc(ctx, "sine", 1975, t + o, t + o + 0.4, vol * 0.3);
  });
}
function bellStart(ctx, vol, t) {
  makeOsc(ctx, "triangle", 740, t, t + 0.55, vol * 0.5, 600);
}
function bellPause(ctx, vol, t) {
  makeOsc(ctx, "triangle", 600, t, t + 0.5, vol * 0.4, 500);
  makeOsc(ctx, "triangle", 500, t + 0.28, t + 0.75, vol * 0.25, 420);
}
function bellDone(ctx, vol, t) {
  makeOsc(ctx, "triangle", 523, t, t + 0.8, vol * 0.5, 440);
  makeOsc(ctx, "triangle", 659, t + 0.35, t + 1.1, vol * 0.5, 587);
  makeOsc(ctx, "triangle", 784, t + 0.7, t + 1.45, vol * 0.5, 698);
}

async function playStartClick() {
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume(),
    t = ctx.currentTime;
  theme() === "bell" ? bellStart(ctx, vol, t) : chimeStart(ctx, vol, t);
}
async function playPause() {
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume(),
    t = ctx.currentTime;
  theme() === "bell" ? bellPause(ctx, vol, t) : chimePause(ctx, vol, t);
}
async function playTimerDone() {
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume(),
    t = ctx.currentTime;
  theme() === "bell" ? bellDone(ctx, vol, t) : chimeDone(ctx, vol, t);
}

async function playTick() {
  if (state.mutedSfx || !state.tickingEnabled) return;
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume() * 0.25,
    t = ctx.currentTime;
  makeOsc(ctx, "square", 1200, t, t + 0.03, vol, 900);
}

// ===== MUSIC ENGINE =====
let ytPlayer = null;
let ytPlayerReady = false;

function currentStation() {
  return STATIONS.find((s) => s.id === state.activeGenre) || STATIONS[0];
}

// Called automatically by YouTube IFrame API once script loads
function onYouTubeIframeAPIReady() {
  const station = currentStation();
  ytPlayer = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    videoId: station.videoId,
    playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady() {
  ytPlayerReady = true;
  ytPlayer.setVolume(state.volMusic ?? 60);
  updateNowPlaying();
  // Fire deferred autoplay if the timer started before the player was ready
  if (state.running && !state.musicPlaying) {
    if (state.phase === "work" && state.autoplayWork) startMusic();
    else if (state.phase === "break" && state.autoplayBreak) startMusic();
  }
}

function onPlayerStateChange(event) {
  const playing = event.data === YT.PlayerState.PLAYING;
  const paused = event.data === YT.PlayerState.PAUSED;
  if (playing) {
    // Unmute as soon as playback starts — the mute in startMusic() was only
    // needed to satisfy the browser's autoplay policy for the first play.
    ytPlayer.unMute();
    ytPlayer.setVolume(state.volMusic ?? 60);
    state.musicPlaying = true;
    updatePlayPauseButtons();
  } else if (paused) {
    state.musicPlaying = false;
    updatePlayPauseButtons();
  }
}

function updateNowPlaying() {
  const npEl = document.getElementById("now-playing");
  const npIcon = document.getElementById("np-icon");
  const npTrack = document.getElementById("np-track");
  if (!npEl) return;
  if (state.musicPlaying) {
    npEl.classList.remove("now-playing-idle");
    if (npIcon) npIcon.style.animation = "";
    if (npTrack) npTrack.textContent = `${currentStation().label} — Live`;
  } else {
    npEl.classList.add("now-playing-idle");
    if (npIcon) npIcon.style.animation = "none";
    if (npTrack) npTrack.textContent = `${currentStation().label}`;
  }
}

function startMusic() {
  if (!ytPlayer || !ytPlayerReady || typeof ytPlayer.playVideo !== "function")
    return;
  // Mute first so the browser allows playback without a prior iframe click
  // (muted autoplay is always permitted). onPlayerStateChange unmutes once playing.
  ytPlayer.mute();
  ytPlayer.setVolume(state.volMusic ?? 60);
  ytPlayer.playVideo();
}

function pauseMusic() {
  if (!ytPlayer || typeof ytPlayer.pauseVideo !== "function") return;
  ytPlayer.pauseVideo();
}

function stopMusicPlayback() {
  pauseMusic();
}

function playMusic() {
  startMusic();
}

function togglePlayPause() {
  if (state.musicPlaying) {
    pauseMusic();
  } else {
    startMusic();
  }
}

function skipToNextTrack() {
  const idx = STATIONS.findIndex((s) => s.id === state.activeGenre);
  const next = STATIONS[(idx + 1) % STATIONS.length];
  switchGenre(next.id);
}

function updatePlayPauseButtons() {
  const playBtn = document.getElementById("btn-play");
  const pauseBtn = document.getElementById("btn-pause");
  if (!playBtn || !pauseBtn) return;
  if (state.musicPlaying) {
    playBtn.disabled = true;
    playBtn.classList.add("player-btn-disabled");
    pauseBtn.disabled = false;
    pauseBtn.classList.remove("player-btn-disabled");
  } else {
    playBtn.disabled = false;
    playBtn.classList.remove("player-btn-disabled");
    pauseBtn.disabled = true;
    pauseBtn.classList.add("player-btn-disabled");
  }
  updateNowPlaying();
}

function applyMusicVolume() {
  if (ytPlayer && typeof ytPlayer.setVolume === "function")
    ytPlayer.setVolume(state.volMusic ?? 60);
}

function switchGenre(id) {
  const station = STATIONS.find((s) => s.id === id) || STATIONS[0];
  state.activeGenre = station.id;
  saveState();
  applyGenreTheme(station.id);
  updateGenreButtons();
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    if (state.musicPlaying) {
      ytPlayer.loadVideoById(station.videoId);
    } else {
      ytPlayer.cueVideoById(station.videoId);
    }
  }
  updateNowPlaying();
}

function applyGenreTheme(id) {
  const station = STATIONS.find((s) => s.id === id) || STATIONS[0];
  const card = document.querySelector(".card-audio");
  if (!card) return;
  card.style.setProperty("--genre-color", station.color);
  card.style.setProperty("--genre-bg", station.bg);
  document.documentElement.style.setProperty("--genre-color", station.color);
  document.documentElement.style.setProperty("--genre-bg", station.bg);
  const stripe = card.querySelector(".card-stripe-audio");
  if (stripe) stripe.style.background = station.color;
  const npIcon = document.getElementById("np-icon");
  if (npIcon) npIcon.style.color = station.color;
}

function updateGenreButtons() {
  document.querySelectorAll(".genre-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.genre === state.activeGenre);
  });
}

// ===== NOTIFICATIONS =====
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
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
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  new Notification(title, { body });
}

// ===== TIMER HELPERS =====
function workMinutes() {
  if (state.mode === "custom" && state.customWorkMinutes > 0)
    return state.customWorkMinutes;
  return state.mode === "50/10" ? 50 : 25;
}
function breakMinutes() {
  if (state.mode === "custom" && state.customBreakMinutes > 0)
    return state.customBreakMinutes;
  return state.mode === "50/10" ? 10 : 5;
}
function totalSeconds() {
  return (state.phase === "work" ? workMinutes() : breakMinutes()) * 60;
}

// ===== WORKER-BASED TIMER =====
let timeWorker = null;
let tickingWorker = null;

function initWorkers() {
  // Try inline blob workers so they work from any path
  try {
    const timeBlob = new Blob(
      [
        `
let timer=null,startTS=Date.now(),counted=0,countMax=0;
function init(s){startTS=Date.now();counted=0;countMax=s;}
function gap(){
  const ms=Date.now()-startTS,sec=Math.round(ms/1000),diff=sec-counted;
  counted+=diff;
  const over=counted>countMax?counted-countMax:0;
  const g=diff-over; return g>0?g:1;
}
self.addEventListener('message',e=>{
  const m=e.data;
  if(m.startsWith('start-timer_')){clearInterval(timer);init(parseInt(m.split('_')[1],10));timer=setInterval(()=>postMessage(gap()),1000);}
  else if(m.startsWith('change-timer_')){init(parseInt(m.split('_')[1],10));}
  else if(m==='stop-timer'){clearInterval(timer);timer=null;}
});`,
      ],
      { type: "application/javascript" },
    );
    timeWorker = new Worker(URL.createObjectURL(timeBlob));
  } catch (e) {
    console.warn("timeWorker failed, falling back to setInterval", e);
    timeWorker = null;
  }

  try {
    const tickBlob = new Blob(
      [
        `
let t=null;
self.addEventListener('message',e=>{
  if(e.data==='ticking-start'){clearInterval(t);t=setInterval(()=>postMessage('tick'),1000);}
  else if(e.data==='ticking-stop'){clearInterval(t);t=null;}
});`,
      ],
      { type: "application/javascript" },
    );
    tickingWorker = new Worker(URL.createObjectURL(tickBlob));
    tickingWorker.addEventListener("message", async () => {
      await playTick();
    });
  } catch (e) {
    console.warn("tickingWorker failed", e);
    tickingWorker = null;
  }
}

function startTimer() {
  if (state.running) return;
  state.lastActivityAt = Date.now();
  state.running = true;
  playStartClick();
  updateTimerUI();
  saveState();

  // Autoplay music if enabled for this phase and music isn't already playing
  if (!state.musicPlaying) {
    if (state.phase === "work" && state.autoplayWork) startMusic(true);
    else if (state.phase === "break" && state.autoplayBreak) startMusic(true);
  }

  if (timeWorker) {
    timeWorker.onmessage = (e) => {
      const gap = typeof e.data === "number" ? e.data : 1;
      for (let i = 0; i < gap; i++) tick();
    };
    timeWorker.postMessage(`start-timer_${state.timeLeft}`);
  } else {
    timerInterval = setInterval(tick, 1000);
  }

  // Start ticking if enabled on work phase
  if (state.tickingEnabled && state.phase === "work") {
    if (tickingWorker) tickingWorker.postMessage("ticking-start");
  }

  // Auto-switch to correct card based on phase
  const correctCard = state.phase === "work" ? 0 : 1;
  if (activeCard !== correctCard) {
    goTo(correctCard);
  }
}

function pauseTimer() {
  if (!state.running) return;
  state.lastActivityAt = Date.now();
  state.running = false;
  if (timeWorker) timeWorker.postMessage("stop-timer");
  clearInterval(timerInterval);
  timerInterval = null;
  if (tickingWorker) tickingWorker.postMessage("ticking-stop");
  pauseMusic();
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
    updateTimerDisplays();
    updateProgressBars();
    if (state.timeLeft % 5 === 0) saveState();
  } else {
    phaseComplete();
  }
}

function phaseComplete() {
  // Stop workers
  if (timeWorker) timeWorker.postMessage("stop-timer");
  if (tickingWorker) tickingWorker.postMessage("ticking-stop");
  clearInterval(timerInterval);
  timerInterval = null;
  state.running = false;
  playTimerDone();

  const completedPhase = state.phase;

  if (completedPhase === "work") {
    state.pomoCount++;
    state.phase = "break";
    state.timeLeft = breakMinutes() * 60;
    updatePomoCount();
    sendNotification(
      "Work session done! ☕",
      `Enjoy your ${breakMinutes()}-minute break.`,
    );
    goTo(1);
  } else {
    state.breakCount++;
    state.phase = "work";
    state.timeLeft = workMinutes() * 60;
    updateBreakCount();
    sendNotification("Break's over! 💪", "Time to focus.");
    goTo(0);
  }

  updateTimerUI();
  saveState();

  // Seamless handoff: only keep music playing if autoStart is on
  // AND both autoplay toggles are enabled.
  const nextPhase = state.phase;
  const seamless =
    state.autoStart &&
    ((nextPhase === "break" && state.autoplayWork && state.autoplayBreak) ||
      (nextPhase === "work" && state.autoplayBreak && state.autoplayWork));

  if (!seamless) pauseMusic();

  if (state.autoStart) {
    setTimeout(() => {
      startTimer();
    }, 1000);
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

function updateTimerDisplays() {
  document.querySelectorAll(".timer-display").forEach((el) => {
    el.textContent = formatTime(state.timeLeft);
  });
}

function updateProgressBars() {
  const total = totalSeconds();
  const pct = total > 0 ? (state.timeLeft / total) * 100 : 100;
  document.querySelectorAll(".timer-progress-fill").forEach((fill) => {
    fill.style.width = pct + "%";
    fill.classList.toggle("break-phase", state.phase === "break");
  });
}

function updateTimerUI() {
  updateTimerDisplays();
  updateProgressBars();

  const isWork = state.phase === "work";
  const isRunning = state.running;

  // Timer block lives only on Work card
  // Mirror timer on both Work and Break cards — dim whichever phase is inactive
  const workBlock = document.getElementById("timer-block-work");
  const breakBlock = document.getElementById("timer-block-break");
  if (workBlock) workBlock.classList.toggle("timer-dimmed", !isWork);
  if (breakBlock) breakBlock.classList.toggle("timer-dimmed", isWork);

  // Phase labels
  document.querySelectorAll(".phase-label-work").forEach((el) => {
    el.classList.toggle("inactive-phase", !isWork);
    el.classList.remove("break-phase");
  });
  document.querySelectorAll(".phase-label-break").forEach((el) => {
    el.classList.toggle("inactive-phase", isWork);
    el.classList.toggle("break-phase", !isWork);
  });

  // Phase label on Work card
  document.querySelectorAll(".phase-label-work").forEach((el) => {
    el.textContent = isWork ? "Work Session" : "Break in progress";
    el.classList.toggle("break-phase", !isWork);
  });

  // Timer digits color
  document.querySelectorAll(".timer-digits").forEach((el) => {
    el.classList.toggle("break-phase", !isWork);
    el.classList.toggle("running", isRunning);
  });

  // Buttons - enable pause on any card if timer is running, enable start on any card if timer is not running
  const btnStarts = document.querySelectorAll(".btn-start");
  const btnPauses = document.querySelectorAll(".btn-pause");
  btnStarts.forEach((b) => {
    // Only disable Start if timer is already running
    b.disabled = isRunning;
    b.classList.toggle("break-mode", !isWork);
  });
  btnPauses.forEach((b) => {
    // Only disable Pause if timer is not running
    b.disabled = !isRunning;
    b.classList.toggle("break-mode", !isWork);
  });

  // Header
  const header = document.getElementById("main-header");
  header.classList.toggle("header-work", isWork && isRunning);
  header.classList.toggle("header-break", !isWork && isRunning);
  if (!isRunning) header.classList.remove("header-work", "header-break");
}

function updatePomoCount() {
  document
    .querySelectorAll(".pomo-number")
    .forEach((el) => (el.textContent = state.pomoCount));
}

function updateBreakCount() {
  document
    .querySelectorAll(".break-number")
    .forEach((el) => (el.textContent = state.breakCount));
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
  const el = document.getElementById("darkmode-desc");
  if (el) el.textContent = enabled ? "On" : "Off";
}

function initSettings() {
  // Timer mode - segmented pill buttons
  const applyModeUI = (mode) => {
    document.querySelectorAll(".mode-seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    document.querySelectorAll(".custom-time-fields").forEach((el) => {
      el.classList.toggle("hidden", mode !== "custom");
    });
  };
  const syncTimerMode = (mode) => {
    state.mode = mode;
    applyModeUI(mode);
    pauseTimer();
    state.phase = "work";
    state.timeLeft = workMinutes() * 60;
    updateTimerUI();
    saveState();
  };

  document.querySelectorAll(".mode-seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => syncTimerMode(btn.dataset.mode));
  });
  // Init: apply UI only, don't reset timer
  applyModeUI(state.mode);

  // Sound theme
  if (state.soundTheme === "beep") state.soundTheme = "chime";
  document.querySelectorAll("input[name='sound-theme']").forEach((radio) => {
    if (radio.value === (state.soundTheme || "chime")) radio.checked = true;
    radio.addEventListener("change", (e) => {
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
  const toggleSfx = document.getElementById("toggle-sfx");
  const sfxThemeRow = document.getElementById("sfx-theme-row");
  if (toggleSfx) {
    toggleSfx.checked = !state.mutedSfx;
    document.getElementById("sfx-desc").textContent = state.mutedSfx
      ? "Off"
      : "On";
    if (sfxThemeRow) sfxThemeRow.classList.toggle("hidden", state.mutedSfx);
    toggleSfx.addEventListener("change", () => {
      state.mutedSfx = !toggleSfx.checked;
      document.getElementById("sfx-desc").textContent = state.mutedSfx
        ? "Off"
        : "On";
      if (sfxThemeRow) sfxThemeRow.classList.toggle("hidden", state.mutedSfx);
      saveState();
    });
  }

  // Ticking sound
  const toggleTicking = document.getElementById("toggle-ticking");
  if (toggleTicking) {
    toggleTicking.checked = state.tickingEnabled;
    document.getElementById("ticking-desc").textContent = state.tickingEnabled
      ? "On"
      : "Off";
    toggleTicking.addEventListener("change", () => {
      state.tickingEnabled = toggleTicking.checked;
      document.getElementById("ticking-desc").textContent = state.tickingEnabled
        ? "On"
        : "Off";
      saveState();
      // Start/stop live ticking if timer is running
      if (tickingWorker) {
        if (state.tickingEnabled && state.running && state.phase === "work") {
          tickingWorker.postMessage("ticking-start");
        } else {
          tickingWorker.postMessage("ticking-stop");
        }
      }
    });
  }

  // Autoplay music toggles
  const toggleAutoplayWork = document.getElementById("toggle-autoplay-work");
  const toggleAutoplayBreak = document.getElementById("toggle-autoplay-break");

  if (toggleAutoplayWork) {
    toggleAutoplayWork.checked = state.autoplayWork;
    document.getElementById("autoplay-work-desc").textContent =
      state.autoplayWork ? "On" : "Off";
    toggleAutoplayWork.addEventListener("change", () => {
      state.autoplayWork = toggleAutoplayWork.checked;
      document.getElementById("autoplay-work-desc").textContent =
        state.autoplayWork ? "On" : "Off";
      saveState();
    });
  }
  if (toggleAutoplayBreak) {
    toggleAutoplayBreak.checked = state.autoplayBreak;
    document.getElementById("autoplay-break-desc").textContent =
      state.autoplayBreak ? "On" : "Off";
    toggleAutoplayBreak.addEventListener("change", () => {
      state.autoplayBreak = toggleAutoplayBreak.checked;
      document.getElementById("autoplay-break-desc").textContent =
        state.autoplayBreak ? "On" : "Off";
      saveState();
    });
  }
  const syncAutoStart = (enabled) => {
    state.autoStart = enabled;
    const workToggle = document.getElementById("toggle-autostart-work");
    const breakToggle = document.getElementById("toggle-autostart-break");
    const workDesc = document.getElementById("autostart-desc-work");
    const breakDesc = document.getElementById("autostart-desc-break");

    if (workToggle) workToggle.checked = enabled;
    if (breakToggle) breakToggle.checked = enabled;
    if (workDesc) workDesc.textContent = enabled ? "On" : "Off";
    if (breakDesc) breakDesc.textContent = enabled ? "On" : "Off";
    saveState();
  };

  const toggleAutostartWork = document.getElementById("toggle-autostart-work");
  const toggleAutostartBreak = document.getElementById(
    "toggle-autostart-break",
  );

  if (toggleAutostartWork) {
    toggleAutostartWork.checked = state.autoStart;
    toggleAutostartWork.addEventListener("change", () => {
      syncAutoStart(toggleAutostartWork.checked);
    });
  }

  if (toggleAutostartBreak) {
    toggleAutostartBreak.checked = state.autoStart;
    toggleAutostartBreak.addEventListener("change", () => {
      syncAutoStart(toggleAutostartBreak.checked);
    });
  }

  // Initial sync of auto-start display
  syncAutoStart(state.autoStart);

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

  // Custom timer inputs - synced between both cards
  const customWorkInputWork = document.getElementById("custom-work-minutes");
  const customWorkInputBreak = document.getElementById(
    "custom-work-minutes-break",
  );
  const customBreakInputWork = document.getElementById(
    "custom-break-minutes-work",
  );
  const customBreakInputBreak = document.getElementById("custom-break-minutes");

  function updateCustomWorkInputs() {
    if (state.customWorkMinutes) {
      if (customWorkInputWork)
        customWorkInputWork.value = state.customWorkMinutes;
      if (customWorkInputBreak)
        customWorkInputBreak.value = state.customWorkMinutes;
    }
  }
  function updateCustomBreakInputs() {
    if (state.customBreakMinutes) {
      if (customBreakInputWork)
        customBreakInputWork.value = state.customBreakMinutes;
      if (customBreakInputBreak)
        customBreakInputBreak.value = state.customBreakMinutes;
    }
  }
  updateCustomWorkInputs();
  updateCustomBreakInputs();

  function flashSetBtn(btn) {
    btn.textContent = "✓";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = "Set";
      btn.disabled = false;
    }, 1000);
  }

  function applyCustomTimes(workInput, breakInput, btn) {
    const wVal = parseInt(workInput?.value, 10);
    const bVal = parseInt(breakInput?.value, 10);
    if (wVal >= 1 && wVal <= 180) state.customWorkMinutes = wVal;
    if (bVal >= 1 && bVal <= 60) state.customBreakMinutes = bVal;
    updateCustomWorkInputs();
    updateCustomBreakInputs();
    pauseTimer();
    state.phase = "work";
    state.timeLeft = workMinutes() * 60;
    updateTimerUI();
    saveState();
    if (btn) flashSetBtn(btn);
  }

  const btnSetWork = document.getElementById("btn-set-custom-work");
  const btnSetBreak = document.getElementById("btn-set-custom-break");
  if (btnSetWork)
    btnSetWork.addEventListener("click", () =>
      applyCustomTimes(customWorkInputWork, customBreakInputWork, btnSetWork),
    );
  if (btnSetBreak)
    btnSetBreak.addEventListener("click", () =>
      applyCustomTimes(
        customWorkInputBreak,
        customBreakInputBreak,
        btnSetBreak,
      ),
    );

  // Prevent card drag while typing in custom time inputs
  [
    customWorkInputWork,
    customWorkInputBreak,
    customBreakInputWork,
    customBreakInputBreak,
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("touchstart", (e) => e.stopPropagation(), {
      passive: true,
    });
  });

  // Reset break board (all tabs)
  const btnResetBreak = document.getElementById("btn-reset-break-board");
  if (btnResetBreak) {
    btnResetBreak.addEventListener("click", () => {
      if (
        confirm(
          "Reshuffle all break bingo boards and clear all marks? Today's break score resets too.",
        )
      ) {
        const TABS = ["all", "body", "mind", "home"];
        TABS.forEach((tab) => {
          state.breakTabs[tab] = shuffleCells(
            DEFAULT_BREAK_TABS[tab].map((text) => ({ text, count: 0 })),
          );
          state.lineCompletions[tab] = {};
          state.blackoutCompletions[tab] = 0;
        });
        state.bingoAcknowledged = false;
        state.scoreBreakToday = 0;
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
      if (confirm("Clear all work tasks? Today's work score resets too.")) {
        state.workCells = [];
        state.scoreWorkToday = 0;
        state.focusedTaskIndex = -1;
        saveState();
        exitFocusMode();
        renderWorkTaskList();
        updateScoreUI();
      }
    });
  }

  // Reset all scores
  const btnResetScores = document.getElementById("btn-reset-scores");
  if (btnResetScores) {
    btnResetScores.addEventListener("click", () => {
      if (
        confirm(
          "Wipe ALL scores — today, yesterday, and all-time? This cannot be undone.",
        )
      ) {
        state.scoreWorkToday = state.scoreBreakToday = 0;
        state.scoreWorkYesterday = state.scoreBreakYesterday = 0;
        state.scoreWorkAllTime = state.scoreBreakAllTime = 0;
        state.scoreWorkAllTimeBase = state.scoreBreakAllTimeBase = 0;
        saveState();
        updateScoreUI();
      }
    });
  }

  // Reset to defaults (keep scores)
  const btnResetDefaults = document.getElementById("btn-reset-defaults");
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener("click", () => {
      if (
        !confirm(
          "This will reset all settings and custom lists to defaults. Your scores and history will be kept. Continue?",
        )
      )
        return;
      const scoreFields = {
        pomoCount: state.pomoCount,
        breakCount: state.breakCount,
        scoreHistory: state.scoreHistory,
        scoreWorkToday: state.scoreWorkToday,
        scoreBreakToday: state.scoreBreakToday,
        scoreWorkYesterday: state.scoreWorkYesterday,
        scoreBreakYesterday: state.scoreBreakYesterday,
        scoreWorkAllTime: state.scoreWorkAllTime,
        scoreBreakAllTime: state.scoreBreakAllTime,
        scoreWorkAllTimeBase: state.scoreWorkAllTimeBase,
        scoreBreakAllTimeBase: state.scoreBreakAllTimeBase,
      };
      localStorage.removeItem("bingoBreakState2");
      sessionStorage.clear();
      localStorage.setItem("bingoBreakState2", JSON.stringify(scoreFields));
      window.location.reload();
    });
  }

  // Wipe all data (scores, tasks, break activities, everything)
  const btnWipeAllData = document.getElementById("btn-wipe-all-data");
  if (btnWipeAllData) {
    btnWipeAllData.addEventListener("click", () => {
      if (
        confirm(
          "This will delete EVERYTHING — all scores, tasks, bingo boards, and settings. This cannot be undone. Are you sure?",
        )
      ) {
        localStorage.removeItem("bingoBreakState2");
        window.location.reload();
      }
    });
  }
}

// ===== GRIDS =====
function shuffleCells(cells) {
  const arr = [...cells];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderGrid(cells, containerId, isWork) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = "";

  cells.forEach((cell, i) => {
    const div = document.createElement("div");
    div.className =
      "bingo-cell" +
      (cell.count > 0 ? ` completed completed-${cell.count}` : "");
    div.dataset.index = i;

    const span = document.createElement("span");
    span.className = "cell-text" + (cell.text ? "" : " placeholder");
    span.textContent = cell.text || "Click to add…";
    div.appendChild(span);

    if (cell.count > 0) {
      const pip = document.createElement("span");
      pip.className = "cell-count-pip";
      pip.textContent = "★".repeat(cell.count);
      div.appendChild(pip);
    }

    div.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleCell(i, false);
    });
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (cells[i].count > 0) {
        cells[i].count--;
        renderBreakGrid();
        checkAndAwardBreakLines(state.activeBreakTab);
        recalculateScore();
        saveState();
      }
    });

    grid.appendChild(div);
  });
}

function renderBreakGrid() {
  const tab = state.activeBreakTab;
  renderGrid(state.breakTabs[tab], "break-grid", false);

  // Sync tab bar
  document.querySelectorAll(".break-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
}

// ===== WORK TASK LIST RENDERER =====
function renderWorkTaskList() {
  const container = document.getElementById("work-task-list");
  if (!container) return;
  container.innerHTML = "";

  const active = state.workCells.filter((c) => c.count === 0);
  const done = state.workCells.filter((c) => c.count > 0);

  const toggleBtn = document.getElementById("btn-toggle-done-tasks");
  if (active.length === 0 && done.length === 0) {
    if (toggleBtn) { toggleBtn.style.opacity = "0.3"; toggleBtn.disabled = true; }
    return;
  }

  // Incomplete divider
  if (active.length > 0) {
    const incompleteDivider = document.createElement("div");
    incompleteDivider.className = "work-task-done-divider";
    incompleteDivider.innerHTML = `<span>Incomplete (${active.length})</span>`;
    incompleteDivider.style.display = state.showDoneTasks ? "none" : "flex";
    container.appendChild(incompleteDivider);
  }

  // Active tasks — visible when not in "Show Done" mode
  active.forEach((cell) => {
    const idx = state.workCells.indexOf(cell);
    const item = buildTaskItem(cell, idx, false);
    item.style.display = state.showDoneTasks ? "none" : "flex";
    container.appendChild(item);
  });

  // Done tasks (hidden unless toggled)
  if (done.length > 0) {
    const divider = document.createElement("div");
    divider.className = "work-task-done-divider";
    divider.id = "work-done-divider";
    divider.innerHTML = `<span>Completed (${done.length})</span>`;
    divider.style.display = state.showDoneTasks ? "flex" : "none";
    container.appendChild(divider);

    done.forEach((cell) => {
      const idx = state.workCells.indexOf(cell);
      const item = buildTaskItem(cell, idx, true);
      item.style.display = state.showDoneTasks ? "flex" : "none";
      item.dataset.isDone = "1";
      container.appendChild(item);
    });
  }

  // Update toggle button
  if (toggleBtn) {
    const hasDone = done.length > 0;
    const canToggle = hasDone || state.showDoneTasks;
    toggleBtn.disabled = !canToggle;
    toggleBtn.textContent = state.showDoneTasks ? "Hide Done" : "Show Done";
    toggleBtn.style.opacity = canToggle ? "1" : "0.3";
    toggleBtn.style.color = state.showDoneTasks ? "var(--c-work)" : "";
    toggleBtn.style.borderColor = state.showDoneTasks ? "var(--c-work)" : "";
  }
}

function buildTaskItem(cell, idx, isDone) {
  const item = document.createElement("div");
  item.className = "work-task-item" + (isDone ? " completed" : "");
  item.dataset.index = idx;

  const icon = document.createElement("div");
  icon.className = "task-item-icon";
  icon.textContent = isDone ? "✓" : "";
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isDone) {
      // Undo
      state.workCells[idx].count = 0;
      recalculateScore();
      saveState();
      renderWorkTaskList();
      exitFocusMode();
    } else {
      // Complete task
      state.workCells[idx].count = 1;
      addScore(10, true);
      showScorePopup(`+10 pts ✓`);
      saveState();
      renderWorkTaskList();
    }
  });
  item.appendChild(icon);

  const text = document.createElement("span");
  text.className = "task-item-text";
  text.textContent = cell.text || "Unnamed task";
  text.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!isDone) startEditingTask(idx, text);
  });
  item.appendChild(text);

  if (!isDone) {
    // Focus hint
    const hint = document.createElement("span");
    hint.className = "task-item-focus-hint";
    hint.textContent = "Focus →";
    item.appendChild(hint);

    item.addEventListener("click", () => enterFocusMode(idx));

    // Right-click to delete
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.workCells.splice(idx, 1);
      if (state.focusedTaskIndex === idx) exitFocusMode();
      else if (state.focusedTaskIndex > idx) state.focusedTaskIndex--;
      recalculateScore();
      saveState();
      renderWorkTaskList();
    });
  }

  return item;
}

function startEditingTask(idx, textElement) {
  const cell = state.workCells[idx];
  const input = document.createElement("input");
  input.type = "text";
  input.value = cell.text;
  input.maxLength = 80;
  input.className = "task-item-text-edit";

  textElement.replaceWith(input);
  input.focus();
  input.select();

  function saveEdit() {
    cell.text = input.value.trim() || "Unnamed task";
    saveState();
    renderWorkTaskList();
  }

  input.addEventListener("blur", saveEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveEdit();
    }
  });
}

// ===== FOCUS MODE =====
function enterFocusMode(taskIdx) {
  state.focusedTaskIndex = taskIdx;
  saveState();

  const task = state.workCells[taskIdx];
  const focusView = document.getElementById("work-focus-view");
  const listView = document.getElementById("work-tasklist-view");
  const focusName = document.getElementById("focus-task-name");

  if (focusName) focusName.textContent = task.text || "Unnamed task";
  if (listView) listView.classList.add("hidden");
  if (focusView) focusView.classList.remove("hidden");
}

function exitFocusMode() {
  state.focusedTaskIndex = -1;
  saveState();

  const focusView = document.getElementById("work-focus-view");
  const listView = document.getElementById("work-tasklist-view");
  if (focusView) focusView.classList.add("hidden");
  if (listView) listView.classList.remove("hidden");
  renderWorkTaskList();
}

function completeCurrentFocusTask() {
  const idx = state.focusedTaskIndex;
  if (idx < 0 || idx >= state.workCells.length) return;
  const cell = state.workCells[idx];
  if (cell.count >= 1) return;

  cell.count = 1;
  addScore(10, true);
  showScorePopup(`+10 pts ✓`);
  saveState();
  exitFocusMode();
}

function recalculateScore() {
  let workPts = 0,
    breakPts = 0;
  state.workCells.forEach((c) => {
    if (c.count >= 1) workPts += 10;
  });
  const TABS = ["all", "body", "mind", "home"];
  TABS.forEach((tab) => {
    state.breakTabs[tab].forEach((c) => {
      for (let n = 1; n <= c.count; n++)
        breakPts +=
          basePointsForCell(n, false) - basePointsForCell(n - 1, false);
    });
    // Calculate line completion points: 10, 20, 30, 40, 50
    Object.values(state.lineCompletions[tab] || {}).forEach(
      (completionCount) => {
        breakPts += completionCount * 10;
      },
    );
    // Calculate blackout points: 100, 200, 300, 400, 500
    breakPts += (state.blackoutCompletions[tab] || 0) * 100;
  });
  state.scoreWorkToday = workPts;
  state.scoreBreakToday = breakPts;
  state.scoreWorkAllTime = Math.max(state.scoreWorkAllTimeBase || 0, workPts);
  state.scoreBreakAllTime = Math.max(
    state.scoreBreakAllTimeBase || 0,
    breakPts,
  );
  updateScoreUI();
}

// ===== INLINE TASK ADD =====
function initInlineTaskAdd() {
  const input = document.getElementById("work-add-input");
  const btn = document.getElementById("work-add-btn");

  function addTask() {
    const text = input?.value.trim();
    if (!text) return;
    state.workCells.push({ text, count: 0 });
    saveState();
    renderWorkTaskList();
    if (input) input.value = "";
    input?.focus();
  }

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    addTask();
  });

  // Stop card drag when interacting with input
  input?.addEventListener("mousedown", (e) => e.stopPropagation());
  input?.addEventListener("touchstart", (e) => e.stopPropagation(), {
    passive: true,
  });
}

// ===== 7-DAY HISTORY CHART =====
function renderHistoryChart() {
  const svg = document.getElementById("pts-history-chart");
  const labelRow = document.getElementById("pts-chart-labels");
  if (!svg || !labelRow) return;

  // Build 7-slot array: days[-6] ... days[0]=today
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = localDateString(-i);
    const hist = state.scoreHistory.find((h) => h.date === dateStr);
    const isToday = i === 0;
    days.push({
      label: isToday
        ? "Today"
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
            new Date(dateStr + "T12:00:00").getDay()
          ],
      total: isToday ? totalToday() : hist ? hist.work + hist.brk : 0,
      work: isToday ? state.scoreWorkToday : hist ? hist.work : 0,
      brk: isToday ? state.scoreBreakToday : hist ? hist.brk : 0,
      isToday,
    });
  }

  const maxVal = Math.max(...days.map((d) => d.total), 1);
  const W = 300,
    H = 72,
    barW = 28,
    gap = (W - 7 * barW) / 8;

  svg.innerHTML = "";
  labelRow.innerHTML = "";

  days.forEach((day, i) => {
    const x = gap + i * (barW + gap);
    const barH = Math.max(2, (day.total / maxVal) * H);
    const y = H - barH;
    const workH = Math.max(0, (day.work / maxVal) * H);
    const brkH = Math.max(0, (day.brk / maxVal) * H);

    // Break segment (bottom)
    if (brkH > 0) {
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("x", x);
      rect.setAttribute("y", H - brkH);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", brkH);
      rect.setAttribute("fill", day.isToday ? "#27ae60" : "#7dbb99");
      rect.setAttribute("rx", "3");
      svg.appendChild(rect);
    }
    // Work segment (top)
    if (workH > 0) {
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("x", x);
      rect.setAttribute("y", H - brkH - workH);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", workH);
      rect.setAttribute("fill", day.isToday ? "#c0392b" : "#e08070");
      rect.setAttribute("rx", "3");
      svg.appendChild(rect);
    }
    // Empty bar placeholder
    if (day.total === 0) {
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("x", x);
      rect.setAttribute("y", H - 3);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", 3);
      rect.setAttribute("fill", "var(--rule)");
      rect.setAttribute("rx", "2");
      svg.appendChild(rect);
    }

    // Label
    const lbl = document.createElement("span");
    lbl.className = "pts-chart-day-label" + (day.isToday ? " today" : "");
    lbl.textContent = day.label;
    labelRow.appendChild(lbl);
  });
}

function toggleCell(index) {
  const tab = state.activeBreakTab;
  const cells = state.breakTabs[tab];
  const cell = cells[index];
  const prevCount = cell.count;
  if (prevCount >= 5) return;

  cell.count = prevCount + 1;
  const pts =
    basePointsForCell(cell.count, false) - basePointsForCell(prevCount, false);
  addScore(pts, false);
  showScorePopup(`+${pts} pt${pts !== 1 ? "s" : ""}`);

  // Render the grid FIRST so the DOM is updated
  renderBreakGrid();

  // THEN check for lines/blackout so animations can find the updated cells
  checkAndAwardBreakLines(tab);

  saveState();
}

function showLineAnimation(line, completionNum, isBlackout = false) {
  // line is now the actual array (e.g., [0,1,2,3])
  if (!Array.isArray(line)) return;

  // Small delay to ensure DOM has updated
  setTimeout(() => {
    line.forEach((cellIdx) => {
      const cellEl = document.querySelector(
        `.bingo-cell[data-index="${cellIdx}"]`,
      );
      if (cellEl) {
        if (isBlackout) {
          cellEl.classList.add("blackout-line-glow");
          setTimeout(() => {
            cellEl.classList.remove("blackout-line-glow");
          }, 3000);
        } else {
          cellEl.classList.add("line-complete-glow");
          setTimeout(() => {
            cellEl.classList.remove("line-complete-glow");
          }, 2000);
        }
      }
    });
  }, 50); // Small delay ensures DOM is ready
}

function showBlackoutAnimation() {
  // Apply a stronger glow/pulse to ALL cells with a small delay to ensure DOM is ready
  setTimeout(() => {
    const cells = document.querySelectorAll(".bingo-cell");
    cells.forEach((cellEl) => {
      cellEl.classList.add("blackout-complete-glow");
      setTimeout(() => {
        cellEl.classList.remove("blackout-complete-glow");
      }, 3000);
    });
  }, 50);
}

// ===== CUSTOMIZE MODALS =====
function openCustomizeModal(isWork, breakTabKey) {
  let cells, defaults, titleText;

  if (isWork) {
    cells = state.workCells;
    defaults = [];
    titleText = "✏ Today's Tasks";
  } else {
    const tab = breakTabKey || state.activeBreakTab;
    cells = state.breakTabs[tab];
    defaults = DEFAULT_BREAK_TABS[tab];
    const tabLabel = { all: "All", body: "Body", mind: "Mind", home: "Home" }[
      tab
    ];
    titleText = `✏ Edit ${tabLabel} Activities`;
    breakTabKey = tab;
  }

  const modal = document.getElementById("customize-modal");
  const title = document.getElementById("customize-modal-title");
  const list = document.getElementById("customize-list");
  const saveBtn = document.getElementById("btn-customize-save");
  const instructionsEl = document.querySelector(".customize-instructions");

  if (title) title.textContent = titleText;
  if (instructionsEl) {
    instructionsEl.textContent = isWork
      ? "Add or edit your tasks for today. Empty rows are removed on save."
      : "Edit your activities below. Blank fields use defaults. Shuffled on save.";
  }
  list.innerHTML = "";
  saveBtn.dataset.isWork = isWork ? "1" : "0";
  saveBtn.dataset.breakTab = isWork ? "" : breakTabKey || state.activeBreakTab;

  const rowTexts = isWork
    ? [...cells.map((c) => c.text), "", ""]
    : cells.map((c) => c.text);

  if (!isWork) {
    // 2-column grid: 8 rows × 2 inputs = 16 cells
    list.style.display = "grid";
    list.style.gridTemplateColumns = "1fr 1fr";
    list.style.gap = "5px";
    rowTexts.forEach((text, i) => {
      list.appendChild(buildCustomizeCell(i, text, false));
    });
  } else {
    list.style.display = "";
    list.style.gridTemplateColumns = "";
    list.style.gap = "";
    rowTexts.forEach((text, i) => {
      list.appendChild(buildCustomizeRow(i, text, true));
    });

    // Add more button for work
    const addBtn = document.createElement("button");
    addBtn.className = "action-btn";
    addBtn.style.cssText = "width:100%;margin-top:4px;font-size:0.75rem;";
    addBtn.textContent = "+ Add another task";
    addBtn.addEventListener("click", () => {
      const inputs = list.querySelectorAll("input");
      const newIdx = inputs.length;
      list.appendChild(buildCustomizeRow(newIdx, "", true));
      list.querySelectorAll("input")[newIdx]?.focus();
    });
    list.appendChild(addBtn);
  }

  modal.classList.remove("hidden");
  const defaultsBtn = document.getElementById("btn-customize-defaults");
  if (defaultsBtn) defaultsBtn.style.display = isWork ? "none" : "";
  list.querySelectorAll("input")[0]?.focus();
}

function buildCustomizeRow(i, value, isWork) {
  const row = document.createElement("div");
  row.className = "customize-row";
  const num = document.createElement("span");
  num.className = "row-num";
  num.textContent = i + 1;
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 60;
  input.placeholder = isWork ? `Task ${i + 1}…` : `Break idea ${i + 1}…`;
  input.value = value || "";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const inputs = document.querySelectorAll("#customize-list input");
      const next = inputs[i + 1];
      if (next) next.focus();
      else document.getElementById("btn-customize-save").focus();
    }
  });
  row.appendChild(num);
  row.appendChild(input);
  return row;
}

function buildCustomizeCell(i, value, isWork) {
  // Compact single-input cell for 2-col break grid layout
  const cell = document.createElement("div");
  cell.className = "customize-cell";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 40;
  input.placeholder = `Item ${i + 1}…`;
  input.value = value || "";
  input.dataset.cellIdx = i;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const inputs = document.querySelectorAll("#customize-list input");
      const next = inputs[i + 1];
      if (next) next.focus();
      else document.getElementById("btn-customize-save").focus();
    }
  });
  cell.appendChild(input);
  return cell;
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function saveCustomize() {
  const saveBtn = document.getElementById("btn-customize-save");
  const isWork = saveBtn.dataset.isWork === "1";
  const inputs = document.querySelectorAll("#customize-list input");
  const texts = Array.from(inputs).map((inp) => inp.value.trim());

  if (isWork) {
    // Filter out empty rows — work list is purely user-defined
    const filled = texts.filter((t) => t.length > 0);
    state.workCells = filled.map((text) => ({ text, count: 0 }));
    exitFocusMode();
    renderWorkTaskList();
  } else {
    const tab = saveBtn.dataset.breakTab || state.activeBreakTab;
    const defaults = DEFAULT_BREAK_TABS[tab];
    const filled = texts.map((t, i) => t || defaults[i] || "");
    // shuffle break items
    const shuffled = [...filled];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.breakTabs[tab] = shuffled.map((text) => ({ text, count: 0 }));
    state.lineCompletions[tab] = {};
    state.blackoutCompletions[tab] = 0;
    renderBreakGrid();
  }
  state.bingoAcknowledged = false;
  saveState();
  closeCustomizeModal();
}

function loadDefaultsIntoModal() {
  const saveBtn = document.getElementById("btn-customize-save");
  const isWork = saveBtn.dataset.isWork === "1";
  // Work has no defaults — nothing to load
  if (isWork) return;
  const tab = saveBtn.dataset.breakTab || state.activeBreakTab;
  const defaults = DEFAULT_BREAK_TABS[tab];
  const inputs = document.querySelectorAll("#customize-list input");
  defaults.forEach((text, i) => {
    if (inputs[i]) inputs[i].value = text;
  });
}

// ===================================================================
// CARD DECK ENGINE
// ===================================================================
const CARD_COUNT = 5;
const MAX_VISIBLE_DEPTH = 3;

function getPeek(prop) {
  return (
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(prop),
    ) || 11
  );
}

const cards = () => Array.from(document.querySelectorAll(".card"));
const navBtns = () => Array.from(document.querySelectorAll(".bnav"));

let deckOrder = [0, 1, 2, 3, 4];
let activeCard = 0;

function transformForDepth(depth) {
  if (depth === 0) return "translate(0px, 0px)";
  const px = getPeek("--peek-x"),
    py = getPeek("--peek-y");
  return `translate(${px * Math.min(depth, MAX_VISIBLE_DEPTH)}px, ${py * Math.min(depth, MAX_VISIBLE_DEPTH)}px)`;
}

function layoutDeck(animate = true) {
  cards().forEach((card, cardIdx) => {
    const depth = deckOrder.indexOf(cardIdx);
    if (animate) card.classList.add("animating");
    else card.classList.remove("animating");
    card.classList.remove("depth-0", "depth-1", "depth-2", "depth-3");
    card.classList.add(`depth-${Math.min(depth, MAX_VISIBLE_DEPTH)}`);
    card.style.transform = transformForDepth(depth);
    card.style.zIndex = CARD_COUNT - depth;
  });
  if (animate) {
    clearTimeout(layoutDeck._t);
    layoutDeck._t = setTimeout(
      () => cards().forEach((c) => c.classList.remove("animating")),
      460,
    );
  }
}

function goTo(targetIdx, direction) {
  if (targetIdx === activeCard) return;
  if (direction === undefined) direction = targetIdx > activeCard ? 1 : -1;

  const leavingCard = document.querySelector(
    `.card[data-card="${activeCard}"]`,
  );
  if (leavingCard && flippedCards.has(activeCard)) {
    flippedCards.delete(activeCard);
    leavingCard.classList.remove("flipped", "flipping");
  }

  let steps = 0;
  while (deckOrder[0] !== targetIdx && steps < CARD_COUNT) {
    if (direction > 0) deckOrder.push(deckOrder.shift());
    else deckOrder.unshift(deckOrder.pop());
    steps++;
  }
  activeCard = targetIdx;
  layoutDeck(true);
  syncBottomNav();
}

function syncBottomNav() {
  navBtns().forEach((b, i) => b.classList.toggle("active", i === activeCard));
}

function initBottomNav() {
  navBtns().forEach((btn, i) =>
    btn.addEventListener("click", () => {
      if (i === activeCard) flipCard(i);
      else goTo(i);
    }),
  );
}

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Don't navigate if user is editing a task input field
    if (e.target.classList.contains("task-item-text-edit")) return;

    if (e.key === "ArrowRight") goTo((activeCard + 1) % CARD_COUNT, 1);
    if (e.key === "ArrowLeft")
      goTo((activeCard - 1 + CARD_COUNT) % CARD_COUNT, -1);
  });
}

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
  if (flippedCards.has(cardIdx)) {
    flippedCards.delete(cardIdx);
    card.classList.remove("flipped");
    card.classList.remove("drag-flip");
  } else {
    flippedCards.add(cardIdx);
    card.classList.add("flipped");
    card.classList.remove("drag-flip");
  }
}

function initFlipCorners() {
  document.querySelectorAll(".flip-corner").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      flipCard(parseInt(btn.dataset.card));
    });
  });
}

function initCardTitleShortcuts() {
  function openSettingsForCard(cardIdx) {
    if (activeCard === cardIdx) {
      // Already on this card — toggle the flip with animation
      flipCard(cardIdx);
      return;
    }
    // Navigating to a different card — pre-set to settings side with no transition
    // so it arrives already showing settings when the deck slides it in.
    const card = document.querySelector(`.card[data-card="${cardIdx}"]`);
    if (card && !flippedCards.has(cardIdx)) {
      const flipper = card.querySelector(".card-flipper");
      flipper.style.transition = "none";
      flippedCards.add(cardIdx);
      card.classList.add("flipped");
      card.classList.remove("drag-flip", "flipping");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => { flipper.style.transition = ""; })
      );
    }
    goTo(cardIdx);
  }

  // Right-click bottom nav button
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 2) return;
    const btn = e.target.closest(".bnav");
    if (!btn) return;
    e.preventDefault();
    openSettingsForCard(parseInt(btn.dataset.i));
  }, true);

  // Suppress the context menu on nav buttons
  document.addEventListener("contextmenu", (e) => {
    if (!e.target.closest(".bnav")) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Long-press on mobile
  let longPressTimer = null;
  document.addEventListener("touchstart", (e) => {
    const btn = e.target.closest(".bnav");
    if (!btn) return;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      openSettingsForCard(parseInt(btn.dataset.i));
    }, 500);
  }, { passive: true });
  const cancelLongPress = () => { clearTimeout(longPressTimer); longPressTimer = null; };
  document.addEventListener("touchmove", cancelLongPress, { passive: true });
  document.addEventListener("touchend", cancelLongPress);
  document.addEventListener("touchcancel", cancelLongPress);
}

// Drag/swipe
let drag = null;

function onPointerDown(e) {
  const card = e.currentTarget;
  if (!card.classList.contains("depth-0")) return;
  if (e.target.closest(".flip-corner")) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  drag = {
    startX: clientX,
    startY: clientY,
    currentX: 0,
    velocityX: 0,
    lastX: clientX,
    lastT: Date.now(),
    moved: false,
  };
  card.classList.remove("animating");
}

function onPointerMove(e) {
  if (!drag) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - drag.startX,
    dy = clientY - drag.startY;
  if (!drag.moved && Math.abs(dy) > Math.abs(dx) + 6) {
    drag = null;
    return;
  }
  if (Math.abs(dx) > 4) drag.moved = true;
  if (!drag.moved) return;
  e.preventDefault();
  const now = Date.now(),
    dt = now - drag.lastT || 1;
  drag.velocityX = (clientX - drag.lastX) / dt;
  drag.lastX = clientX;
  drag.lastT = now;
  drag.currentX = dx;
  const topCard = cards()[deckOrder[0]];
  topCard.style.transform = `translate(${dx}px, 0px) rotate(${dx * 0.012}deg)`;
}

function onPointerUp() {
  if (!drag) return;
  const topCard = cards()[deckOrder[0]];
  const dx = drag.currentX,
    vel = drag.velocityX;

  topCard.classList.add("animating");

  const didSwipe = Math.abs(dx) > 80 || Math.abs(vel) > 0.4;
  if (didSwipe) {
    const exitX = dx > 0 ? "110vw" : "-110vw";
    const exitRot = dx > 0 ? "8deg" : "-8deg";
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
  cards().forEach((card) => {
    card.addEventListener("mousedown", onPointerDown);
    card.addEventListener("touchstart", onPointerDown, { passive: true });
  });
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("mouseup", onPointerUp);
  document.addEventListener("touchmove", onPointerMove, { passive: false });
  document.addEventListener("touchend", onPointerUp);
}

// ===================================================================
// INIT
// ===================================================================
function init() {
  initWorkers();
  loadState();

  const primeOnce = () => {
    primeAudioCtx();
    document.removeEventListener("pointerdown", primeOnce);
  };
  document.addEventListener("pointerdown", primeOnce);

  // Timer buttons - now global, work from any card
  document.querySelectorAll(".btn-start").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      startTimer();
    }),
  );
  document.querySelectorAll(".btn-pause").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      pauseTimer();
    }),
  );
  document.querySelectorAll(".btn-reset").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      resetTimer(true);
    }),
  );

  // Settings
  initSettings();

  // Inline task add
  initInlineTaskAdd();

  // Toggle done tasks
  document
    .getElementById("btn-toggle-done-tasks")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      const hasDone = state.workCells.some(c => c.count > 0);
      if (!hasDone && !state.showDoneTasks) return;
      state.showDoneTasks = !state.showDoneTasks;
      saveState();
      renderWorkTaskList();
    });

  // Focus mode
  document.getElementById("btn-exit-focus")?.addEventListener("click", (e) => {
    e.stopPropagation();
    exitFocusMode();
  });
  document
    .getElementById("btn-complete-focus-task")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      completeCurrentFocusTask();
    });

  // Break tab buttons
  document.querySelectorAll(".break-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.activeBreakTab = btn.dataset.tab;
      saveState();
      renderBreakGrid();
    });
  });

  // Break edit button (edits active tab)
  document
    .getElementById("btn-edit-break-tab")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      openCustomizeModal(false);
    });

  // Customize modal (break only now)
  document
    .getElementById("btn-customize-cancel")
    ?.addEventListener("click", closeCustomizeModal);
  document
    .getElementById("btn-customize-save")
    ?.addEventListener("click", saveCustomize);
  document
    .getElementById("btn-customize-defaults")
    ?.addEventListener("click", loadDefaultsIntoModal);
  document.getElementById("customize-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("customize-modal"))
      closeCustomizeModal();
  });

  // Bingo modal
  document.getElementById("btn-close-modal")?.addEventListener("click", () => {
    document.getElementById("bingo-modal").classList.add("hidden");
  });

  // Phase modal
  document
    .getElementById("btn-close-phase-modal")
    ?.addEventListener("click", () => {
      document.getElementById("phase-modal").classList.add("hidden");
    });

  // Genre buttons
  document.querySelectorAll(".genre-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchGenre(btn.dataset.genre));
  });

  // Player control buttons
  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  const btnNextTrack = document.getElementById("btn-next-track");

  if (btnPlay) {
    btnPlay.addEventListener("click", playMusic);
  }
  if (btnPause) {
    btnPause.addEventListener("click", stopMusicPlayback);
  }
  if (btnNextTrack) {
    btnNextTrack.addEventListener("click", skipToNextTrack);
  }

  // Initialize play/pause button states
  updatePlayPauseButtons();

  // Deck engine
  layoutDeck(false);
  initBottomNav();
  initKeyboard();
  initCardClicks();
  initFlipCorners();
  initCardTitleShortcuts();
  initDrag();

  // Apply saved genre theme
  applyGenreTheme(state.activeGenre);
  updateGenreButtons();

  // Initial renders
  updateTimerUI();
  updatePomoCount();
  updateBreakCount();
  updateScoreUI();
  renderBreakGrid();
  renderWorkTaskList();

  // Restore focus mode if was active
  if (
    state.focusedTaskIndex >= 0 &&
    state.workCells[state.focusedTaskIndex]?.count === 0
  ) {
    enterFocusMode(state.focusedTaskIndex);
  } else {
    state.focusedTaskIndex = -1;
  }
}

document.addEventListener("DOMContentLoaded", init);

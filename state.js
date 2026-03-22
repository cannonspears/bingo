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
  breakTabNames: { all: "Custom", body: "Body", mind: "Mind", home: "Home" },

  // Work focus mode
  focusedTaskIndex: -1,
  showDoneTasks: false,
  taskSortDir: null,
  longBreak: true,

  bingoAcknowledged: false,
  workBingoAcknowledged: false,

  tickingEnabled: false,

  // 7-day history [{date, work, brk, sessions}] — most recent last
  scoreHistory: [],
  sessionsToday: [],
  activePtsTab: "today",
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
  activeVideoIdx: 0,
  musicPlaying: false,

  // Custom timer settings (in minutes)
  customWorkMinutes: null,
  customBreakMinutes: null,

  volMusic: 60,
  scoreWorkToday: 0,
  scoreBreakToday: 0,
  scoreBankedWorkToday: 0,
  scoreBankedBreakToday: 0,
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
  state.workCells = state.workCells.map((c) => ({
    text: c.text,
    count: typeof c.count === "number" ? c.count : (c.completed ? 1 : 0),
    difficulty: c.difficulty || "easy",
  }));

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
    state.scoreBankedWorkToday = 0;
    state.scoreBankedBreakToday = 0;
    state.scoreCurrentDate = todayStr;

    if (archivedDate) {
      state.scoreHistory.push({
        date: archivedDate,
        work: archivedWork,
        brk: archivedBrk,
        sessions: state.sessionsToday,
      });
      // Keep only last 7 days
      if (state.scoreHistory.length > 7)
        state.scoreHistory = state.scoreHistory.slice(-7);
    }
    state.sessionsToday = [];

    // Reset all break tabs
    TABS.forEach((tab) => {
      state.lineCompletions[tab] = {};
      state.blackoutCompletions[tab] = 0;
      state.breakTabs[tab] = state.breakTabs[tab].map((c) => ({
        ...c,
        count: 0,
      }));
    });

    // Remove completed work tasks, keep incomplete ones
    state.workCells = state.workCells.filter((c) => c.count < 1);

    state.bingoAcknowledged = false;
    state.workBingoAcknowledged = false;
    state.focusedTaskIndex = -1;
  } else {
    // Same-day: check for 4-hour lapse focus session reset
    const hoursInactive = state.lastActivityAt
      ? (Date.now() - state.lastActivityAt) / 3_600_000
      : Infinity;
    if (hoursInactive >= 4) {
      const sessionWork = state.scoreWorkToday - (state.scoreBankedWorkToday || 0);
      const sessionBrk  = state.scoreBreakToday - (state.scoreBankedBreakToday || 0);
      if (sessionWork > 0 || sessionBrk > 0 || state.pomoCount > 0 || state.breakCount > 0)
        state.sessionsToday.push({ work: sessionWork, brk: sessionBrk, pomos: state.pomoCount || 0, breaks: state.breakCount || 0 });

      state.scoreBankedWorkToday = state.scoreWorkToday;
      state.scoreBankedBreakToday = state.scoreBreakToday;

      // Reset grids (keep tiles, clear counts) and remove completed tasks
      TABS.forEach((tab) => {
        state.lineCompletions[tab] = {};
        state.blackoutCompletions[tab] = 0;
        state.breakTabs[tab] = state.breakTabs[tab].map((c) => ({ ...c, count: 0 }));
      });
      state.workCells = state.workCells.filter((c) => c.count < 1);
      state.bingoAcknowledged = false;
      state.workBingoAcknowledged = false;
      state.pomoCount = 0;
      state.breakCount = 0;
      state.focusedTaskIndex = -1;
      // Reset timer to work phase so the work card renders correctly on next load
      state.phase = "work";
      const workMins = (state.mode === "custom" && state.customWorkMinutes > 0)
        ? state.customWorkMinutes
        : (state.mode === "50/10" ? 50 : 25);
      state.timeLeft = workMins * 60;
      state.running = false;
      saveState();
    }
  }
}

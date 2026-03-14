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

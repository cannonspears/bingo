// ===== HELPERS =====
function localDateString(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== SCORING =====
// Work: 10 pts flat per task (one completion only).
// Break: each star click awards that star's number of pts (1st=1, 2nd=2, 3rd=3, 4th=4, 5th=5).
// Base is the cumulative triangular number so the delta equals the star number.
function basePointsForCell(count, isWork) {
  if (count < 1 || count > 5) return 0;
  if (isWork) return 10;
  return (count * (count + 1)) / 2; // 1, 3, 6, 10, 15
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

// ===== POINTS CARD RENDERING =====
function getTodaySessions() {
  const currentWork = state.scoreWorkToday - (state.scoreBankedWorkToday || 0);
  const currentBrk = state.scoreBreakToday - (state.scoreBankedBreakToday || 0);
  const current =
    currentWork > 0 || currentBrk > 0 || state.pomoCount > 0 || state.breakCount > 0
      ? [{ work: currentWork, brk: currentBrk, pomos: state.pomoCount || 0, breaks: state.breakCount || 0 }]
      : [];
  return [...(state.sessionsToday || []), ...current];
}

function getBestDay() {
  const todayEntry = {
    work: state.scoreWorkToday,
    brk: state.scoreBreakToday,
    sessions: getTodaySessions(),
  };
  return [...(state.scoreHistory || []), todayEntry].reduce(
    (best, d) => (d.work + d.brk > best.work + best.brk ? d : best),
    { work: 0, brk: 0, sessions: [] },
  );
}

function renderSessionList(id, sessions) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!sessions || !sessions.length) {
    el.innerHTML = `<div class="pts-sessions-empty">No sessions recorded</div>`;
    return;
  }
  el.innerHTML = sessions
    .map(
      (s, i) => {
        const countDetail = (s.pomos != null)
          ? `<div class="pts-session-counts">${s.pomos} focus · ${s.breaks} break</div>`
          : "";
        return `
    <div class="pts-session-row">
      <div>
        <div class="pts-session-label">Session ${i + 1}</div>
        ${countDetail}
        <div class="pts-session-detail">${s.work} pts (work) · ${s.brk} pts (break)</div>
      </div>
      <div class="pts-session-total">${s.work + s.brk} pts</div>
    </div>
  `;
      },
    )
    .join("");
}

function renderPtsCard() {
  // Sync active tab
  const active = state.activePtsTab || "today";
  document.querySelectorAll(".pts-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.ptsTab === active);
  });
  document.querySelectorAll(".pts-tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `pts-panel-${active}`;
  });

  // Today
  setEl("pts-work-today", state.scoreWorkToday);
  setEl("pts-break-today", state.scoreBreakToday);
  setEl("pts-total-today", totalToday());
  renderSessionList("pts-sessions-today", getTodaySessions());

  // Yesterday — prefer scoreHistory lookup so day-gap edge cases work correctly
  const ydayStr = localDateString(-1);
  const yday = (state.scoreHistory || []).find((h) => h.date === ydayStr);
  const ydayWork = yday?.work ?? 0;
  const ydayBrk = yday?.brk ?? 0;
  setEl("pts-work-yesterday", ydayWork);
  setEl("pts-break-yesterday", ydayBrk);
  setEl("pts-total-yesterday", ydayWork + ydayBrk);
  renderSessionList("pts-sessions-yesterday", yday?.sessions ?? []);

  // Last 7 Days
  renderHistoryChart();

  // Best Day
  const best = getBestDay();
  setEl("pts-work-best", best.work);
  setEl("pts-break-best", best.brk);
  setEl("pts-total-best", best.work + best.brk);
  renderSessionList("pts-sessions-best", best.sessions ?? []);
}

function updateScoreUI() {
  // Minimal inline score on Work card
  const workInline = document.getElementById("work-score-inline");
  const breakInline = document.getElementById("break-score-inline");
  if (workInline) workInline.textContent = state.scoreWorkToday;
  if (breakInline) breakInline.textContent = state.scoreBreakToday;

  renderPtsCard();
}

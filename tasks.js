// ===== DIFFICULTY HELPERS =====
function pointsForTask(cell) {
  const map = { easy: 5, medium: 10, hard: 15 };
  return map[cell.difficulty || "easy"];
}

// ===== RECURRING TASKS =====
// Streak displayed as 0 (without mutating stored state) once a day has been
// skipped — the chain only actually resets in state when the task is next completed.
function effectiveStreak(task) {
  const today = localDateString();
  const yesterday = localDateString(-1);
  if (task.lastCompletedDate === today || task.lastCompletedDate === yesterday) {
    return task.streak || 0;
  }
  return 0;
}

function completeRecurringTask(id) {
  const task = state.recurringTasks.find((t) => t.id === id);
  if (!task || task.lastCompletedDate === localDateString()) return;
  task.streak =
    effectiveStreak(task) + (task.lastCompletedDate === localDateString(-1) ? 1 : 0) || 1;
  task.lastCompletedDate = localDateString();
  const pts = pointsForTask(task);
  state.lastActivityAt = Date.now();
  window.cloudLogTask?.({
    text: task.text,
    difficulty: task.difficulty,
    points: pts,
    recurring: true,
  });
  addScore(pts, true);
  showScorePopup(`+${pts} pts ✓`);
  saveState();
  renderRecurringTaskList();
}

function undoRecurringTask(id) {
  const task = state.recurringTasks.find((t) => t.id === id);
  if (!task || task.lastCompletedDate !== localDateString()) return;
  task.streak = Math.max(0, task.streak - 1);
  task.lastCompletedDate = task.streak > 0 ? localDateString(-1) : null;
  recalculateScore();
  saveState();
  renderRecurringTaskList();
}

function renderRecurringTaskList() {
  const container = document.getElementById("work-recurring-list");
  if (!container) return;
  container.innerHTML = "";

  const today = localDateString();
  const active = state.recurringTasks.filter((t) => t.lastCompletedDate !== today);
  const done = state.recurringTasks.filter((t) => t.lastCompletedDate === today);

  const toggleBtn = document.getElementById("btn-toggle-done-recurring");
  const sectionLabel = document.getElementById("work-recurring-section-label");

  if (active.length === 0 && done.length === 0) {
    if (toggleBtn) {
      toggleBtn.style.opacity = "0.3";
      toggleBtn.disabled = true;
    }
    const sortBtnEarly = document.getElementById("btn-sort-recurring");
    if (sortBtnEarly) {
      sortBtnEarly.disabled = true;
      sortBtnEarly.style.opacity = "0.3";
    }
    if (sectionLabel) sectionLabel.style.display = "none";
    return;
  }

  // Update pinned section label
  if (sectionLabel) {
    if (state.showDoneRecurringTasks && done.length > 0) {
      sectionLabel.querySelector("span").textContent =
        `Completed (${done.length})`;
      sectionLabel.style.display = "flex";
    } else if (!state.showDoneRecurringTasks && active.length > 0) {
      sectionLabel.querySelector("span").textContent =
        `Incomplete (${active.length})`;
      sectionLabel.style.display = "flex";
    } else {
      sectionLabel.style.display = "none";
    }
  }

  active.forEach((task) => {
    const item = buildRecurringTaskItem(task, false);
    item.style.display = state.showDoneRecurringTasks ? "none" : "flex";
    container.appendChild(item);
  });

  done.forEach((task) => {
    const item = buildRecurringTaskItem(task, true);
    item.style.display = state.showDoneRecurringTasks ? "flex" : "none";
    item.dataset.isDone = "1";
    container.appendChild(item);
  });

  if (toggleBtn) {
    const hasDone = done.length > 0;
    const canToggle = hasDone || state.showDoneRecurringTasks;
    toggleBtn.disabled = !canToggle;
    toggleBtn.textContent = state.showDoneRecurringTasks ? "☐" : "☑";
    toggleBtn.style.opacity = canToggle ? "1" : "0.3";
    toggleBtn.style.color = state.showDoneRecurringTasks ? "var(--c-work)" : "";
    toggleBtn.style.borderColor = state.showDoneRecurringTasks ? "var(--c-work)" : "";
  }

  const sortBtn = document.getElementById("btn-sort-recurring");
  if (sortBtn) {
    const hasSortable = active.length > 1;
    sortBtn.textContent = state.recurringSortDir === "easy" ? "Sort △" : "Sort ▽";
    sortBtn.classList.toggle("active", state.recurringSortDir != null);
    sortBtn.disabled = !hasSortable;
    sortBtn.style.opacity = hasSortable ? "1" : "0.3";
  }
}

function buildRecurringTaskItem(task, isDone) {
  const item = document.createElement("div");
  item.className = "work-task-item" + (isDone ? " completed" : "");
  item.dataset.difficulty = task.difficulty || "easy";

  const icon = document.createElement("div");
  icon.className = "task-item-icon";
  icon.textContent = isDone ? "✓" : "";
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isDone) undoRecurringTask(task.id);
    else completeRecurringTask(task.id);
  });
  item.appendChild(icon);

  const text = document.createElement("span");
  text.className = "task-item-text";
  text.textContent = task.text || "Unnamed task";
  item.appendChild(text);

  const diffBadge = document.createElement("span");
  const diff = task.difficulty || "easy";
  diffBadge.className = `task-diff-badge task-diff-badge--${diff}`;
  const dotCount = { easy: 1, medium: 2, hard: 3 }[diff];
  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement("span");
    dot.className = "task-diff-dot";
    diffBadge.appendChild(dot);
  }
  if (!isDone) {
    diffBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      const order = ["easy", "medium", "hard"];
      task.difficulty = order[(order.indexOf(diff) + 1) % 3];
      saveState();
      renderRecurringTaskList();
    });
  }

  if (!isDone) {
    const hint = document.createElement("span");
    hint.className = "task-item-focus-hint";
    hint.textContent = "Focus →";
    item.appendChild(hint);
  }

  item.appendChild(diffBadge);

  if (!isDone) {
    item.addEventListener("click", () => enterRecurringFocusMode(task.id));

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = state.recurringTasks.indexOf(task);
      if (idx === -1) return;
      state.recurringTasks.splice(idx, 1);
      if (state.focusedRecurringId === task.id) exitFocusMode();
      recalculateScore();
      saveState();
      renderRecurringTaskList();
    });
  }

  return item;
}

function addRecurringTask(text) {
  const trimmed = text?.trim();
  if (!trimmed) return;
  state.recurringTasks.push({
    id: state.nextRecurringId++,
    text: trimmed,
    difficulty: "easy",
    lastCompletedDate: null,
    streak: 0,
  });
  saveState();
  renderRecurringTaskList();
}

// ===== WORK TASK LIST RENDERER =====
function renderWorkTaskList() {
  const container = document.getElementById("work-task-list");
  if (!container) return;
  container.innerHTML = "";

  const active = state.workCells.filter((c) => c.count === 0);
  const done = state.workCells.filter((c) => c.count > 0);

  const toggleBtn = document.getElementById("btn-toggle-done-tasks");
  const sectionLabel = document.getElementById("work-section-label");

  if (active.length === 0 && done.length === 0) {
    if (toggleBtn) {
      toggleBtn.style.opacity = "0.3";
      toggleBtn.disabled = true;
    }
    const sortBtnEarly = document.getElementById("btn-sort-tasks");
    if (sortBtnEarly) {
      sortBtnEarly.disabled = true;
      sortBtnEarly.style.opacity = "0.3";
    }
    if (sectionLabel) sectionLabel.style.display = "none";
    return;
  }

  // Update pinned section label
  if (sectionLabel) {
    if (state.showDoneTasks && done.length > 0) {
      sectionLabel.querySelector("span").textContent =
        `Completed (${done.length})`;
      sectionLabel.style.display = "flex";
    } else if (!state.showDoneTasks && active.length > 0) {
      sectionLabel.querySelector("span").textContent =
        `Incomplete (${active.length})`;
      sectionLabel.style.display = "flex";
    } else {
      sectionLabel.style.display = "none";
    }
  }

  // Active tasks — visible when not in "Show Done" mode
  active.forEach((cell) => {
    const idx = state.workCells.indexOf(cell);
    const item = buildTaskItem(cell, idx, false);
    item.style.display = state.showDoneTasks ? "none" : "flex";
    container.appendChild(item);
  });

  // Done tasks (hidden unless toggled)
  done.forEach((cell) => {
    const idx = state.workCells.indexOf(cell);
    const item = buildTaskItem(cell, idx, true);
    item.style.display = state.showDoneTasks ? "flex" : "none";
    item.dataset.isDone = "1";
    container.appendChild(item);
  });

  // Update toggle button
  if (toggleBtn) {
    const hasDone = done.length > 0;
    const canToggle = hasDone || state.showDoneTasks;
    toggleBtn.disabled = !canToggle;
    toggleBtn.textContent = state.showDoneTasks ? "☐" : "☑";
    toggleBtn.style.opacity = canToggle ? "1" : "0.3";
    toggleBtn.style.color = state.showDoneTasks ? "var(--c-work)" : "";
    toggleBtn.style.borderColor = state.showDoneTasks ? "var(--c-work)" : "";
  }

  // Update sort button label, active state, and disabled state
  const sortBtn = document.getElementById("btn-sort-tasks");
  if (sortBtn) {
    const hasSortable = active.length > 1;
    sortBtn.textContent = state.taskSortDir === "easy" ? "Sort △" : "Sort ▽";
    sortBtn.classList.toggle("active", state.taskSortDir != null);
    sortBtn.disabled = !hasSortable;
    sortBtn.style.opacity = hasSortable ? "1" : "0.3";
  }
}

function buildTaskItem(cell, idx, isDone) {
  const item = document.createElement("div");
  item.className = "work-task-item" + (isDone ? " completed" : "");
  item.dataset.index = idx;
  item.dataset.difficulty = cell.difficulty || "easy";

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
      const pts = pointsForTask(state.workCells[idx]);
      state.workCells[idx].count = 1;
      state.lastActivityAt = Date.now();
      window.cloudLogTask?.({ text: state.workCells[idx].text, difficulty: state.workCells[idx].difficulty, points: pts });
      addScore(pts, true);
      showScorePopup(`+${pts} pts ✓`);
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

  // Difficulty badge (shown for all tasks; non-interactive when done)
  const diffBadge = document.createElement("span");
  const diff = cell.difficulty || "easy";
  diffBadge.className = `task-diff-badge task-diff-badge--${diff}`;
  const dotCount = { easy: 1, medium: 2, hard: 3 }[diff];
  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement("span");
    dot.className = "task-diff-dot";
    diffBadge.appendChild(dot);
  }
  if (!isDone) {
    diffBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      const order = ["easy", "medium", "hard"];
      state.workCells[idx].difficulty = order[(order.indexOf(diff) + 1) % 3];
      saveState();
      renderWorkTaskList();
    });
  }
  if (!isDone) {
    // Focus hint
    const hint = document.createElement("span");
    hint.className = "task-item-focus-hint";
    hint.textContent = "Focus →";
    // Prevent clicking the hint from blurring (and thus exiting) an active edit
    hint.addEventListener("mousedown", (e) => {
      if (item.querySelector(".task-item-text-edit")) e.preventDefault();
    });
    item.appendChild(hint);
  }

  item.appendChild(diffBadge);

  if (!isDone) {
    item.addEventListener("click", () => {
      if (item.querySelector(".task-item-text-edit")) return;
      enterFocusMode(idx);
    });

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
  input.addEventListener("click", (e) => e.stopPropagation());

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
function setFocusStreakIndicator(streak) {
  const indicator = document.getElementById("focus-streak-indicator");
  const countEl = document.getElementById("focus-streak-count");
  if (!indicator) return;
  if (streak == null) {
    indicator.classList.add("hidden");
  } else {
    if (countEl) countEl.textContent = streak;
    indicator.classList.remove("hidden");
  }
}

function enterFocusMode(taskIdx) {
  state.focusedTaskIndex = taskIdx;
  state.focusedRecurringId = null;
  saveState();

  const task = state.workCells[taskIdx];
  const focusView = document.getElementById("work-focus-view");
  const listView = document.getElementById("work-tasklist-view");
  const focusName = document.getElementById("focus-task-name");

  if (focusName) focusName.textContent = task.text || "Unnamed task";
  const ptsLabel = document.getElementById("complete-pts-label");
  if (ptsLabel) ptsLabel.textContent = `+${pointsForTask(task)} pts`;
  setFocusStreakIndicator(null);
  if (listView) listView.classList.add("hidden");
  if (focusView) focusView.classList.remove("hidden");
}

function enterRecurringFocusMode(id) {
  const task = state.recurringTasks.find((t) => t.id === id);
  if (!task) return;
  state.focusedTaskIndex = -1;
  state.focusedRecurringId = id;
  saveState();

  const focusView = document.getElementById("work-focus-view");
  const recurringView = document.getElementById("work-recurring-view");
  const focusName = document.getElementById("focus-task-name");

  if (focusName) focusName.textContent = task.text || "Unnamed task";
  const ptsLabel = document.getElementById("complete-pts-label");
  if (ptsLabel) ptsLabel.textContent = `+${pointsForTask(task)} pts`;
  setFocusStreakIndicator(effectiveStreak(task));
  if (recurringView) recurringView.classList.add("hidden");
  if (focusView) focusView.classList.remove("hidden");
}

function exitFocusMode() {
  state.focusedTaskIndex = -1;
  state.focusedRecurringId = null;
  saveState();

  const focusView = document.getElementById("work-focus-view");
  const listView = document.getElementById("work-tasklist-view");
  const recurringView = document.getElementById("work-recurring-view");
  setFocusStreakIndicator(null);
  if (focusView) focusView.classList.add("hidden");
  if (state.workListView === "recurring") {
    if (recurringView) recurringView.classList.remove("hidden");
    renderRecurringTaskList();
  } else {
    if (listView) listView.classList.remove("hidden");
    renderWorkTaskList();
  }
}

function completeCurrentFocusTask() {
  if (state.focusedRecurringId != null) {
    completeRecurringTask(state.focusedRecurringId);
    exitFocusMode();
    return;
  }

  const idx = state.focusedTaskIndex;
  if (idx < 0 || idx >= state.workCells.length) return;
  const cell = state.workCells[idx];
  if (cell.count >= 1) return;

  const pts = pointsForTask(cell);
  cell.count = 1;
  window.cloudLogTask?.({ text: cell.text, difficulty: cell.difficulty, points: pts });
  addScore(pts, true);
  showScorePopup(`+${pts} pts ✓`);
  saveState();
  exitFocusMode();
}

function recalculateScore() {
  let workPts = 0,
    breakPts = 0;
  state.workCells.forEach((c) => {
    if (c.count >= 1) workPts += pointsForTask(c);
  });
  state.recurringTasks.forEach((t) => {
    if (t.lastCompletedDate === localDateString()) workPts += pointsForTask(t);
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
  state.scoreWorkToday = workPts + (state.scoreBankedWorkToday || 0);
  state.scoreBreakToday = breakPts + (state.scoreBankedBreakToday || 0);
  state.scoreWorkAllTime = Math.max(
    state.scoreWorkAllTimeBase || 0,
    state.scoreWorkToday,
  );
  state.scoreBreakAllTime = Math.max(
    state.scoreBreakAllTimeBase || 0,
    state.scoreBreakToday,
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
    state.workCells.unshift({ text, count: 0, difficulty: "easy" });
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

function initRecurringTaskAdd() {
  const input = document.getElementById("recurring-add-input");
  const btn = document.getElementById("recurring-add-btn");

  function addTask() {
    addRecurringTask(input?.value);
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

  input?.addEventListener("mousedown", (e) => e.stopPropagation());
  input?.addEventListener("touchstart", (e) => e.stopPropagation(), {
    passive: true,
  });
}

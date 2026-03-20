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

// Rebuild lineCompletions and blackoutCompletions for a tab from current cell state.
// Call this after decrementing cells so removed lines lose their stored bonus.
function syncLineCompletions(tabKey) {
  const tab = tabKey || state.activeBreakTab;
  const cells = state.breakTabs[tab];
  const newLineCompletions = {};
  for (const line of BREAK_LINES) {
    const isComplete = line.every((i) => cells[i].count >= 1);
    if (isComplete) {
      newLineCompletions[lineKey(line)] = Math.min(...line.map((i) => cells[i].count));
    }
  }
  state.lineCompletions[tab] = newLineCompletions;
  const allComplete = cells.every((c) => c.count >= 1);
  state.blackoutCompletions[tab] = allComplete ? Math.min(...cells.map((c) => c.count)) : 0;
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
        syncLineCompletions(state.activeBreakTab);
        renderBreakGrid();
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

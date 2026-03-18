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
    H = 130,
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

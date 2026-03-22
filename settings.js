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

  // Long Break toggle — synced between Work and Break cards
  const syncLongBreak = (enabled) => {
    state.longBreak = enabled;
    const workToggle = document.getElementById("toggle-longbreak-work");
    const breakToggle = document.getElementById("toggle-longbreak-break");
    const workDesc = document.getElementById("longbreak-desc-work");
    const breakDesc = document.getElementById("longbreak-desc-break");
    if (workToggle) workToggle.checked = enabled;
    if (breakToggle) breakToggle.checked = enabled;
    if (workDesc) workDesc.textContent = enabled ? "On" : "Off";
    if (breakDesc) breakDesc.textContent = enabled ? "On" : "Off";
    saveState();
  };

  const toggleLongBreakWork = document.getElementById("toggle-longbreak-work");
  const toggleLongBreakBreak = document.getElementById("toggle-longbreak-break");
  if (toggleLongBreakWork) {
    toggleLongBreakWork.addEventListener("change", () => syncLongBreak(toggleLongBreakWork.checked));
  }
  if (toggleLongBreakBreak) {
    toggleLongBreakBreak.addEventListener("change", () => syncLongBreak(toggleLongBreakBreak.checked));
  }
  syncLongBreak(state.longBreak);

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

// ===== CUSTOM STATION MODAL =====
function openCustomStationModal() {
  [0, 1, 2].forEach((i) => {
    const id = (state.customVideos || [])[i] || "";
    const input = document.getElementById(`custom-video-${i}`);
    const status = document.getElementById(`custom-status-${i}`);
    if (input) input.value = id;
    if (status) status.textContent = id ? `✓ ${id}` : "";
  });
  // Wire real-time status updates
  [0, 1, 2].forEach((i) => {
    const input = document.getElementById(`custom-video-${i}`);
    if (!input || input._customWired) return;
    input._customWired = true;
    input.addEventListener("input", (e) => {
      const id = extractYtId(e.target.value.trim());
      const status = document.getElementById(`custom-status-${i}`);
      if (status) status.textContent = id ? `✓ ${id}` : "";
    });
  });
  document.getElementById("custom-station-modal").classList.remove("hidden");
}

function closeCustomStationModal() {
  document.getElementById("custom-station-modal").classList.add("hidden");
}

function saveCustomStation() {
  const ids = [0, 1, 2].map((i) => {
    const raw = document.getElementById(`custom-video-${i}`)?.value.trim() || "";
    return extractYtId(raw);
  });
  state.customVideos = ids;
  saveState();
  closeCustomStationModal();
  if (state.activeGenre === "custom") {
    state.activeVideoIdx = 0;
    switchGenre("custom");
  } else if (ids.some(Boolean)) {
    switchGenre("custom");
  }
}

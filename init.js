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
      const hasDone = state.workCells.some((c) => c.count > 0);
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
      if (btn.classList.contains("pts-tab")) return; // handled separately
      state.activeBreakTab = btn.dataset.tab;
      saveState();
      renderBreakGrid();
    });
  });

  // Points tab buttons
  document.querySelectorAll(".pts-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.activePtsTab = btn.dataset.ptsTab;
      saveState();
      renderPtsCard();
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

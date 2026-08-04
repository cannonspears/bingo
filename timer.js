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
    addScore(25, true);
    const isLongBreak = state.longBreak && state.pomoCount % 4 === 0;
    state.phase = "break";
    state.timeLeft = breakMinutes() * (isLongBreak ? 3 : 1) * 60;
    updatePomoCount();
    sendNotification(
      "Work session done! ☕",
      isLongBreak
        ? `Long break! Enjoy your ${breakMinutes() * 3}-minute break.`
        : `Enjoy your ${breakMinutes()}-minute break.`,
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

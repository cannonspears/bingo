// ===== STATE =====
const DEFAULT_CELLS = [
  "20 pushups", "Make your bed", "5 min walk", "Drink water",
  "Stretch arms", "10 jumping jacks", "Tidy desk", "Deep breaths",
  "Text a friend", "Do the dishes", "10 squats", "Wipe counters",
  "Read a page", "Journal 1 min", "Cold water face", "Dance break"
];

let state = {
  mode: "25/5",
  phase: "work",
  timeLeft: 25 * 60,
  running: false,
  pomoCount: 0,
  cells: [],
  bingoAcknowledged: false,
  volMusic: 60,
  volSfx: 80,
  mutedMusic: false,
  mutedSfx: false,
  autoStart: false,
  notificationsEnabled: false,
  darkMode: false
};

let timerInterval = null;

// ===== LOCAL STORAGE =====
function saveState() {
  localStorage.setItem("bingoBreakState", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("bingoBreakState");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed, running: false };
      if (state.timeLeft <= 0) resetTimer(false);
    } catch (e) {
      console.warn("Could not parse saved state", e);
    }
  }
  if (!Array.isArray(state.cells) || state.cells.length !== 16) {
    state.cells = DEFAULT_CELLS.map(text => ({ text, completed: false }));
  }
}

// ===== AUDIO =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function sfxVolume() {
  return state.mutedSfx ? 0 : state.volSfx / 100;
}

function playStartClick() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.06);
  gain.gain.setValueAtTime(sfxVolume() * 0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

function playTimerDone() {
  const ctx = getAudioCtx();
  const vol = sfxVolume();
  if (vol === 0) return;

  const ringTimes = [0, 0.35, 0.70];
  ringTimes.forEach(offset => {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318, ctx.currentTime + offset);
    gain1.gain.setValueAtTime(vol * 0.6, ctx.currentTime + offset);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.5);
    osc1.start(ctx.currentTime + offset);
    osc1.stop(ctx.currentTime + offset + 0.55);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975, ctx.currentTime + offset);
    gain2.gain.setValueAtTime(vol * 0.3, ctx.currentTime + offset);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.4);
    osc2.start(ctx.currentTime + offset);
    osc2.stop(ctx.currentTime + offset + 0.45);
  });
}

// ===== BACKGROUND MUSIC =====
let MUSIC_FILES = [];   // populated from music/manifest.json at startup
let musicAudio = null;

async function loadMusicManifest() {
  try {
    const res = await fetch("music/manifest.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tracks = await res.json();
    if (Array.isArray(tracks) && tracks.length > 0) {
      MUSIC_FILES = tracks.map(t =>
        typeof t === "string"
          ? { file: `music/${t}`, title: t.replace(/\.mp3$/i, ""), artist: "", license: "", url: "" }
          : { ...t, file: `music/${t.file}` }
      );
    } else {
      console.warn("music/manifest.json is empty or invalid — no music will play.");
    }
  } catch (e) {
    console.warn("Could not load music/manifest.json — no background music will play.", e);
  }
}

function pickRandomTrack() {
  if (MUSIC_FILES.length === 0) return null;
  return MUSIC_FILES[Math.floor(Math.random() * MUSIC_FILES.length)];
}

function updateNowPlaying(track) {
  const npEl      = document.getElementById("now-playing");
  const npTrack   = document.getElementById("np-track");
  const npArtist  = document.getElementById("np-artist");
  const npUrl     = document.getElementById("np-url");
  const npLicense = document.getElementById("np-license");

  if (!track) {
    npEl.classList.add("hidden");
    return;
  }

  npTrack.textContent  = track.title  || "Unknown Track";
  npArtist.textContent = track.artist || "";

  if (track.url) {
    npUrl.href = track.url;
    npUrl.textContent = "↗ Source";
    npUrl.classList.remove("hidden");
  } else {
    npUrl.classList.add("hidden");
  }

  npLicense.textContent = track.license || "";
  npEl.classList.remove("hidden");
}

function startMusic() {
  stopMusic();
  const track = pickRandomTrack();
  if (!track) return;
  musicAudio = new Audio(track.file);
  musicAudio.loop = false;
  musicAudio.volume = 0; // start at 0 for fade-in
  musicAudio.onerror = () => { musicAudio = null; updateNowPlaying(null); };
  musicAudio.addEventListener("ended", () => {
    if (state.running && state.phase === "work") startMusic();
  });
  musicAudio.play().catch((e) => { console.warn("Music playback failed:", e); });
  updateNowPlaying(track);
  fadeInMusic();
}

function fadeInMusic() {
  if (!musicAudio) return;
  const targetVol = state.mutedMusic ? 0 : state.volMusic / 100;
  const steps = 25;
  const interval = 500 / steps;
  let step = 0;
  const fadeTimer = setInterval(() => {
    step++;
    if (!musicAudio) { clearInterval(fadeTimer); return; }
    musicAudio.volume = Math.min(targetVol, (step / steps) * targetVol);
    if (step >= steps) clearInterval(fadeTimer);
  }, interval);
}

function stopMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.src = "";
    musicAudio = null;
  }
  updateNowPlaying(null);
}

function applyMusicVolume() {
  if (musicAudio) {
    musicAudio.volume = state.mutedMusic ? 0 : state.volMusic / 100;
  }
}

// ===== NOTIFICATIONS =====
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      if (permission !== "granted") {
        state.notificationsEnabled = false;
        document.getElementById("toggle-notifs").checked = false;
        document.getElementById("notifs-desc").textContent = "Off";
        saveState();
      }
    });
  }
}

function sendNotification(title, body) {
  if (!state.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "" });
}

// ===== TIMER =====
function workMinutes() { return state.mode === "50/10" ? 50 : 25; }
function breakMinutes() { return state.mode === "50/10" ? 10 : 5; }

function startTimer() {
  if (state.running) return;
  state.running = true;
  playStartClick();
  if (state.phase === "work") startMusic();
  updateTimerUI();
  saveState();
  timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  clearInterval(timerInterval);
  timerInterval = null;
  stopMusic();
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
    updateTimerDisplay();
    if (state.timeLeft % 5 === 0) saveState();
  } else {
    phaseComplete();
  }
}

function phaseComplete() {
  stopMusic();
  pauseTimer();
  playTimerDone();

  if (state.phase === "work") {
    state.pomoCount++;
    state.phase = "break";
    state.timeLeft = breakMinutes() * 60;
    updatePomoCount();
    sendNotification("Work session done! ☕", `Enjoy your ${breakMinutes()}-minute break.`);
    showPhaseModal("☕", `Work session done! Enjoy your ${breakMinutes()}-minute break.`);
  } else {
    state.phase = "work";
    state.timeLeft = workMinutes() * 60;
    sendNotification("Break's over! 💪", "Time to focus.");
    showPhaseModal("💪", "Break's over! Ready to focus?");
  }

  updateTimerUI();
  saveState();

  // Auto-start next session if enabled
  if (state.autoStart) {
    setTimeout(() => {
      document.getElementById("phase-modal").classList.add("hidden");
      startTimer();
    }, 2000);
  }
}

function showPhaseModal(emoji, msg) {
  document.getElementById("phase-modal-emoji").textContent = emoji;
  document.getElementById("phase-modal-msg").textContent = msg;
  document.getElementById("phase-modal").classList.remove("hidden");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatTime(state.timeLeft);
}

function updateTimerUI() {
  const display = document.getElementById("timer-display");
  const phaseLabel = document.getElementById("phase-label");
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");
  const header = document.getElementById("main-header");

  display.textContent = formatTime(state.timeLeft);

  if (state.phase === "work") {
    phaseLabel.textContent = "Work Session";
    phaseLabel.className = "";
    display.className = state.running ? "running" : "";
    header.classList.toggle("header-work", state.running);
    header.classList.remove("header-break");
  } else {
    phaseLabel.textContent = "Break Time!";
    phaseLabel.className = "break-phase";
    display.className = state.running ? "running break-phase" : "break-phase";
    header.classList.toggle("header-break", state.running);
    header.classList.remove("header-work");
  }

  if (!state.running) {
    header.classList.remove("header-work", "header-break");
  }

  btnStart.disabled = state.running;
  btnPause.disabled = !state.running;
}

function updatePomoCount() {
  document.getElementById("pomo-number").textContent = state.pomoCount;
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
  document.getElementById("darkmode-desc").textContent = enabled ? "On" : "Off";
}

function initSettings() {
  // Flip card
  const flipCard = document.getElementById("timer-flip-card");
  document.getElementById("btn-open-settings").addEventListener("click", () => {
    syncFlipCardHeight();
    flipCard.classList.add("flipped");
  });
  document.getElementById("btn-close-settings").addEventListener("click", () => {
    flipCard.classList.remove("flipped");
    // After the flip-back animation completes, clear the forced height
    // so the card returns to its natural (front-face) height
    setTimeout(() => {
      document.querySelector(".flip-card-inner").style.height = "";
    }, 680); // matches transition duration (650ms + small buffer)
  });

  // Timer mode radios
  document.querySelectorAll("input[name='pomo-mode']").forEach(radio => {
    if (radio.value === state.mode) radio.checked = true;
    radio.addEventListener("change", (e) => {
      if (e.target.checked) applyMode(e.target.value);
    });
  });

  // Volume controls
  initVolumeControls();

  // Auto-start toggle
  const toggleAutostart = document.getElementById("toggle-autostart");
  toggleAutostart.checked = state.autoStart;
  document.getElementById("autostart-desc").textContent = state.autoStart ? "On" : "Off";
  toggleAutostart.addEventListener("change", () => {
    state.autoStart = toggleAutostart.checked;
    document.getElementById("autostart-desc").textContent = state.autoStart ? "On" : "Off";
    saveState();
  });

  // Notifications toggle
  const toggleNotifs = document.getElementById("toggle-notifs");
  toggleNotifs.checked = state.notificationsEnabled;
  document.getElementById("notifs-desc").textContent = state.notificationsEnabled ? "On" : "Off";
  toggleNotifs.addEventListener("change", () => {
    state.notificationsEnabled = toggleNotifs.checked;
    document.getElementById("notifs-desc").textContent = state.notificationsEnabled ? "On" : "Off";
    if (state.notificationsEnabled) requestNotificationPermission();
    saveState();
  });

  // Dark mode toggle
  const toggleDark = document.getElementById("toggle-darkmode");
  toggleDark.checked = state.darkMode;
  applyDarkMode(state.darkMode);
  toggleDark.addEventListener("change", () => {
    state.darkMode = toggleDark.checked;
    applyDarkMode(state.darkMode);
    saveState();
  });
}

function syncFlipCardHeight() {
  const front = document.querySelector(".flip-card-front");
  const back = document.querySelector(".flip-card-back");
  const inner = document.querySelector(".flip-card-inner");
  // Temporarily release the back's height constraint to measure its natural content height
  back.style.height = "auto";
  const frontH = front.scrollHeight;
  const backH = back.scrollHeight;
  // Restore back to fill the inner container
  back.style.height = "";
  inner.style.height = Math.max(frontH, backH) + "px";
}

function initVolumeControls() {
  const sliderMusic = document.getElementById("vol-music");
  const sliderSfx   = document.getElementById("vol-sfx");
  const valMusic    = document.getElementById("vol-music-val");
  const valSfx      = document.getElementById("vol-sfx-val");
  const btnMuteMusic = document.getElementById("btn-mute-music");
  const btnMuteSfx   = document.getElementById("btn-mute-sfx");

  sliderMusic.value = state.volMusic;
  valMusic.textContent = state.volMusic;
  sliderSfx.value = state.volSfx;
  valSfx.textContent = state.volSfx;
  updateMuteButton(btnMuteMusic, state.mutedMusic);
  updateMuteButton(btnMuteSfx, state.mutedSfx);

  sliderMusic.addEventListener("input", () => {
    state.volMusic = parseInt(sliderMusic.value);
    valMusic.textContent = state.volMusic;
    if (state.volMusic > 0) {
      state.mutedMusic = false;
      updateMuteButton(btnMuteMusic, false);
    }
    applyMusicVolume();
    saveState();
  });

  sliderSfx.addEventListener("input", () => {
    state.volSfx = parseInt(sliderSfx.value);
    valSfx.textContent = state.volSfx;
    if (state.volSfx > 0) {
      state.mutedSfx = false;
      updateMuteButton(btnMuteSfx, false);
    }
    saveState();
  });

  btnMuteMusic.addEventListener("click", () => {
    state.mutedMusic = !state.mutedMusic;
    updateMuteButton(btnMuteMusic, state.mutedMusic);
    applyMusicVolume();
    saveState();
  });

  btnMuteSfx.addEventListener("click", () => {
    state.mutedSfx = !state.mutedSfx;
    updateMuteButton(btnMuteSfx, state.mutedSfx);
    saveState();
  });
}

function updateMuteButton(btn, muted) {
  btn.textContent = muted ? "Off" : "On";
  btn.classList.toggle("muted", muted);
}

// ===== BINGO GRID =====
let dragSrcIndex = null;

function shuffleCells(cells) {
  const arr = [...cells];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderBingoGrid() {
  const grid = document.getElementById("bingo-grid");
  grid.innerHTML = "";

  state.cells.forEach((cell, i) => {
    const div = document.createElement("div");
    div.className = "bingo-cell" + (cell.completed ? " completed" : "");
    div.dataset.index = i;
    div.draggable = true;

    const span = document.createElement("span");
    span.className = "cell-text" + (cell.text ? "" : " placeholder");
    span.textContent = cell.text || "Click to add...";
    div.appendChild(span);

    div.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      toggleCell(i);
    });

    div.addEventListener("dblclick", (e) => {
      if (e.target.tagName === "INPUT") return;
      startEditing(div, i);
    });

    div.addEventListener("dragstart", onDragStart);
    div.addEventListener("dragover", onDragOver);
    div.addEventListener("dragleave", onDragLeave);
    div.addEventListener("drop", onDrop);
    div.addEventListener("dragend", onDragEnd);

    grid.appendChild(div);
  });
}

function startEditing(div, index) {
  const span = div.querySelector(".cell-text");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cell-edit";
  input.maxLength = 40;
  input.value = state.cells[index].text;
  input.placeholder = "Break idea...";

  div.replaceChild(input, span);
  input.focus();
  input.select();

  function finishEdit() {
    state.cells[index].text = input.value.trim();
    saveState();
    renderBingoGrid();
  }

  input.addEventListener("blur", finishEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") { input.value = state.cells[index].text; input.blur(); }
    e.stopPropagation();
  });
}

function toggleCell(index) {
  state.cells[index].completed = !state.cells[index].completed;
  state.bingoAcknowledged = false;
  saveState();
  renderBingoGrid();
  checkBingo();
}

function checkBingo() {
  if (state.bingoAcknowledged) return;
  const c = state.cells;
  const done = (i) => c[i].completed;

  for (let r = 0; r < 4; r++) {
    if ([0,1,2,3].every(col => done(r * 4 + col))) { showBingoModal(); return; }
  }
  for (let col = 0; col < 4; col++) {
    if ([0,1,2,3].every(r => done(r * 4 + col))) { showBingoModal(); return; }
  }
  if ([0,5,10,15].every(done)) { showBingoModal(); return; }
  if ([3,6,9,12].every(done))  { showBingoModal(); return; }
}

function showBingoModal() {
  state.bingoAcknowledged = true;
  document.getElementById("bingo-modal").classList.remove("hidden");
}

// ===== DRAG & DROP =====
function onDragStart(e) {
  dragSrcIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("drag-over");
}
function onDragLeave(e) { e.currentTarget.classList.remove("drag-over"); }
function onDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove("drag-over");
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
  const tmp = state.cells[dragSrcIndex];
  state.cells[dragSrcIndex] = state.cells[targetIndex];
  state.cells[targetIndex] = tmp;
  saveState();
  renderBingoGrid();
}
function onDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".bingo-cell").forEach(c => c.classList.remove("drag-over"));
  dragSrcIndex = null;
}

// ===== CUSTOMIZE MODAL =====
function openCustomizeModal() {
  const list = document.getElementById("customize-list");
  list.innerHTML = "";

  state.cells.forEach((cell, i) => {
    const row = document.createElement("div");
    row.className = "customize-row";

    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 50;
    input.placeholder = `Break idea ${i + 1}…`;
    input.value = cell.text;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const inputs = list.querySelectorAll("input");
        const next = inputs[i + 1];
        if (next) next.focus(); else document.getElementById("btn-customize-save").focus();
      }
    });

    row.appendChild(num);
    row.appendChild(input);
    list.appendChild(row);
  });

  document.getElementById("customize-modal").classList.remove("hidden");
  list.querySelectorAll("input")[0].focus();
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function saveCustomize() {
  const inputs = document.querySelectorAll("#customize-list input");
  const texts = Array.from(inputs).map(inp => inp.value.trim());
  const filled = texts.map((t, i) => t || DEFAULT_CELLS[i] || "");

  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filled[i], filled[j]] = [filled[j], filled[i]];
  }

  state.cells = filled.map(text => ({ text, completed: false }));
  state.bingoAcknowledged = false;
  saveState();
  renderBingoGrid();
  closeCustomizeModal();
}

function loadDefaultsIntoModal() {
  const inputs = document.querySelectorAll("#customize-list input");
  DEFAULT_CELLS.forEach((text, i) => { if (inputs[i]) inputs[i].value = text; });
}

// ===== INIT =====
async function init() {
  // Load music manifest first so tracks are ready when user hits Start
  await loadMusicManifest();

  loadState();

  // Timer buttons
  document.getElementById("btn-start").addEventListener("click", startTimer);
  document.getElementById("btn-pause").addEventListener("click", pauseTimer);
  document.getElementById("btn-reset").addEventListener("click", () => resetTimer(true));

  // Settings (includes flip card, all toggles, volume)
  initSettings();

  // Bingo reset & reshuffle
  document.getElementById("btn-reset-bingo").addEventListener("click", () => {
    if (confirm("Reset all marks and reshuffle the bingo card?")) {
      const texts = state.cells.map(c => c.text);
      const shuffled = shuffleCells(texts.map(text => ({ text, completed: false })));
      state.cells = shuffled;
      state.bingoAcknowledged = false;
      saveState();
      renderBingoGrid();
    }
  });

  // Customize modal
  document.getElementById("btn-open-customize").addEventListener("click", openCustomizeModal);
  document.getElementById("btn-customize-cancel").addEventListener("click", closeCustomizeModal);
  document.getElementById("btn-customize-save").addEventListener("click", saveCustomize);
  document.getElementById("btn-customize-defaults").addEventListener("click", loadDefaultsIntoModal);
  document.getElementById("customize-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("customize-modal")) closeCustomizeModal();
  });

  // Bingo modal
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("bingo-modal").classList.add("hidden");
  });

  // Phase complete modal
  document.getElementById("btn-close-phase-modal").addEventListener("click", () => {
    document.getElementById("phase-modal").classList.add("hidden");
  });

  updateTimerUI();
  updatePomoCount();
  renderBingoGrid();
}

document.addEventListener("DOMContentLoaded", init);

// ===== SOUND ENGINE =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
function primeAudioCtx() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();
}
async function ensureAudioCtxRunning() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}
function sfxVolume() {
  return state.mutedSfx ? 0 : state.volSfx / 100 || 0.8;
}
function theme() {
  return state.soundTheme || "chime";
}

function makeOsc(ctx, type, freq, startT, stopT, vol, freqEnd) {
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startT);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, stopT);
  gain.gain.setValueAtTime(vol, startT);
  gain.gain.exponentialRampToValueAtTime(0.001, stopT);
  osc.start(startT);
  osc.stop(stopT + 0.01);
}

function chimeStart(ctx, vol, t) {
  makeOsc(ctx, "sine", 880, t, t + 0.12, vol * 0.4, 440);
}
function chimePause(ctx, vol, t) {
  makeOsc(ctx, "sine", 660, t, t + 0.18, vol * 0.35, 440);
  makeOsc(ctx, "sine", 440, t + 0.14, t + 0.32, vol * 0.25, 330);
}
function chimeDone(ctx, vol, t) {
  [0, 0.35, 0.7].forEach((o) => {
    makeOsc(ctx, "sine", 1318, t + o, t + o + 0.5, vol * 0.6);
    makeOsc(ctx, "sine", 1975, t + o, t + o + 0.4, vol * 0.3);
  });
}
function bellStart(ctx, vol, t) {
  makeOsc(ctx, "triangle", 740, t, t + 0.55, vol * 0.5, 600);
}
function bellPause(ctx, vol, t) {
  makeOsc(ctx, "triangle", 600, t, t + 0.5, vol * 0.4, 500);
  makeOsc(ctx, "triangle", 500, t + 0.28, t + 0.75, vol * 0.25, 420);
}
function bellDone(ctx, vol, t) {
  makeOsc(ctx, "triangle", 523, t, t + 0.8, vol * 0.5, 440);
  makeOsc(ctx, "triangle", 659, t + 0.35, t + 1.1, vol * 0.5, 587);
  makeOsc(ctx, "triangle", 784, t + 0.7, t + 1.45, vol * 0.5, 698);
}

async function playStartClick() {
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume(),
    t = ctx.currentTime;
  theme() === "bell" ? bellStart(ctx, vol, t) : chimeStart(ctx, vol, t);
}
async function playPause() {
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume(),
    t = ctx.currentTime;
  theme() === "bell" ? bellPause(ctx, vol, t) : chimePause(ctx, vol, t);
}
async function playTimerDone() {
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume(),
    t = ctx.currentTime;
  theme() === "bell" ? bellDone(ctx, vol, t) : chimeDone(ctx, vol, t);
}

async function playTick() {
  if (state.mutedSfx || !state.tickingEnabled) return;
  const ctx = await ensureAudioCtxRunning(),
    vol = sfxVolume() * 0.25,
    t = ctx.currentTime;
  makeOsc(ctx, "square", 1200, t, t + 0.03, vol, 900);
}

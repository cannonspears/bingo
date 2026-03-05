// timeWorker.js — accurate wall-clock timer for Bingo Break
// Fires postMessage(gapSeconds) every ~1s, compensating for drift
let timer = null;
let startTS = Date.now();
let counted = 0;
let countMax = 0;

function initializeSeconds(seconds) {
  startTS = Date.now();
  counted = 0;
  countMax = seconds;
}

function calcGapSeconds() {
  const gapMsFromStart = Date.now() - startTS;
  const gapSecFromStart = Math.round(gapMsFromStart / 1000);
  const gapSecFromLast = gapSecFromStart - counted;
  counted += gapSecFromLast;
  const overSec = counted > countMax ? counted - countMax : 0;
  const gap = gapSecFromLast - overSec;
  return gap > 0 ? gap : 1;
}

self.addEventListener('message', (e) => {
  const msg = e.data;
  if (typeof msg === 'string') {
    if (msg.startsWith('start-timer_')) {
      clearInterval(timer);
      initializeSeconds(parseInt(msg.split('_')[1], 10));
      timer = setInterval(() => {
        postMessage(calcGapSeconds());
      }, 1000);
    } else if (msg.startsWith('change-timer_')) {
      initializeSeconds(parseInt(msg.split('_')[1], 10));
    } else if (msg === 'stop-timer') {
      clearInterval(timer);
      timer = null;
    }
  }
});

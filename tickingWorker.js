// tickingWorker.js — drives the ticking sound metronome for Bingo Break
let tickInterval = null;

self.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg === 'ticking-start') {
    clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      postMessage('tick');
    }, 1000);
  } else if (msg === 'ticking-stop') {
    clearInterval(tickInterval);
    tickInterval = null;
  }
});

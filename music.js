// ===== MUSIC ENGINE =====
let ytPlayer = null;
let ytPlayerReady = false;

function currentStation() {
  return STATIONS.find((s) => s.id === state.activeGenre) || STATIONS[0];
}

// Called automatically by YouTube IFrame API once script loads
function onYouTubeIframeAPIReady() {
  const station = currentStation();
  ytPlayer = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    videoId: station.videoId,
    playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady() {
  ytPlayerReady = true;
  ytPlayer.setVolume(state.volMusic ?? 60);
  updateNowPlaying();
  // Fire deferred autoplay if the timer started before the player was ready
  if (state.running && !state.musicPlaying) {
    if (state.phase === "work" && state.autoplayWork) startMusic();
    else if (state.phase === "break" && state.autoplayBreak) startMusic();
  }
}

function onPlayerStateChange(event) {
  const playing = event.data === YT.PlayerState.PLAYING;
  const paused = event.data === YT.PlayerState.PAUSED;
  if (playing) {
    // Unmute as soon as playback starts — the mute in startMusic() was only
    // needed to satisfy the browser's autoplay policy for the first play.
    ytPlayer.unMute();
    ytPlayer.setVolume(state.volMusic ?? 60);
    state.musicPlaying = true;
    updatePlayPauseButtons();
  } else if (paused) {
    state.musicPlaying = false;
    updatePlayPauseButtons();
  }
}

function updateNowPlaying() {
  const npEl = document.getElementById("now-playing");
  const npIcon = document.getElementById("np-icon");
  const npTrack = document.getElementById("np-track");
  if (!npEl) return;
  if (state.musicPlaying) {
    npEl.classList.remove("now-playing-idle");
    if (npIcon) npIcon.style.animation = "";
    if (npTrack) npTrack.textContent = `${currentStation().label} — Live`;
  } else {
    npEl.classList.add("now-playing-idle");
    if (npIcon) npIcon.style.animation = "none";
    if (npTrack) npTrack.textContent = `${currentStation().label}`;
  }
}

function startMusic() {
  if (!ytPlayer || !ytPlayerReady || typeof ytPlayer.playVideo !== "function")
    return;
  // Mute first so the browser allows playback without a prior iframe click
  // (muted autoplay is always permitted). onPlayerStateChange unmutes once playing.
  ytPlayer.mute();
  ytPlayer.setVolume(state.volMusic ?? 60);
  ytPlayer.playVideo();
}

function pauseMusic() {
  if (!ytPlayer || typeof ytPlayer.pauseVideo !== "function") return;
  ytPlayer.pauseVideo();
}

function stopMusicPlayback() {
  pauseMusic();
}

function playMusic() {
  startMusic();
}

function togglePlayPause() {
  if (state.musicPlaying) {
    pauseMusic();
  } else {
    startMusic();
  }
}

function skipToNextTrack() {
  const idx = STATIONS.findIndex((s) => s.id === state.activeGenre);
  const next = STATIONS[(idx + 1) % STATIONS.length];
  switchGenre(next.id);
}

function updatePlayPauseButtons() {
  const playBtn = document.getElementById("btn-play");
  const pauseBtn = document.getElementById("btn-pause");
  if (!playBtn || !pauseBtn) return;
  if (state.musicPlaying) {
    playBtn.disabled = true;
    playBtn.classList.add("player-btn-disabled");
    pauseBtn.disabled = false;
    pauseBtn.classList.remove("player-btn-disabled");
  } else {
    playBtn.disabled = false;
    playBtn.classList.remove("player-btn-disabled");
    pauseBtn.disabled = true;
    pauseBtn.classList.add("player-btn-disabled");
  }
  updateNowPlaying();
}

function applyMusicVolume() {
  if (ytPlayer && typeof ytPlayer.setVolume === "function")
    ytPlayer.setVolume(state.volMusic ?? 60);
}

function switchGenre(id) {
  const station = STATIONS.find((s) => s.id === id) || STATIONS[0];
  state.activeGenre = station.id;
  saveState();
  applyGenreTheme(station.id);
  updateGenreButtons();
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    if (state.musicPlaying) {
      ytPlayer.loadVideoById(station.videoId);
    } else {
      ytPlayer.cueVideoById(station.videoId);
    }
  }
  updateNowPlaying();
}

function applyGenreTheme(id) {
  const station = STATIONS.find((s) => s.id === id) || STATIONS[0];
  const card = document.querySelector(".card-audio");
  if (!card) return;
  card.style.setProperty("--genre-color", station.color);
  card.style.setProperty("--genre-bg", station.bg);
  document.documentElement.style.setProperty("--genre-color", station.color);
  document.documentElement.style.setProperty("--genre-bg", station.bg);
  const stripe = card.querySelector(".card-stripe-audio");
  if (stripe) stripe.style.background = station.color;
  const npIcon = document.getElementById("np-icon");
  if (npIcon) npIcon.style.color = station.color;
}

function updateGenreButtons() {
  document.querySelectorAll(".genre-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.genre === state.activeGenre);
  });
}

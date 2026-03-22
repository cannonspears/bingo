// ===== MUSIC ENGINE =====
let ytPlayer = null;
let ytPlayerReady = false;

function currentStation() {
  return STATIONS.find((s) => s.id === state.activeGenre) || STATIONS[0];
}

function currentVideoId() {
  const station = currentStation();
  const idx = state.activeVideoIdx ?? 0;
  return station.videos[idx] || station.videos[0];
}

// Called automatically by YouTube IFrame API once script loads
function onYouTubeIframeAPIReady() {
  const station = currentStation();
  ytPlayer = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    videoId: currentVideoId(),
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
  const ended = event.data === YT.PlayerState.ENDED;
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
  } else if (ended) {
    // Livestreams never fire ENDED; regular videos do — loop from the beginning
    ytPlayer.seekTo(0);
    ytPlayer.playVideo();
  }
}

function updateNowPlaying() {
  const npEl = document.getElementById("now-playing");
  const npIcon = document.getElementById("np-icon");
  const npTrack = document.getElementById("np-track");
  if (!npEl) return;
  const station = currentStation();
  const idx = (state.activeVideoIdx ?? 0) + 1;
  const total = station.videos.length;
  if (state.musicPlaying) {
    npEl.classList.remove("now-playing-idle");
    if (npIcon) npIcon.style.animation = "";
    if (npTrack) npTrack.textContent = `${station.label} — ${idx} / ${total}`;
  } else {
    npEl.classList.add("now-playing-idle");
    if (npIcon) npIcon.style.animation = "none";
    if (npTrack) npTrack.textContent = `${station.label} — ${idx} / ${total}`;
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
  const station = currentStation();
  const nextIdx = ((state.activeVideoIdx ?? 0) + 1) % station.videos.length;
  state.activeVideoIdx = nextIdx;
  saveState();
  const videoId = currentVideoId();
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    if (state.musicPlaying) {
      ytPlayer.loadVideoById(videoId);
    } else {
      ytPlayer.cueVideoById(videoId);
    }
  }
  updateNowPlaying();
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
  state.activeVideoIdx = 0;
  saveState();
  applyGenreTheme(station.id);
  updateGenreButtons();
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    const videoId = currentVideoId();
    if (state.musicPlaying) {
      ytPlayer.loadVideoById(videoId);
    } else {
      ytPlayer.cueVideoById(videoId);
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

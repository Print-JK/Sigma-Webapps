// --- Global State ---
let playlist = [];
let activePlaylist = [];
let playedTrackIndices = [];
let currentTrackIndex = -1;

let isShuffle = false;
let repeatMode = 0; // 0 = Off, 1 = Repeat All, 2 = Repeat One
let isClosed = false;

// Audio Context Nodes
const audio = document.getElementById('audioEngine');
let audioCtx, analyser, sourceNode, dataArray;
let bassFilter, midFilter, trebleFilter;
let visualizerMode = 'circular';
let currentAudioUrl = null;

// DOM Elements
const wrapper = document.getElementById('wrapper');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const overlay = document.getElementById('overlay');

const fileListContainer = document.getElementById('fileList');
const searchInput = document.getElementById('searchInput');
const playlistCountLabel = document.getElementById('playlistCountLabel');

const heroTitle = document.getElementById('heroTrackTitle');
const heroArtist = document.getElementById('heroTrackArtist');
const heroMeta = document.getElementById('heroTrackMeta');

const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');

const playPauseBtn = document.getElementById('playPauseBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');

const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

// --- Off-Canvas Sidebar Toggle ---
function toggleOffCanvas() {
  if (isClosed) {
    overlay.style.display = 'none';
    hamburgerBtn.classList.remove('is-open');
    hamburgerBtn.classList.add('is-closed');
    wrapper.classList.remove('toggled');
    isClosed = false;
  } else {
    overlay.style.display = 'block';
    hamburgerBtn.classList.remove('is-closed');
    hamburgerBtn.classList.add('is-open');
    wrapper.classList.add('toggled');
    isClosed = true;
  }
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  setupAudioEngine();
  setupMediaSession();
});

function setupAudioEngine() {
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', handleTrackEnded);

  const initContext = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      sourceNode = audioCtx.createMediaElementSource(audio);

      bassFilter = audioCtx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 250;

      midFilter = audioCtx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1500;
      midFilter.Q.value = 1;

      trebleFilter = audioCtx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 4000;

      sourceNode.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      drawVisualizer();
    }
  };

  audio.addEventListener('play', initContext, { once: true });
}

// --- File Handling & Loading ---
function handleFileSelect(event) {
  const files = Array.from(event.target.files).filter(file => file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a)$/i));
  if (!files.length) return;

  playlist = [...playlist, ...files];
  applyPlaylistFilter();

  if (currentTrackIndex === -1 && activePlaylist.length > 0) {
    playTrack(0, true);
  }
}

function clearPlaylist() {
  playlist = [];
  activePlaylist = [];
  playedTrackIndices = [];
  currentTrackIndex = -1;
  audio.pause();
  audio.src = '';
  
  heroTitle.textContent = 'No Track Selected';
  heroArtist.textContent = 'Select or upload audio files to start playback';
  heroMeta.textContent = '-';
  miniTitle.textContent = 'Not Playing';
  miniArtist.textContent = '-';
  playPauseBtn.textContent = '▶';
  
  renderPlaylistUI();
}

// --- Search & Sub-Playlist Logic ---
function handleSearch(event) {
  applyPlaylistFilter();
}

function applyPlaylistFilter() {
  const query = searchInput.value.trim().toLowerCase();
  
  if (!query) {
    activePlaylist = [...playlist];
  } else {
    activePlaylist = playlist.filter(file => file.name.toLowerCase().includes(query));
  }

  playedTrackIndices = [];
  if (currentTrackIndex !== -1 && currentTrackIndex < activePlaylist.length) {
    playedTrackIndices.push(currentTrackIndex);
  }

  playlistCountLabel.textContent = `Tracks (${activePlaylist.length})`;
  renderPlaylistUI();
}

function renderPlaylistUI() {
  fileListContainer.innerHTML = '';

  if (activePlaylist.length === 0) {
    fileListContainer.innerHTML = '<div class="empty-state">No matching tracks found.</div>';
    return;
  }

  activePlaylist.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = `file-row ${idx === currentTrackIndex ? 'active' : ''}`;
    row.onclick = () => {
      playTrack(idx, true);
      if (window.innerWidth <= 768 && isClosed) {
        toggleOffCanvas(); // Close drawer on mobile after clicking
      }
    };

    row.innerHTML = `
      <span>🎵</span>
      <span class="file-name" title="${file.name}">${file.name}</span>
    `;
    fileListContainer.appendChild(row);
  });
}

// --- Playback Engine ---
function playTrack(index, isManualSelection = false) {
  if (index < 0 || index >= activePlaylist.length) return;

  if (isManualSelection) {
    playedTrackIndices = [];
  }

  currentTrackIndex = index;
  if (!playedTrackIndices.includes(index)) {
    playedTrackIndices.push(index);
  }

  const file = activePlaylist[currentTrackIndex];
  if (currentAudioUrl) {
    try { URL.revokeObjectURL(currentAudioUrl); } catch (_) {}
  }
  currentAudioUrl = URL.createObjectURL(file);
  audio.src = currentAudioUrl;
  audio.play();

  const parsedName = parseTrackName(file.name);
  heroTitle.textContent = parsedName.title;
  heroArtist.textContent = parsedName.artist;
  heroMeta.textContent = `${formatBytes(file.size)} • ${file.type || 'audio/mp3'}`;

  miniTitle.textContent = parsedName.title;
  miniArtist.textContent = parsedName.artist;

  playPauseBtn.textContent = '⏸';

  renderPlaylistUI();
  updateMediaSessionMetadata(parsedName.title, parsedName.artist);
}

function togglePlayPause() {
  if (currentTrackIndex === -1) {
    if (activePlaylist.length > 0) playTrack(0, true);
    return;
  }

  if (audio.paused) {
    audio.play();
    playPauseBtn.textContent = '⏸';
  } else {
    audio.pause();
    playPauseBtn.textContent = '▶';
  }
}

function playNextTrack() {
  if (activePlaylist.length === 0) return;

  if (isShuffle) {
    if (playedTrackIndices.length >= activePlaylist.length) {
      if (repeatMode === 1) {
        playedTrackIndices = [];
      } else if (repeatMode === 0) {
        audio.pause();
        playPauseBtn.textContent = '▶';
        return;
      }
    }

    const unplayedIndices = activePlaylist
      .map((_, idx) => idx)
      .filter(idx => !playedTrackIndices.includes(idx));

    if (unplayedIndices.length > 0) {
      const randomIndex = unplayedIndices[Math.floor(Math.random() * unplayedIndices.length)];
      playTrack(randomIndex);
    } else if (repeatMode === 1) {
      playedTrackIndices = [];
      const randomIndex = Math.floor(Math.random() * activePlaylist.length);
      playTrack(randomIndex);
    }
  } else {
    if (currentTrackIndex < activePlaylist.length - 1) {
      playTrack(currentTrackIndex + 1);
    } else if (repeatMode === 1) {
      playTrack(0);
    } else {
      audio.pause();
      playPauseBtn.textContent = '▶';
    }
  }
}

function playPreviousTrack() {
  if (activePlaylist.length === 0) return;

  const prevIdx = (currentTrackIndex - 1 + activePlaylist.length) % activePlaylist.length;
  playTrack(prevIdx);
}

function handleTrackEnded() {
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNextTrack();
  }
}

// --- Toggle Controls ---
function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
  shuffleBtn.title = isShuffle ? "Shuffle: ON" : "Shuffle: OFF";
  
  playedTrackIndices = [];
  if (currentTrackIndex !== -1) playedTrackIndices.push(currentTrackIndex);
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;

  if (repeatMode === 0) {
    repeatBtn.classList.remove('active');
    repeatBtn.innerText = '🔁';
    repeatBtn.title = "Repeat: OFF";
  } else if (repeatMode === 1) {
    repeatBtn.classList.add('active');
    repeatBtn.innerText = '🔁';
    repeatBtn.title = "Repeat: ALL";
  } else if (repeatMode === 2) {
    repeatBtn.classList.add('active');
    repeatBtn.innerText = '🔂';
    repeatBtn.title = "Repeat: ONE";
  }
}

// --- Controls & Helpers ---
function updateProgress() {
  if (isNaN(audio.duration)) return;
  const percent = (audio.currentTime / audio.duration) * 100;
  progressBar.value = percent;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationTimeEl.textContent = formatTime(audio.duration);
}

function seekAudio(event) {
  if (isNaN(audio.duration)) return;
  const seekTime = (event.target.value / 100) * audio.duration;
  audio.currentTime = seekTime;
}

function adjustVolume(event) {
  audio.volume = event.target.value / 100;
}

function toggleMute() {
  audio.muted = !audio.muted;
  document.getElementById('muteBtn').textContent = audio.muted ? '🔇' : '🔊';
}

function parseTrackName(fileName) {
  const cleanName = fileName.replace(/\.[^/.]+$/, "");
  const parts = cleanName.split(' - ');
  if (parts.length > 1) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: 'Local Artist', title: cleanName };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Drag & Drop ---
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a)$/i));
    if (files.length) {
      playlist = [...playlist, ...files];
      applyPlaylistFilter();
      if (currentTrackIndex === -1 && activePlaylist.length > 0) {
        playTrack(0, true);
      }
    }
  });
}

// --- Mobile Lockscreen Playback ---
function setupMediaSession() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
  }
}

function updateMediaSessionMetadata(title, artist) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist,
      album: 'SpotiLocal Offline Queue',
      artwork: [
        { src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24" fill="%233b82f6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"/></svg>', sizes: '512x512', type: 'image/svg+xml' }
      ]
    });
  }
}

// --- EQ & Visualizer Handlers ---
function changeEQ(event) {
  const mode = event.target.value;
  const eqBadge = document.getElementById('eqBadge');
  if (eqBadge) eqBadge.innerText = `${mode.toUpperCase()} EQ`;

  if (!bassFilter || !trebleFilter || !midFilter) return;

  switch (mode) {
    case 'bass':
      bassFilter.gain.value = 7;
      midFilter.gain.value = -1;
      trebleFilter.gain.value = -2;
      break;
    case 'treble':
      bassFilter.gain.value = -3;
      midFilter.gain.value = 1;
      trebleFilter.gain.value = 6;
      break;
    case 'vocal':
      bassFilter.gain.value = -2;
      midFilter.gain.value = 5;
      trebleFilter.gain.value = 2;
      break;
    default: // flat
      bassFilter.gain.value = 0;
      midFilter.gain.value = 0;
      trebleFilter.gain.value = 0;
  }
}

function changeVisualizer(event) {
  visualizerMode = event.target.value;
}

// --- Multi-Mode Visualizer ---
function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  if (!analyser) return;

  const canvas = document.getElementById('visualizerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (visualizerMode === 'circular') {
    // Circular wave around album art with warm golden amber glow
    const radius = 90;
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';

    for (let i = 0; i < dataArray.length; i++) {
      const angle = (i / dataArray.length) * Math.PI * 2;
      const amplitude = (dataArray[i] / 255) * 45;
      const r = radius + amplitude;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (visualizerMode === 'pulse') {
    // Ambient breathing pulse
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = sum / dataArray.length;
    const pulseR = 80 + (avg / 255) * 60;

    const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, pulseR);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
    grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Frequency Bars with luxury gradient
    const barWidth = (canvas.width / dataArray.length) * 1.8;
    let x = (canvas.width - dataArray.length * barWidth) / 2;

    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height * 0.65;
      const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
      grad.addColorStop(0, '#059669');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  }
}
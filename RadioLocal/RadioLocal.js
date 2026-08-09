// --- Global State ---
let playlist = [];            // Full list of loaded File objects
let activePlaylist = [];      // Filtered sub-playlist based on search term
let playedTrackIndices = [];  // History tracking played indices to avoid duplicates in shuffle
let currentTrackIndex = -1;

let isShuffle = false;
let repeatMode = 0;           // 0 = Off, 1 = Repeat All, 2 = Repeat One

// Audio Context & Visualizer Nodes
const audio = document.getElementById('audioEngine');
let audioCtx, analyser, sourceNode, dataArray;

// DOM Elements
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
      analyser.fftSize = 64;
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyser);
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

// --- Search & Filter Sub-Playlist Logic ---
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

  // Reset played tracks tracker when filter changes
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
    row.onclick = () => playTrack(idx, true); // Manual selection resets tracking

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

  // Manual track pick resets shuffle history
  if (isManualSelection) {
    playedTrackIndices = [];
  }

  currentTrackIndex = index;
  if (!playedTrackIndices.includes(index)) {
    playedTrackIndices.push(index);
  }

  const file = activePlaylist[currentTrackIndex];
  const objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
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
    // Check if all tracks in active filtered playlist have already been played once
    if (playedTrackIndices.length >= activePlaylist.length) {
      if (repeatMode === 1) { // Repeat All: Reset shuffle history and restart
        playedTrackIndices = [];
      } else if (repeatMode === 0) { // Repeat Off: Stop playback when playlist ends
        audio.pause();
        playPauseBtn.textContent = '▶';
        return;
      }
    }

    // Pick a random unplayed track from the active playlist
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
    // Linear playback
    if (currentTrackIndex < activePlaylist.length - 1) {
      playTrack(currentTrackIndex + 1);
    } else if (repeatMode === 1) {
      playTrack(0); // Loop back to start
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
  if (repeatMode === 2) { // Repeat Single Track
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
  shuffleBtn.title = isShuffle 
    ? "Shuffle: ON (No duplicate track plays)" 
    : "Shuffle: OFF";
  
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

// --- Controls & Timeline Helpers ---
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

// --- Mobile Lockscreen Background Playback ---
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

// --- Real-time Visualizer Canvas ---
function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  if (!analyser) return;

  const canvas = document.getElementById('visualizerCanvas');
  const ctx = canvas.getContext('2d');
  
  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / dataArray.length) * 2;
  let barHeight;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    barHeight = (dataArray[i] / 255) * canvas.height * 0.7;

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

    x += barWidth;
  }
}
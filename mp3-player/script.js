// --- Global State ---
let playlist = [];            // Full list of loaded File objects
let activePlaylist = [];      // Filtered sub-playlist based on search term
let currentTrackIndex = -1;
let isShuffle = false;
let isRepeat = false;

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
const volumeBar = document.getElementById('volumeBar');

// --- Initialization & Event Listeners ---
window.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  setupAudioEngine();
  setupMediaSession();
});

// Setup Web Audio API Canvas Visualizer
function setupAudioEngine() {
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', handleTrackEnded);

  // Initialize Web Audio Context on first play interaction
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
    playTrack(0);
  }
}

function clearPlaylist() {
  playlist = [];
  activePlaylist = [];
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
    // Filter sub-playlist based on filename matching
    activePlaylist = playlist.filter(file => file.name.toLowerCase().includes(query));
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
    row.onclick = () => playTrack(idx);

    row.innerHTML = `
      <span>🎵</span>
      <span class="file-name" title="${file.name}">${file.name}</span>
    `;
    fileListContainer.appendChild(row);
  });
}

// --- Playback Engine & Logic ---
function playTrack(index) {
  if (index < 0 || index >= activePlaylist.length) return;

  currentTrackIndex = index;
  const file = activePlaylist[currentTrackIndex];
  
  const objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.play();

  // Update UI metadata
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
    if (activePlaylist.length > 0) playTrack(0);
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
    // Filter-aware Shuffle: Pick random index within active filtered sub-playlist
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * activePlaylist.length);
    } while (activePlaylist.length > 1 && randomIndex === currentTrackIndex);
    playTrack(randomIndex);
  } else {
    const nextIdx = (currentTrackIndex + 1) % activePlaylist.length;
    playTrack(nextIdx);
  }
}

function playPreviousTrack() {
  if (activePlaylist.length === 0) return;

  const prevIdx = (currentTrackIndex - 1 + activePlaylist.length) % activePlaylist.length;
  playTrack(prevIdx);
}

function handleTrackEnded() {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNextTrack();
  }
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle('active', isRepeat);
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

// Parse "Artist - Title.mp3" file name format automatically
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
        playTrack(0);
      }
    }
  });
}

// --- Mobile Lockscreen Background Playback (Media Session API) ---
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
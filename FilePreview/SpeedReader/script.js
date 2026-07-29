// Local PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '../../lib/pdf.worker.min.js';

const state = {
  pdfDoc: null,
  fullText: '',
  words: [],
  
  mode: 'rsvp', // 'rsvp' or 'scroll'
  wps: 6.0,     // Words Per Second
  lineDensity: 1.8,
  
  currentWordIndex: 0,
  isPlaying: false,
  animationFrameId: null,
  lastTimestamp: 0,
  
  timeAccumulator: 0,
  currentYOffset: 0
};

const elements = {
  wrapper: document.getElementById('wrapper'),
  overlay: document.getElementById('overlay'),
  hamburgerBtn: document.getElementById('hamburger-btn'),
  
  pdfInput: document.getElementById('pdf-input'),
  btnBrowse: document.getElementById('btn-browse'),
  rawTextInput: document.getElementById('raw-text-input'),
  btnLoadText: document.getElementById('btn-load-text'),
  
  activeSourceName: document.getElementById('active-source-name'),
  docMetaInfo: document.getElementById('doc-meta-info'),
  statusBar: document.getElementById('status-bar'),
  
  modeSelect: document.getElementById('mode-select'),
  rsvpDisplay: document.getElementById('rsvp-display'),
  rsvpWordBox: document.getElementById('rsvp-word-box'),
  rsvpSpeedBadge: document.getElementById('rsvp-speed-badge'),
  readerViewport: document.getElementById('reader-viewport'),
  readerStream: document.getElementById('reader-stream'),
  
  wpsInput: document.getElementById('wps-input'),
  wpsSlider: document.getElementById('wps-slider'),
  wpmDisplay: document.getElementById('wpm-display'),
  densityInput: document.getElementById('density-input'),
  densitySlider: document.getElementById('density-slider'),
  densityControlGroup: document.getElementById('density-control-group'),
  
  btnTogglePlay: document.getElementById('btn-toggle-play'),
  btnReset: document.getElementById('btn-reset')
};

function init() {
  setupSidebarToggle();
  setupEventListeners();
  updateWPMDisplay();
}

// --- Off-Canvas Sidebar Logic ---
function setupSidebarToggle() {
  let isClosed = true;

  function toggleSidebar() {
    if (isClosed) {
      elements.overlay.style.display = 'block';
      elements.hamburgerBtn.classList.remove('is-closed');
      elements.hamburgerBtn.classList.add('is-open');
      elements.wrapper.classList.add('toggled');
      isClosed = false;
    } else {
      elements.overlay.style.display = 'none';
      elements.hamburgerBtn.classList.remove('is-open');
      elements.hamburgerBtn.classList.add('is-closed');
      elements.wrapper.classList.remove('toggled');
      isClosed = true;
    }
  }

  elements.hamburgerBtn.addEventListener('click', toggleSidebar);
  elements.overlay.addEventListener('click', toggleSidebar);
}

function setupEventListeners() {
  // PDF File Upload
  elements.btnBrowse.addEventListener('click', () => elements.pdfInput.click());
  elements.pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processPDFFile(e.target.files[0]);
  });

  // Raw Text Load Button
  elements.btnLoadText.addEventListener('click', () => {
    const rawText = elements.rawTextInput.value.trim();
    if (!rawText) {
      alert('Please enter or paste text into the box.');
      return;
    }
    loadTextContent(rawText, 'Pasted Raw Text');
  });

  // Mode Select Toggle
  elements.modeSelect.addEventListener('change', (e) => {
    state.mode = e.target.value;
    if (state.mode === 'rsvp') {
      elements.rsvpDisplay.classList.remove('hidden');
      elements.readerViewport.classList.add('hidden');
      elements.densityControlGroup.classList.add('hidden');
    } else {
      elements.rsvpDisplay.classList.add('hidden');
      elements.readerViewport.classList.remove('hidden');
      elements.densityControlGroup.classList.remove('hidden');
    }
    resetReaderPosition();
  });

  // WPS Speed Controls
  elements.wpsInput.addEventListener('input', (e) => {
    state.wps = parseFloat(e.target.value) || 1;
    elements.wpsSlider.value = state.wps;
    updateWPMDisplay();
  });
  elements.wpsSlider.addEventListener('input', (e) => {
    state.wps = parseFloat(e.target.value) || 1;
    elements.wpsInput.value = state.wps;
    updateWPMDisplay();
  });

  // Line Density Controls
  elements.densityInput.addEventListener('input', (e) => {
    updateLineDensity(parseFloat(e.target.value) || 1.8);
  });
  elements.densitySlider.addEventListener('input', (e) => {
    updateLineDensity(parseFloat(e.target.value) || 1.8);
  });

  // Playback Controls
  elements.btnTogglePlay.addEventListener('click', togglePlay);
  elements.btnReset.addEventListener('click', resetReaderPosition);
}

function updateWPMDisplay() {
  const wpm = Math.round(state.wps * 60);
  elements.wpmDisplay.textContent = `${wpm} WPM`;
  elements.rsvpSpeedBadge.textContent = `${wpm} wpm`;
}

async function processPDFFile(file) {
  if (file.type !== 'application/pdf') {
    alert('Please upload a valid PDF document.');
    return;
  }

  elements.statusBar.textContent = 'Extracting PDF text...';

  try {
    const arrayBuffer = await file.arrayBuffer();
    state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let text = '';
    for (let i = 1; i <= state.pdfDoc.numPages; i++) {
      const page = await state.pdfDoc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + ' ';
    }

    loadTextContent(text, file.name);
  } catch (err) {
    console.error(err);
    elements.statusBar.textContent = 'Failed to extract text from PDF.';
  }
}

function loadTextContent(text, sourceLabel) {
  state.fullText = text.trim();
  state.words = state.fullText.split(/\s+/).filter(w => w.length > 0);

  elements.activeSourceName.textContent = sourceLabel;
  elements.docMetaInfo.textContent = `${state.words.length} words`;

  resetReaderPosition();
  elements.statusBar.textContent = 'Text loaded successfully. Ready to read.';
}

function updateLineDensity(density) {
  state.lineDensity = density;
  elements.densityInput.value = density;
  elements.densitySlider.value = density;
  
  const fontSizeRem = 1.4;
  const linePixelHeight = fontSizeRem * density * 16;
  elements.readerViewport.style.height = `${linePixelHeight * 4}px`;
  elements.readerStream.style.lineHeight = density;
}

function togglePlay() {
  if (state.isPlaying) pause();
  else start();
}

function start() {
  if (state.words.length === 0) return;
  state.isPlaying = true;
  elements.btnTogglePlay.textContent = 'Pause';
  state.lastTimestamp = performance.now();
  state.timeAccumulator = 0;
  state.animationFrameId = requestAnimationFrame(loop);
  elements.statusBar.textContent = 'Reading active...';
}

function pause() {
  state.isPlaying = false;
  elements.btnTogglePlay.textContent = 'Resume';
  if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
  elements.statusBar.textContent = 'Paused.';
}

function resetReaderPosition() {
  pause();
  elements.btnTogglePlay.textContent = 'Start Reader';
  state.currentWordIndex = 0;
  state.currentYOffset = 0;

  if (state.words.length > 0) {
    renderCurrentRSVPWord();
    elements.readerStream.innerHTML = `<p>${state.words.join(' ')}</p>`;
    elements.readerStream.style.transform = `translateY(0px)`;
  }
}

function getORPIndex(word) {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function renderCurrentRSVPWord() {
  const word = state.words[state.currentWordIndex] || '';
  if (!word) return;

  const orpIdx = getORPIndex(word);
  const left = word.substring(0, orpIdx);
  const focal = word.charAt(orpIdx);
  const right = word.substring(orpIdx + 1);

  elements.rsvpWordBox.innerHTML = `<span class="rsvp-part left-part">${left}</span><span class="rsvp-part focal-letter">${focal}</span><span class="rsvp-part right-part">${right}</span>`;

  // Dynamic measuring to center the ORP focal letter cleanly without gaps
  const leftSpan = elements.rsvpWordBox.querySelector('.left-part');
  const focalSpan = elements.rsvpWordBox.querySelector('.focal-letter');
  
  if (leftSpan && focalSpan) {
    const leftWidth = leftSpan.getBoundingClientRect().width;
    const focalWidth = focalSpan.getBoundingClientRect().width;
    
    // Shift left by prefix width + half focal character width
    const offset = leftWidth + (focalWidth / 2);
    elements.rsvpWordBox.style.transform = `translateX(-${offset}px)`;
  }
}

function loop(timestamp) {
  if (!state.isPlaying) return;

  const dt = (timestamp - state.lastTimestamp) / 1000;
  state.lastTimestamp = timestamp;

  if (state.mode === 'rsvp') {
    state.timeAccumulator += dt;
    const intervalSec = 1 / state.wps;

    if (state.timeAccumulator >= intervalSec) {
      state.timeAccumulator -= intervalSec;
      state.currentWordIndex++;

      if (state.currentWordIndex >= state.words.length) {
        pause();
        elements.statusBar.textContent = 'Reached end of text.';
        return;
      }
      renderCurrentRSVPWord();
    }
  } else {
    const fontSize = parseFloat(window.getComputedStyle(elements.readerStream).fontSize);
    const lineHeightPx = fontSize * state.lineDensity;
    const linesPerSec = state.wps / 10;
    const pixelsPerSec = linesPerSec * lineHeightPx;

    state.currentYOffset += pixelsPerSec * dt;
    elements.readerStream.style.transform = `translateY(-${state.currentYOffset}px)`;
  }

  state.animationFrameId = requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', init);
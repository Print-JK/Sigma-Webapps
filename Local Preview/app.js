// app.js

// State
let keyBytes = null; // Uint8Array
let zipFile = null;  // File selected (.zip for encrypt or .enc for decrypt)
let previewItems = []; // { type, url, text?, name }

// Elements
const btnGenKey = document.getElementById('btnGenKey');
const downloadKeyLink = document.getElementById('downloadKeyLink');
const keyDrop = document.getElementById('keyDrop');
const keyInput = document.getElementById('keyInput');
const keyStatus = document.getElementById('keyStatus');

const zipInput = document.getElementById('zipInput');
const zipStatus = document.getElementById('zipStatus');
const btnEncrypt = document.getElementById('btnEncrypt');
const btnDecrypt = document.getElementById('btnDecrypt');
const downloadResultLink = document.getElementById('downloadResultLink');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');

const previewArea = document.getElementById('previewArea');
const carouselControls = document.getElementById('carouselControls');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let carouselIndex = 0;

/* Utility */
function setProgress(pct, label) {
  const clamped = Math.max(0, Math.min(100, pct));
  progressBar.style.width = clamped + '%';
  progressLabel.textContent = label || '';
}
function resetProgress() { setProgress(0, 'Idle.'); }
function bytesToHex(uint8) {
  return Array.from(uint8).map(b => b.toString(16).padStart(2,'0')).join('');
}
function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i/2] = parseInt(hex.slice(i, i+2), 16);
  return arr;
}
function xorData(data, key) {
  const out = new Uint8Array(data.byteLength);
  const dv = new Uint8Array(data);
  for (let i = 0; i < dv.length; i++) out[i] = dv[i] ^ key[i % key.length];
  return out.buffer;
}
function blobDownload(blob, filename) {
  if (window.saveAs) {
    saveAs(blob, filename);
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

/* Key generation */
btnGenKey.addEventListener('click', () => {
  const size = 32; // 256-bit
  keyBytes = new Uint8Array(size);
  crypto.getRandomValues(keyBytes);
  const blob = new Blob([keyBytes], { type: 'application/octet-stream' });
  downloadKeyLink.classList.remove('hidden');
  downloadKeyLink.textContent = 'Download key.bin';
  downloadKeyLink.href = URL.createObjectURL(blob);
  downloadKeyLink.download = 'key.bin';
  keyStatus.textContent = `Key loaded (length: ${size} bytes).`;
});

/* Key upload via dropzone */
keyDrop.addEventListener('click', () => keyInput.click());
keyDrop.addEventListener('dragover', e => { e.preventDefault(); keyDrop.style.background = '#eef'; });
keyDrop.addEventListener('dragleave', () => { keyDrop.style.background = ''; });
keyDrop.addEventListener('drop', async e => {
  e.preventDefault();
  keyDrop.style.background = '';
  const file = e.dataTransfer.files?.[0];
  if (file) await loadKeyFile(file);
});
keyInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (file) await loadKeyFile(file);
});
async function loadKeyFile(file) {
  const buf = await file.arrayBuffer();
  keyBytes = new Uint8Array(buf);
  keyStatus.textContent = `Key loaded (${file.name}, ${keyBytes.length} bytes).`;
}

/* ZIP or ENC selection */
zipInput.addEventListener('change', e => {
  zipFile = e.target.files?.[0] || null;
  zipStatus.textContent = zipFile ? `Selected: ${zipFile.name} (${zipFile.type || 'binary'})` : 'No file selected.';
  clearPreview();
  resetProgress();
});

/* Encrypt */
btnEncrypt.addEventListener('click', async () => {
  clearPreview();
  if (!zipFile) return alert('Select a ZIP file to encrypt.');
  if (!keyBytes) return alert('Load or generate a key first.');
  if (!zipFile.name.endsWith('.zip')) return alert('Please select a .zip file for encryption.');

  setProgress(0, 'Reading ZIP…');
  const buf = await zipFile.arrayBuffer();

  // Simulate progress during XOR
  setProgress(10, 'Encrypting (XOR)…');
  const encBuf = await simulateChunkedXor(buf, keyBytes, pct => setProgress(pct, 'Encrypting (XOR)…'));

  const encBlob = new Blob([encBuf], { type: 'application/octet-stream' });
  const resultName = zipFile.name.replace(/\.zip$/i, '') + '.enc';
  downloadResultLink.classList.remove('hidden');
  downloadResultLink.textContent = `Download ${resultName}`;
  downloadResultLink.href = URL.createObjectURL(encBlob);
  downloadResultLink.download = resultName;

  setProgress(100, 'Encryption complete.');
});

/* Decrypt */
btnDecrypt.addEventListener('click', async () => {
  clearPreview();
  if (!zipFile) return alert('Select an encrypted file (.enc) or an encrypted ZIP.');
  if (!keyBytes) return alert('Load or generate a key first.');

  setProgress(0, 'Reading encrypted file…');
  const encBuf = await zipFile.arrayBuffer();

  setProgress(10, 'Decrypting (XOR)…');
  const decBuf = await simulateChunkedXor(encBuf, keyBytes, pct => setProgress(pct, 'Decrypting (XOR)…'));

  setProgress(60, 'Parsing ZIP…');
  try {
    const zip = await JSZip.loadAsync(decBuf);
    setProgress(75, 'Preparing previews…');
    await buildPreviewFromZip(zip);
    setProgress(100, 'Decryption complete.');
    // 🔽 NEW: create a downloadable decrypted ZIP
    const decBlob = new Blob([decBuf], { type: 'application/zip' });
    const resultName = zipFile.name.replace(/\.enc$/i, '') + '.zip';
    downloadResultLink.classList.remove('hidden');
    downloadResultLink.textContent = `Download ${resultName}`;
    downloadResultLink.href = URL.createObjectURL(decBlob);
    downloadResultLink.download = resultName;

    setProgress(100, 'Decryption complete.');
  } catch (err) {
    setProgress(0, 'Idle.');
    alert('Failed to parse ZIP. Key may be incorrect or file is not an encrypted ZIP.');
  }
});


/* Chunked XOR to show progress */
async function simulateChunkedXor(buffer, key, onProgress) {
  const CHUNK = 1024 * 256; // 256KB
  const input = new Uint8Array(buffer);
  const output = new Uint8Array(input.length);
  for (let offset = 0; offset < input.length; offset += CHUNK) {
    const end = Math.min(input.length, offset + CHUNK);
    for (let i = offset; i < end; i++) {
      output[i] = input[i] ^ key[i % key.length];
    }
    const pct = Math.round(10 + 70 * (end / input.length)); // 10→80 during XOR
    onProgress?.(pct);
    await new Promise(r => setTimeout(r)); // yield to UI
  }
  return output.buffer;
}

/* Preview building */
async function buildPreviewFromZip(zip) {
  previewItems = [];
  const files = Object.values(zip.files).filter(f => !f.dir);

  for (const f of files) {
    const ext = f.name.toLowerCase().split('.').pop();
    if (['jpg','jpeg','png','gif'].includes(ext)) {
      const blob = await f.async('blob');
      const url = URL.createObjectURL(blob);
      previewItems.push({ type: 'image', url, name: f.name });
    } else if (['mp4'].includes(ext)) {
      const blob = await f.async('blob');
      const url = URL.createObjectURL(blob);
      previewItems.push({ type: 'video', url, name: f.name });
    } else if (['txt'].includes(ext)) {
      const text = await f.async('string');
      previewItems.push({ type: 'text', text, name: f.name });
    } else if (['pdf'].includes(ext)) {
      const blob = await f.async('blob');
      const url = URL.createObjectURL(blob);
      previewItems.push({ type: 'pdf', url, name: f.name });
    }
  }

  renderPreview();
}

/* Preview rendering */
function clearPreview() {
  previewArea.innerHTML = '';
  previewItems = [];
  carouselIndex = 0;
  carouselControls.classList.add('hidden');
  downloadResultLink.classList.add('hidden');
}
function renderPreview() {
  previewArea.innerHTML = '';
  if (previewItems.length === 0) {
    previewArea.innerHTML = '<p>No previewable files found in the ZIP.</p>';
    return;
  }

  const images = previewItems.filter(p => p.type === 'image');
  const videos = previewItems.filter(p => p.type === 'video');
  const texts  = previewItems.filter(p => p.type === 'text');
  const pdfs   = previewItems.filter(p => p.type === 'pdf');

  // Images: carousel
  if (images.length) {
    const wrap = document.createElement('div');
    wrap.className = 'carousel';
    const img = document.createElement('img');
    img.alt = images[0].name;
    img.src = images[0].url;
    wrap.appendChild(img);
    previewArea.appendChild(wrap);

    carouselControls.classList.remove('hidden');
    carouselIndex = 0;

    prevBtn.onclick = () => {
      carouselIndex = (carouselIndex - 1 + images.length) % images.length;
      img.src = images[carouselIndex].url;
      img.alt = images[carouselIndex].name;
    };
    nextBtn.onclick = () => {
      carouselIndex = (carouselIndex + 1) % images.length;
      img.src = images[carouselIndex].url;
      img.alt = images[carouselIndex].name;
    };
  } else {
    carouselControls.classList.add('hidden');
  }

  // Videos
  for (const v of videos) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = v.url;
    video.style.display = 'block';
    video.style.marginTop = '12px';
    previewArea.appendChild(video);
  }

  // Texts
  for (const t of texts) {
    const title = document.createElement('strong');
    title.textContent = t.name;
    const p = document.createElement('p');
    p.textContent = t.text;
    previewArea.appendChild(title);
    previewArea.appendChild(p);
  }

  // PDFs
  for (const pfile of pdfs) {
    const title = document.createElement('div');
    const openLink = document.createElement('a');
    openLink.href = pfile.url;
    openLink.target = '_blank';
    openLink.textContent = `Open ${pfile.name} in new tab`;
    title.appendChild(openLink);
    const iframe = document.createElement('iframe');
    iframe.src = pfile.url;
    iframe.width = '100%';
    iframe.height = '500';
    iframe.style.marginTop = '8px';
    previewArea.appendChild(title);
    previewArea.appendChild(iframe);
  }
}

/* Accessibility & cleanup */
window.addEventListener('beforeunload', () => {
  // Revoke preview URLs
  for (const item of previewItems) {
    if (item.url) URL.revokeObjectURL(item.url);
  }
});

function renderPreview() {
  previewArea.innerHTML = '';
  if (previewItems.length === 0) {
    previewArea.innerHTML = '<p>No previewable files found in the ZIP.</p>';
    return;
  }

  const images = previewItems.filter(p => p.type === 'image');
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
  grid.style.gap = '8px';

  images.forEach((imgItem, idx) => {
    const thumb = document.createElement('img');
    thumb.src = imgItem.url;
    thumb.alt = imgItem.name;
    thumb.style.width = '100%';
    thumb.style.cursor = 'pointer';
    thumb.onclick = () => openImageModal(idx, images);
    grid.appendChild(thumb);
  });

  previewArea.appendChild(grid);
}

function openImageModal(startIndex, images) {
  let currentIndex = startIndex;

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.8)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  const img = document.createElement('img');
  img.src = images[currentIndex].url;
  img.style.maxWidth = '90%';
  img.style.maxHeight = '90%';
  modal.appendChild(img);

  // Navigation buttons
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev';
  prevBtn.style.position = 'absolute';
  prevBtn.style.left = '20px';
  prevBtn.style.top = '50%';
  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    img.src = images[currentIndex].url;
  };

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.style.position = 'absolute';
  nextBtn.style.right = '20px';
  nextBtn.style.top = '50%';
  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % images.length;
    img.src = images[currentIndex].url;
  };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '20px';
  closeBtn.style.right = '20px';
  closeBtn.onclick = () => modal.remove();

  modal.appendChild(prevBtn);
  modal.appendChild(nextBtn);
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);
}

function renderPreview() {
  previewArea.innerHTML = '';
  if (previewItems.length === 0) {
    previewArea.innerHTML = '<p>No previewable files found in the ZIP.</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
  grid.style.gap = '8px';

  previewItems.forEach((item, idx) => {
    const thumb = document.createElement('div');
    thumb.style.cursor = 'pointer';
    thumb.style.textAlign = 'center';

    if (item.type === 'image' || item.type === 'gif') {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name;
      img.style.width = '100%';
      thumb.appendChild(img);
    } else if (item.type === 'video') {
      thumb.textContent = '🎬 ' + item.name;
    } else if (item.type === 'text') {
      thumb.textContent = '📄 ' + item.name;
    } else if (item.type === 'pdf') {
      thumb.textContent = '📕 ' + item.name;
    }

    thumb.onclick = () => openModal(idx);
    grid.appendChild(thumb);
  });

  previewArea.appendChild(grid);
}

function openModal(startIndex) {
  let currentIndex = startIndex;

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.8)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  const content = document.createElement('div');
  modal.appendChild(content);

function renderFile(item) {
  content.innerHTML = '';

  if (item.type === 'video') {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';

    const video = document.createElement('video');
    video.src = item.url;
    video.className = 'video-player';
    video.preload = 'metadata';

    // --- Controls bar ---
    const controls = document.createElement('div');
    controls.className = 'video-controls';

    // Play/Pause
    const playBtn = document.createElement('button');
    playBtn.className = 'control-btn';
    playBtn.innerHTML = '▶️';
    playBtn.onclick = () => {
      if (video.paused) {
        video.play();
        playBtn.innerHTML = '⏸️';
      } else {
        video.pause();
        playBtn.innerHTML = '▶️';
      }
    };

    // Seek bar
    const seekBar = document.createElement('input');
    seekBar.type = 'range';
    seekBar.min = 0;
    seekBar.max = 100;
    seekBar.value = 0;
    seekBar.className = 'seek-bar';
    seekBar.oninput = () => {
      video.currentTime = (seekBar.value / 100) * video.duration;
    };
    video.addEventListener('timeupdate', () => {
      seekBar.value = (video.currentTime / video.duration) * 100;
    });

    // Volume
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = 0;
    volume.max = 1;
    volume.step = 0.05;
    volume.value = video.volume;
    volume.className = 'volume-bar';
    volume.oninput = () => { video.volume = volume.value;
      if (video.volume === 0) {
    muteBtn.innerHTML = '🔇';
  } else {
    muteBtn.innerHTML = video.muted ? '🔇' : '🔊';
  }
};

// Mute button
const muteBtn = document.createElement('button');
muteBtn.className = 'control-btn';
muteBtn.innerHTML = '🔊';
muteBtn.onclick = () => {
  video.muted = !video.muted;
  muteBtn.innerHTML = video.muted ? '🔇' : '🔊';
};

    // Speed selector
    const speedSelect = document.createElement('select');
    [0.5, 1, 1.5, 2].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `${s}x`;
      if (s === 1) opt.selected = true;
      speedSelect.appendChild(opt);
    });
    speedSelect.onchange = () => { video.playbackRate = parseFloat(speedSelect.value); };

    // Fullscreen
    const fsBtn = document.createElement('button');
    fsBtn.className = 'control-btn';
    fsBtn.innerHTML = '⛶';
    fsBtn.onclick = () => {
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    };

    controls.appendChild(playBtn);
    controls.appendChild(seekBar);
    controls.appendChild(muteBtn);
    controls.appendChild(volume);
    controls.appendChild(speedSelect);
    controls.appendChild(fsBtn);

    wrapper.appendChild(video);
    wrapper.appendChild(controls);
    content.appendChild(wrapper);

    // --- Click & hold for 2x speed (desktop + mobile) ---
    let holdTimer;
    const startBoost = () => { video.playbackRate = 2; };
    const stopBoost = () => { video.playbackRate = parseFloat(speedSelect.value); };

    // Desktop
    video.addEventListener('mousedown', startBoost);
    video.addEventListener('mouseup', stopBoost);
    video.addEventListener('mouseleave', stopBoost);

    // Mobile (touch)
    video.addEventListener('touchstart', startBoost);
    video.addEventListener('touchend', stopBoost);

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', e => {
      if (e.code === 'Space') {
        e.preventDefault();
        playBtn.click();
      } else if (e.code === 'ArrowRight') {
        video.currentTime += 5;
      } else if (e.code === 'ArrowLeft') {
        video.currentTime -= 5;
      } else if (e.key === 'f') {
        fsBtn.click();
      } else if (e.key === 'm') {
        video.muted = !video.muted;
      }
    });
  }


  // … keep your image/text/pdf handling as before …

  else if (item.type === 'image' || item.type === 'gif') {
    const img = document.createElement('img');
    img.src = item.url;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    content.appendChild(img);
  }

  else if (item.type === 'text') {
    // Instead of inline preview, open in new tab
    const link = document.createElement('a');
    const blob = new Blob([item.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.target = '_blank';
    link.textContent = `Open ${item.name} in new tab`;
    content.appendChild(link);
  }

  else if (item.type === 'pdf') {
    // Open PDF in new tab
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.textContent = `Open ${item.name} in new tab`;
    content.appendChild(link);
  }
}


  renderFile(previewItems[currentIndex]);

  // Navigation buttons
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev';
  prevBtn.style.position = 'absolute';
  prevBtn.style.left = '20px';
  prevBtn.style.top = '50%';
  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + previewItems.length) % previewItems.length;
    renderFile(previewItems[currentIndex]);
  };

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.style.position = 'absolute';
  nextBtn.style.right = '20px';
  nextBtn.style.top = '50%';
  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % previewItems.length;
    renderFile(previewItems[currentIndex]);
  };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '20px';
  closeBtn.style.right = '20px';
  closeBtn.onclick = () => modal.remove();

  modal.appendChild(prevBtn);
  modal.appendChild(nextBtn);
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);
}


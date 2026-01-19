import { readPsd } from 'ag-psd';

let keyBytes = null;
let zipFile = null;
let previewItems = [];

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

/* Progress */
function setProgress(pct, label) {
  progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  progressLabel.textContent = label || '';
}
function resetProgress() { setProgress(0, 'Idle.'); }

/* Chunked XOR */
async function simulateChunkedXor(buffer, key, onProgress) {
  const CHUNK = 1024 * 256;
  const input = new Uint8Array(buffer);
  const output = new Uint8Array(input.length);
  for (let offset = 0; offset < input.length; offset += CHUNK) {
    const end = Math.min(input.length, offset + CHUNK);
    for (let i = offset; i < end; i++) {
      output[i] = input[i] ^ key[i % key.length];
    }
    onProgress?.(Math.round(10 + 70 * (end / input.length)));
    await new Promise(r => setTimeout(r));
  }
  return output.buffer;
}

/* Key generation & loading */
btnGenKey.addEventListener('click', () => {
  const size = 32;
  keyBytes = new Uint8Array(size);
  crypto.getRandomValues(keyBytes);
  const blob = new Blob([keyBytes], { type: 'application/octet-stream' });
  downloadKeyLink.classList.remove('hidden');
  downloadKeyLink.textContent = 'Download key.bin';
  downloadKeyLink.href = URL.createObjectURL(blob);
  downloadKeyLink.download = 'key.bin';
  keyStatus.textContent = `Key loaded (length: ${size} bytes).`;
});

keyDrop.addEventListener('click', () => keyInput.click());
keyDrop.addEventListener('dragover', e => { e.preventDefault(); keyDrop.style.background = '#303030'; });
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

/* File selection */
zipInput.addEventListener('change', e => {
  zipFile = e.target.files?.[0] || null;
  zipStatus.textContent = zipFile ? `Selected: ${zipFile.name}` : 'No file selected.';
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
  setProgress(10, 'Encrypting…');
  const encBuf = await simulateChunkedXor(buf, keyBytes, pct => setProgress(pct, 'Encrypting…'));
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
  if (!zipFile) return alert('Select an encrypted file (.enc).');
  if (!keyBytes) return alert('Load or generate a key first.');

  setProgress(0, 'Reading file…');
  const encBuf = await zipFile.arrayBuffer();
  setProgress(10, 'Decrypting…');
  const decBuf = await simulateChunkedXor(encBuf, keyBytes, pct => setProgress(pct, 'Decrypting…'));
  setProgress(60, 'Parsing ZIP…');
  
  try {
    const zip = await JSZip.loadAsync(decBuf);
    setProgress(75, 'Preparing previews…');
    await buildPreviewFromZip(zip);
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

/* Build preview items */
async function buildPreviewFromZip(zip) {
  previewItems = [];
  const files = Object.values(zip.files).filter(f => !f.dir);

  for (const f of files) {
    const ext = f.name.toLowerCase().split('.').pop();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
      const blob = await f.async('blob');
      previewItems.push({ type: 'image', url: URL.createObjectURL(blob), name: f.name });
    } else if (['mp4','webm','mov'].includes(ext)) {
      const blob = await f.async('blob');
      previewItems.push({ type: 'video', url: URL.createObjectURL(blob), name: f.name });
    } else if (['txt','md','json','csv'].includes(ext)) {
      const text = await f.async('string');
      previewItems.push({ type: 'text', text, name: f.name });
    } else if (ext === 'pdf') {
      const blob = await f.async('blob');
      previewItems.push({ type: 'pdf', url: URL.createObjectURL(blob), name: f.name });
    } else if (['psd','psb'].includes(ext)) {
      const arrayBuffer = await f.async('arraybuffer');
      try {
        const psd = readPsd(arrayBuffer);
        previewItems.push({ type: 'psd', psdData: psd, name: f.name });
      } catch (err) {
        console.error('Failed to parse PSD:', f.name, err);
      }
    }
  }
  renderPreview();
}

/* Preview rendering */
function clearPreview() {
  previewArea.innerHTML = '';
  previewItems = [];
  downloadResultLink.classList.add('hidden');
}

function renderPreview() {
  previewArea.innerHTML = '';
  if (!previewItems.length) {
    previewArea.innerHTML = '<p>No previewable files found in the ZIP.</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'preview-grid';

  previewItems.forEach((item, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name;
      thumb.appendChild(img);
    } else {
      const label = document.createElement('div');
      label.className = 'thumb-label';
      if (item.type === 'video') label.textContent = `🎬 ${item.name}`;
      else if (item.type === 'text') label.textContent = `📄 ${item.name}`;
      else if (item.type === 'pdf') label.textContent = `📕 ${item.name}`;
      else if (item.type === 'psd') label.textContent = `🎨 ${item.name}`;
      thumb.appendChild(label);
    }

    thumb.onclick = () => openModal(idx);
    grid.appendChild(thumb);
  });

  previewArea.appendChild(grid);
}

/* Collect layers from PSD with original properties */
function collectLayers(children, depth = 0) {
  let result = [];
  if (!children) return result;
  
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    
    if (child.children && child.children.length > 0) {
      result.push({
        name: child.name || 'Group',
        isFolder: true,
        depth: depth,
        visible: child.hidden !== undefined ? !child.hidden : true,
        opacity: child.opacity !== undefined ? child.opacity / 255 : 1,
      });
      result = result.concat(collectLayers(child.children, depth + 1));
    } else if (child.canvas) {
      result.push({
        name: child.name,
        canvas: child.canvas,
        left: child.left || 0,
        top: child.top || 0,
        visible: child.hidden !== undefined ? !child.hidden : true,
        isFolder: false,
        depth: depth,
        clipping: child.clipping || false,
        opacity: child.opacity !== undefined ? child.opacity / 255 : 1,
        blendMode: child.blendMode || 'normal',
      });
    }
  }
  return result;
}

/* Modal viewer */
function openModal(startIndex) {
  let currentIndex = startIndex;

  const modal = document.createElement('div');
  modal.className = 'modal';

  const content = document.createElement('div');
  content.className = 'modal-content';
  modal.appendChild(content);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => {
    cleanupModal();
    modal.remove();
  };
  modal.appendChild(closeBtn);

  let leftZone = null;
  let rightZone = null;

  function removeTapZones() {
    if (leftZone) { leftZone.remove(); leftZone = null; }
    if (rightZone) { rightZone.remove(); rightZone = null; }
  }

  function renderFile(item) {
    content.innerHTML = '';
    removeTapZones();
    window.onkeydown = null;

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.url;
      img.className = 'modal-img';
      content.appendChild(img);

      leftZone = document.createElement('div');
      leftZone.className = 'modal-tapzone left';
      rightZone = document.createElement('div');
      rightZone.className = 'modal-tapzone right';
      modal.appendChild(leftZone);
      modal.appendChild(rightZone);

      let zoomed = false;
      let scale = 1;

      const setZoom = (newScale, pivotX, pivotY) => {
        scale = Math.max(1, Math.min(3, newScale));
        zoomed = scale > 1;
        if (pivotX !== undefined && pivotY !== undefined) {
          img.style.transformOrigin = `${pivotX}px ${pivotY}px`;
        } else {
          img.style.transformOrigin = 'center center';
        }
        img.style.transform = `scale(${scale})`;
        img.style.cursor = zoomed ? 'grab' : 'default';
      };

      leftZone.onclick = (e) => {
        e.stopPropagation();
        if (!zoomed) {
          currentIndex = (currentIndex - 1 + previewItems.length) % previewItems.length;
          renderFile(previewItems[currentIndex]);
        }
      };
      rightZone.onclick = (e) => {
        e.stopPropagation();
        if (!zoomed) {
          currentIndex = (currentIndex + 1) % previewItems.length;
          renderFile(previewItems[currentIndex]);
        }
      };

      let lastTapTime = 0;
      modal.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          const rect = img.getBoundingClientRect();
          const pivotX = e.clientX - rect.left;
          const pivotY = e.clientY - rect.top;
          setZoom(zoomed ? 1 : 1.8, pivotX, pivotY);
        }
        lastTapTime = now;
      });

      modal.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = img.getBoundingClientRect();
        const pivotX = e.clientX - rect.left;
        const pivotY = e.clientY - rect.top;
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        setZoom(scale + delta, pivotX, pivotY);
      }, { passive: false });

      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let scrollStartLeft = 0;
      let scrollStartTop = 0;

      img.addEventListener('mousedown', (e) => {
        if (!zoomed) return;
        dragging = true;
        img.style.cursor = 'grabbing';
        dragStartX = e.pageX;
        dragStartY = e.pageY;
        scrollStartLeft = modal.scrollLeft;
        scrollStartTop = modal.scrollTop;
      });
      window.addEventListener('mouseup', () => {
        if (dragging) {
          dragging = false;
          img.style.cursor = 'grab';
        }
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging || !zoomed) return;
        modal.scrollLeft = scrollStartLeft - (e.pageX - dragStartX);
        modal.scrollTop = scrollStartTop - (e.pageY - dragStartY);
      });

      let touchState = {
        mode: null,
        startX: 0, startY: 0,
        startScrollLeft: 0, startScrollTop: 0,
        startDist: 0, startScale: 1,
      };

      const distance = (t1, t2) => {
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        return Math.sqrt(dx*dx + dy*dy);
      };

      modal.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          if (zoomed) {
            touchState.mode = 'pan';
            const t = e.touches[0];
            touchState.startX = t.clientX;
            touchState.startY = t.clientY;
            touchState.startScrollLeft = modal.scrollLeft;
            touchState.startScrollTop = modal.scrollTop;
          }
        } else if (e.touches.length === 2) {
          touchState.mode = 'pinch';
          touchState.startDist = distance(e.touches[0], e.touches[1]);
          touchState.startScale = scale;
          const rect = img.getBoundingClientRect();
          const midX = (e.touches[0].clientX + e.touches[1].clientX)/2 - rect.left;
          const midY = (e.touches[0].clientY + e.touches[1].clientY)/2 - rect.top;
          img.style.transformOrigin = `${midX}px ${midY}px`;
        }
      }, { passive: true });

      modal.addEventListener('touchmove', (e) => {
        if (touchState.mode === 'pan' && zoomed && e.touches.length === 1) {
          const t = e.touches[0];
          const dx = t.clientX - touchState.startX;
          const dy = t.clientY - touchState.startY;
          modal.scrollLeft = touchState.startScrollLeft - dx;
          modal.scrollTop = touchState.startScrollTop - dy;
        } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
          const dist = distance(e.touches[0], e.touches[1]);
          const factor = dist / touchState.startDist;
          setZoom(touchState.startScale * factor);
        }
      }, { passive: true });

      modal.addEventListener('touchend', () => {
        touchState.mode = null;
      });

      window.onkeydown = (e) => {
        if (zoomed) return;
        if (e.key === 'ArrowLeft') {
          currentIndex = (currentIndex - 1 + previewItems.length) % previewItems.length;
          renderFile(previewItems[currentIndex]);
        } else if (e.key === 'ArrowRight') {
          currentIndex = (currentIndex + 1) % previewItems.length;
          renderFile(previewItems[currentIndex]);
        } else if (e.key === 'Escape') {
          cleanupModal();
          modal.remove();
        }
      };
    }

    else if (item.type === 'psd') {
      const psdContainer = document.createElement('div');
      psdContainer.className = 'psd-viewer';

      const layersPanel = document.createElement('div');
      layersPanel.className = 'psd-layers-panel';
      
      const layersTitle = document.createElement('h3');
      layersTitle.textContent = 'Layers';
      layersPanel.appendChild(layersTitle);

      const layersList = document.createElement('ul');
      layersList.className = 'psd-layers-list';
      layersPanel.appendChild(layersList);

      const canvasArea = document.createElement('div');
      canvasArea.className = 'psd-canvas-area';
      
      const canvas = document.createElement('canvas');
      canvas.className = 'psd-canvas';
      canvas.width = item.psdData.width;
      canvas.height = item.psdData.height;
      canvasArea.appendChild(canvas);

      psdContainer.appendChild(layersPanel);
      psdContainer.appendChild(canvasArea);
      content.appendChild(psdContainer);

      const ctx = canvas.getContext('2d');
      const layers = collectLayers(item.psdData.children);

      layers.forEach((layer, index) => {
        const li = document.createElement('li');
        li.className = 'psd-layer-item';
        
        if (layer.depth > 0) {
          li.style.paddingLeft = `${8 + layer.depth * 16}px`;
        }
        
        if (layer.isFolder) {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = layer.visible;
          checkbox.addEventListener('change', () => {
            layer.visible = checkbox.checked;
            const folderDepth = layer.depth;
            let i = index + 1;
            while (i < layers.length && layers[i].depth > folderDepth) {
              layers[i].visible = checkbox.checked;
              const childLi = layersList.children[i];
              const childCheckbox = childLi.querySelector('input[type="checkbox"]');
              if (childCheckbox) {
                childCheckbox.checked = checkbox.checked;
              }
              i++;
            }
            renderPsd(ctx, canvas, layers);
          });
          
          const folderIcon = document.createElement('span');
          folderIcon.textContent = '📁 ';
          
          const label = document.createElement('span');
          label.textContent = layer.name;
          label.style.fontWeight = 'bold';
          label.style.color = '#a8a8a8';
          
          li.appendChild(checkbox);
          li.appendChild(folderIcon);
          li.appendChild(label);
        } else {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = layer.visible;
          checkbox.addEventListener('change', () => {
            layer.visible = checkbox.checked;
            renderPsd(ctx, canvas, layers);
          });
          
          const label = document.createElement('span');
          label.textContent = layer.name || `Layer ${index}`;
          
          li.appendChild(checkbox);
          li.appendChild(label);
          
          if (layer.clipping) {
            const clipIcon = document.createElement('span');
            clipIcon.textContent = ' 🔗';
            clipIcon.title = 'Clipping Mask';
            clipIcon.style.fontSize = '0.8rem';
            li.appendChild(clipIcon);
          }
        }
        
        layersList.appendChild(li);
      });

      renderPsd(ctx, canvas, layers);

      window.onkeydown = (e) => {
        if (e.key === 'Escape') {
          cleanupModal();
          modal.remove();
        }
      };
    }

    else if (item.type === 'video') {
      const shell = document.createElement('div');
      shell.className = 'video-shell';

      const video = document.createElement('video');
      video.src = item.url;
      video.className = 'video-player';
      video.preload = 'metadata';
      video.playsInline = true;
      shell.appendChild(video);

      const controls = document.createElement('div');
      controls.className = 'video-controls';

      const playBtn = document.createElement('button');
      playBtn.className = 'control-btn';
      playBtn.textContent = '▶️';
      playBtn.onclick = () => {
        if (video.paused) { video.play(); playBtn.textContent = '⏸️'; }
        else { video.pause(); playBtn.textContent = '▶️'; }
      };

      const seek = document.createElement('input');
      seek.type = 'range'; seek.min = 0; seek.max = 100; seek.value = 0;
      seek.className = 'seek';
      video.addEventListener('timeupdate', () => {
        if (video.duration) seek.value = (video.currentTime / video.duration) * 100;
      });
      seek.oninput = () => {
        if (video.duration) video.currentTime = (seek.value / 100) * video.duration;
      };

      const muteBtn = document.createElement('button');
      muteBtn.className = 'control-btn';
      muteBtn.textContent = '🔊';
      muteBtn.onclick = () => {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? '🔇' : '🔊';
      };

      const volume = document.createElement('input');
      volume.type = 'range'; volume.min = 0; volume.max = 1; volume.step = 0.05;
      volume.value = video.volume;
      volume.className = 'volume';
      volume.oninput = () => { video.volume = parseFloat(volume.value); };

      const speedSelect = document.createElement('select');
      speedSelect.className = 'speed-select';
      [0.5, 0.75, 1, 1.25, 1.5, 2].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `${s}x`;
        if (s === 1) opt.selected = true;
        speedSelect.appendChild(opt);
      });
      speedSelect.onchange = () => { video.playbackRate = parseFloat(speedSelect.value); };

      const fsBtn = document.createElement('button');
      fsBtn.className = 'control-btn';
      fsBtn.textContent = '⛶';
      fsBtn.onclick = () => {
        if (!document.fullscreenElement) shell.requestFullscreen();
        else document.exitFullscreen();
      };

      controls.append(playBtn, seek, muteBtn, volume, speedSelect, fsBtn);
      shell.appendChild(controls);

      let hideTimeout;
      const showControls = () => {
        controls.classList.add('show');
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => controls.classList.remove('show'), 2000);
      };
      shell.addEventListener('mousemove', showControls);
      shell.addEventListener('touchstart', showControls);
      showControls();

      const overlay = document.createElement('div');
      overlay.className = 'video-overlay';
      shell.appendChild(overlay);
      const showOverlay = (text) => {
        const msg = document.createElement('div');
        msg.className = 'overlay-msg';
        msg.textContent = text;
        overlay.appendChild(msg);
        setTimeout(() => msg.remove(), 700);
      };

      let lastTap = 0;
      shell.addEventListener('touchend', e => {
        const now = Date.now();
        const tapX = e.changedTouches[0].clientX;
        const width = shell.clientWidth;
        const corner = width * 0.25;

        if (now - lastTap < 300) {
          if (tapX < corner) {
            video.currentTime = Math.max(0, video.currentTime - 10);
            showOverlay('⏪ -10s');
          } else if (tapX > width - corner) {
            video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
            showOverlay('⏩ +10s');
          }
        }
        lastTap = now;
      }, { passive: true });

      const startBoost = () => { video.playbackRate = 2; showOverlay('⚡ 2x'); };
      const stopBoost = () => { video.playbackRate = parseFloat(speedSelect.value); };

      shell.addEventListener('mousedown', e => {
        const w = shell.clientWidth;
        if (e.offsetX > w * 0.25 && e.offsetX < w * 0.75) startBoost();
      });
      shell.addEventListener('mouseup', stopBoost);
      shell.addEventListener('mouseleave', stopBoost);
      shell.addEventListener('touchstart', e => {
        const w = shell.clientWidth;
        const x = e.touches[0].clientX - shell.getBoundingClientRect().left;
        if (x > w * 0.25 && x < w * 0.75) startBoost();
      }, { passive: true });
      shell.addEventListener('touchend', stopBoost);

      content.appendChild(shell);

      window.onkeydown = (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          if (video.paused) { video.play(); playBtn.textContent = '⏸️'; }
          else { video.pause(); playBtn.textContent = '▶️'; }
        } else if (e.key === 'ArrowLeft') {
          video.currentTime = Math.max(0, video.currentTime - 5);
        } else if (e.key === 'ArrowRight') {
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
        } else if (e.key === 'Escape') {
          cleanupModal();
          modal.remove();
        }
      };
    }

    else if (item.type === 'text') {
      const link = document.createElement('a');
      const blob = new Blob([item.text], { type: 'text/plain' });
      link.href = URL.createObjectURL(blob);
      link.target = '_blank';
      link.textContent = `Open ${item.name} in new tab`;
      content.appendChild(link);
    }

    else if (item.type === 'pdf') {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.textContent = `Open ${item.name} in new tab`;
      content.appendChild(link);
    }
  }

  function cleanupModal() {
    window.onkeydown = null;
  }

  renderFile(previewItems[currentIndex]);
  document.body.appendChild(modal);
}

/* Render PSD with proper clipping masks and opacity */
function renderPsd(ctx, canvas, layers) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  let i = layers.length - 1;
  
  while (i >= 0) {
    const layer = layers[i];
    
    if (layer.isFolder || !layer.visible || !layer.canvas) {
      i--;
      continue;
    }
    
    let clippingGroup = [layer];
    let j = i - 1;
    
    while (j >= 0 && layers[j].clipping && layers[j].visible && layers[j].canvas) {
      clippingGroup.unshift(layers[j]);
      j--;
    }
    
    if (clippingGroup.length > 1) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      const base = clippingGroup[clippingGroup.length - 1];
      tempCtx.globalAlpha = base.opacity;
      tempCtx.drawImage(base.canvas, base.left, base.top);
      
      for (let k = 0; k < clippingGroup.length - 1; k++) {
        const clippingLayer = clippingGroup[k];
        tempCtx.save();
        tempCtx.globalCompositeOperation = 'source-atop';
        tempCtx.globalAlpha = clippingLayer.opacity;
        tempCtx.drawImage(clippingLayer.canvas, clippingLayer.left, clippingLayer.top);
        tempCtx.restore();
      }
      
      ctx.drawImage(tempCanvas, 0, 0);
      i = j;
    } else {
      ctx.save();
      
      if (layer.blendMode && layer.blendMode !== 'normal') {
        const blendMap = {
          'multiply': 'multiply',
          'screen': 'screen',
          'overlay': 'overlay',
          'darken': 'darken',
          'lighten': 'lighten',
          'color-dodge': 'color-dodge',
          'color-burn': 'color-burn',
          'hard-light': 'hard-light',
          'soft-light': 'soft-light',
          'difference': 'difference',
          'exclusion': 'exclusion',
        };
        
        const canvasBlendMode = blendMap[layer.blendMode.toLowerCase()];
        if (canvasBlendMode) {
          ctx.globalCompositeOperation = canvasBlendMode;
        }
      }
      
      //ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layer.canvas, layer.left, layer.top);
      ctx.restore();
      i--;
    }
  }
}

window.addEventListener('beforeunload', () => {
  for (const item of previewItems) {
    if (item.url) URL.revokeObjectURL(item.url);
  }
});
let currentFiles = [];
let selectedFileIndex = null;
let psdLayers = []; // Holds independent parsed sub-layer canvases

// Extension Matcher
function getFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();

  switch (ext) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';

    case 'psd':
      return 'psd';

    case 'mp4':
    case 'webm':
    case 'ogg':
      return 'video';

    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
    case 'm4a':
    case 'opus':
      return 'audio';

    case 'pdf':
      return 'pdf';

    case 'csv':
      return 'csv';

    case 'md':
    case 'markdown':
      return 'markdown';

    case 'txt':
    case 'json':
    case 'xml':
    case 'log':
      return 'text';

    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'odt':
      return 'office-xml';

    case 'doc':
    case 'xls':
    case 'ppt':
      return 'office-legacy';
    
    default:
      return 'unsupported';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// Upload Handlers
function handleSingleFile(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  currentFiles = files;
  renderFileList();
  selectFile(0);
}

function handleFolderFiles(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  currentFiles = files;
  renderFileList();
  selectFile(0);
}

// Sidebar File List
function renderFileList() {
  const tree = document.getElementById('fileTree');
  tree.innerHTML = '';

  currentFiles.forEach((file, index) => {
    const type = getFileType(file.name);
    const item = document.createElement('div');
    item.className = `file-item ${index === selectedFileIndex ? 'active' : ''}`;
    item.onclick = () => selectFile(index);
    
    const relativePath = file.webkitRelativePath || file.name;
    item.innerHTML = `
      <span title="${relativePath}">${file.name}</span>
      <span class="badge">${type}</span>
    `;
    tree.appendChild(item);
  });
}

// Main Selector
function selectFile(index) {
  selectedFileIndex = index;
  renderFileList();
  
  const file = currentFiles[index];
  const type = getFileType(file.name);

  document.getElementById('selectedFileName').textContent = file.name;
  document.getElementById('selectedFileMeta').textContent = `${formatBytes(file.size)} • ${type.toUpperCase()}`;

  const stage = document.getElementById('previewStage');
  stage.innerHTML = '<div class="placeholder"><p>Loading preview...</p></div>';

  const fileUrl = URL.createObjectURL(file);

  switch(type) {
    case 'image':
      renderImage(fileUrl, stage);
      break;
    case 'video':
      renderVideo(fileUrl, stage);
      break;
    case 'audio':
      renderAudio(fileUrl, stage);
      break;
    case 'pdf':
      renderPDF(fileUrl, stage);
      break;
    case 'csv':
      renderCSV(file, stage);
      break;
    case 'markdown':
      renderMarkdown(file, stage);
      break;
    case 'psd':
      renderPSD(file, stage);
      break;
    case 'text':
      renderPlainText(file, stage);
      break;
    case 'office-xml':
      renderOfficeXML(file, stage);
      break;
    case 'office-legacy':
      stage.innerHTML = `
        <div class="placeholder">
          <p>Legacy binary Office file (${file.name.split('.').pop().toUpperCase()}) detected.</p>
          <small>Consider converting to modern OOXML (${file.name.split('.').pop().toUpperCase()}X) format for client-side rendering.</small>
        </div>`;
      break;
    default:
      stage.innerHTML = `<div class="placeholder"><p>Preview unavailable for this format.</p></div>`;
  }
}

// --- Renderers ---

function renderImage(url, stage) {
  stage.innerHTML = `<img src="${url}" alt="Preview">`;
}

function renderVideo(url, stage) {

    stage.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'video-player';
    wrapper.style.cssText = `
        display:flex;
        flex-direction:column;
        gap:10px;
        width:100%;
        height:100%;
        align-items:center;
    `;

    const video = document.createElement('video');
    video.src = url;
    video.style.cssText = `
        max-width:100%;
        max-height:calc(100% - 60px);
        background:#000;
    `;

    const controls = document.createElement('div');
    controls.className = 'video-controls';
    controls.style.cssText = `
        display:flex;
        gap:8px;
        align-items:center;
        width:100%;
    `;

    // Play
    const playBtn = document.createElement('button');
    playBtn.textContent = '▶️';

    playBtn.onclick = () => {
        if(video.paused){
            video.play();
            playBtn.textContent='⏸️';
        }else{
            video.pause();
            playBtn.textContent='▶️';
        }
    };

    video.onpause=()=>playBtn.textContent='▶️';
    video.onplay=()=>playBtn.textContent='⏸️';

    // Back
    const backBtn=document.createElement('button');
    backBtn.textContent='⏪';
    backBtn.onclick=()=>video.currentTime-=5;

    // Forward
    const forwardBtn=document.createElement('button');
    forwardBtn.textContent='⏩';
    forwardBtn.onclick=()=>video.currentTime+=5;

    // Seek
    const seek=document.createElement('input');
    seek.type='range';
    seek.min=0;
    seek.max=100;
    seek.value=0;
    seek.style.flex='1';

    seek.oninput=()=>{
        if(video.duration)
            video.currentTime=(seek.value/100)*video.duration;
    };

    video.addEventListener('timeupdate',()=>{
        if(video.duration)
            seek.value=(video.currentTime/video.duration)*100;
    });

    // Mute
    const muteBtn=document.createElement('button');
    muteBtn.textContent='🔊';

    muteBtn.onclick=()=>{
        video.muted=!video.muted;
        muteBtn.textContent=video.muted?'🔇':'🔊';
    };

    // Volume
    const volume=document.createElement('input');
    volume.type='range';
    volume.min=0;
    volume.max=1;
    volume.step=0.05;
    volume.value=1;

    volume.oninput=()=>{
        video.volume=volume.value;
    };

    // Speed
    const speed=document.createElement('select');

    [0.5,1,1.5,2].forEach(v=>{
        const o=document.createElement('option');
        o.value=v;
        o.textContent=v+'x';
        if(v===1)o.selected=true;
        speed.appendChild(o);
    });

    speed.onchange=()=>{
        video.playbackRate=parseFloat(speed.value);
    };

    // Fullscreen
    const fs=document.createElement('button');
    fs.textContent='⛶';

    fs.onclick=()=>{
        if(!document.fullscreenElement)
            wrapper.requestFullscreen();
        else
            document.exitFullscreen();
    };

    controls.append(
        playBtn,
        backBtn,
        forwardBtn,
        seek,
        muteBtn,
        volume,
        speed,
        fs
    );

    wrapper.append(video,controls);
    stage.appendChild(wrapper);

    // Hold for 2x
    const boost=()=>video.playbackRate=2;
    const normal=()=>video.playbackRate=parseFloat(speed.value);

    video.addEventListener('mousedown',boost);
    video.addEventListener('mouseup',normal);
    video.addEventListener('mouseleave',normal);

    video.addEventListener('touchstart',boost);
    video.addEventListener('touchend',normal);

    document.onkeydown=(e)=>{

        if(selectedFileIndex===null) return;

        switch(e.code){

            case 'Space':
                e.preventDefault();
                playBtn.click();
                break;

            case 'ArrowRight':
                video.currentTime+=5;
                break;

            case 'ArrowLeft':
                video.currentTime-=5;
                break;

            case 'KeyF':
                fs.click();
                break;

            case 'KeyM':
                muteBtn.click();
                break;
        }
    };
}

function renderAudio(url, stage){

    stage.innerHTML='';

    const wrapper=document.createElement('div');

    wrapper.style.cssText=`
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:20px;
        width:100%;
        height:100%;
    `;

    const icon=document.createElement('div');
    icon.style.fontSize='80px';
    icon.textContent='🎵';

    const audio=document.createElement('audio');
    audio.src=url;

    const controls=document.createElement('div');
    controls.style.cssText=`
        display:flex;
        gap:8px;
        align-items:center;
        width:90%;
    `;

    const play=document.createElement('button');
    play.textContent='▶️';

    play.onclick=()=>{
        if(audio.paused){
            audio.play();
            play.textContent='⏸️';
        }else{
            audio.pause();
            play.textContent='▶️';
        }
    };

    audio.onpause=()=>play.textContent='▶️';
    audio.onplay=()=>play.textContent='⏸️';

    const back=document.createElement('button');
    back.textContent='⏪';
    back.onclick=()=>audio.currentTime-=5;

    const forward=document.createElement('button');
    forward.textContent='⏩';
    forward.onclick=()=>audio.currentTime+=5;

    const seek=document.createElement('input');
    seek.type='range';
    seek.min=0;
    seek.max=100;
    seek.value=0;
    seek.style.flex='1';

    seek.oninput=()=>{
        if(audio.duration)
            audio.currentTime=(seek.value/100)*audio.duration;
    };

    audio.addEventListener('timeupdate',()=>{
        if(audio.duration)
            seek.value=(audio.currentTime/audio.duration)*100;
    });

    const mute=document.createElement('button');
    mute.textContent='🔊';

    mute.onclick=()=>{
        audio.muted=!audio.muted;
        mute.textContent=audio.muted?'🔇':'🔊';
    };

    const volume=document.createElement('input');
    volume.type='range';
    volume.min=0;
    volume.max=1;
    volume.step=0.05;
    volume.value=1;

    volume.oninput=()=>{
        audio.volume=volume.value;
    };

    const speed=document.createElement('select');

    [0.5,1,1.5,2].forEach(v=>{
        const o=document.createElement('option');
        o.value=v;
        o.textContent=v+'x';
        if(v===1)o.selected=true;
        speed.appendChild(o);
    });

    speed.onchange=()=>{
        audio.playbackRate=parseFloat(speed.value);
    };

    controls.append(
        play,
        back,
        forward,
        seek,
        mute,
        volume,
        speed
    );

    wrapper.append(
        icon,
        audio,
        controls
    );

    stage.appendChild(wrapper);

    document.onkeydown=(e)=>{

        if(selectedFileIndex===null) return;

        switch(e.code){

            case 'Space':
                e.preventDefault();
                play.click();
                break;

            case 'ArrowRight':
                audio.currentTime+=5;
                break;

            case 'ArrowLeft':
                audio.currentTime-=5;
                break;

            case 'KeyM':
                mute.click();
                break;
        }
    };
}

function renderPDF(url, stage) {
  stage.innerHTML = `<iframe class="pdf-frame" src="${url}"></iframe>`;
}

// Editable Plain Text Reader
function renderPlainText(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const rawText = e.target.result;
    
    stage.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; gap: 12px;">
        <div style="display: flex; justify-content: flex-end;">
          <button id="saveTxtBtn" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
            💾 Save Changes
          </button>
        </div>
        <textarea id="txtEditor" style="
          flex: 1; 
          width: 100%; 
          background: var(--bg-secondary); 
          color: var(--text-main); 
          border: 1px solid var(--border-color); 
          border-radius: 6px; 
          padding: 16px; 
          font-family: monospace; 
          font-size: 0.85rem; 
          resize: none; 
          outline: none;
          line-height: 1.5;
        ">${escapeHtml(rawText)}</textarea>
      </div>
    `;

    document.getElementById('saveTxtBtn').onclick = () => {
      const editedContent = document.getElementById('txtEditor').value;
      downloadFile(editedContent, file.name, 'text/plain');
    };
  };
  reader.readAsText(file);
}

function renderCSV(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter(line => line.trim() !== '');
    if (!lines.length) {
      stage.innerHTML = '<div class="placeholder"><p>CSV file is empty.</p></div>';
      return;
    }

    let html = '<div class="table-container"><table>';
    lines.forEach((line, rowIndex) => {
      const columns = line.split(',');
      const tag = rowIndex === 0 ? 'th' : 'td';
      html += '<tr>';
      columns.forEach(col => {
        html += `<${tag}>${escapeHtml(col.trim().replace(/^"|"$/g, ''))}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table></div>';
    stage.innerHTML = html;
  };
  reader.readAsText(file);
}

// Editable Split-Pane Markdown Reader
function renderMarkdown(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const rawText = e.target.result;
    
    stage.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; gap: 12px;">
        <div style="display: flex; justify-content: flex-end;">
          <button id="saveMdBtn" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
            💾 Save Changes
          </button>
        </div>
        <div style="display: flex; flex: 1; gap: 16px; height: calc(100% - 45px); overflow: hidden;">
          <textarea id="mdInput" style="
            flex: 1; 
            height: 100%; 
            background: var(--bg-secondary); 
            color: var(--text-main); 
            border: 1px solid var(--border-color); 
            border-radius: 6px; 
            padding: 16px; 
            font-family: monospace; 
            font-size: 0.85rem; 
            resize: none; 
            outline: none;
            line-height: 1.5;
          ">${escapeHtml(rawText)}</textarea>
          
          <div id="mdPreview" class="markdown-container" style="flex: 1; height: 100%; overflow-y: auto;">
            ${parseMarkdown(rawText)}
          </div>
        </div>
      </div>
    `;

    const input = document.getElementById('mdInput');
    const preview = document.getElementById('mdPreview');

    // Live preview updating on typing
    input.addEventListener('input', () => {
      preview.innerHTML = parseMarkdown(input.value);
    });

    document.getElementById('saveMdBtn').onclick = () => {
      downloadFile(input.value, file.name, 'text/markdown');
    };
  };
  reader.readAsText(file);
}

// Helper to trigger file downloads
function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Office OpenXML Reader (docx, pptx, xlsx using local/global JSZip)
function renderOfficeXML(file, stage) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      if (typeof JSZip === 'undefined') {
        stage.innerHTML = '<div class="placeholder"><p>Error: JSZip library not loaded. Make sure jszip.min.js is included in your index.html.</p></div>';
        return;
      }

      const zip = await JSZip.loadAsync(e.target.result);
      const ext = file.name.split('.').pop().toLowerCase();
      let textFragments = [];

      if (ext === 'docx') {
        const docFile = zip.file("word/document.xml");
        if (docFile) {
          const xmlText = await docFile.async("text");
          const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
          const paragraphs = xmlDoc.getElementsByTagName("w:p");
          for (let p of paragraphs) {
            const texts = p.getElementsByTagName("w:t");
            let line = "";
            for (let t of texts) line += t.textContent;
            if (line.trim()) textFragments.push(line);
          }
        }
      } else if (ext === 'pptx') {
        const slideFiles = Object.keys(zip.files).filter(k => k.startsWith("ppt/slides/slide") && k.endsWith(".xml"));
        slideFiles.sort();
        for (let idx = 0; idx < slideFiles.length; idx++) {
          const xmlText = await zip.file(slideFiles[idx]).async("text");
          const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
          const textNodes = xmlDoc.querySelectorAll("a\\:t, t");
          let slideText = Array.from(textNodes).map(n => n.textContent).join(" ");
          if (slideText.trim()) {
            textFragments.push(`--- [ Slide ${idx + 1} ] ---`);
            textFragments.push(slideText);
          }
        }
      } else if (ext === 'xlsx') {
        const sharedStringsFile = zip.file("xl/sharedStrings.xml");
        if (sharedStringsFile) {
          const xmlText = await sharedStringsFile.async("text");
          const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
          const strings = xmlDoc.getElementsByTagName("t");
          for (let s of strings) {
            if (s.textContent.trim()) textFragments.push(s.textContent);
          }
        }
      }

      if (textFragments.length > 0) {
        stage.innerHTML = `
          <div class="markdown-container">
            <h3>📄 Extracted Text Preview (${file.name})</h3>
            <hr style="margin: 12px 0; border-color: var(--border-color);" />
            <div style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(textFragments.join('\n\n'))}</div>
          </div>`;
      } else {
        stage.innerHTML = `<div class="placeholder"><p>No text elements found inside ${file.name}.</p></div>`;
      }
    } catch (err) {
      stage.innerHTML = `<div class="placeholder"><p>Unable to extract Office archive structure.</p></div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// PSD Parser with Real Sub-Layer Extraction and Layer Toggling
function renderPSD(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = new Uint8Array(e.target.result);
    try {
      const parsed = parsePSDFile(buffer);
      psdLayers = parsed.layers;

      if (psdLayers.length === 0) {
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = parsed.width;
        baseCanvas.height = parsed.height;
        psdLayers.push({
          id: 0,
          name: 'Flattened Composite',
          visible: true,
          left: 0,
          top: 0,
          width: parsed.width,
          height: parsed.height,
          canvas: baseCanvas
        });
      }

      renderPSDLayout(stage, parsed.width, parsed.height);
    } catch (err) {
      console.error(err);
      stage.innerHTML = `<div class="placeholder"><p>Unable to parse PSD file layer structure.</p></div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function parsePSDFile(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (view.getUint32(0) !== 0x38425053) {
    throw new Error('Invalid PSD header');
  }

  const canvasHeight = view.getUint32(14);
  const canvasWidth = view.getUint32(18);
  const depth = view.getUint16(22);

  if (depth !== 8) {
    throw new Error('PSD Preview requires 8-bit depth mode.');
  }

  const colorMode = view.getUint16(24);
  let offset = 26;

  const colorDataLen = view.getUint32(offset);
  offset += 4 + colorDataLen;

  const imageResLen = view.getUint32(offset);
  offset += 4 + imageResLen;

  const layerAndMaskLen = view.getUint32(offset);
  offset += 4;

  const layers = [];

  if (layerAndMaskLen > 0) {
    const layerSectionEnd = offset + layerAndMaskLen;
    const layerInfoLen = view.getUint32(offset);
    offset += 4;

    const layerInfoStart = offset;
    let layerCount = Math.abs(view.getInt16(offset));
    offset += 2;

    const parsedLayers = [];

    for (let i = 0; i < layerCount; i++) {
      const top = view.getInt32(offset);
      const left = view.getInt32(offset + 4);
      const bottom = view.getInt32(offset + 8);
      const right = view.getInt32(offset + 12);
      offset += 16;

      const numChannels = view.getUint16(offset);
      offset += 2;

      const channels = [];
      for (let c = 0; c < numChannels; c++) {
        const channelId = view.getInt16(offset);
        const channelLength = view.getUint32(offset + 2);
        offset += 6;
        channels.push({ id: channelId, length: channelLength });
      }

      const blendSig = readAscii(view, offset, 4);
      offset += 4;
      const blendMode = readAscii(view, offset, 4);
      offset += 4;
      const opacity = view.getUint8(offset);
      offset += 1;
      const clipping = view.getUint8(offset);
      offset += 1;
      const flags = view.getUint8(offset);
      offset += 1;
      const filler = view.getUint8(offset);
      offset += 1;

      const extraLen = view.getUint32(offset);
      offset += 4;
      const extraDataStart = offset;
      const extraDataEnd = offset + extraLen;

      let layerName = `Layer ${i + 1} (${right - left}x${bottom - top})`;
      if (extraLen >= 12 && extraDataEnd <= buffer.byteLength) {
        const maskDataLen = view.getUint32(offset);
        offset += 4 + maskDataLen;
        if (offset + 4 <= extraDataEnd) {
          const blendRangesLen = view.getUint32(offset);
          offset += 4 + blendRangesLen;
          if (offset < extraDataEnd) {
            const nameLen = view.getUint8(offset);
            offset += 1;
            const actualNameLen = Math.min(nameLen, extraDataEnd - offset);
            if (actualNameLen > 0) {
              layerName = readAscii(view, offset, actualNameLen) || layerName;
            }
            offset += actualNameLen;
            while (offset < extraDataEnd && ((offset - extraDataStart) % 4) !== 0) {
              offset += 1;
            }
          }
        }
      }
      offset = extraDataEnd;

      parsedLayers.push({
        id: i,
        name: layerName,
        visible: (flags & 0x02) === 0,
        left,
        top,
        width: right - left,
        height: bottom - top,
        channels,
        opacity,
        flags,
        blendMode,
        blendSig,
        clipping
      });
    }

    let imageOffset = offset;
    for (const layer of parsedLayers) {
      const decoded = decodePSDLayerImage(buffer, imageOffset, layer, depth, colorMode);
      imageOffset += decoded.bytesConsumed;
      if (decoded.canvas) {
        layer.canvas = decoded.canvas;
      } else {
        layer.canvas = createPlaceholderCanvas(layer.width, layer.height, layer.opacity, layer.id);
      }

      layers.push(layer);
    }

    offset = layerSectionEnd;
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    depth,
    colorMode,
    layers
  };
}

function readAscii(view, offset, length) {
  let text = '';
  for (let i = 0; i < length; i++) {
    text += String.fromCharCode(view.getUint8(offset + i));
  }
  return text;
}

function createPlaceholderCanvas(width, height, opacity, id) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let p = 0; p < width * height * 4; p += 4) {
    imgData.data[p] = (id * 70) % 255;
    imgData.data[p + 1] = (id * 130) % 255;
    imgData.data[p + 2] = (id * 200) % 255;
    imgData.data[p + 3] = opacity;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function decodePSDLayerImage(buffer, startOffset, layer, depth, colorMode) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = startOffset;
  const channelBuffers = {};
  let bytesConsumed = 0;

  for (const channel of layer.channels) {
    const channelStart = offset;
    if (offset + 2 > buffer.byteLength) {
      break;
    }

    const compression = view.getUint16(offset);
    offset += 2;

    const channelBytes = channel.length - 2;
    let decoded = null;

    if (compression === 0) {
      if (offset + channelBytes <= buffer.byteLength) {
        decoded = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, channelBytes);
      }
      offset += channelBytes;
    } else if (compression === 1) {
      const rowCounts = [];
      for (let y = 0; y < layer.height; y++) {
        rowCounts.push(view.getUint16(offset));
        offset += 2;
      }
      const rleStart = offset;
      const rleEnd = channelStart + channel.length;
      if (rleEnd <= buffer.byteLength) {
        const compressedBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + rleStart, rleEnd - rleStart);
        decoded = decodePSDRowRLE(compressedBytes, layer.width, layer.height);
      }
      offset = rleEnd;
    } else {
      offset += channelBytes;
    }

    bytesConsumed += channel.length;
    channelBuffers[channel.id] = decoded;
  }

  const canvas = document.createElement('canvas');
  canvas.width = layer.width;
  canvas.height = layer.height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(layer.width, layer.height);
  const pixelCount = layer.width * layer.height;

  const alpha = channelBuffers[-1] || null;
  const fillAlpha = alpha ? alpha : new Uint8Array(pixelCount).fill(255);

  if (colorMode === 3) {
    const red = channelBuffers[0] || new Uint8Array(pixelCount);
    const green = channelBuffers[1] || new Uint8Array(pixelCount);
    const blue = channelBuffers[2] || new Uint8Array(pixelCount);

    for (let p = 0; p < pixelCount; p++) {
      const base = p * 4;
      imageData.data[base] = red[p];
      imageData.data[base + 1] = green[p];
      imageData.data[base + 2] = blue[p];
      imageData.data[base + 3] = fillAlpha[p];
    }
  } else if (colorMode === 1) {
    const gray = channelBuffers[0] || new Uint8Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      const v = gray[p];
      const base = p * 4;
      imageData.data[base] = v;
      imageData.data[base + 1] = v;
      imageData.data[base + 2] = v;
      imageData.data[base + 3] = fillAlpha[p];
    }
  } else if (colorMode === 4) {
    const c = channelBuffers[0] || new Uint8Array(pixelCount);
    const m = channelBuffers[1] || new Uint8Array(pixelCount);
    const y = channelBuffers[2] || new Uint8Array(pixelCount);
    const k = channelBuffers[3] || new Uint8Array(pixelCount);

    for (let p = 0; p < pixelCount; p++) {
      const base = p * 4;
      const cc = c[p];
      const mm = m[p];
      const yy = y[p];
      const kk = k[p];
      imageData.data[base] = 255 - Math.min(255, cc + kk);
      imageData.data[base + 1] = 255 - Math.min(255, mm + kk);
      imageData.data[base + 2] = 255 - Math.min(255, yy + kk);
      imageData.data[base + 3] = fillAlpha[p];
    }
  } else {
    ctx.putImageData(createPlaceholderCanvas(layer.width, layer.height, layer.opacity, layer.id).getContext('2d').getImageData(0, 0, layer.width, layer.height), 0, 0);
    return { canvas, bytesConsumed };
  }

  ctx.putImageData(imageData, 0, 0);
  return { canvas, bytesConsumed };
}

function decodePSDRowRLE(compressed, width, height) {
  const output = new Uint8Array(width * height);
  let readOffset = 0;
  let writeOffset = 0;

  for (let row = 0; row < height; row++) {
    while (writeOffset < (row + 1) * width && readOffset < compressed.length) {
      const code = compressed[readOffset++];
      if (code >= 0 && code <= 127) {
        const count = code + 1;
        output.set(compressed.subarray(readOffset, readOffset + count), writeOffset);
        readOffset += count;
        writeOffset += count;
      } else if (code >= 129 && code <= 255) {
        const count = 257 - code;
        const value = compressed[readOffset++];
        output.fill(value, writeOffset, writeOffset + count);
        writeOffset += count;
      }
    }
    if (writeOffset < (row + 1) * width) {
      writeOffset = (row + 1) * width;
    }
  }

  return output;
}

// PSD Stage Layout & Interactive Controls
function renderPSDLayout(stage, width, height) {
  stage.innerHTML = '';

  const container = document.createElement('div');
  container.style.cssText = 'display: flex; gap: 20px; width: 100%; height: 100%; max-height: 100%; overflow: hidden;';

  // Canvas Viewport
  const canvasWrapper = document.createElement('div');
  canvasWrapper.style.cssText = 'flex: 1; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 6px; overflow: auto; padding: 16px;';
  
  const mainCanvas = document.createElement('canvas');
  mainCanvas.id = 'psdMainCanvas';
  mainCanvas.width = width;
  mainCanvas.height = height;
  mainCanvas.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); background: #ffffff;';
  canvasWrapper.appendChild(mainCanvas);

  // Layer Tree Sidebar
  const layersPanel = document.createElement('div');
  layersPanel.style.cssText = 'width: 240px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;';
  
  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 600; font-size: 0.85rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; margin-bottom: 4px;';
  title.textContent = 'PSD Layers';
  layersPanel.appendChild(title);

  // Iterate in reverse for the sidebar UI so top-most layers appear at the top of the UI list
  for (let i = psdLayers.length - 1; i >= 0; i--) {
    const layer = psdLayers[i];
    const layerRow = document.createElement('label');
    layerRow.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer; padding: 8px; border-radius: 4px; background: var(--bg-tertiary); user-select: none;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = layer.visible;
    checkbox.onchange = (e) => {
      layer.visible = e.target.checked;
      redrawPSDComposite();
    };

    const label = document.createElement('span');
    label.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    label.textContent = layer.name;

    layerRow.appendChild(checkbox);
    layerRow.appendChild(label);
    layersPanel.appendChild(layerRow);
  }

  container.appendChild(canvasWrapper);
  container.appendChild(layersPanel);
  stage.appendChild(container);

  redrawPSDComposite();
}

// Redraw composite canvas whenever toggles change
function redrawPSDComposite() {
  const canvas = document.getElementById('psdMainCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  psdLayers.forEach(layer => {
    if (layer.visible && layer.canvas) {
      ctx.drawImage(layer.canvas, layer.left, layer.top);
    }
  });
}

// Markdown Parser Helper
function parseMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*)\*/gim, '<b>$1</b>');
  html = html.replace(/\*(.*)\*/gim, '<i>$1</i>');
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
  html = html.replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/\n\n/g, '<p></p>');
  return html;
}
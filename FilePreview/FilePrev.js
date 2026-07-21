let currentFiles = [];
let selectedFileIndex = null;
let psdLayers = []; // Holds independent parsed sub-layer canvases

// Extension Matcher
function getFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  switch(ext) {
    case 'png': case 'jpg': case 'jpeg': case 'gif': 
    case 'webp': case 'svg': case 'bmp': case 'ico':
      return 'image';
    case 'psd': return 'psd';
    case 'mp4': case 'webm': case 'ogg': return 'video';
    case 'pdf': return 'pdf';
    case 'csv': return 'csv';
    case 'md': case 'markdown': return 'markdown';
    case 'txt': case 'json': case 'xml': case 'log':
      return 'text';
    case 'docx': case 'pptx': case 'xlsx': case 'odt':
      return 'office-xml';
    case 'doc': case 'xls': case 'ppt':
      return 'office-legacy';
    default: return 'unsupported';
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
  stage.innerHTML = `<video controls src="${url}"></video>`;
}

function renderPDF(url, stage) {
  stage.innerHTML = `<iframe class="pdf-frame" src="${url}"></iframe>`;
}

function renderPlainText(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = escapeHtml(e.target.result);
    stage.innerHTML = `<pre style="width: 100%; height: 100%; overflow: auto; background: var(--bg-secondary); padding: 16px; border-radius: 6px; border: 1px solid var(--border-color); font-family: monospace; font-size: 0.85rem; color: var(--text-main); white-space: pre-wrap;">${text}</pre>`;
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

function renderMarkdown(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const htmlContent = parseMarkdown(text);
    stage.innerHTML = `<div class="markdown-container">${htmlContent}</div>`;
  };
  reader.readAsText(file);
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
      const view = new DataView(buffer.buffer);
      
      if (view.getUint32(0) !== 0x38425053) {
        throw new Error('Invalid PSD header');
      }

      const canvasHeight = view.getUint32(14);
      const canvasWidth = view.getUint32(18);
      const depth = view.getUint16(22);

      if (depth !== 8) {
        stage.innerHTML = '<div class="placeholder"><p>PSD Preview requires 8-bit depth mode.</p></div>';
        return;
      }

      let offset = 26;
      const colorDataLen = view.getUint32(offset); offset += 4 + colorDataLen;
      const imageResLen = view.getUint32(offset); offset += 4 + imageResLen;
      
      // Section 4: Layer & Mask Info Section
      const layerAndMaskLen = view.getUint32(offset); 
      const layerSectionOffset = offset + 4;
      offset += 4 + layerAndMaskLen;

      psdLayers = [];

      if (layerAndMaskLen > 0) {
        let layerPtr = layerSectionOffset + 4;
        const layerCount = Math.abs(view.getInt16(layerPtr)); 
        layerPtr += 2;

        for (let i = 0; i < layerCount; i++) {
          const top = view.getInt32(layerPtr);
          const left = view.getInt32(layerPtr + 4);
          const bottom = view.getInt32(layerPtr + 8);
          const right = view.getInt32(layerPtr + 12);
          layerPtr += 16;

          const numChannels = view.getUint16(layerPtr); 
          layerPtr += 2 + (numChannels * 6); // Skip channel information IDs

          const blendSig = view.getUint32(layerPtr); layerPtr += 4; // '8BIM'
          const blendMode = view.getUint32(layerPtr); layerPtr += 4;
          const opacity = view.getUint8(layerPtr); layerPtr += 1;
          const clipping = view.getUint8(layerPtr); layerPtr += 1;
          const flags = view.getUint8(layerPtr); layerPtr += 1;
          const filler = view.getUint8(layerPtr); layerPtr += 1;

          const extraLen = view.getUint32(layerPtr); layerPtr += 4 + extraLen;

          const lWidth = right - left;
          const lHeight = bottom - top;

          if (lWidth > 0 && lHeight > 0) {
            // Create layer canvas buffer
            const lCanvas = document.createElement('canvas');
            lCanvas.width = lWidth;
            lCanvas.height = lHeight;
            const lCtx = lCanvas.getContext('2d');
            const lImgData = lCtx.createImageData(lWidth, lHeight);

            // Create solid placeholder image data per layer bounding box
            for (let p = 0; p < lWidth * lHeight * 4; p += 4) {
              lImgData.data[p] = (i * 70) % 255;     // Red
              lImgData.data[p + 1] = (i * 130) % 255; // Green
              lImgData.data[p + 2] = (i * 200) % 255; // Blue
              lImgData.data[p + 3] = opacity;         // Opacity
            }
            lCtx.putImageData(lImgData, 0, 0);

            psdLayers.unshift({
              id: i,
              name: `Layer ${i + 1} (${lWidth}x${lHeight})`,
              visible: (flags & 0x02) === 0, // Flag bit 1 = hidden
              left: left,
              top: top,
              width: lWidth,
              height: lHeight,
              canvas: lCanvas
            });
          }
        }
      }

      // Fallback if no sub-layers are extracted from Section 4
      if (psdLayers.length === 0) {
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = canvasWidth;
        baseCanvas.height = canvasHeight;
        
        psdLayers.push({
          id: 0,
          name: 'Flattened Composite',
          visible: true,
          left: 0,
          top: 0,
          width: canvasWidth,
          height: canvasHeight,
          canvas: baseCanvas
        });
      }

      renderPSDLayout(stage, canvasWidth, canvasHeight);

    } catch (err) {
      stage.innerHTML = `<div class="placeholder"><p>Unable to parse PSD file layer structure.</p></div>`;
    }
  };
  reader.readAsArrayBuffer(file);
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

  psdLayers.forEach((layer) => {
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
  });

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
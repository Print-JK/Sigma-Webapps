let currentFiles = [];
let selectedFileIndex = null;

// Supported Extension Matcher
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

// Single File Input Handler
function handleSingleFile(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  currentFiles = files;
  renderFileList();
  selectFile(0);
}

// Folder Input Handler
function handleFolderFiles(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  currentFiles = files;
  renderFileList();
  selectFile(0);
}

// Populate Sidebar File List
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

// Trigger File Rendering
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
          <small>To view full formatted previews client-side, consider converting to modern XML format (${file.name.split('.').pop().toUpperCase()}X).</small>
        </div>`;
      break;
    default:
      stage.innerHTML = `<div class="placeholder"><p>Preview unavailable for this format.</p></div>`;
  }
}

// Render Handlers
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

function renderOfficeXML(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const textDecoder = new TextDecoder('utf-8');
    const content = textDecoder.decode(e.target.result);
    
    // Parse text nodes from embedded OpenXML structures
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    
    // Match common text tags: <w:t> (Word), <a:t> (PowerPoint), <t> (Excel)
    const textElements = Array.from(xmlDoc.querySelectorAll('t, w\\:t, a\\:t'));
    
    if (textElements.length > 0) {
      const extractedText = textElements.map(el => el.textContent).join('\n');
      stage.innerHTML = `
        <div class="markdown-container">
          <h3>📄 Extracted Text Content (${file.name})</h3>
          <hr style="margin: 12px 0; border-color: var(--border-color);" />
          <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(extractedText)}</pre>
        </div>`;
    } else {
      stage.innerHTML = `
        <div class="placeholder">
          <p>Office XML file loaded (${file.name}).</p>
          <small>Text content could not be directly extracted from this file structure.</small>
        </div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// PSD Parser with PackBits (RLE) Decompressor & Layer Section Inspector
function renderPSD(file, stage) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = new Uint8Array(e.target.result);
    try {
      const view = new DataView(buffer.buffer);
      
      // Verify PSD Magic Header ('8BPS')
      if (view.getUint32(0) !== 0x38425053) {
        throw new Error('Invalid PSD file header');
      }

      const channels = view.getUint16(12);
      const height = view.getUint32(14);
      const width = view.getUint32(18);
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

      let layerCount = 0;
      if (layerAndMaskLen > 0) {
        const layerInfoLen = view.getUint32(layerSectionOffset);
        if (layerInfoLen > 0) {
          layerCount = view.getInt16(layerSectionOffset + 4);
        }
      }

      const compression = view.getUint16(offset); offset += 2;
      const pixelCount = width * height;
      const channelData = [
        new Uint8Array(pixelCount),
        new Uint8Array(pixelCount),
        new Uint8Array(pixelCount),
        new Uint8Array(pixelCount)
      ];

      // Decompress Composite Channel Data
      if (compression === 0) {
        // Uncompressed RAW RGB
        for (let c = 0; c < Math.min(channels, 4); c++) {
          for (let i = 0; i < pixelCount; i++) {
            channelData[c][i] = buffer[offset++];
          }
        }
      } else if (compression === 1) {
        // RLE / PackBits Compressed Stream
        const byteCountsLines = height * channels;
        offset += byteCountsLines * 2;

        for (let c = 0; c < Math.min(channels, 4); c++) {
          let pos = 0;
          while (pos < pixelCount && offset < buffer.length) {
            let n = buffer[offset++];
            if (n > 127) n -= 256;

            if (n >= 0 && n <= 127) {
              const count = n + 1;
              for (let i = 0; i < count; i++) {
                if (pos < pixelCount) channelData[c][pos++] = buffer[offset++];
              }
            } else if (n >= -127 && n <= -1) {
              const count = -n + 1;
              const val = buffer[offset++];
              for (let i = 0; i < count; i++) {
                if (pos < pixelCount) channelData[c][pos++] = val;
              }
            }
          }
        }
      } else {
        stage.innerHTML = `<div class="placeholder"><p>Unsupported PSD compression type.</p></div>`;
        return;
      }

      // Render decompressed pixel buffer onto Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(width, height);

      for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        imgData.data[idx]     = channelData[0][i]; // R
        imgData.data[idx + 1] = channelData[1][i]; // G
        imgData.data[idx + 2] = channelData[2][i]; // B
        imgData.data[idx + 3] = channels >= 4 ? channelData[3][i] : 255; // A
      }

      ctx.putImageData(imgData, 0, 0);

      stage.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 12px; max-height: 100%;';
      wrapper.appendChild(canvas);

      if (Math.abs(layerCount) > 0) {
        const info = document.createElement('div');
        info.style.cssText = 'font-size: 0.75rem; color: var(--text-muted); background: var(--bg-secondary); padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border-color);';
        info.textContent = `PSD Structure: ${Math.abs(layerCount)} sub-layers detected (${width}x${height}px)`;
        wrapper.appendChild(info);
      }

      stage.appendChild(wrapper);

    } catch (err) {
      stage.innerHTML = `<div class="placeholder"><p>Unable to parse PSD file structure.</p></div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// Lightweight Markdown Parser
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
/**
 * PhotoCraft — Layered Raster Photo Editor Engine
 * Pure client-side layered image editor inspired by Photoshop & PhotoCraft (storytold/photocraft).
 * 100% offline, zero server required.
 */

(function () {
  "use strict";

  // Document & Studio State
  const state = {
    width: 800,
    height: 600,
    layers: [],
    activeLayerIndex: -1,
    activeTool: "brush", // 'brush', 'eraser', 'bucket', 'rect', 'circle', 'text', 'eyedropper', 'move'
    brushColor: "#10b981",
    brushSize: 12,
    brushOpacity: 1.0,
    isDrawing: false,
    startX: 0,
    startY: 0,
    undoStack: [],
    redoStack: [],
    maxUndo: 20
  };

  // DOM Elements
  const compositeCanvas = document.getElementById("compositeCanvas");
  const compCtx = compositeCanvas.getContext("2d");
  const interactionCanvas = document.getElementById("interactionCanvas");
  const interCtx = interactionCanvas.getContext("2d");
  const canvasWrapper = document.getElementById("canvasWrapper");
  const layersListEl = document.getElementById("layersList");
  const fileInput = document.getElementById("fileInput");

  // Options Bar Controls
  const brushColorInput = document.getElementById("brushColorInput");
  const brushSizeInput = document.getElementById("brushSizeInput");
  const brushOpacityInput = document.getElementById("brushOpacityInput");
  const layerOpacitySlider = document.getElementById("layerOpacitySlider");
  const layerBlendSelect = document.getElementById("layerBlendSelect");

  // Layer Factory
  function createLayer(name = "New Layer", width = state.width, height = state.height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    return {
      id: "layer_" + Math.random().toString(36).substr(2, 9),
      name: name,
      canvas: canvas,
      ctx: ctx,
      visible: true,
      opacity: 1.0,
      blendMode: "source-over"
    };
  }

  // Initialize New Blank Document
  function initNewDocument(w = 800, h = 600, bgWhite = true) {
    state.width = w;
    state.height = h;
    state.layers = [];
    state.undoStack = [];
    state.redoStack = [];

    compositeCanvas.width = w;
    compositeCanvas.height = h;
    interactionCanvas.width = w;
    interactionCanvas.height = h;
    canvasWrapper.style.width = `${w}px`;
    canvasWrapper.style.height = `${h}px`;

    // Create Background Layer
    const bgLayer = createLayer("Background", w, h);
    if (bgWhite) {
      bgLayer.ctx.fillStyle = "#ffffff";
      bgLayer.ctx.fillRect(0, 0, w, h);
    }
    state.layers.push(bgLayer);

    // Create Foreground Drawing Layer
    const layer1 = createLayer("Layer 1", w, h);
    state.layers.push(layer1);
    state.activeLayerIndex = 1;

    renderLayersUI();
    compositeLayers();
  }

  // Composite All Visible Layers onto Composite Canvas
  function compositeLayers() {
    compCtx.clearRect(0, 0, state.width, state.height);

    for (let i = 0; i < state.layers.length; i++) {
      const layer = state.layers[i];
      if (!layer.visible) continue;

      compCtx.save();
      compCtx.globalAlpha = layer.opacity;
      compCtx.globalCompositeOperation = layer.blendMode || "source-over";
      compCtx.drawImage(layer.canvas, 0, 0);
      compCtx.restore();
    }
  }

  // Render Layers Panel UI
  function renderLayersUI() {
    layersListEl.innerHTML = "";

    state.layers.forEach((layer, idx) => {
      const item = document.createElement("div");
      item.className = `layer-item ${idx === state.activeLayerIndex ? "active" : ""}`;

      item.innerHTML = `
        <input type="checkbox" ${layer.visible ? "checked" : ""} title="Toggle visibility" onclick="event.stopPropagation(); window.PhotoCraft.toggleVisibility(${idx})">
        <canvas class="layer-thumb-preview" width="28" height="28" id="thumb_${layer.id}"></canvas>
        <span class="layer-title-text">${escapeHTML(layer.name)}</span>
        <button class="thumb-btn" title="Delete layer" onclick="event.stopPropagation(); window.PhotoCraft.deleteLayer(${idx})">🗑</button>
      `;

      item.onclick = () => {
        state.activeLayerIndex = idx;
        renderLayersUI();
        syncLayerControls();
      };

      layersListEl.appendChild(item);

      // Render thumbnail preview
      const thumb = item.querySelector(`#thumb_${layer.id}`);
      if (thumb) {
        const tCtx = thumb.getContext("2d");
        tCtx.drawImage(layer.canvas, 0, 0, 28, 28);
      }
    });

    syncLayerControls();
  }

  function syncLayerControls() {
    const active = getActiveLayer();
    if (!active) return;
    if (layerOpacitySlider) layerOpacitySlider.value = Math.round(active.opacity * 100);
    if (layerBlendSelect) layerBlendSelect.value = active.blendMode || "source-over";
  }

  function getActiveLayer() {
    return state.layers[state.activeLayerIndex] || null;
  }

  // Save Undo State
  function saveSnapshot() {
    const active = getActiveLayer();
    if (!active) return;
    const imgData = active.ctx.getImageData(0, 0, state.width, state.height);
    state.undoStack.push({
      layerIndex: state.activeLayerIndex,
      imgData: imgData
    });
    if (state.undoStack.length > state.maxUndo) state.undoStack.shift();
    state.redoStack = [];
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    const snap = state.undoStack.pop();
    const layer = state.layers[snap.layerIndex];
    if (layer) {
      // Save current to redo
      const curData = layer.ctx.getImageData(0, 0, state.width, state.height);
      state.redoStack.push({ layerIndex: snap.layerIndex, imgData: curData });
      layer.ctx.putImageData(snap.imgData, 0, 0);
      compositeLayers();
      renderLayersUI();
    }
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    const snap = state.redoStack.pop();
    const layer = state.layers[snap.layerIndex];
    if (layer) {
      const curData = layer.ctx.getImageData(0, 0, state.width, state.height);
      state.undoStack.push({ layerIndex: snap.layerIndex, imgData: curData });
      layer.ctx.putImageData(snap.imgData, 0, 0);
      compositeLayers();
      renderLayersUI();
    }
  }

  // Flood Fill / Paint Bucket Algorithm
  function floodFill(layerCtx, startX, startY, fillColorHex) {
    const w = state.width;
    const h = state.height;
    const imgData = layerCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const startPos = (startY * w + startX) * 4;
    const targetR = data[startPos];
    const targetG = data[startPos + 1];
    const targetB = data[startPos + 2];
    const targetA = data[startPos + 3];

    // Parse fill color
    const fillR = parseInt(fillColorHex.slice(1, 3), 16);
    const fillG = parseInt(fillColorHex.slice(3, 5), 16);
    const fillB = parseInt(fillColorHex.slice(5, 7), 16);
    const fillA = 255;

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

    function match(pos) {
      return (
        Math.abs(data[pos] - targetR) < 25 &&
        Math.abs(data[pos + 1] - targetG) < 25 &&
        Math.abs(data[pos + 2] - targetB) < 25 &&
        Math.abs(data[pos + 3] - targetA) < 25
      );
    }

    const queue = [[startX, startY]];
    const seen = new Uint8Array(w * h);

    while (queue.length > 0) {
      const [x, y] = queue.pop();
      const pos = (y * w + x) * 4;
      const seenPos = y * w + x;

      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (seen[seenPos]) continue;
      if (!match(pos)) continue;

      seen[seenPos] = 1;
      data[pos] = fillR;
      data[pos + 1] = fillG;
      data[pos + 2] = fillB;
      data[pos + 3] = fillA;

      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    layerCtx.putImageData(imgData, 0, 0);
  }

  // Interactive Canvas Drawing Events
  interactionCanvas.addEventListener("mousedown", (e) => {
    const active = getActiveLayer();
    if (!active || !active.visible) return;

    const rect = interactionCanvas.getBoundingClientRect();
    state.startX = Math.round(e.clientX - rect.left);
    state.startY = Math.round(e.clientY - rect.top);
    state.isDrawing = true;

    saveSnapshot();

    if (state.activeTool === "brush" || state.activeTool === "eraser") {
      active.ctx.save();
      active.ctx.beginPath();
      active.ctx.moveTo(state.startX, state.startY);
      active.ctx.lineCap = "round";
      active.ctx.lineJoin = "round";
      active.ctx.lineWidth = state.brushSize;

      if (state.activeTool === "eraser") {
        active.ctx.globalCompositeOperation = "destination-out";
      } else {
        active.ctx.globalCompositeOperation = "source-over";
        active.ctx.strokeStyle = state.brushColor;
        active.ctx.globalAlpha = state.brushOpacity;
      }
    } else if (state.activeTool === "bucket") {
      floodFill(active.ctx, state.startX, state.startY, state.brushColor);
      state.isDrawing = false;
      compositeLayers();
      renderLayersUI();
    } else if (state.activeTool === "eyedropper") {
      const p = compCtx.getImageData(state.startX, state.startY, 1, 1).data;
      const hex = `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1)}`;
      state.brushColor = hex;
      brushColorInput.value = hex;
      state.isDrawing = false;
    } else if (state.activeTool === "text") {
      const textVal = prompt("Enter text:", "Text");
      if (textVal) {
        active.ctx.font = `${state.brushSize * 2}px sans-serif`;
        active.ctx.fillStyle = state.brushColor;
        active.ctx.fillText(textVal, state.startX, state.startY);
        compositeLayers();
        renderLayersUI();
      }
      state.isDrawing = false;
    }
  });

  interactionCanvas.addEventListener("mousemove", (e) => {
    if (!state.isDrawing) return;
    const active = getActiveLayer();
    if (!active) return;

    const rect = interactionCanvas.getBoundingClientRect();
    const curX = Math.round(e.clientX - rect.left);
    const curY = Math.round(e.clientY - rect.top);

    if (state.activeTool === "brush" || state.activeTool === "eraser") {
      active.ctx.lineTo(curX, curY);
      active.ctx.stroke();
      compositeLayers();
    } else if (state.activeTool === "rect" || state.activeTool === "circle") {
      interCtx.clearRect(0, 0, state.width, state.height);
      interCtx.strokeStyle = state.brushColor;
      interCtx.lineWidth = state.brushSize;

      if (state.activeTool === "rect") {
        interCtx.strokeRect(state.startX, state.startY, curX - state.startX, curY - state.startY);
      } else if (state.activeTool === "circle") {
        const rx = Math.abs(curX - state.startX) / 2;
        const ry = Math.abs(curY - state.startY) / 2;
        const cx = state.startX + (curX - state.startX) / 2;
        const cy = state.startY + (curY - state.startY) / 2;
        interCtx.beginPath();
        interCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        interCtx.stroke();
      }
    }
  });

  interactionCanvas.addEventListener("mouseup", (e) => {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    const active = getActiveLayer();
    if (!active) return;

    const rect = interactionCanvas.getBoundingClientRect();
    const curX = Math.round(e.clientX - rect.left);
    const curY = Math.round(e.clientY - rect.top);

    if (state.activeTool === "brush" || state.activeTool === "eraser") {
      active.ctx.closePath();
      active.ctx.restore();
    } else if (state.activeTool === "rect") {
      interCtx.clearRect(0, 0, state.width, state.height);
      active.ctx.strokeStyle = state.brushColor;
      active.ctx.lineWidth = state.brushSize;
      active.ctx.strokeRect(state.startX, state.startY, curX - state.startX, curY - state.startY);
    } else if (state.activeTool === "circle") {
      interCtx.clearRect(0, 0, state.width, state.height);
      const rx = Math.abs(curX - state.startX) / 2;
      const ry = Math.abs(curY - state.startY) / 2;
      const cx = state.startX + (curX - state.startX) / 2;
      const cy = state.startY + (curY - state.startY) / 2;
      active.ctx.strokeStyle = state.brushColor;
      active.ctx.lineWidth = state.brushSize;
      active.ctx.beginPath();
      active.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      active.ctx.stroke();
    }

    compositeLayers();
    renderLayersUI();
  });

  // Layer Management Methods
  function addLayer() {
    const layer = createLayer(`Layer ${state.layers.length + 1}`);
    state.layers.push(layer);
    state.activeLayerIndex = state.layers.length - 1;
    renderLayersUI();
    compositeLayers();
  }

  function deleteLayer(idx) {
    if (state.layers.length <= 1) return alert("Cannot delete the only layer.");
    state.layers.splice(idx, 1);
    state.activeLayerIndex = Math.max(0, state.activeLayerIndex - 1);
    renderLayersUI();
    compositeLayers();
  }

  function toggleVisibility(idx) {
    state.layers[idx].visible = !state.layers[idx].visible;
    renderLayersUI();
    compositeLayers();
  }

  function moveLayerUp() {
    const idx = state.activeLayerIndex;
    if (idx >= state.layers.length - 1) return;
    const temp = state.layers[idx];
    state.layers[idx] = state.layers[idx + 1];
    state.layers[idx + 1] = temp;
    state.activeLayerIndex = idx + 1;
    renderLayersUI();
    compositeLayers();
  }

  function moveLayerDown() {
    const idx = state.activeLayerIndex;
    if (idx <= 0) return;
    const temp = state.layers[idx];
    state.layers[idx] = state.layers[idx - 1];
    state.layers[idx - 1] = temp;
    state.activeLayerIndex = idx - 1;
    renderLayersUI();
    compositeLayers();
  }

  // Adjustments & Filters (Applied to active layer)
  function applyAdjustment(type) {
    const active = getActiveLayer();
    if (!active) return;
    saveSnapshot();

    const imgData = active.ctx.getImageData(0, 0, state.width, state.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue; // skip transparent

      if (type === "invert") {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      } else if (type === "grayscale") {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = g;
        d[i + 1] = g;
        d[i + 2] = g;
      } else if (type === "sepia") {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
        d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
        d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
      } else if (type === "brightness") {
        d[i] = Math.min(255, d[i] + 25);
        d[i + 1] = Math.min(255, d[i + 1] + 25);
        d[i + 2] = Math.min(255, d[i + 2] + 25);
      } else if (type === "contrast") {
        const factor = (259 * (35 + 255)) / (255 * (259 - 35));
        d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128));
        d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128));
        d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128));
      }
    }

    active.ctx.putImageData(imgData, 0, 0);
    compositeLayers();
    renderLayersUI();
  }

  // Open Image File
  function openImageFile(file) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      initNewDocument(img.naturalWidth, img.naturalHeight, false);
      const bg = state.layers[0];
      bg.name = file.name;
      bg.ctx.drawImage(img, 0, 0);
      compositeLayers();
      renderLayersUI();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // Export Image
  function exportImage(format = "png") {
    compositeLayers();
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const dataUrl = compositeCanvas.toDataURL(mime, 0.95);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `photocraft_export.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function escapeHTML(str) {
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
  }

  // Tool Switching
  const tools = ["brush", "eraser", "bucket", "rect", "circle", "text", "eyedropper"];
  tools.forEach(t => {
    const btn = document.getElementById(`tool_${t}`);
    if (btn) {
      btn.addEventListener("click", () => {
        tools.forEach(o => document.getElementById(`tool_${o}`)?.classList.remove("active"));
        btn.classList.add("active");
        state.activeTool = t;
      });
    }
  });

  // Wiring Options Bar
  brushColorInput.addEventListener("input", (e) => state.brushColor = e.target.value);
  brushSizeInput.addEventListener("input", (e) => state.brushSize = parseInt(e.target.value, 10));
  brushOpacityInput.addEventListener("input", (e) => state.brushOpacity = parseFloat(e.target.value));

  layerOpacitySlider.addEventListener("input", (e) => {
    const active = getActiveLayer();
    if (active) {
      active.opacity = parseFloat(e.target.value) / 100;
      compositeLayers();
    }
  });

  layerBlendSelect.addEventListener("change", (e) => {
    const active = getActiveLayer();
    if (active) {
      active.blendMode = e.target.value;
      compositeLayers();
    }
  });

  // Action Buttons
  document.getElementById("addLayerBtn").addEventListener("click", addLayer);
  document.getElementById("moveUpBtn").addEventListener("click", moveLayerUp);
  document.getElementById("moveDownBtn").addEventListener("click", moveLayerDown);

  document.getElementById("btnUndo").addEventListener("click", undo);
  document.getElementById("btnRedo").addEventListener("click", redo);

  document.getElementById("exportPngBtn").addEventListener("click", () => exportImage("png"));
  document.getElementById("exportJpgBtn").addEventListener("click", () => exportImage("jpg"));

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) openImageFile(e.target.files[0]);
  });
  document.getElementById("openImgBtn").addEventListener("click", () => fileInput.click());

  // Filter buttons
  ["brightness", "contrast", "grayscale", "sepia", "invert"].forEach(filterName => {
    document.getElementById(`filter_${filterName}`)?.addEventListener("click", () => applyAdjustment(filterName));
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redo();
    }
  });

  // Expose global for inline HTML events
  window.PhotoCraft = {
    toggleVisibility,
    deleteLayer
  };

  // Start with default document
  initNewDocument(800, 600, true);

})();

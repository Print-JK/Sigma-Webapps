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
    activeTool: "brush", // marquee, brush, eraser, bucket, gradient, shapes, text, eyedropper
    brushColor: "#10b981",
    brushSize: 12,
    brushOpacity: 1.0,
    isDrawing: false,
    editingMask: false,
    startX: 0,
    startY: 0,
    selection: null,
    previewSelection: null,
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
  const gradientEndColorInput = document.getElementById("gradientEndColorInput");
  const gradientTypeSelect = document.getElementById("gradientTypeSelect");
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
      maskCanvas: null,
      maskCompositeCanvas: null,
      maskEnabled: false,
      locked: false,
      visible: true,
      opacity: 1.0,
      blendMode: "source-over"
    };
  }

  // Initialize New Blank Document
  function initNewDocument(w = 800, h = 600, bgWhite = true) {
    state.width = w;
    state.height = h;
    state.selection = null;
    state.previewSelection = null;
    state.layers = [];
    state.undoStack = [];
    state.redoStack = [];

    compositeCanvas.width = w;
    compositeCanvas.height = h;
    interactionCanvas.width = w;
    interactionCanvas.height = h;
    interCtx.setLineDash([]);
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
      if (layer.maskEnabled && layer.maskCanvas) {
        if (!layer.maskCompositeCanvas) {
          layer.maskCompositeCanvas = document.createElement("canvas");
          layer.maskCompositeCanvas.width = state.width; layer.maskCompositeCanvas.height = state.height;
        }
        const masked = layer.maskCompositeCanvas;
        const maskedCtx = masked.getContext("2d");
        maskedCtx.save();
        maskedCtx.globalCompositeOperation = "source-over";
        maskedCtx.clearRect(0, 0, state.width, state.height);
        maskedCtx.drawImage(layer.canvas, 0, 0);
        maskedCtx.globalCompositeOperation = "destination-in";
        maskedCtx.drawImage(layer.maskCanvas, 0, 0);
        maskedCtx.restore();
        compCtx.drawImage(masked, 0, 0);
      } else compCtx.drawImage(layer.canvas, 0, 0);
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
        <button class="thumb-btn" title="Add or edit layer mask" onclick="event.stopPropagation(); window.PhotoCraft.editMask(${idx})">${layer.maskEnabled ? (state.editingMask && idx === state.activeLayerIndex ? "Mask ✓" : "Mask") : "+ Mask"}</button>
        <button class="thumb-btn" title="Toggle layer lock" onclick="event.stopPropagation(); window.PhotoCraft.toggleLock(${idx})">${layer.locked ? "🔒" : "🔓"}</button>
        <button class="thumb-btn" title="Delete layer" onclick="event.stopPropagation(); window.PhotoCraft.deleteLayer(${idx})">🗑</button>
      `;

      item.onclick = () => {
        state.editingMask = false;
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
    const isMask = state.editingMask && active.maskEnabled;
    const target = isMask ? active.maskCanvas.getContext("2d") : active.ctx;
    const imgData = target.getImageData(0, 0, state.width, state.height);
    state.undoStack.push({
      layerIndex: state.activeLayerIndex,
      isMask,
      imgData: imgData
    });
    if (state.undoStack.length > state.maxUndo) state.undoStack.shift();
    state.redoStack = [];
  }

  function editMask(index) {
    const layer = state.layers[index];
    if (!layer) return;
    const wasEditingThisMask = state.editingMask && state.activeLayerIndex === index;
    state.activeLayerIndex = index;
    if (!layer.maskEnabled) {
      layer.maskCanvas = document.createElement("canvas");
      layer.maskCanvas.width = state.width; layer.maskCanvas.height = state.height;
      const maskCtx = layer.maskCanvas.getContext("2d");
      maskCtx.fillStyle = "#fff";
      maskCtx.fillRect(0, 0, state.width, state.height);
      layer.maskEnabled = true;
    }
    state.editingMask = !wasEditingThisMask;
    renderLayersUI();
    compositeLayers();
  }

  function toggleLock(index) {
    const layer = state.layers[index];
    if (!layer) return;
    layer.locked = !layer.locked;
    renderLayersUI();
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    const snap = state.undoStack.pop();
    const layer = state.layers[snap.layerIndex];
    if (layer) {
      // Save current to redo
      const target = snap.isMask && layer.maskCanvas ? layer.maskCanvas.getContext("2d") : layer.ctx;
      const curData = target.getImageData(0, 0, state.width, state.height);
      state.redoStack.push({ layerIndex: snap.layerIndex, isMask: snap.isMask, imgData: curData });
      target.putImageData(snap.imgData, 0, 0);
      compositeLayers();
      renderLayersUI();
    }
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    const snap = state.redoStack.pop();
    const layer = state.layers[snap.layerIndex];
    if (layer) {
      const target = snap.isMask && layer.maskCanvas ? layer.maskCanvas.getContext("2d") : layer.ctx;
      const curData = target.getImageData(0, 0, state.width, state.height);
      state.undoStack.push({ layerIndex: snap.layerIndex, isMask: snap.isMask, imgData: curData });
      target.putImageData(snap.imgData, 0, 0);
      compositeLayers();
      renderLayersUI();
    }
  }

  // Flood Fill / Paint Bucket Algorithm
  function floodFill(layerCtx, startX, startY, fillColorHex, maskMode = false) {
    const w = state.width;
    const h = state.height;
    startX = Math.max(0, Math.min(w - 1, startX));
    startY = Math.max(0, Math.min(h - 1, startY));
    if (!selectionContains(startX, startY)) return;
    const imgData = layerCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const startPos = (startY * w + startX) * 4;
    const targetR = data[startPos];
    const targetG = data[startPos + 1];
    const targetB = data[startPos + 2];
    const targetA = data[startPos + 3];

    // Parse fill color
    let fillR = parseInt(fillColorHex.slice(1, 3), 16);
    let fillG = parseInt(fillColorHex.slice(3, 5), 16);
    let fillB = parseInt(fillColorHex.slice(5, 7), 16);
    let fillA = 255;
    if (maskMode) {
      fillA = Math.round((0.2126 * fillR + 0.7152 * fillG + 0.0722 * fillB));
      fillR = fillG = fillB = 255;
    }

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
      if (!selectionContains(x, y)) continue;
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

  function canvasPoint(event) {
    const rect = interactionCanvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(state.width, Math.round((event.clientX - rect.left) * state.width / rect.width))),
      y: Math.max(0, Math.min(state.height, Math.round((event.clientY - rect.top) * state.height / rect.height)))
    };
  }

  function selectionContains(x, y) {
    const selection = state.selection;
    if (!selection) return true;
    const left = Math.min(selection.x, selection.x + selection.w);
    const right = Math.max(selection.x, selection.x + selection.w);
    const top = Math.min(selection.y, selection.y + selection.h);
    const bottom = Math.max(selection.y, selection.y + selection.h);
    if (selection.type === "ellipse") {
      const rx = Math.max(0.5, (right - left) / 2), ry = Math.max(0.5, (bottom - top) / 2);
      const dx = (x + 0.5 - (left + right) / 2) / rx;
      const dy = (y + 0.5 - (top + bottom) / 2) / ry;
      return dx * dx + dy * dy <= 1;
    }
    return x >= left && x < right && y >= top && y < bottom;
  }

  function clipToSelection(ctx) {
    const selection = state.selection;
    if (!selection) return;
    const left = Math.min(selection.x, selection.x + selection.w);
    const top = Math.min(selection.y, selection.y + selection.h);
    const width = Math.abs(selection.w), height = Math.abs(selection.h);
    ctx.beginPath();
    if (selection.type === "ellipse") ctx.ellipse(left + width / 2, top + height / 2, Math.max(0.5, width / 2), Math.max(0.5, height / 2), 0, 0, Math.PI * 2);
    else ctx.rect(left, top, width, height);
    ctx.clip();
  }

  function paintMarquee(ctx, selection) {
    if (!selection || Math.abs(selection.w) < 1 || Math.abs(selection.h) < 1) return;
    const left = Math.min(selection.x, selection.x + selection.w);
    const top = Math.min(selection.y, selection.y + selection.h);
    const width = Math.abs(selection.w), height = Math.abs(selection.h);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -1;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    if (selection.type === "ellipse") ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    else ctx.rect(left + .5, top + .5, Math.max(0, width - 1), Math.max(0, height - 1));
    ctx.stroke();
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = 4;
    ctx.strokeStyle = "#111";
    ctx.stroke();
    ctx.restore();
  }

  function renderSelectionOverlay(preview = null) {
    interCtx.clearRect(0, 0, state.width, state.height);
    paintMarquee(interCtx, preview || state.selection);
  }

  function colorWithMaskAlpha(color) {
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    const alpha = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    return `rgba(255,255,255,${alpha})`;
  }

  function paintGradient(ctx, x1, y1, x2, y2, maskMode = false) {
    const gradient = gradientTypeSelect.value === "radial"
      ? ctx.createRadialGradient(x1, y1, 0, x1, y1, Math.max(1, Math.hypot(x2 - x1, y2 - y1)))
      : ctx.createLinearGradient(x1, y1, x2, y2);
    const startColor = maskMode ? colorWithMaskAlpha(state.brushColor) : state.brushColor;
    const endColor = maskMode ? colorWithMaskAlpha(gradientEndColorInput.value) : gradientEndColorInput.value;
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    ctx.save();
    clipToSelection(ctx);
    ctx.globalAlpha = state.brushOpacity;
    ctx.globalCompositeOperation = maskMode ? "copy" : "source-over";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  // Interactive Canvas Drawing Events
  interactionCanvas.addEventListener("mousedown", (e) => {
    const point = canvasPoint(e);
    state.startX = point.x;
    state.startY = point.y;
    if (state.activeTool === "rectMarquee" || state.activeTool === "ellipseMarquee") {
      state.isDrawing = true;
      state.previewSelection = { type: state.activeTool === "ellipseMarquee" ? "ellipse" : "rect", x: point.x, y: point.y, w: 0, h: 0 };
      renderSelectionOverlay(state.previewSelection);
      return;
    }
    const active = getActiveLayer();
    if (!active || !active.visible || active.locked) return;
    const targetCtx = state.editingMask && active.maskEnabled ? active.maskCanvas.getContext("2d") : active.ctx;

    state.isDrawing = true;
    state.previewSelection = null;
    if (state.activeTool !== "eyedropper") saveSnapshot();

    if (state.activeTool === "brush" || state.activeTool === "eraser") {
      targetCtx.save();
      clipToSelection(targetCtx);
      targetCtx.beginPath();
      targetCtx.moveTo(state.startX, state.startY);
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";
      targetCtx.lineWidth = state.brushSize;

      if (state.activeTool === "eraser") {
        targetCtx.globalCompositeOperation = "destination-out";
      } else {
        targetCtx.globalCompositeOperation = "source-over";
        if (state.editingMask && active.maskEnabled) {
          const hex = state.brushColor.slice(1);
          const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          if (luminance <= 0.5) targetCtx.globalCompositeOperation = "destination-out";
          targetCtx.globalAlpha = state.brushOpacity * (luminance <= 0.5 ? 1 - luminance : luminance);
          targetCtx.strokeStyle = "#fff";
        } else {
          targetCtx.strokeStyle = state.brushColor;
          targetCtx.globalAlpha = state.brushOpacity;
        }
      }
    } else if (state.activeTool === "bucket") {
      floodFill(targetCtx, state.startX, state.startY, state.brushColor, state.editingMask && active.maskEnabled);
      state.isDrawing = false;
      compositeLayers();
      renderLayersUI();
    } else if (state.activeTool === "gradient") {
      interCtx.clearRect(0, 0, state.width, state.height);
      paintGradient(interCtx, state.startX, state.startY, state.startX + 1, state.startY, false);
    } else if (state.activeTool === "eyedropper") {
      const p = compCtx.getImageData(state.startX, state.startY, 1, 1).data;
      const hex = `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1)}`;
      state.brushColor = hex;
      brushColorInput.value = hex;
      state.isDrawing = false;
    } else if (state.activeTool === "text") {
      const textVal = prompt("Enter text:", "Text");
      if (textVal) {
        active.ctx.save();
        clipToSelection(active.ctx);
        active.ctx.font = `${state.brushSize * 2}px sans-serif`;
        active.ctx.fillStyle = state.brushColor;
        active.ctx.fillText(textVal, state.startX, state.startY);
        active.ctx.restore();
        compositeLayers();
        renderLayersUI();
      }
      state.isDrawing = false;
    }
  });

  interactionCanvas.addEventListener("mousemove", (e) => {
    if (!state.isDrawing) return;
    if (state.activeTool === "rectMarquee" || state.activeTool === "ellipseMarquee") {
      const point = canvasPoint(e);
      state.previewSelection = { type: state.activeTool === "ellipseMarquee" ? "ellipse" : "rect", x: state.startX, y: state.startY, w: point.x - state.startX, h: point.y - state.startY };
      renderSelectionOverlay(state.previewSelection);
      return;
    }
    const active = getActiveLayer();
    if (!active) return;
    const targetCtx = state.editingMask && active.maskEnabled ? active.maskCanvas.getContext("2d") : active.ctx;

    const point = canvasPoint(e);
    const curX = point.x;
    const curY = point.y;

    if (state.activeTool === "brush" || state.activeTool === "eraser") {
      targetCtx.lineTo(curX, curY);
      targetCtx.stroke();
      compositeLayers();
    } else if (state.activeTool === "rect" || state.activeTool === "circle") {
      interCtx.clearRect(0, 0, state.width, state.height);
      interCtx.save();
      clipToSelection(interCtx);
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
      interCtx.restore();
      paintMarquee(interCtx, state.selection);
    } else if (state.activeTool === "gradient") {
      interCtx.clearRect(0, 0, state.width, state.height);
      paintGradient(interCtx, state.startX, state.startY, curX, curY, false);
      paintMarquee(interCtx, state.selection);
    }
  });

  interactionCanvas.addEventListener("mouseup", (e) => {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    if (state.activeTool === "rectMarquee" || state.activeTool === "ellipseMarquee") {
      const point = canvasPoint(e);
      const next = { type: state.activeTool === "ellipseMarquee" ? "ellipse" : "rect", x: state.startX, y: state.startY, w: point.x - state.startX, h: point.y - state.startY };
      state.selection = Math.abs(next.w) >= 1 && Math.abs(next.h) >= 1 ? next : null;
      state.previewSelection = null;
      renderSelectionOverlay();
      return;
    }
    const active = getActiveLayer();
    if (!active) return;
    const targetCtx = state.editingMask && active.maskEnabled ? active.maskCanvas.getContext("2d") : active.ctx;

    const point = canvasPoint(e);
    const curX = point.x;
    const curY = point.y;

    if (state.activeTool === "brush" || state.activeTool === "eraser") {
      targetCtx.closePath();
      targetCtx.restore();
    } else if (state.activeTool === "rect") {
      interCtx.clearRect(0, 0, state.width, state.height);
      targetCtx.save();
      clipToSelection(targetCtx);
      targetCtx.strokeStyle = state.brushColor;
      targetCtx.lineWidth = state.brushSize;
      targetCtx.strokeRect(state.startX, state.startY, curX - state.startX, curY - state.startY);
      targetCtx.restore();
    } else if (state.activeTool === "circle") {
      interCtx.clearRect(0, 0, state.width, state.height);
      const rx = Math.abs(curX - state.startX) / 2;
      const ry = Math.abs(curY - state.startY) / 2;
      const cx = state.startX + (curX - state.startX) / 2;
      const cy = state.startY + (curY - state.startY) / 2;
      targetCtx.save();
      clipToSelection(targetCtx);
      targetCtx.strokeStyle = state.brushColor;
      targetCtx.lineWidth = state.brushSize;
      targetCtx.beginPath();
      targetCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      targetCtx.stroke();
      targetCtx.restore();
    } else if (state.activeTool === "gradient") {
      interCtx.clearRect(0, 0, state.width, state.height);
      paintGradient(targetCtx, state.startX, state.startY, curX, curY, state.editingMask && active.maskEnabled);
    }

    compositeLayers();
    renderLayersUI();
    renderSelectionOverlay();
  });

  // Layer Management Methods
  function addLayer() {
    const layer = createLayer(`Layer ${state.layers.length + 1}`);
    state.layers.push(layer);
    state.activeLayerIndex = state.layers.length - 1;
    renderLayersUI();
    compositeLayers();
  }

  function duplicateLayer() {
    const source = getActiveLayer();
    if (!source) return;
    const copy = createLayer(`${source.name} copy`);
    copy.ctx.drawImage(source.canvas, 0, 0);
    copy.opacity = source.opacity;
    copy.visible = source.visible;
    copy.blendMode = source.blendMode;
    copy.locked = false;
    if (source.maskEnabled && source.maskCanvas) {
      copy.maskCanvas = document.createElement("canvas");
      copy.maskCanvas.width = state.width; copy.maskCanvas.height = state.height;
      copy.maskCanvas.getContext("2d").drawImage(source.maskCanvas, 0, 0);
      copy.maskEnabled = true;
    }
    state.layers.splice(state.activeLayerIndex + 1, 0, copy);
    state.activeLayerIndex += 1;
    renderLayersUI();
    compositeLayers();
  }

  function mergeLayerDown() {
    const index = state.activeLayerIndex;
    if (index <= 0 || !state.layers[index]) return;
    const lower = state.layers[index - 1];
    const upper = state.layers[index];
    if (lower.locked || upper.locked) return alert("Unlock both layers before merging.");
    const merged = document.createElement("canvas");
    merged.width = state.width;
    merged.height = state.height;
    const ctx = merged.getContext("2d");
    const pixelsFor = (layer) => {
      const output = document.createElement("canvas"); output.width = state.width; output.height = state.height;
      const outputCtx = output.getContext("2d"); outputCtx.drawImage(layer.canvas, 0, 0);
      if (layer.maskEnabled && layer.maskCanvas) {
        outputCtx.globalCompositeOperation = "destination-in";
        outputCtx.drawImage(layer.maskCanvas, 0, 0);
      }
      return output;
    };
    if (lower.visible) {
      ctx.globalAlpha = lower.opacity;
      ctx.globalCompositeOperation = lower.blendMode || "source-over";
      ctx.drawImage(pixelsFor(lower), 0, 0);
    }
    if (upper.visible) {
      ctx.globalAlpha = upper.opacity;
      ctx.globalCompositeOperation = upper.blendMode || "source-over";
      ctx.drawImage(pixelsFor(upper), 0, 0);
    }
    lower.canvas = merged;
    lower.ctx = ctx;
    lower.opacity = 1;
    lower.visible = true;
    lower.blendMode = "source-over";
    lower.maskCanvas = null;
    lower.maskCompositeCanvas = null;
    lower.maskEnabled = false;
    state.layers.splice(index, 1);
    state.activeLayerIndex = index - 1;
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
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (delta) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h /= 6; if (h < 0) h += 1;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    const k = (n) => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
  }

  function applyAdjustment(type) {
    const active = getActiveLayer();
    if (!active || active.locked) return;
    saveSnapshot();

    const imgData = active.ctx.getImageData(0, 0, state.width, state.height);
    const d = imgData.data;

    if (type === "levels") {
      const low = [255, 255, 255], high = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) {
        const pixel = i / 4;
        if (!selectionContains(pixel % state.width, Math.floor(pixel / state.width))) continue;
        for (let c = 0; c < 3; c++) { low[c] = Math.min(low[c], d[i + c]); high[c] = Math.max(high[c], d[i + c]); }
      }
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) {
        const pixel = i / 4;
        if (!selectionContains(pixel % state.width, Math.floor(pixel / state.width))) continue;
        const span = high[c] - low[c]; if (span) d[i + c] = Math.round((d[i + c] - low[c]) * 255 / span);
      }
    }

    for (let i = 0; i < d.length; i += 4) {
      const pixel = i / 4;
      if (!selectionContains(pixel % state.width, Math.floor(pixel / state.width))) continue;
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
      } else if (type === "hsl") {
        const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        const shift = Number(document.getElementById("hueShift").value) / 360;
        const saturation = Number(document.getElementById("saturationShift").value) / 100;
        const nextSaturation = saturation >= 0 ? s + saturation * (1 - s) : s * (1 + saturation);
        const [r, g, b] = hslToRgb((h + shift + 1) % 1, Math.max(0, Math.min(1, nextSaturation)), l);
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
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
  const tools = ["rectMarquee", "ellipseMarquee", "brush", "eraser", "bucket", "gradient", "rect", "circle", "text", "eyedropper"];
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
  document.getElementById("duplicateLayerBtn").addEventListener("click", duplicateLayer);
  document.getElementById("mergeLayerBtn").addEventListener("click", mergeLayerDown);

  document.getElementById("btnUndo").addEventListener("click", undo);
  document.getElementById("btnRedo").addEventListener("click", redo);

  document.getElementById("exportPngBtn").addEventListener("click", () => exportImage("png"));
  document.getElementById("exportJpgBtn").addEventListener("click", () => exportImage("jpg"));

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) openImageFile(e.target.files[0]);
  });
  document.getElementById("openImgBtn").addEventListener("click", () => fileInput.click());

  // Filter buttons
  ["brightness", "contrast", "grayscale", "sepia", "invert", "levels"].forEach(filterName => {
    document.getElementById(`filter_${filterName}`)?.addEventListener("click", () => applyAdjustment(filterName));
  });
  document.getElementById("applyHslBtn").addEventListener("click", () => applyAdjustment("hsl"));

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    const editingField = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    if (!editingField && e.key.toLowerCase() === "m") {
      document.getElementById(`tool_${e.shiftKey ? "ellipseMarquee" : "rectMarquee"}`).click();
      e.preventDefault();
    } else if (!editingField && e.key === "Escape" && state.selection) {
      state.selection = null;
      renderSelectionOverlay();
      e.preventDefault();
    }
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
    deleteLayer,
    editMask,
    toggleLock
  };

  // Start with default document
  initNewDocument(800, 600, true);

})();

/**
 * PdfCraft — PDF Reader & Workbench Engine
 * Pure client-side PDF editing, page organizing, annotations & export.
 * Powered by pdf.js and pdf-lib. 100% offline, zero server required.
 */

(function () {
  "use strict";

  // PDF.js worker fallback for file://
  if (window.location.protocol === "file:") {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = ""; } catch (_) {}
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "../lib/pdf.worker.min.js";
  }

  const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib || {};

  // Application State
  const state = {
    file: null,
    fileName: "document.pdf",
    pdfDoc: null,         // PDF.js document
    pdfLibDoc: null,      // PDFLib document
    numPages: 0,
    currentPage: 1,
    zoom: 1.25,
    activeTool: "select", // 'select', 'highlight', 'pen', 'text', 'rect'
    penColor: "#ef4444",
    highlightColor: "#facc15",
    penWidth: 3,
    pagesData: [],        // array of { pageIndex, rotation, annotations: [] }
    isDrawing: false,
    currentPath: [],
    currentViewport: null
  };

  // DOM Elements
  const fileInput = document.getElementById("fileInput");
  const mergeInput = document.getElementById("mergeInput");
  const pdfCanvas = document.getElementById("pdfCanvas");
  const annotationCanvas = document.getElementById("annotationCanvas");
  const pageContainer = document.getElementById("pageContainer");
  const thumbnailsScroll = document.getElementById("thumbnailsScroll");
  const pageIndicator = document.getElementById("pageIndicator");
  const emptyState = document.getElementById("emptyState");
  const zoomSelect = document.getElementById("zoomSelect");

  // Load PDF File
  async function loadPdfFile(file) {
    state.file = file;
    state.fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();

    // 1. Load in PDF.js for rendering
    state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    state.numPages = state.pdfDoc.numPages;

    // 2. Load in PDF-lib for document model & export
    state.pdfLibDoc = await PDFDocument.load(arrayBuffer);

    // Initialize page metadata
    state.pagesData = [];
    for (let i = 0; i < state.numPages; i++) {
      state.pagesData.push({
        pageIndex: i,
        rotation: 0,
        annotations: []
      });
    }

    state.currentPage = 1;
    emptyState.style.display = "none";
    pageContainer.style.display = "block";

    await renderCurrentPage();
    await renderThumbnails();
  }

  // Render Active Page
  async function renderCurrentPage() {
    if (!state.pdfDoc) return;

    const page = await state.pdfDoc.getPage(state.currentPage);
    const pageMeta = state.pagesData[state.currentPage - 1];
    const rotation = (page.rotate + pageMeta.rotation) % 360;

    const viewport = page.getViewport({ scale: state.zoom, rotation });
    state.currentViewport = viewport;
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    annotationCanvas.width = viewport.width;
    annotationCanvas.height = viewport.height;

    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    const ctx = pdfCanvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    redrawAnnotations();
    updatePageIndicator();
  }

  // Redraw Vector Annotations on Top Canvas
  function redrawAnnotations() {
    const ctx = annotationCanvas.getContext("2d");
    ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
    const pageMeta = state.pagesData[state.currentPage - 1];
    if (!pageMeta) return;

    const viewport = state.currentViewport;
    if (!viewport) return;
    const toCanvas = (x, y) => viewport.convertToViewportPoint(x, y);
    pageMeta.annotations.forEach(ann => {
      ctx.save();
      if (ann.type === "pen") {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.width * state.zoom;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ann.points.forEach((pt, i) => {
          const [x, y] = toCanvas(pt.x, pt.y);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else if (ann.type === "highlight") {
        ctx.fillStyle = hexToRgba(ann.color, 0.35);
        const [x1, y1] = toCanvas(ann.x1, ann.y1);
        const [x2, y2] = toCanvas(ann.x2, ann.y2);
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (ann.type === "rect") {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = (ann.width || 2) * state.zoom;
        const [x1, y1] = toCanvas(ann.x1, ann.y1);
        const [x2, y2] = toCanvas(ann.x2, ann.y2);
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (ann.type === "text") {
        const [x, y] = toCanvas(ann.x, ann.y);
        ctx.font = `${(ann.size || 16) * state.zoom}px sans-serif`;
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, x, y);
      }
      ctx.restore();
    });
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Render Left Page Thumbnails
  async function renderThumbnails() {
    thumbnailsScroll.innerHTML = "";
    for (let i = 1; i <= state.numPages; i++) {
      const pageIndex = i;
      const card = document.createElement("div");
      card.className = `thumbnail-card ${pageIndex === state.currentPage ? "active" : ""}`;
      card.id = `thumbCard_${pageIndex}`;
      card.draggable = true;
      card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", String(pageIndex - 1)));
      card.addEventListener("dragover", (event) => { event.preventDefault(); card.classList.add("drop-target"); });
      card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
      card.addEventListener("drop", async (event) => {
        event.preventDefault();
        card.classList.remove("drop-target");
        const from = Number(event.dataTransfer.getData("text/plain"));
        const to = pageIndex - 1;
        if (Number.isInteger(from) && from !== to) await reorderPage(from, to);
      });

      const tCanvas = document.createElement("canvas");
      tCanvas.className = "thumbnail-canvas";

      const page = await state.pdfDoc.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 0.25 });
      tCanvas.width = viewport.width;
      tCanvas.height = viewport.height;
      const ctx = tCanvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      card.appendChild(tCanvas);

      const footer = document.createElement("div");
      footer.className = "thumbnail-footer";
      footer.innerHTML = `
        <span>Page ${pageIndex}</span>
        <div class="thumbnail-actions">
          <button class="thumb-btn" title="Move Page Up" onclick="event.stopPropagation(); window.PdfCraft.movePageUp(${pageIndex})">▲</button>
          <button class="thumb-btn" title="Move Page Down" onclick="event.stopPropagation(); window.PdfCraft.movePageDown(${pageIndex})">▼</button>
          <button class="thumb-btn" title="Rotate 90° Clockwise" onclick="event.stopPropagation(); window.PdfCraft.rotatePage(${pageIndex})">↻</button>
          <button class="thumb-btn" title="Delete Page" onclick="event.stopPropagation(); window.PdfCraft.deletePage(${pageIndex})">🗑</button>
        </div>
      `;
      card.appendChild(footer);

      card.onclick = () => {
        state.currentPage = pageIndex;
        updateActiveThumbnail();
        renderCurrentPage();
      };

      thumbnailsScroll.appendChild(card);
    }
  }

  function updateActiveThumbnail() {
    document.querySelectorAll(".thumbnail-card").forEach((card, idx) => {
      card.classList.toggle("active", idx + 1 === state.currentPage);
    });
  }

  function updatePageIndicator() {
    pageIndicator.innerText = `Page ${state.currentPage} of ${state.numPages}`;
  }

  async function reorderPage(from, to) {
    if (from < 0 || to < 0 || from >= state.numPages || to >= state.numPages) return;
    const oldCurrent = state.currentPage - 1;
    const order = [...Array(state.numPages).keys()];
    const [pageIndex] = order.splice(from, 1);
    order.splice(to, 0, pageIndex);
    const nextMeta = [...state.pagesData];
    const [meta] = nextMeta.splice(from, 1);
    nextMeta.splice(to, 0, meta);
    const newDoc = await PDFDocument.create();
    (await newDoc.copyPages(state.pdfLibDoc, order)).forEach((page) => newDoc.addPage(page));
    state.pdfLibDoc = newDoc;
    state.pagesData = nextMeta;
    const bytes = await newDoc.save();
    state.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    let current = oldCurrent;
    if (oldCurrent === from) current = to;
    else if (from < to && oldCurrent > from && oldCurrent <= to) current = oldCurrent - 1;
    else if (from > to && oldCurrent < from && oldCurrent >= to) current = oldCurrent + 1;
    state.currentPage = current + 1;
    await renderCurrentPage();
    await renderThumbnails();
  }

  async function movePageUp(pageNumber) {
    if (pageNumber <= 1) return;
    const idx = pageNumber - 1;
    // Swap in pagesData
    const temp = state.pagesData[idx];
    state.pagesData[idx] = state.pagesData[idx - 1];
    state.pagesData[idx - 1] = temp;

    // Rebuild pdfLibDoc in new order
    const newDoc = await PDFDocument.create();
    const order = [...Array(state.numPages).keys()];
    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    const copied = await newDoc.copyPages(state.pdfLibDoc, order);
    copied.forEach(p => newDoc.addPage(p));
    state.pdfLibDoc = newDoc;

    const bytes = await state.pdfLibDoc.save();
    state.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    state.currentPage = pageNumber - 1;
    await renderCurrentPage();
    await renderThumbnails();
  }

  async function movePageDown(pageNumber) {
    if (pageNumber >= state.numPages) return;
    const idx = pageNumber - 1;
    // Swap in pagesData
    const temp = state.pagesData[idx];
    state.pagesData[idx] = state.pagesData[idx + 1];
    state.pagesData[idx + 1] = temp;

    // Rebuild pdfLibDoc in new order
    const newDoc = await PDFDocument.create();
    const order = [...Array(state.numPages).keys()];
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    const copied = await newDoc.copyPages(state.pdfLibDoc, order);
    copied.forEach(p => newDoc.addPage(p));
    state.pdfLibDoc = newDoc;

    const bytes = await state.pdfLibDoc.save();
    state.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    state.currentPage = pageNumber + 1;
    await renderCurrentPage();
    await renderThumbnails();
  }

  // Page Operations
  async function rotatePage(pageNumber) {
    const meta = state.pagesData[pageNumber - 1];
    meta.rotation = (meta.rotation + 90) % 360;
    if (pageNumber === state.currentPage) {
      await renderCurrentPage();
    }
  }

  async function deletePage(pageNumber) {
    if (state.numPages <= 1) {
      return alert("Cannot delete the only page remaining in document.");
    }
    if (!confirm(`Delete page ${pageNumber}?`)) return;

    state.pagesData.splice(pageNumber - 1, 1);
    state.pdfLibDoc.removePage(pageNumber - 1);
    state.numPages--;

    // Re-save and reload in pdf.js
    const bytes = await state.pdfLibDoc.save();
    state.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;

    state.currentPage = Math.min(state.currentPage, state.numPages);
    await renderCurrentPage();
    await renderThumbnails();
  }

  async function mergeAnotherPdf(file) {
    if (!state.pdfLibDoc) return;
    const arrayBuffer = await file.arrayBuffer();
    const otherDoc = await PDFDocument.load(arrayBuffer);
    const copiedPages = await state.pdfLibDoc.copyPages(otherDoc, otherDoc.getPageIndices());
    copiedPages.forEach(p => state.pdfLibDoc.addPage(p));

    const totalNew = otherDoc.getPageCount();
    for (let i = 0; i < totalNew; i++) {
      state.pagesData.push({
        pageIndex: state.numPages + i,
        rotation: 0,
        annotations: []
      });
    }

    const bytes = await state.pdfLibDoc.save();
    state.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    state.numPages = state.pdfDoc.numPages;

    await renderCurrentPage();
    await renderThumbnails();
    alert(`Successfully merged ${totalNew} pages from "${file.name}"!`);
  }

  // Annotation Drawing Events on AnnotationCanvas
  let startX = 0, startY = 0;
  const toPdfPoint = (x, y) => state.currentViewport.convertToPdfPoint(x, y);

  annotationCanvas.addEventListener("mousedown", (e) => {
    if (state.activeTool === "select") return;
    const rect = annotationCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    state.isDrawing = true;

    if (state.activeTool === "pen") {
      const [x, y] = toPdfPoint(startX, startY);
      state.currentPath = [{ x, y }];
    } else if (state.activeTool === "text") {
      const textVal = prompt("Enter text annotation:", "Note");
      if (textVal) {
        state.pagesData[state.currentPage - 1].annotations.push({
          type: "text",
          ...(() => { const [x, y] = toPdfPoint(startX, startY); return { x, y }; })(),
          text: textVal,
          color: state.penColor,
          size: 16 / state.zoom
        });
        redrawAnnotations();
      }
      state.isDrawing = false;
    }
  });

  annotationCanvas.addEventListener("mousemove", (e) => {
    if (!state.isDrawing) return;
    const rect = annotationCanvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    if (state.activeTool === "pen") {
      const [x, y] = toPdfPoint(curX, curY);
      state.currentPath.push({ x, y });
      const ctx = annotationCanvas.getContext("2d");
      ctx.strokeStyle = state.penColor;
      ctx.lineWidth = state.penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const [prevX, prevY] = state.currentViewport.convertToViewportPoint(state.currentPath[state.currentPath.length - 2].x, state.currentPath[state.currentPath.length - 2].y);
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(curX, curY);
      ctx.stroke();
    } else if (state.activeTool === "highlight" || state.activeTool === "rect") {
      redrawAnnotations();
      const ctx = annotationCanvas.getContext("2d");
      const w = curX - startX;
      const h = curY - startY;
      if (state.activeTool === "highlight") {
        ctx.fillStyle = hexToRgba(state.highlightColor, 0.35);
        ctx.fillRect(startX, startY, w, h);
      } else {
        ctx.strokeStyle = state.penColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, w, h);
      }
    }
  });

  annotationCanvas.addEventListener("mouseup", (e) => {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    const rect = annotationCanvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    const pageMeta = state.pagesData[state.currentPage - 1];

    if (state.activeTool === "pen" && state.currentPath.length > 1) {
      pageMeta.annotations.push({
        type: "pen",
        points: [...state.currentPath],
        color: state.penColor,
        width: state.penWidth / state.zoom
      });
      state.currentPath = [];
    } else if (state.activeTool === "highlight") {
      const [x1, y1] = toPdfPoint(startX, startY);
      const [x2, y2] = toPdfPoint(curX, curY);
      pageMeta.annotations.push({
        type: "highlight",
        x1, y1, x2, y2,
        color: state.highlightColor
      });
    } else if (state.activeTool === "rect") {
      const [x1, y1] = toPdfPoint(startX, startY);
      const [x2, y2] = toPdfPoint(curX, curY);
      pageMeta.annotations.push({
        type: "rect",
        x1, y1, x2, y2,
        color: state.penColor,
        width: 2 / state.zoom
      });
    }

    redrawAnnotations();
  });

  // Export & Download PDF
  async function exportPdf() {
    if (!state.pdfLibDoc) return;
    // Work on a fresh copy so repeated exports do not accumulate rotations or
    // bake the same in-memory annotation overlay into the source document.
    const outputDoc = await PDFDocument.load(await state.pdfLibDoc.save());

    // Apply rotations
    const pages = outputDoc.getPages();
    pages.forEach((page, idx) => {
      const meta = state.pagesData[idx];
      if (meta && meta.rotation !== 0) {
        const cur = page.getRotation().angle;
        page.setRotation(degrees((cur + meta.rotation) % 360));
      }
    });

    const font = await outputDoc.embedFont(StandardFonts.Helvetica);

    // Bake annotations
    pages.forEach((page, idx) => {
      const meta = state.pagesData[idx];
      if (meta) drawAnnotations(page, meta.annotations, font);
    });

    const outBytes = await outputDoc.save();
    const blob = new Blob([outBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.fileName.replace(/\.pdf$/i, "") + "_edited.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function colorToRgb(hex) {
    const value = String(hex || "#000000").replace("#", "");
    return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255);
  }

  function drawAnnotations(page, annotations, font) {
    annotations.forEach(ann => {
      if (ann.type === "highlight" || ann.type === "rect") {
        const options = {
          x: Math.min(ann.x1, ann.x2), y: Math.min(ann.y1, ann.y2),
          width: Math.abs(ann.x2 - ann.x1), height: Math.abs(ann.y2 - ann.y1)
        };
        if (ann.type === "highlight") page.drawRectangle({ ...options, color: colorToRgb(ann.color), opacity: 0.35 });
        else page.drawRectangle({ ...options, borderColor: colorToRgb(ann.color), borderWidth: ann.width || 2 });
      } else if (ann.type === "text") {
        page.drawText(ann.text, { x: ann.x, y: ann.y, size: ann.size || 16, font, color: colorToRgb(ann.color) });
      } else if (ann.type === "pen" && ann.points.length > 1) {
        for (let i = 1; i < ann.points.length; i++) {
          page.drawLine({ start: ann.points[i - 1], end: ann.points[i], thickness: ann.width || 2, color: colorToRgb(ann.color), opacity: 1 });
        }
      }
    });
  }

  async function extractCurrentPage() {
    if (!state.pdfLibDoc) return;
    const extracted = await PDFDocument.create();
    const index = state.currentPage - 1;
    const [page] = await extracted.copyPages(state.pdfLibDoc, [index]);
    const meta = state.pagesData[index];
    if (meta?.rotation) page.setRotation(degrees((page.getRotation().angle + meta.rotation) % 360));
    extracted.addPage(page);
    if (meta?.annotations.length) {
      const font = await extracted.embedFont(StandardFonts.Helvetica);
      drawAnnotations(page, meta.annotations, font);
    }
    const blob = new Blob([await extracted.save()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${state.fileName.replace(/\.pdf$/i, "")}_page_${state.currentPage}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Toolbar & Menu Wiring
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) loadPdfFile(e.target.files[0]);
  });
  mergeInput.addEventListener("change", (e) => {
    if (e.target.files.length) mergeAnotherPdf(e.target.files[0]);
  });

  document.getElementById("openFileBtn").addEventListener("click", () => fileInput.click());
  document.getElementById("mergeFileBtn").addEventListener("click", () => mergeInput.click());
  document.getElementById("savePdfBtn").addEventListener("click", exportPdf);
  document.getElementById("extractPageBtn").addEventListener("click", extractCurrentPage);

  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      updateActiveThumbnail();
      renderCurrentPage();
    }
  });

  document.getElementById("nextPageBtn").addEventListener("click", () => {
    if (state.currentPage < state.numPages) {
      state.currentPage++;
      updateActiveThumbnail();
      renderCurrentPage();
    }
  });

  document.getElementById("zoomInBtn").addEventListener("click", () => {
    state.zoom = Math.min(3.0, state.zoom + 0.25);
    renderCurrentPage();
  });

  document.getElementById("zoomOutBtn").addEventListener("click", () => {
    state.zoom = Math.max(0.5, state.zoom - 0.25);
    renderCurrentPage();
  });

  if (zoomSelect) {
    zoomSelect.addEventListener("change", (e) => {
      state.zoom = parseFloat(e.target.value);
      renderCurrentPage();
    });
  }

  // Tool Switching
  const tools = ["select", "highlight", "pen", "text", "rect"];
  tools.forEach(tool => {
    const btn = document.getElementById(`tool_${tool}`);
    if (btn) {
      btn.addEventListener("click", () => {
        tools.forEach(t => document.getElementById(`tool_${t}`)?.classList.remove("active"));
        btn.classList.add("active");
        state.activeTool = tool;
        annotationCanvas.style.pointerEvents = tool === "select" ? "none" : "auto";
        annotationCanvas.style.cursor = tool === "select" ? "default" : "crosshair";
      });
    }
  });

  // Toggle Sidebar
  document.getElementById("toggleSidebarBtn").addEventListener("click", () => {
    document.getElementById("craftSidebar").classList.toggle("collapsed");
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" && state.currentPage > 1) {
      state.currentPage--;
      updateActiveThumbnail();
      renderCurrentPage();
    } else if (e.key === "ArrowRight" && state.currentPage < state.numPages) {
      state.currentPage++;
      updateActiveThumbnail();
      renderCurrentPage();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      exportPdf();
    }
  });

  // Expose for thumbnail callbacks
  window.PdfCraft = {
    rotatePage,
    deletePage,
    movePageUp,
    movePageDown
  };

})();

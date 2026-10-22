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
    currentPath: []
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

    pageMeta.annotations.forEach(ann => {
      ctx.save();
      if (ann.type === "pen") {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ann.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      } else if (ann.type === "highlight") {
        ctx.fillStyle = hexToRgba(ann.color, 0.35);
        ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
      } else if (ann.type === "rect") {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.width || 2;
        ctx.strokeRect(ann.x, ann.y, ann.widthRect, ann.heightRect);
      } else if (ann.type === "text") {
        ctx.font = `${ann.size || 16}px sans-serif`;
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, ann.x, ann.y);
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

  annotationCanvas.addEventListener("mousedown", (e) => {
    if (state.activeTool === "select") return;
    const rect = annotationCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    state.isDrawing = true;

    if (state.activeTool === "pen") {
      state.currentPath = [{ x: startX, y: startY }];
    } else if (state.activeTool === "text") {
      const textVal = prompt("Enter text annotation:", "Note");
      if (textVal) {
        state.pagesData[state.currentPage - 1].annotations.push({
          type: "text",
          x: startX,
          y: startY,
          text: textVal,
          color: state.penColor,
          size: 16
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
      state.currentPath.push({ x: curX, y: curY });
      const ctx = annotationCanvas.getContext("2d");
      ctx.strokeStyle = state.penColor;
      ctx.lineWidth = state.penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(state.currentPath[state.currentPath.length - 2].x, state.currentPath[state.currentPath.length - 2].y);
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
        width: state.penWidth
      });
      state.currentPath = [];
    } else if (state.activeTool === "highlight") {
      pageMeta.annotations.push({
        type: "highlight",
        x: Math.min(startX, curX),
        y: Math.min(startY, curY),
        width: Math.abs(curX - startX),
        height: Math.abs(curY - startY),
        color: state.highlightColor
      });
    } else if (state.activeTool === "rect") {
      pageMeta.annotations.push({
        type: "rect",
        x: Math.min(startX, curX),
        y: Math.min(startY, curY),
        widthRect: Math.abs(curX - startX),
        heightRect: Math.abs(curY - startY),
        color: state.penColor,
        width: 2
      });
    }

    redrawAnnotations();
  });

  // Export & Download PDF
  async function exportPdf() {
    if (!state.pdfLibDoc) return;

    // Apply rotations
    const pages = state.pdfLibDoc.getPages();
    pages.forEach((page, idx) => {
      const meta = state.pagesData[idx];
      if (meta && meta.rotation !== 0) {
        const cur = page.getRotation().angle;
        page.setRotation(degrees((cur + meta.rotation) % 360));
      }
    });

    const font = await state.pdfLibDoc.embedFont(StandardFonts.Helvetica);

    // Bake annotations
    pages.forEach((page, idx) => {
      const meta = state.pagesData[idx];
      if (!meta || !meta.annotations.length) return;
      const { height } = page.getSize();
      const scaleFactor = page.getWidth() / pdfCanvas.width;

      meta.annotations.forEach(ann => {
        if (ann.type === "highlight") {
          page.drawRectangle({
            x: ann.x * scaleFactor,
            y: height - (ann.y + ann.height) * scaleFactor,
            width: ann.width * scaleFactor,
            height: ann.height * scaleFactor,
            color: rgb(0.98, 0.8, 0.1),
            opacity: 0.35
          });
        } else if (ann.type === "rect") {
          page.drawRectangle({
            x: ann.x * scaleFactor,
            y: height - (ann.y + ann.heightRect) * scaleFactor,
            width: ann.widthRect * scaleFactor,
            height: ann.heightRect * scaleFactor,
            borderColor: rgb(0.9, 0.2, 0.2),
            borderWidth: 2
          });
        } else if (ann.type === "text") {
          page.drawText(ann.text, {
            x: ann.x * scaleFactor,
            y: height - ann.y * scaleFactor,
            size: (ann.size || 16) * scaleFactor,
            font,
            color: rgb(0.1, 0.1, 0.1)
          });
        }
      });
    });

    const outBytes = await state.pdfLibDoc.save();
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
    deletePage
  };

})();

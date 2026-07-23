/**
 * app.js — UI shell that wires the tool grid + workspace panel to the
 * Converters.* functions defined in converters/*.js. No conversion logic
 * lives here; this file only handles DOM/file plumbing.
 */
(function () {
  "use strict";

  const TOOLS = [
    {
      id: "merge-pdf",
      icon: "🧩",
      title: "Merge PDF",
      description: "Combine multiple PDF files into one, in the order you choose.",
      accept: ".pdf",
      multiple: true,
      reorderable: true,
      fidelity: "high",
      fn: "pdfMerge",
      expectedKinds: ["pdf"],
    },
    {
      id: "split-pdf",
      icon: "✂️",
      title: "Split PDF",
      description: "Break a PDF into separate files by page ranges, or one file per page.",
      accept: ".pdf",
      multiple: false,
      fidelity: "high",
      fn: "pdfSplit",
      expectedKinds: ["pdf"],
      renderOptions: renderSplitOptions,
    },
    {
      id: "images-to-pdf",
      icon: "🖼️",
      title: "JPG / PNG to PDF",
      description: "Turn one or more images into a single PDF, one image per page.",
      accept: ".jpg,.jpeg,.png",
      multiple: true,
      reorderable: true,
      fidelity: "high",
      fn: "imagesToPdf",
      expectedKinds: ["png", "jpg"],
    },
    {
      id: "pdf-to-images",
      icon: "🎞️",
      title: "PDF to JPG / PNG",
      description: "Export each PDF page as an image (zipped if there's more than one).",
      accept: ".pdf",
      multiple: false,
      fidelity: "high",
      fn: "pdfToImages",
      expectedKinds: ["pdf"],
      renderOptions: renderImageFormatOptions,
    },
    {
      id: "word-to-pdf",
      icon: "📄",
      title: "Word to PDF",
      description: "[Experimental] Convert a .docx document to PDF, preserving text, headings and lists.",
      accept: ".docx",
      multiple: false,
      fidelity: "medium",
      fn: "wordToPdf",
      expectedKinds: ["docx"],
    },
    {
      id: "pdf-to-word",
      icon: "📝",
      title: "PDF to Word",
      description: "[Experimental] Extract PDF text into an editable .docx document.",
      accept: ".pdf",
      multiple: false,
      fidelity: "low",
      fn: "pdfToWord",
      expectedKinds: ["pdf"],
    },
    {
      id: "ppt-to-pdf",
      icon: "📽️",
      title: "PowerPoint to PDF",
      description: "[Experimental] Flatten a .pptx deck's text and images onto PDF pages.",
      accept: ".pptx",
      multiple: false,
      fidelity: "low",
      fn: "pptToPdf",
      expectedKinds: ["pptx"],
    },
    {
      id: "pdf-to-ppt",
      icon: "📊",
      title: "PDF to PowerPoint",
      description: "[Experimental] Place each PDF page as a full-page image on its own slide.",
      accept: ".pdf",
      multiple: false,
      fidelity: "medium",
      fn: "pdfToPpt",
      expectedKinds: ["pdf"],
    },
    {
      id: "excel-to-pdf",
      icon: "📈",
      title: "Excel to PDF",
      description: "[Experimental] Render spreadsheet rows and columns as a ruled table in a PDF.",
      accept: ".xlsx,.xls",
      multiple: false,
      fidelity: "medium",
      fn: "excelToPdf",
      expectedKinds: ["xlsx"],
    },
    {
      id: "pdf-to-excel",
      icon: "📉",
      title: "PDF to Excel",
      description: "[Experimental] Infer a table from PDF text positions and export it as .xlsx.",
      accept: ".pdf",
      multiple: false,
      fidelity: "low",
      fn: "pdfToExcel",
      expectedKinds: ["pdf"],
    },
  ];

  const FIDELITY_LABEL = {
    high: "High fidelity",
    medium: "Good fidelity",
    low: "Best-effort",
  };

  const FIDELITY_NOTE = {
    high: null,
    medium: "This conversion preserves the overall content well, but exact layout, fonts and styling may shift slightly — an inherent tradeoff of doing this entirely in the browser.",
    low: "Client-side conversion for this format pair is inherently limited: complex layout, tables, and formatting will not be fully preserved. Treat the result as a content-recovery draft, not a pixel-perfect copy.",
  };

  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------
  let activeTool = null;
  // Each entry: { file, id, kind: 'pending'|<detected kind>, valid, pageCount, thumbnailUrl }
  let entries = [];
  let selectedEntryId = null;
  let entrySeq = 0;

  // -------------------------------------------------------------------
  // DOM refs
  // -------------------------------------------------------------------
  const protocolBanner = document.getElementById("protocolBanner");
  const toolGrid = document.getElementById("toolGrid");
  const workspace = document.getElementById("workspace");
  const workspaceTitle = document.getElementById("workspaceTitle");
  const workspaceSub = document.getElementById("workspaceSub");
  const dropzone = document.getElementById("dropzone");
  const browseLink = document.getElementById("browseLink");
  const fileInput = document.getElementById("fileInput");
  const fileCountLabel = document.getElementById("fileCountLabel");
  const fileListEl = document.getElementById("fileList");
  const clearBtn = document.getElementById("clearBtn");
  const previewName = document.getElementById("previewName");
  const previewMeta = document.getElementById("previewMeta");
  const previewBody = document.getElementById("previewBody");
  const optionsArea = document.getElementById("optionsArea");
  const fidelityNotice = document.getElementById("fidelityNotice");
  const convertBtn = document.getElementById("convertBtn");
  const statusArea = document.getElementById("statusArea");
  const progressFill = document.getElementById("progressFill");
  const statusLine = document.getElementById("statusLine");
  const resultsArea = document.getElementById("resultsArea");

  // -------------------------------------------------------------------
  // file:// warning — pdf.js's worker (and some fetches) can silently
  // fail under the file:// origin in Chromium-based browsers. Surface it
  // up front instead of letting a tool look "broken" for no visible reason.
  // -------------------------------------------------------------------
  if (window.location.protocol === "file:") {
    protocolBanner.classList.remove("hidden");
  }

  // -------------------------------------------------------------------
  // Missing-library check — if any vendor/*.js or converters/*.js file
  // didn't actually load (wrong folder structure, a file left behind when
  // copying, a 404 on a case-sensitive server, etc.), every tool that
  // depends on it fails silently with no visible cause. Name exactly
  // what's missing instead of leaving the UI looking inert.
  // -------------------------------------------------------------------
  (function checkRequiredLibraries() {
    const required = [
      ["PDFLib", "vendor/pdf-lib.min.js"],
      ["pdfjsLib", "vendor/pdf.min.js"],
      ["JSZip", "vendor/jszip.min.js"],
      ["mammoth", "vendor/mammoth.browser.min.js"],
      ["PptxGenJS", "vendor/pptxgen.min.js"],
      ["XLSX", "vendor/xlsx.full.min.js"],
      ["fontkit", "vendor/fontkit.umd.min.js"],
      ["FONT_DATA", "vendor/fonts-data.js"],
      ["ConvUtils", "converters/utils.js"],
      ["Converters", "converters/*.js"],
    ];
    const missing = required.filter(([globalName]) => typeof window[globalName] === "undefined");
    if (missing.length > 0) {
      protocolBanner.classList.remove("hidden");
      protocolBanner.innerHTML =
        `⚠ Missing required file(s), so conversions will silently fail: ` +
        missing.map(([, path]) => `<code>${path}</code>`).join(", ") +
        `. Make sure the whole project folder (including <code>vendor/</code> and ` +
        `<code>converters/</code>) is next to <code>index.html</code>, then reload.`;
      console.error("FileConvert: missing required globals ->", missing.map((m) => m[0]));
    }
  })();

  // -------------------------------------------------------------------
  // Tool grid
  // -------------------------------------------------------------------
  function renderToolGrid() {
    toolGrid.innerHTML = "";
    TOOLS.forEach((tool) => {
      const card = document.createElement("div");
      card.className = "tool-card";
      card.dataset.toolId = tool.id;
      card.innerHTML = `
        <div class="tool-icon">${tool.icon}</div>
        <h3>${tool.title}</h3>
        <p>${tool.description}</p>
        <span class="fidelity-tag ${tool.fidelity === "low" ? "caution" : ""}">${FIDELITY_LABEL[tool.fidelity]}</span>
      `;
      card.addEventListener("click", () => selectTool(tool.id));
      toolGrid.appendChild(card);
    });
  }

  function selectTool(toolId) {
    activeTool = TOOLS.find((t) => t.id === toolId);
    if (!activeTool) return;

    [...toolGrid.children].forEach((card) => {
      card.classList.toggle("active", card.dataset.toolId === toolId);
    });

    entries = [];
    selectedEntryId = null;
    resultsArea.innerHTML = "";
    statusArea.classList.add("hidden");
    fileInput.accept = activeTool.accept;
    fileInput.multiple = !!activeTool.multiple;

    workspace.classList.remove("hidden");
    workspaceTitle.textContent = activeTool.title;
    workspaceSub.textContent = activeTool.description;

    if (activeTool.fidelity !== "high" && FIDELITY_NOTE[activeTool.fidelity]) {
      fidelityNotice.textContent = "⚠ " + FIDELITY_NOTE[activeTool.fidelity];
      fidelityNotice.classList.remove("hidden");
    } else {
      fidelityNotice.classList.add("hidden");
    }

    renderFileList();
    renderPreview();
    renderOptions();
    updateConvertButton();

    // scrollIntoView isn't implemented in every embedding context — guard it
    // so a missing method can't abort tool selection (this previously threw
    // and made the panel look unresponsive in some environments).
    if (typeof workspace.scrollIntoView === "function") {
      workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // -------------------------------------------------------------------
  // Dropzone / file input
  // -------------------------------------------------------------------
  browseLink.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener("click", () => fileInput.click());

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    handleIncomingFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => {
    handleIncomingFiles(e.target.files);
    fileInput.value = ""; // allow re-selecting the same file later
  });

  function handleIncomingFiles(fileListObj) {
    if (!activeTool) return;
    const incoming = Array.from(fileListObj);
    if (incoming.length === 0) return;

    const newEntries = incoming.map((file) => ({
      id: ++entrySeq,
      file,
      kind: "pending",
      valid: null,
      pageCount: null,
      thumbnailUrl: null,
    }));

    entries = activeTool.multiple ? entries.concat(newEntries) : newEntries;
    resultsArea.innerHTML = "";
    statusArea.classList.add("hidden");
    selectedEntryId = newEntries[0].id;

    renderFileList();
    renderPreview();
    updateConvertButton();

    // Sniff each new file's real type in the background, then re-render
    // once we know whether it actually matches what this tool expects.
    newEntries.forEach((entry) => {
      window.ConvUtils.detectFileKind(entry.file).then(async (kind) => {
        entry.kind = kind;
        entry.valid = activeTool.expectedKinds.includes(kind);

        // For valid PDFs, parse once up front and cache the page count —
        // both the split-range prefill and the preview thumbnail read from
        // this instead of each independently (and separately) re-parsing
        // the file, which previously meant the ranges field could still be
        // empty by the time the user looked at it.
        if (entry.valid && kind === "pdf") {
          try {
            entry.pdfDoc = await window.ConvUtils.loadPdfDocument(entry.file);
            entry.pageCount = entry.pdfDoc.numPages;
          } catch (err) {
            entry.valid = false;
            entry.loadError = err.message;
          }
        }

        renderFileList();
        updateConvertButton();
        if (entry.id === selectedEntryId) renderPreview();
        if (entry.valid && kind === "pdf" && activeTool.id === "split-pdf") {
          prefillSplitRanges(entry);
        }
      }).catch((err) => {
        // Type detection itself failed (e.g. a required vendor library
        // didn't load). Previously this left the badge on "…" forever with
        // no visible cause — now it resolves to a clearly-flagged error
        // state instead of hanging silently.
        console.error("File type detection failed for", entry.file.name, err);
        entry.kind = "unknown";
        entry.valid = false;
        entry.loadError = err && err.message ? err.message : String(err);
        renderFileList();
        updateConvertButton();
        if (entry.id === selectedEntryId) renderPreview();
      });
    });
  }

  function removeEntry(id) {
    entries = entries.filter((e) => e.id !== id);
    if (selectedEntryId === id) {
      selectedEntryId = entries.length ? entries[0].id : null;
    }
    renderFileList();
    renderPreview();
    updateConvertButton();
  }

  clearBtn.addEventListener("click", () => {
    entries = [];
    selectedEntryId = null;
    resultsArea.innerHTML = "";
    statusArea.classList.add("hidden");
    renderFileList();
    renderPreview();
    updateConvertButton();
  });

  // -------------------------------------------------------------------
  // File list rendering (with simple drag-to-reorder for merge/image tools)
  // -------------------------------------------------------------------
  function renderFileList() {
    fileListEl.innerHTML = "";
    fileCountLabel.textContent = entries.length ? `(${entries.length})` : "";
    clearBtn.classList.toggle("hidden", entries.length === 0);

    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "file-row" +
        (activeTool.reorderable ? " reorderable" : "") +
        (entry.id === selectedEntryId ? " selected" : "");
      row.draggable = !!activeTool.reorderable;
      row.dataset.index = index;
      row.dataset.entryId = entry.id;

      const tagClass = entry.kind === "pending" ? "pending" : entry.valid ? "" : "bad";
      const tagText = entry.kind === "pending" ? "…" : window.ConvUtils.KIND_LABEL[entry.kind];

      row.innerHTML = `
        <span class="file-icon">${activeTool.reorderable ? "⠿" : "📄"}</span>
        <span class="file-name">${escapeHtml(entry.file.name)}</span>
        <span class="kind-tag ${tagClass}">${tagText}</span>
        <button class="file-remove" title="Remove">✕</button>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.closest(".file-remove")) return;
        selectedEntryId = entry.id;
        renderFileList();
        renderPreview();
      });
      row.querySelector(".file-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        removeEntry(entry.id);
      });

      if (activeTool.reorderable) {
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", index);
        });
        row.addEventListener("dragover", (e) => e.preventDefault());
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
          const toIndex = index;
          const [moved] = entries.splice(fromIndex, 1);
          entries.splice(toIndex, 0, moved);
          renderFileList();
        });
      }

      fileListEl.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------------------------------------------------------
  // Preview pane — shows the currently-selected uploaded file: an image
  // preview for JPG/PNG, a rendered first-page thumbnail + page count for
  // PDFs, and basic file info for everything else (full layout preview of
  // Office formats is out of scope for a client-side prototype).
  // -------------------------------------------------------------------
  function renderPreview() {
    const entry = entries.find((e) => e.id === selectedEntryId);
    if (!entry) {
      previewName.textContent = "No file selected";
      previewMeta.textContent = "";
      previewBody.innerHTML = `<p class="preview-empty">Select a file on the left to preview it here.</p>`;
      return;
    }

    previewName.textContent = entry.file.name;
    const kindLabel = entry.kind === "pending" ? "detecting…" : window.ConvUtils.KIND_LABEL[entry.kind];
    previewMeta.textContent = `${window.ConvUtils.formatBytes(entry.file.size)} · ${kindLabel}`;

    if (entry.kind === "pending") {
      previewBody.innerHTML = `<p class="preview-empty"><span class="spinner"></span>Detecting file type…</p>`;
      return;
    }

    if (!entry.valid) {
      previewBody.innerHTML = `<p class="preview-error">This file looks like <strong>${window.ConvUtils.KIND_LABEL[entry.kind]}</strong>, ` +
        `but "${escapeHtml(activeTool.title)}" needs ${activeTool.expectedKinds.map((k) => window.ConvUtils.KIND_LABEL[k]).join("/")}. ` +
        `Remove it or pick a matching file.</p>`;
      return;
    }

    if (entry.kind === "png" || entry.kind === "jpg") {
      const url = URL.createObjectURL(entry.file);
      previewBody.innerHTML = "";
      const img = document.createElement("img");
      img.src = url;
      img.alt = entry.file.name;
      previewBody.appendChild(img);
      return;
    }

    if (entry.kind === "pdf") {
      previewBody.innerHTML = `<p class="preview-empty"><span class="spinner"></span>Rendering preview…</p>`;
      const showThumbnail = (pdfDoc, pageCount) => {
        window.ConvUtils.getPdfThumbnail(pdfDoc, 0.5).then((thumbnailUrl) => {
          entry.thumbnailUrl = thumbnailUrl;
          if (entry.id !== selectedEntryId) return; // user moved on already
          previewBody.innerHTML = "";
          const img = document.createElement("img");
          img.src = thumbnailUrl;
          img.alt = "First page preview";
          previewBody.appendChild(img);
          const caption = document.createElement("p");
          caption.className = "preview-meta";
          caption.style.marginTop = "10px";
          caption.textContent = `${pageCount} page${pageCount === 1 ? "" : "s"}`;
          previewBody.appendChild(caption);
        }).catch((err) => {
          if (entry.id !== selectedEntryId) return;
          previewBody.innerHTML = `<p class="preview-error">Couldn't render a preview: ${escapeHtml(err.message)}</p>`;
        });
      };

      if (entry.pdfDoc) {
        showThumbnail(entry.pdfDoc, entry.pageCount);
      } else {
        window.ConvUtils.loadPdfDocument(entry.file).then((pdfDoc) => {
          entry.pdfDoc = pdfDoc;
          entry.pageCount = pdfDoc.numPages;
          if (entry.id !== selectedEntryId) return;
          showThumbnail(pdfDoc, pdfDoc.numPages);
        }).catch((err) => {
          if (entry.id !== selectedEntryId) return;
          previewBody.innerHTML = `<p class="preview-error">Couldn't render a preview: ${escapeHtml(err.message)}</p>`;
        });
      }
      return;
    }

    // docx / pptx / xlsx — show basic info; full rendering is out of scope.
    previewBody.innerHTML = `
      <dl class="preview-info-grid">
        <dt>File</dt><dd>${escapeHtml(entry.file.name)}</dd>
        <dt>Size</dt><dd>${window.ConvUtils.formatBytes(entry.file.size)}</dd>
        <dt>Detected type</dt><dd>${window.ConvUtils.KIND_LABEL[entry.kind]}</dd>
      </dl>
    `;
  }

  // -------------------------------------------------------------------
  // Per-tool option panels
  // -------------------------------------------------------------------
  function renderOptions() {
    optionsArea.innerHTML = "";
    if (activeTool.renderOptions) {
      activeTool.renderOptions(optionsArea);
    }
  }

  function renderSplitOptions(container) {
    container.innerHTML = `
      <label>
        Split mode
        <select id="splitMode">
          <option value="ranges">Custom page ranges</option>
          <option value="every">One file per page</option>
        </select>
      </label>
      <label id="rangesWrap">
        Page ranges (e.g. 1-3,5,8-10)
        <input type="text" id="splitRanges" placeholder="1-3,5,8-10" />
        <span class="preview-error hidden" id="rangesError" style="text-align:left;"></span>
      </label>
    `;
    const modeSelect = container.querySelector("#splitMode");
    const rangesWrap = container.querySelector("#rangesWrap");
    const rangesInput = container.querySelector("#splitRanges");
    modeSelect.addEventListener("change", () => {
      rangesWrap.style.display = modeSelect.value === "ranges" ? "flex" : "none";
      updateConvertButton();
    });
    rangesInput.addEventListener("input", updateConvertButton);
  }

  // Once we know a selected PDF's page count, default the ranges field to
  // "the whole document" so a first click on Convert has a sane, valid
  // input instead of failing on an empty string.
  function prefillSplitRanges(entry) {
    const rangesInput = document.getElementById("splitRanges");
    if (rangesInput && !rangesInput.value && entry.pageCount) {
      rangesInput.value = entry.pageCount > 1 ? `1-${entry.pageCount}` : "1";
    }
    updateConvertButton();
  }

  function validateSplitRanges() {
    const modeSelect = document.getElementById("splitMode");
    const rangesInput = document.getElementById("splitRanges");
    const errorEl = document.getElementById("rangesError");
    if (!modeSelect || !rangesInput) return true; // options not rendered yet
    if (modeSelect.value === "every") {
      errorEl.classList.add("hidden");
      return true;
    }
    const value = rangesInput.value.trim();
    if (!value) {
      errorEl.textContent = "Enter at least one page range, e.g. 1-3,5.";
      errorEl.classList.remove("hidden");
      return false;
    }
    if (!/^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$/.test(value)) {
      errorEl.textContent = "Use formats like 1-3, 5, 8-10 separated by commas.";
      errorEl.classList.remove("hidden");
      return false;
    }
    errorEl.classList.add("hidden");
    return true;
  }

  function renderImageFormatOptions(container) {
    container.innerHTML = `
      <label>
        Output format
        <select id="imageFormat">
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </label>
    `;
  }

  function collectOptions() {
    const opts = {};
    if (activeTool.id === "split-pdf") {
      opts.mode = document.getElementById("splitMode").value;
      opts.ranges = document.getElementById("splitRanges").value;
    }
    if (activeTool.id === "pdf-to-images") {
      opts.imageFormat = document.getElementById("imageFormat").value;
    }
    return opts;
  }

  // -------------------------------------------------------------------
  // Convert button state + run
  // -------------------------------------------------------------------
  function updateConvertButton() {
    if (!activeTool || entries.length === 0) {
      convertBtn.disabled = true;
      return;
    }
    // A tool can only run once every file is confirmed to be a type it
    // actually accepts — this is what used to let a mismatched file sit
    // silently in the list until conversion failed deep inside a library.
    const allKnown = entries.every((e) => e.kind !== "pending");
    const allValid = entries.every((e) => e.valid);

    let optionsOk = true;
    if (activeTool.id === "split-pdf") {
      optionsOk = validateSplitRanges();
    }

    convertBtn.disabled = !(allKnown && allValid && optionsOk);
  }

  convertBtn.addEventListener("click", runConversion);

  async function runConversion() {
    if (!activeTool || entries.length === 0) return;

    convertBtn.disabled = true;
    resultsArea.innerHTML = "";
    statusArea.classList.remove("hidden");
    statusLine.classList.remove("error", "success");
    progressFill.style.width = "0%";
    statusLine.innerHTML = `<span class="spinner"></span>Starting…`;

    try {
      const options = collectOptions();
      const files = entries.map((e) => e.file);
      const fn = window.Converters[activeTool.fn];
      if (!fn) throw new Error(`Converter "${activeTool.fn}" is not implemented yet.`);

      const outputs = await fn(files, options, ({ pct, message }) => {
        progressFill.style.width = `${pct}%`;
        statusLine.innerHTML = `<span class="spinner"></span>${escapeHtml(message)}`;
      });

      const zipBaseName = `${activeTool.id}-output.zip`;
      const packaged = await window.ConvUtils.packageResults(outputs, zipBaseName);

      progressFill.style.width = "100%";
      statusLine.textContent = "Conversion complete.";
      statusLine.classList.add("success");
      renderResults(packaged);
    } catch (err) {
      console.error(err);
      statusLine.textContent = "Error: " + (err && err.message ? err.message : String(err));
      statusLine.classList.add("error");
    } finally {
      updateConvertButton();
    }
  }

  function renderResults(packaged) {
    resultsArea.innerHTML = "";
    packaged.forEach((result) => {
      const row = document.createElement("div");
      row.className = "result-row";
      const url = URL.createObjectURL(result.blob);
      row.innerHTML = `
        <span class="result-name">📦 ${escapeHtml(result.name)} (${window.ConvUtils.formatBytes(result.blob.size)})</span>
        <a class="download-link" href="${url}" download="${result.name}">Download</a>
      `;
      resultsArea.appendChild(row);
    });
  }

  // -------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------
  renderToolGrid();
})();

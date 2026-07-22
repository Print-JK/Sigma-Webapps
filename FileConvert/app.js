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
      renderOptions: renderImageFormatOptions,
    },
    {
      id: "word-to-pdf",
      icon: "📄",
      title: "Word to PDF",
      description: "Convert a .docx document to PDF, preserving text, headings and lists.",
      accept: ".docx",
      multiple: false,
      fidelity: "medium",
      fn: "wordToPdf",
    },
    {
      id: "pdf-to-word",
      icon: "📝",
      title: "PDF to Word",
      description: "Extract PDF text into an editable .docx document.",
      accept: ".pdf",
      multiple: false,
      fidelity: "low",
      fn: "pdfToWord",
    },
    {
      id: "ppt-to-pdf",
      icon: "📽️",
      title: "PowerPoint to PDF",
      description: "Flatten a .pptx deck's text and images onto PDF pages.",
      accept: ".pptx",
      multiple: false,
      fidelity: "low",
      fn: "pptToPdf",
    },
    {
      id: "pdf-to-ppt",
      icon: "📊",
      title: "PDF to PowerPoint",
      description: "Place each PDF page as a full-page image on its own slide.",
      accept: ".pdf",
      multiple: false,
      fidelity: "medium",
      fn: "pdfToPpt",
    },
    {
      id: "excel-to-pdf",
      icon: "📈",
      title: "Excel to PDF",
      description: "Render spreadsheet rows and columns as a ruled table in a PDF.",
      accept: ".xlsx,.xls",
      multiple: false,
      fidelity: "medium",
      fn: "excelToPdf",
    },
    {
      id: "pdf-to-excel",
      icon: "📉",
      title: "PDF to Excel",
      description: "Infer a table from PDF text positions and export it as .xlsx.",
      accept: ".pdf",
      multiple: false,
      fidelity: "low",
      fn: "pdfToExcel",
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
  let selectedFiles = []; // File[]

  // -------------------------------------------------------------------
  // DOM refs
  // -------------------------------------------------------------------
  const toolGrid = document.getElementById("toolGrid");
  const workspace = document.getElementById("workspace");
  const workspaceTitle = document.getElementById("workspaceTitle");
  const workspaceSub = document.getElementById("workspaceSub");
  const dropzone = document.getElementById("dropzone");
  const dropHint = document.getElementById("dropHint");
  const browseLink = document.getElementById("browseLink");
  const fileInput = document.getElementById("fileInput");
  const fileListEl = document.getElementById("fileList");
  const optionsArea = document.getElementById("optionsArea");
  const fidelityNotice = document.getElementById("fidelityNotice");
  const clearBtn = document.getElementById("clearBtn");
  const convertBtn = document.getElementById("convertBtn");
  const statusArea = document.getElementById("statusArea");
  const progressFill = document.getElementById("progressFill");
  const statusLine = document.getElementById("statusLine");
  const resultsArea = document.getElementById("resultsArea");

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

    selectedFiles = [];
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
    renderOptions();
    updateConvertButton();
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // -------------------------------------------------------------------
  // Dropzone / file input
  // -------------------------------------------------------------------
  browseLink.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", (e) => {
    if (e.target !== browseLink) fileInput.click();
  });

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
    if (activeTool.multiple) {
      selectedFiles = selectedFiles.concat(incoming);
    } else {
      selectedFiles = incoming.slice(0, 1);
    }
    resultsArea.innerHTML = "";
    statusArea.classList.add("hidden");
    renderFileList();
    updateConvertButton();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    updateConvertButton();
  }

  clearBtn.addEventListener("click", () => {
    selectedFiles = [];
    resultsArea.innerHTML = "";
    statusArea.classList.add("hidden");
    renderFileList();
    updateConvertButton();
  });

  // -------------------------------------------------------------------
  // File list rendering (with simple drag-to-reorder for merge/image tools)
  // -------------------------------------------------------------------
  function renderFileList() {
    fileListEl.innerHTML = "";
    dropHint.textContent = selectedFiles.length
      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
      : "No file selected";
    clearBtn.classList.toggle("hidden", selectedFiles.length === 0);

    selectedFiles.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "file-row" + (activeTool.reorderable ? " reorderable" : "");
      row.draggable = !!activeTool.reorderable;
      row.dataset.index = index;
      row.innerHTML = `
        <span class="file-icon">${activeTool.reorderable ? "⠿" : "📄"}</span>
        <span class="file-name">${escapeHtml(file.name)}</span>
        <span class="file-size">${window.ConvUtils.formatBytes(file.size)}</span>
        <button class="file-remove" title="Remove">✕</button>
      `;
      row.querySelector(".file-remove").addEventListener("click", () => removeFile(index));

      if (activeTool.reorderable) {
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", index);
        });
        row.addEventListener("dragover", (e) => e.preventDefault());
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
          const toIndex = index;
          const [moved] = selectedFiles.splice(fromIndex, 1);
          selectedFiles.splice(toIndex, 0, moved);
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
      </label>
    `;
    const modeSelect = container.querySelector("#splitMode");
    const rangesWrap = container.querySelector("#rangesWrap");
    modeSelect.addEventListener("change", () => {
      rangesWrap.style.display = modeSelect.value === "ranges" ? "flex" : "none";
    });
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
    convertBtn.disabled = selectedFiles.length === 0;
  }

  convertBtn.addEventListener("click", runConversion);

  async function runConversion() {
    if (!activeTool || selectedFiles.length === 0) return;

    convertBtn.disabled = true;
    resultsArea.innerHTML = "";
    statusArea.classList.remove("hidden");
    statusLine.classList.remove("error", "success");
    progressFill.style.width = "0%";
    statusLine.innerHTML = `<span class="spinner"></span>Starting…`;

    try {
      const options = collectOptions();
      const fn = window.Converters[activeTool.fn];
      if (!fn) throw new Error(`Converter "${activeTool.fn}" is not implemented yet.`);

      const outputs = await fn(selectedFiles, options, ({ pct, message }) => {
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
      convertBtn.disabled = selectedFiles.length === 0;
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

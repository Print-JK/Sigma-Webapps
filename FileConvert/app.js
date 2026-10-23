/**
 * FileConvert/app.js
 * Implements the iLovePDF-Clone architecture and tool suite 100% locally in-browser,
 * styled with the Apple Liquid Glass design system and integrated with the
 * compiled Rust/WASM ArtCraft Suite (PdfCraft, WordCraft, GridCraft, DeckCraft, PhotoCraft).
 */
(function (global) {
  "use strict";

  const CRAFT_APPS = {
    PdfCraft: {
      name: "PdfCraft",
      path: "../PdfCraft/index.html",
      icon: "📕",
      hint: "Native Rust PDF Editor — view, reorder, rotate, annotate, redact & export PDFs",
    },
    WordCraft: {
      name: "WordCraft",
      path: "../WordCraft/index.html",
      icon: "📘",
      hint: "Native Rust Word Processor — open .docx/.doc/.rtf/.md & export via File ▸ Print / Save",
    },
    GridCraft: {
      name: "GridCraft",
      path: "../GridCraft/index.html",
      icon: "📗",
      hint: "Native Rust Spreadsheet Engine — open .xlsx/.csv & export via File ▸ Export PDF",
    },
    DeckCraft: {
      name: "DeckCraft",
      path: "../DeckCraft/index.html",
      icon: "📙",
      hint: "Native Rust Presentation Suite — open .pptx/.md & export via File ▸ Export PDF",
    },
    PhotoCraft: {
      name: "PhotoCraft",
      path: "../PhotoCraft/index.html",
      icon: "🎨",
      hint: "Native Rust Raster & PSD Studio — open images/PSDs & export to PDF/JPG/PNG/WEBP",
    },
  };

  // ── Complete Tool Definitions (iLovePDF-Clone + Sigma FileConvert) ─────────
  const TOOLS = {
    merge: {
      id: "merge",
      category: "organize",
      title: "Merge PDF",
      desc: "Combine PDFs in the order you want",
      icon: "🔗",
      theme: "ic-red",
      dropTitle: "Select PDF files to merge",
      dropHint: "Add at least 2 PDF files and arrange them in the order you want",
      accept: ".pdf",
      multiple: true,
      reorderable: true,
      minFiles: 2,
      btnLabel: "Merge PDF",
      btnIcon: "🔗",
      fn: "pdfMerge",
      craftApp: "PdfCraft",
      options: null,
      resultTitle: "PDFs merged!",
      resultDesc: "Your merged PDF is ready.",
      downloadName: "merged.pdf",
    },
    split: {
      id: "split",
      category: "organize",
      title: "Split PDF",
      desc: "Separate one page or a whole set",
      icon: "✂️",
      theme: "ic-orange",
      dropTitle: "Select a PDF file to split",
      dropHint: "Upload the PDF you want to split into separate files",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Split PDF",
      btnIcon: "✂️",
      fn: "pdfSplit",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Split Options</h4>
          <div class="option-row">
            <label>Split mode</label>
            <div class="radio-group">
              <label><input type="radio" name="splitMode" value="all" checked onchange="updateSplitUI()"> Extract all pages</label>
              <label><input type="radio" name="splitMode" value="fixed" onchange="updateSplitUI()"> Fixed pages</label>
              <label><input type="radio" name="splitMode" value="range" onchange="updateSplitUI()"> By ranges</label>
            </div>
          </div>
          <div id="splitFixedRow" class="option-row" style="display:none">
            <label>Pages per file</label>
            <input type="number" id="splitFixed" value="1" min="1" style="max-width:120px">
          </div>
          <div id="splitRangeRow" class="option-row" style="display:none">
            <label>Page ranges</label>
            <input type="text" id="splitRanges" placeholder="e.g. 1-3, 5, 7-9">
          </div>
        </div>
      `,
      getOptions: () => {
        const mode = document.querySelector("input[name=splitMode]:checked")?.value || "all";
        const opts = { mode };
        if (mode === "fixed") opts.fixed = document.getElementById("splitFixed")?.value || "1";
        if (mode === "range") {
          opts.ranges = (document.getElementById("splitRanges")?.value || "").trim();
          if (!opts.ranges) {
            showError("Please enter page ranges (e.g. 1-3, 5, 7-9).");
            return null;
          }
        }
        return opts;
      },
      resultTitle: "PDF split!",
      resultDesc: "Download your split PDF file(s).",
      downloadName: "split_pages.zip",
    },
    compress: {
      id: "compress",
      category: "organize",
      title: "Compress PDF",
      desc: "Reduce file size while optimizing quality",
      icon: "🗜️",
      theme: "ic-green",
      dropTitle: "Select a PDF to compress",
      dropHint: "Upload the PDF file you want to reduce in size",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Compress PDF",
      btnIcon: "🗜️",
      fn: "compressPdf",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Compression Level</h4>
          <div class="option-row">
            <label>Preset</label>
            <div class="radio-group">
              <label><input type="radio" name="compressLevel" value="extreme"> Extreme (Smaller size)</label>
              <label><input type="radio" name="compressLevel" value="recommended" checked> Recommended (Balanced)</label>
              <label><input type="radio" name="compressLevel" value="high"> Less compression (High quality)</label>
            </div>
          </div>
        </div>
      `,
      getOptions: () => {
        const lvl = document.querySelector("input[name=compressLevel]:checked")?.value || "recommended";
        if (lvl === "extreme") return { quality: 0.45, scale: 1.0 };
        if (lvl === "high") return { quality: 0.82, scale: 1.5 };
        return { quality: 0.65, scale: 1.2 };
      },
      resultTitle: "PDF compressed!",
      resultDesc: "Your compressed PDF is ready.",
      downloadName: "compressed.pdf",
    },
    "pdf-to-jpg": {
      id: "pdf-to-jpg",
      category: "from-pdf",
      title: "PDF to JPG",
      desc: "Convert each PDF page into a JPG or PNG image",
      icon: "🖼️",
      theme: "ic-blue",
      dropTitle: "Select a PDF to convert",
      dropHint: "Each page will be exported as a high-clarity image",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to Images",
      btnIcon: "🖼️",
      fn: "pdfToImages",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Image Quality &amp; Format</h4>
          <div class="option-row">
            <label>Resolution (DPI)</label>
            <div class="radio-group">
              <label><input type="radio" name="dpi" value="72"> Low (72 DPI)</label>
              <label><input type="radio" name="dpi" value="150" checked> Medium (150 DPI)</label>
              <label><input type="radio" name="dpi" value="300"> High (300 DPI)</label>
            </div>
          </div>
          <div class="option-row">
            <label>Format</label>
            <div class="radio-group">
              <label><input type="radio" name="imgFmt" value="jpg" checked> JPG</label>
              <label><input type="radio" name="imgFmt" value="png"> PNG</label>
            </div>
          </div>
        </div>
      `,
      getOptions: () => ({
        dpi: document.querySelector("input[name=dpi]:checked")?.value || "150",
        imageFormat: document.querySelector("input[name=imgFmt]:checked")?.value || "jpg",
      }),
      resultTitle: "Conversion done!",
      resultDesc: "Your exported page image(s) are ready.",
      downloadName: "pdf_images.zip",
    },
    "jpg-to-pdf": {
      id: "jpg-to-pdf",
      category: "to-pdf",
      title: "JPG to PDF",
      desc: "Convert JPG, PNG, WEBP, BMP & GIF images to PDF in seconds",
      icon: "📄",
      theme: "ic-purple",
      dropTitle: "Select image files",
      dropHint: "Upload JPG, PNG, GIF, BMP, or WEBP files and arrange their page order",
      accept: "image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif",
      multiple: true,
      reorderable: true,
      minFiles: 1,
      btnLabel: "Convert to PDF",
      btnIcon: "📄",
      fn: "imagesToPdf",
      craftApp: "PhotoCraft",
      options: null,
      resultTitle: "Conversion done!",
      resultDesc: "Your PDF is ready.",
      downloadName: "converted.pdf",
    },
    "word-to-pdf": {
      id: "word-to-pdf",
      category: "to-pdf",
      title: "Word to PDF",
      desc: "Make DOC and DOCX files easy to read as PDF",
      icon: "📝",
      theme: "ic-blue",
      dropTitle: "Select a Word document",
      dropHint: "Upload a .docx file to convert locally or open in WordCraft Engine",
      accept: ".doc,.docx",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to PDF",
      btnIcon: "📝",
      fn: "wordToPdf",
      craftApp: "WordCraft",
      options: null,
      resultTitle: "Conversion done!",
      resultDesc: "Your Word document has been converted to PDF.",
      downloadName: "converted.pdf",
    },
    "excel-to-pdf": {
      id: "excel-to-pdf",
      category: "to-pdf",
      title: "Excel to PDF",
      desc: "Make Excel spreadsheets easy to read as PDF tables",
      icon: "📊",
      theme: "ic-green",
      dropTitle: "Select an Excel file",
      dropHint: "Upload an .xlsx or .xls spreadsheet to convert locally or open in GridCraft Engine",
      accept: ".xls,.xlsx,.csv",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to PDF",
      btnIcon: "📊",
      fn: "excelToPdf",
      craftApp: "GridCraft",
      options: null,
      resultTitle: "Conversion done!",
      resultDesc: "Your spreadsheet has been converted to PDF.",
      downloadName: "converted.pdf",
    },
    "ppt-to-pdf": {
      id: "ppt-to-pdf",
      category: "to-pdf",
      title: "PowerPoint to PDF",
      desc: "Convert PowerPoint presentations (.pptx) to PDF",
      icon: "📽️",
      theme: "ic-orange",
      dropTitle: "Select a PowerPoint presentation",
      dropHint: "Upload a .pptx file to convert locally or open in DeckCraft Engine",
      accept: ".pptx,.potx",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to PDF",
      btnIcon: "📽️",
      fn: "pptToPdf",
      craftApp: "DeckCraft",
      options: null,
      resultTitle: "Conversion done!",
      resultDesc: "Your presentation has been converted to PDF.",
      downloadName: "converted.pdf",
    },
    rotate: {
      id: "rotate",
      category: "organize",
      title: "Rotate PDF",
      desc: "Rotate your PDFs the way you need them",
      icon: "🔄",
      theme: "ic-teal",
      dropTitle: "Select a PDF to rotate",
      dropHint: "Upload the PDF you want to rotate",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Rotate PDF",
      btnIcon: "🔄",
      fn: "rotatePdf",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Rotation Options</h4>
          <div class="option-row">
            <label>Rotate</label>
            <div class="radio-group">
              <label><input type="radio" name="rotateDeg" value="90" checked> 90° right (Clockwise)</label>
              <label><input type="radio" name="rotateDeg" value="180"> 180°</label>
              <label><input type="radio" name="rotateDeg" value="270"> 90° left (Counter-clockwise)</label>
            </div>
          </div>
          <div class="option-row">
            <label>Pages</label>
            <input type="text" id="rotatePages" value="all" placeholder="all or e.g. 1, 3-5" style="max-width:260px">
          </div>
        </div>
      `,
      getOptions: () => ({
        degrees: document.querySelector("input[name=rotateDeg]:checked")?.value || "90",
        angle: document.querySelector("input[name=rotateDeg]:checked")?.value || "90",
        pages: document.getElementById("rotatePages")?.value || "all",
      }),
      resultTitle: "PDF rotated!",
      resultDesc: "Your rotated PDF is ready.",
      downloadName: "rotated.pdf",
    },
    protect: {
      id: "protect",
      category: "security",
      title: "Protect PDF",
      desc: "Protect PDF files with a password (128-bit encryption)",
      icon: "🔒",
      theme: "ic-yellow",
      dropTitle: "Select a PDF to protect",
      dropHint: "Set a password on your PDF file locally",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Protect PDF",
      btnIcon: "🔒",
      fn: "protectPdf",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Set Password</h4>
          <div class="option-row">
            <label>Password</label>
            <input type="password" id="pdfPassword" placeholder="Enter a password" style="max-width:300px">
          </div>
          <div class="option-row">
            <label>Confirm</label>
            <input type="password" id="pdfPasswordConfirm" placeholder="Confirm password" style="max-width:300px">
          </div>
        </div>
      `,
      getOptions: () => {
        const p = document.getElementById("pdfPassword")?.value || "";
        const c = document.getElementById("pdfPasswordConfirm")?.value || "";
        if (!p) {
          showError("Please enter a password");
          return null;
        }
        if (p !== c) {
          showError("Passwords do not match");
          return null;
        }
        return { password: p };
      },
      resultTitle: "PDF protected!",
      resultDesc: "Your password-protected PDF is ready.",
      downloadName: "protected.pdf",
    },
    unlock: {
      id: "unlock",
      category: "security",
      title: "Unlock PDF",
      desc: "Remove PDF password security",
      icon: "🔓",
      theme: "ic-pink",
      dropTitle: "Select a protected PDF",
      dropHint: "Enter the current password to unlock your PDF",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Unlock PDF",
      btnIcon: "🔓",
      fn: "unlockPdf",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Enter Password</h4>
          <div class="option-row">
            <label>Current password</label>
            <input type="password" id="unlockPassword" placeholder="Enter PDF password" style="max-width:300px">
          </div>
        </div>
      `,
      getOptions: () => ({
        password: document.getElementById("unlockPassword")?.value || "",
      }),
      resultTitle: "PDF unlocked!",
      resultDesc: "Password removed. Your PDF is ready.",
      downloadName: "unlocked.pdf",
    },
    watermark: {
      id: "watermark",
      category: "security",
      title: "Watermark PDF",
      desc: "Stamp custom text over your PDF pages",
      icon: "💧",
      theme: "ic-orange",
      dropTitle: "Select a PDF to watermark",
      dropHint: "Add a diagonal text watermark to all pages",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Add Watermark",
      btnIcon: "💧",
      fn: "watermarkPdf",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Watermark Settings</h4>
          <div class="option-row">
            <label>Watermark text</label>
            <input type="text" id="wmText" placeholder="e.g. CONFIDENTIAL" value="CONFIDENTIAL" style="max-width:300px">
          </div>
          <div class="option-row">
            <label>Opacity</label>
            <div class="radio-group">
              <label><input type="radio" name="wmOpacity" value="0.15"> Light</label>
              <label><input type="radio" name="wmOpacity" value="0.3" checked> Medium</label>
              <label><input type="radio" name="wmOpacity" value="0.5"> Strong</label>
            </div>
          </div>
        </div>
      `,
      getOptions: () => ({
        text: document.getElementById("wmText")?.value || "CONFIDENTIAL",
        watermarkText: document.getElementById("wmText")?.value || "CONFIDENTIAL",
        opacity: document.querySelector("input[name=wmOpacity]:checked")?.value || "0.3",
      }),
      resultTitle: "Watermark added!",
      resultDesc: "Your watermarked PDF is ready.",
      downloadName: "watermarked.pdf",
    },
    "pdf-to-word": {
      id: "pdf-to-word",
      category: "from-pdf",
      title: "PDF to Word",
      desc: "Extract PDF text into an editable .docx document",
      icon: "📘",
      theme: "ic-blue",
      dropTitle: "Select a PDF to convert to Word",
      dropHint: "Extracts structured paragraphs into a .docx file",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to Word",
      btnIcon: "📘",
      fn: "pdfToWord",
      craftApp: "WordCraft",
      options: null,
      resultTitle: "Converted to Word!",
      resultDesc: "Your editable .docx document is ready.",
      downloadName: "converted.docx",
    },
    "pdf-to-ppt": {
      id: "pdf-to-ppt",
      category: "from-pdf",
      title: "PDF to PowerPoint",
      desc: "Turn each PDF page into a PowerPoint (.pptx) slide",
      icon: "📙",
      theme: "ic-orange",
      dropTitle: "Select a PDF to convert to PowerPoint",
      dropHint: "Places each PDF page onto a widescreen .pptx slide",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to PowerPoint",
      btnIcon: "📙",
      fn: "pdfToPpt",
      craftApp: "DeckCraft",
      options: null,
      resultTitle: "Converted to PowerPoint!",
      resultDesc: "Your .pptx presentation is ready.",
      downloadName: "converted.pptx",
    },
    "pdf-to-excel": {
      id: "pdf-to-excel",
      category: "from-pdf",
      title: "PDF to Excel",
      desc: "Extract tabular text positions from PDF into .xlsx",
      icon: "📗",
      theme: "ic-green",
      dropTitle: "Select a PDF to convert to Excel",
      dropHint: "Infers rows and columns from PDF text positions",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to Excel",
      btnIcon: "📗",
      fn: "pdfToExcel",
      craftApp: "GridCraft",
      options: null,
      resultTitle: "Converted to Excel!",
      resultDesc: "Your .xlsx workbook is ready.",
      downloadName: "converted.xlsx",
    },
    organize: {
      id: "organize",
      category: "organize",
      title: "Organize PDF",
      desc: "Extract specific page ranges or reorder pages in your PDF",
      icon: "📑",
      theme: "ic-purple",
      dropTitle: "Select a PDF to organize",
      dropHint: "Specify pages or ranges in the order you want them kept",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Organize PDF",
      btnIcon: "📑",
      fn: "organizePdf",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Page Selection &amp; Order</h4>
          <div class="option-row">
            <label>Keep pages / order</label>
            <input type="text" id="orgPageRange" placeholder="e.g. 1-3, 5, 2 (leave blank for all)">
          </div>
        </div>
      `,
      getOptions: () => ({
        pageRange: document.getElementById("orgPageRange")?.value || "",
      }),
      resultTitle: "PDF organized!",
      resultDesc: "Your reorganized PDF is ready.",
      downloadName: "organized.pdf",
    },
    "page-numbers": {
      id: "page-numbers",
      category: "security",
      title: "Add Page Numbers",
      desc: "Stamp customized page numbering (Page X of Y) onto PDF pages",
      icon: "🔢",
      theme: "ic-teal",
      dropTitle: "Select a PDF to number",
      dropHint: "Adds clean page numbers to the footer of every page",
      accept: ".pdf",
      multiple: false,
      minFiles: 1,
      btnLabel: "Add Page Numbers",
      btnIcon: "🔢",
      fn: "addPageNumbers",
      craftApp: "PdfCraft",
      options: `
        <div class="options-panel glass-card specular-hover">
          <h4>Page Numbering Options</h4>
          <div class="option-row">
            <label>Format</label>
            <select id="pageNumFormat" style="max-width:240px">
              <option value="page_of_total">Page X of Y</option>
              <option value="number_only">Number only (1, 2, 3…)</option>
            </select>
          </div>
          <div class="option-row">
            <label>Position</label>
            <select id="pageNumPos" style="max-width:240px">
              <option value="bottom_center">Bottom Center</option>
              <option value="bottom_right">Bottom Right</option>
              <option value="bottom_left">Bottom Left</option>
            </select>
          </div>
        </div>
      `,
      getOptions: () => ({
        format: document.getElementById("pageNumFormat")?.value || "page_of_total",
        position: document.getElementById("pageNumPos")?.value || "bottom_center",
      }),
      resultTitle: "Page numbers added!",
      resultDesc: "Your numbered PDF is ready.",
      downloadName: "numbered.pdf",
    },
    "md-to-pdf": {
      id: "md-to-pdf",
      category: "to-pdf",
      title: "Markdown to PDF",
      desc: "Typeset Markdown (.md) or plain text (.txt) into a clean PDF",
      icon: "🗒️",
      theme: "ic-purple",
      dropTitle: "Select a Markdown or TXT file",
      dropHint: "Upload a .md or .txt file to typeset into PDF",
      accept: ".md,.txt",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert to PDF",
      btnIcon: "🗒️",
      fn: "mdToPdf",
      craftApp: "WordCraft",
      options: null,
      resultTitle: "Conversion done!",
      resultDesc: "Your typeset PDF is ready.",
      downloadName: "document.pdf",
    },
    "csv-excel": {
      id: "csv-excel",
      category: "from-pdf",
      title: "CSV ↔ Excel (XLSX)",
      desc: "Convert CSV spreadsheets to XLSX workbooks or XLSX to CSV",
      icon: "🔄",
      theme: "ic-green",
      dropTitle: "Select a CSV or XLSX file",
      dropHint: "Upload .csv to get .xlsx, or .xlsx to get .csv",
      accept: ".csv,.xlsx,.xls",
      multiple: false,
      minFiles: 1,
      btnLabel: "Convert Spreadsheet",
      btnIcon: "🔄",
      fn: "csvExcel",
      craftApp: "GridCraft",
      options: null,
      resultTitle: "Spreadsheet converted!",
      resultDesc: "Your converted spreadsheet is ready.",
      downloadName: "converted_sheet.xlsx",
    },
  };

  // Support legacy FileConvert IDs as aliases
  const TOOL_ALIASES = {
    "merge-pdf": "merge",
    "split-pdf": "split",
    "compress-pdf": "compress",
    "pdf-to-images": "pdf-to-jpg",
    "images-to-pdf": "jpg-to-pdf",
    "rotate-pdf": "rotate",
    "organize-pdf": "organize",
    "page-numbers-pdf": "page-numbers",
    "watermark-pdf": "watermark",
  };

  // ── State ────────────────────────────────────────────────────────────────────
  let currentTool = null;
  let currentCategory = "all";
  let selectedFiles = [];
  let lastResultBlob = null;
  let lastResultName = "";

  // ── Render Tool Grid ─────────────────────────────────────────────────────────
  function renderToolsGrid(category = "all") {
    const grid = document.getElementById("toolsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    Object.values(TOOLS).forEach((tool) => {
      if (category !== "all" && tool.category !== category) return;
      const craftInfo = CRAFT_APPS[tool.craftApp];
      const card = document.createElement("a");
      card.className = "tool-card glass-card specular-hover";
      card.href = "#";
      card.dataset.toolId = tool.id;
      card.onclick = (e) => {
        e.preventDefault();
        openTool(tool.id);
      };
      card.innerHTML = `
        <div class="tool-icon ${tool.theme}">${tool.icon}</div>
        <h3>${tool.title}</h3>
        <p>${tool.desc}</p>
        ${craftInfo ? `<span class="craft-badge">${craftInfo.icon} ${craftInfo.name} Engine</span>` : ""}
      `;
      grid.appendChild(card);
    });
  }

  function filterTools(category) {
    currentCategory = category || "all";
    document.querySelectorAll("#navCategoryLinks .fc-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === currentCategory);
    });
    showHome();
    renderToolsGrid(currentCategory);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function showHome() {
    document.getElementById("homePage").style.display = "";
    document.getElementById("toolPage").classList.remove("active");
    document.getElementById("mainFooter").style.display = "";
    currentTool = null;
    selectedFiles = [];
  }

  function openTool(rawToolId) {
    const toolId = TOOL_ALIASES[rawToolId] || rawToolId;
    const tool = TOOLS[toolId];
    if (!tool) return;
    currentTool = toolId;
    selectedFiles = [];
    lastResultBlob = null;
    lastResultName = "";

    document.getElementById("homePage").style.display = "none";
    document.getElementById("mainFooter").style.display = "none";
    document.getElementById("toolPage").classList.add("active");

    document.getElementById("toolTitle").textContent = tool.title;
    document.getElementById("toolDesc").textContent = tool.desc;

    document.getElementById("dropIcon").textContent = tool.icon;
    document.getElementById("dropTitle").textContent = tool.dropTitle;
    document.getElementById("dropHint").textContent = tool.dropHint;

    const fi = document.getElementById("fileInput");
    fi.accept = tool.accept || "*";
    fi.multiple = tool.multiple !== false;

    document.getElementById("optionsArea").innerHTML = tool.options || "";

    document.getElementById("fileList").innerHTML = "";
    document.getElementById("actionBar").style.display = "none";
    document.getElementById("resultPanel").style.display = "none";
    document.getElementById("errorPanel").style.display = "none";
    document.getElementById("dropzone").style.display = "";

    document.getElementById("actionBtnLabel").textContent = tool.btnLabel;
    document.getElementById("actionBtnIcon").textContent = tool.btnIcon;

    const craftInfo = CRAFT_APPS[tool.craftApp] || CRAFT_APPS.PdfCraft;
    const headerCraftBtnLabel = document.getElementById("headerCraftBtnLabel");
    if (headerCraftBtnLabel) {
      headerCraftBtnLabel.textContent = `Open ${craftInfo.name} Studio`;
    }
    const actionCraftBtnLabel = document.getElementById("actionCraftBtnLabel");
    if (actionCraftBtnLabel) {
      actionCraftBtnLabel.textContent = `Open File in ${craftInfo.name} (ArtCraft Engine)`;
    }
  }

  function resetTool() {
    if (currentTool) openTool(currentTool);
  }

  // ── File Handling ────────────────────────────────────────────────────────────
  function handleFiles(files) {
    const tool = TOOLS[currentTool];
    if (!tool) return;

    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    if (!tool.multiple) {
      selectedFiles = [incoming[0]];
    } else {
      selectedFiles = [...selectedFiles, ...incoming];
    }
    renderFileList();
  }

  function renderFileList() {
    const tool = TOOLS[currentTool];
    if (!tool) return;
    const list = document.getElementById("fileList");
    list.innerHTML = "";

    selectedFiles.forEach((f, i) => {
      const div = document.createElement("div");
      div.className = "file-item glass-card";
      const canReorder = tool.multiple && selectedFiles.length > 1;
      div.innerHTML = `
        <span class="file-item-icon">${tool.icon || "📄"}</span>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(f.name)}</div>
          <div class="file-item-meta">${formatSize(f.size)}</div>
        </div>
        <div class="file-item-actions">
          ${canReorder ? `
            <button type="button" class="file-item-btn" onclick="moveFile(${i}, -1)" ${i === 0 ? "disabled" : ""} title="Move Up">↑</button>
            <button type="button" class="file-item-btn" onclick="moveFile(${i}, 1)" ${i === selectedFiles.length - 1 ? "disabled" : ""} title="Move Down">↓</button>
          ` : ""}
          <button type="button" class="file-item-remove" onclick="removeFile(${i})" title="Remove">✕</button>
        </div>
      `;
      list.appendChild(div);
    });

    const enough = selectedFiles.length >= (tool.minFiles || 1);
    document.getElementById("actionBar").style.display = selectedFiles.length > 0 ? "" : "none";
    document.getElementById("actionBtn").disabled = !enough;
    document.getElementById("errorPanel").style.display = "none";
    document.getElementById("resultPanel").style.display = "none";
  }

  function moveFile(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= selectedFiles.length) return;
    const tmp = selectedFiles[index];
    selectedFiles[index] = selectedFiles[target];
    selectedFiles[target] = tmp;
    renderFileList();
  }

  function removeFile(i) {
    selectedFiles.splice(i, 1);
    renderFileList();
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Process & Convert ────────────────────────────────────────────────────────
  async function processFiles() {
    const tool = TOOLS[currentTool];
    if (!tool || selectedFiles.length < (tool.minFiles || 1)) return;

    let options = {};
    if (tool.getOptions) {
      options = tool.getOptions();
      if (options === null) return;
    }

    const converterFn = global.Converters && global.Converters[tool.fn];
    if (typeof converterFn !== "function") {
      showError(`Converter "${tool.fn}" is not available.`);
      return;
    }

    showProgress("Processing your file…", 10);
    document.getElementById("errorPanel").style.display = "none";

    try {
      const onProgress = (arg1, arg2) => {
        if (typeof arg1 === "object" && arg1 !== null) {
          showProgress(arg1.message || "Processing…", arg1.pct || 50);
        } else {
          showProgress(arg2 || "Processing…", typeof arg1 === "number" ? arg1 : 50);
        }
      };

      const rawOutput = await converterFn(selectedFiles, options, onProgress);

      let finalBlob;
      let finalFilename = tool.downloadName || "converted.pdf";

      if (rawOutput instanceof Blob) {
        finalBlob = rawOutput;
        if (tool.id === "csv-excel" && selectedFiles[0]) {
          const isCsv = selectedFiles[0].name.toLowerCase().endsWith(".csv");
          finalFilename = window.ConvUtils.baseName(selectedFiles[0].name) + (isCsv ? ".xlsx" : ".csv");
        }
      } else if (Array.isArray(rawOutput)) {
        if (rawOutput.length === 1) {
          const item = rawOutput[0];
          finalFilename = item.name || finalFilename;
          finalBlob = item.data instanceof Blob ? item.data : new Blob([item.data], { type: item.mime || "application/octet-stream" });
        } else {
          showProgress("Packaging multiple files into ZIP archive…", 95);
          const zip = new JSZip();
          for (const item of rawOutput) {
            const bytes = item.data instanceof Blob ? await item.data.arrayBuffer() : item.data;
            zip.file(item.name, bytes);
          }
          finalBlob = await zip.generateAsync({ type: "blob" });
          finalFilename = tool.downloadName.endsWith(".zip") ? tool.downloadName : `${tool.id}_files.zip`;
        }
      } else {
        throw new Error("Unexpected converter output.");
      }

      lastResultBlob = finalBlob;
      lastResultName = finalFilename;

      const url = URL.createObjectURL(finalBlob);
      const dlBtn = document.getElementById("downloadBtn");
      dlBtn.href = url;
      dlBtn.download = finalFilename;

      document.getElementById("resultTitle").textContent = tool.resultTitle;
      const sizeInfo = `${finalFilename} (${formatSize(finalBlob.size)})`;
      document.getElementById("resultDesc").textContent = `${tool.resultDesc} — ${sizeInfo}`;

      const resultCraftBtn = document.getElementById("resultCraftBtn");
      if (resultCraftBtn) {
        resultCraftBtn.style.display = finalFilename.toLowerCase().endsWith(".pdf") ? "" : "none";
      }

      document.getElementById("resultPanel").style.display = "";
      document.getElementById("actionBar").style.display = "none";
      document.getElementById("dropzone").style.display = "none";
      document.getElementById("fileList").innerHTML = "";
    } catch (err) {
      console.error("FileConvert error:", err);
      showError(err && err.message ? err.message : String(err));
    } finally {
      hideProgress();
    }
  }

  function showError(msg) {
    document.getElementById("errorMsg").textContent = msg;
    document.getElementById("errorPanel").style.display = "flex";
  }

  function showProgress(msg, pct) {
    document.getElementById("progressText").textContent = msg;
    const bar = document.getElementById("progressBarFill");
    if (bar && typeof pct === "number") {
      bar.style.width = `${Math.max(5, Math.min(100, pct))}%`;
    }
    document.getElementById("progressOverlay").classList.add("show");
  }

  function hideProgress() {
    document.getElementById("progressOverlay").classList.remove("show");
  }

  function updateSplitUI() {
    const mode = document.querySelector("input[name=splitMode]:checked")?.value;
    const fixedRow = document.getElementById("splitFixedRow");
    const rangeRow = document.getElementById("splitRangeRow");
    if (fixedRow) fixedRow.style.display = mode === "fixed" ? "" : "none";
    if (rangeRow) rangeRow.style.display = mode === "range" ? "" : "none";
  }

  // ── ArtCraft Suite Embedded Studio Integration ───────────────────────────────
  let pendingCraftFile = null;

  async function openCraftModalWithFile(craftKey, fileObj) {
    const info = CRAFT_APPS[craftKey] || CRAFT_APPS.PdfCraft;
    const modal = document.getElementById("craftModal");
    const iframe = document.getElementById("craftIframe");
    document.getElementById("craftModalIcon").textContent = info.icon;
    document.getElementById("craftModalTitle").textContent = `${info.name} (ArtCraft Suite)`;
    document.getElementById("craftModalHint").textContent = `— ${info.hint}`;
    document.getElementById("craftOpenFullBtn").href = info.path;

    if (fileObj) {
      const buffer = await fileObj.arrayBuffer();
      pendingCraftFile = {
        type: "sigma-craft-open-file",
        name: fileObj.name,
        mime: fileObj.type || "application/octet-stream",
        buffer,
      };
    } else {
      pendingCraftFile = null;
    }

    modal.classList.add("open");
    const currentSrc = iframe.getAttribute("src") || "";
    if (!currentSrc.includes(info.path)) {
      iframe.setAttribute("src", info.path);
    } else if (pendingCraftFile && iframe.contentWindow) {
      iframe.contentWindow.postMessage(pendingCraftFile, "*");
    }
  }

  function openCraftModalForCurrentTool() {
    const tool = TOOLS[currentTool];
    const craftKey = (tool && tool.craftApp) || "PdfCraft";
    const fileToPass = selectedFiles[0] || null;
    openCraftModalWithFile(craftKey, fileToPass);
  }

  function resendFileToCraft() {
    const iframe = document.getElementById("craftIframe");
    if (pendingCraftFile && iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(pendingCraftFile, "*");
    } else if (selectedFiles[0]) {
      openCraftModalForCurrentTool();
    }
  }

  function openResultInCraft() {
    if (!lastResultBlob) return;
    const fileObj = new File([lastResultBlob], lastResultName || "result.pdf", {
      type: lastResultBlob.type || "application/pdf",
    });
    openCraftModalWithFile("PdfCraft", fileObj);
  }

  function closeCraftModal() {
    document.getElementById("craftModal").classList.remove("open");
  }

  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "sigma-craft-ready") {
      const iframe = document.getElementById("craftIframe");
      if (pendingCraftFile && iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(pendingCraftFile, "*");
      }
    }
  });

  // ── Event Listeners ──────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    renderToolsGrid("all");

    const fi = document.getElementById("fileInput");
    if (fi) {
      fi.addEventListener("change", function () {
        if (this.files && this.files.length) handleFiles(this.files);
        this.value = "";
      });
    }

    const dz = document.getElementById("dropzone");
    if (dz) {
      dz.addEventListener("dragover", (e) => {
        e.preventDefault();
        dz.classList.add("dragover");
      });
      dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
      dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          handleFiles(e.dataTransfer.files);
        }
      });
    }
  });

  // Expose globals for inline handlers (matching iLovePDF-Clone)
  global.TOOLS = TOOLS;
  global.showHome = showHome;
  global.openTool = openTool;
  global.resetTool = resetTool;
  global.filterTools = filterTools;
  global.handleFiles = handleFiles;
  global.removeFile = removeFile;
  global.moveFile = moveFile;
  global.processFiles = processFiles;
  global.updateSplitUI = updateSplitUI;
  global.openCraftModalForCurrentTool = openCraftModalForCurrentTool;
  global.resendFileToCraft = resendFileToCraft;
  global.openResultInCraft = openResultInCraft;
  global.closeCraftModal = closeCraftModal;
})(typeof window !== "undefined" ? window : globalThis);

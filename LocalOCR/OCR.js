/**
 * LocalOCR Engine
 * High-accuracy client-side text extractor with interactive preprocessing studio.
 * 100% offline, zero server requirement.
 */

// Setup PDF.js Worker with file:// protocol safe fallback
if (window.location.protocol === "file:") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  } catch (_) {}
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "../lib/pdf.worker.min.js";
}

// DOM Elements
const dropZone = document.getElementById("drop-zone");
const browseBtn = document.getElementById("browse-btn");
const fileInput = document.getElementById("file-input");
const workspace = document.getElementById("workspace");
const fileList = document.getElementById("file-list");
const activeFileName = document.getElementById("active-file-name");
const activeFileMeta = document.getElementById("active-file-meta");
const confidenceBadge = document.getElementById("confidenceBadge");
const outputText = document.getElementById("output-text");
const copyBtn = document.getElementById("copy-btn");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const downloadMdBtn = document.getElementById("downloadMdBtn");
const togglePreviewBtn = document.getElementById("togglePreviewBtn");
const previewDrawer = document.getElementById("previewDrawer");
const originalPreviewImg = document.getElementById("originalPreviewImg");
const processedPreviewImg = document.getElementById("processedPreviewImg");
const addMoreBtn = document.getElementById("add-more-btn");
const statusBar = document.getElementById("status-bar");

// Preprocessing toggles
const prepBinarize = document.getElementById("prepBinarize");
const prepInvert = document.getElementById("prepInvert");
const prepContrast = document.getElementById("prepContrast");
const prepDenoise = document.getElementById("prepDenoise");
const prepRotate = document.getElementById("prepRotate");
const reprocessBtn = document.getElementById("reprocessBtn");

const preprocessSettings = {
  binarize: true,
  invert: false,
  contrast: 30,
  denoise: true,
  rotation: 0
};

// Supported Extensions
const SUPPORTED_TEXT = ["md", "txt", "csv", "json", "xml", "log"];
const SUPPORTED_IMAGE = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];
const SUPPORTED_PDF = ["pdf"];

// State
let filesData = [];
let activeFileId = null;
let tesseractWorker = null;

// Initialize Tesseract Worker safely
async function initOCRWorker() {
  if (!tesseractWorker) {
    showStatus("Initializing local Tesseract OCR engine…");
    try {
      tesseractWorker = await Tesseract.createWorker("eng");
    } catch (err) {
      console.warn("Worker creation fallback:", err);
      // Try default worker setup
      tesseractWorker = await Tesseract.createWorker();
      await tesseractWorker.loadLanguage("eng");
      await tesseractWorker.initialize("eng");
    }
    hideStatus();
  }
}

// File Selection Listeners
browseBtn.addEventListener("click", () => fileInput.click());
addMoreBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

// Clipboard Paste
document.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  const pastedFiles = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "file") {
      const file = items[i].getAsFile();
      if (file) pastedFiles.push(file);
    }
  }

  if (pastedFiles.length > 0) {
    e.preventDefault();
    handleFiles(pastedFiles);
  }
});

// Drag & Drop
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (e) => {
  handleFiles(e.dataTransfer.files);
});

// Copy to Clipboard
copyBtn.addEventListener("click", async () => {
  if (outputText.value) {
    await navigator.clipboard.writeText(outputText.value);
    const orig = copyBtn.innerText;
    copyBtn.innerText = "✓ Copied!";
    setTimeout(() => (copyBtn.innerText = orig), 1800);
  }
});

// Download TXT
downloadTxtBtn.addEventListener("click", () => {
  const activeObj = filesData.find((f) => f.id === activeFileId);
  const base = activeObj ? activeObj.name.replace(/\.[^/.]+$/, "") : "extracted_text";
  downloadTextBlob(outputText.value, `${base}_ocr.txt`);
});

// Download Markdown
downloadMdBtn.addEventListener("click", () => {
  const activeObj = filesData.find((f) => f.id === activeFileId);
  const base = activeObj ? activeObj.name.replace(/\.[^/.]+$/, "") : "extracted_text";
  const md = `# OCR Extraction: ${activeObj?.name || ""}\n\n${outputText.value}`;
  downloadTextBlob(md, `${base}_ocr.md`);
});

function downloadTextBlob(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Toggle Preprocessed Preview
togglePreviewBtn.addEventListener("click", () => {
  previewDrawer.classList.toggle("hidden");
});

// Preprocessing button toggles
function setupPrepPill(el, key, isToggle = true) {
  if (!el) return;
  el.addEventListener("click", () => {
    if (isToggle) {
      preprocessSettings[key] = !preprocessSettings[key];
      el.classList.toggle("active", preprocessSettings[key]);
    }
  });
}

setupPrepPill(prepBinarize, "binarize");
setupPrepPill(prepInvert, "invert");
setupPrepPill(prepContrast, "contrast", false);
if (prepContrast) {
  prepContrast.addEventListener("click", () => {
    preprocessSettings.contrast = preprocessSettings.contrast > 0 ? 0 : 35;
    prepContrast.classList.toggle("active", preprocessSettings.contrast > 0);
  });
}
setupPrepPill(prepDenoise, "denoise");
if (prepRotate) {
  prepRotate.addEventListener("click", () => {
    preprocessSettings.rotation = (preprocessSettings.rotation + 90) % 360;
    prepRotate.innerText = `↻ Rotate (${preprocessSettings.rotation}°)`;
    prepRotate.classList.toggle("active", preprocessSettings.rotation !== 0);
  });
}

// Re-process current file with updated preprocessing settings
reprocessBtn.addEventListener("click", async () => {
  const activeObj = filesData.find((f) => f.id === activeFileId);
  if (!activeObj) return;

  if (activeObj.type === "IMAGE") {
    showStatus(`Re-running OCR on ${activeObj.name} with updated preprocessing…`);
    activeObj.status = "PROCESSING";
    renderFileList();
    activeObj.content = await performOCROnImage(activeObj.file);
    activeObj.status = "DONE";
    hideStatus();
    renderFileList();
    outputText.value = activeObj.content;
    if (confidenceBadge && activeObj.confidence) {
      confidenceBadge.innerText = `Confidence: ${Math.round(activeObj.confidence)}%`;
      confidenceBadge.className = "badge badge-accent";
    }
  }
});

// Process incoming files
function handleFiles(incomingFiles) {
  if (!incomingFiles.length) return;
  workspace.classList.remove("hidden");

  Array.from(incomingFiles).forEach((file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    let type = "UNSUPPORTED";

    if (SUPPORTED_TEXT.includes(ext)) type = "TEXT";
    else if (SUPPORTED_IMAGE.includes(ext)) type = "IMAGE";
    else if (SUPPORTED_PDF.includes(ext)) type = "PDF";

    const fileObj = {
      id: "file_" + Math.random().toString(36).substr(2, 9),
      file: file,
      name: file.name,
      ext: ext,
      type: type,
      status: type === "UNSUPPORTED" ? "UNSUPPORTED" : "PENDING",
      content: type === "UNSUPPORTED" ? "Unsupported file type." : "",
      confidence: null,
      preprocessedUrl: null,
      originalUrl: null
    };

    filesData.push(fileObj);
  });

  renderFileList();

  if (!activeFileId && filesData.length > 0) {
    selectFile(filesData[filesData.length - incomingFiles.length].id);
  }

  processQueue();
}

function renderFileList() {
  fileList.innerHTML = "";
  filesData.forEach((item) => {
    const li = document.createElement("li");
    li.className = `file-item ${item.id === activeFileId ? "active" : ""}`;
    li.onclick = () => selectFile(item.id);

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.innerText = item.name;

    const tagSpan = document.createElement("span");
    tagSpan.className = `tag ${item.type === "UNSUPPORTED" ? "unsupported" : ""}`;
    tagSpan.innerText = item.status === "PROCESSING" ? "SCANNING…" : item.type;

    li.appendChild(nameSpan);
    li.appendChild(tagSpan);
    fileList.appendChild(li);
  });
}

function selectFile(id) {
  activeFileId = id;
  const fileObj = filesData.find((f) => f.id === id);
  if (!fileObj) return;

  activeFileName.innerText = fileObj.name;
  activeFileMeta.innerText = `${fileObj.file.size} Bytes • ${fileObj.type}`;
  outputText.value = fileObj.content;

  if (fileObj.confidence) {
    confidenceBadge.innerText = `Confidence: ${Math.round(fileObj.confidence)}%`;
    confidenceBadge.className = "badge badge-accent";
  } else {
    confidenceBadge.className = "badge hidden";
  }

  if (fileObj.originalUrl) originalPreviewImg.src = fileObj.originalUrl;
  if (fileObj.preprocessedUrl) processedPreviewImg.src = fileObj.preprocessedUrl;

  renderFileList();
}

async function processQueue() {
  for (let item of filesData) {
    if (item.status === "PENDING") {
      item.status = "PROCESSING";
      renderFileList();

      if (item.id === activeFileId) {
        showStatus(`Processing ${item.name}…`);
      }

      try {
        if (item.type === "TEXT") {
          item.content = await readTextFile(item.file);
        } else if (item.type === "IMAGE") {
          item.content = await performOCROnImage(item);
        } else if (item.type === "PDF") {
          item.content = await performOCROnPDF(item);
        }
      } catch (err) {
        item.content = `[OCR Error] Could not extract text from ${item.name}: ${err.message}`;
      }

      item.status = "DONE";
      hideStatus();
      renderFileList();

      if (item.id === activeFileId) {
        outputText.value = item.content;
        if (item.confidence) {
          confidenceBadge.innerText = `Confidence: ${Math.round(item.confidence)}%`;
          confidenceBadge.className = "badge badge-accent";
        }
      }
    }
  }
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(reader.error || new Error("Failed to read text."));
    reader.readAsText(file);
  });
}

// Load image into an Image element
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ img, url });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image."));
    };
    img.src = url;
  });
}

// Perform OCR on Image with Preprocessing
async function performOCROnImage(item) {
  const file = item.file || item;
  await initOCRWorker();

  const { img, url: origUrl } = await loadImageElement(file);
  item.originalUrl = origUrl;
  originalPreviewImg.src = origUrl;

  // Run through preprocessing studio
  const prepResult = window.OCRPreprocessor.preprocessImage(img, preprocessSettings);
  item.preprocessedUrl = prepResult.dataUrl;
  processedPreviewImg.src = prepResult.dataUrl;

  // Run Tesseract on preprocessed canvas
  const ret = await tesseractWorker.recognize(prepResult.canvas);
  item.confidence = ret.data.confidence;

  return ret.data.text.trim();
}

// Perform OCR / Text Extraction on PDF
async function performOCROnPDF(item) {
  const file = item.file || item;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    showStatus(`Processing PDF Page ${i}/${pdf.numPages}…`);
    const page = await pdf.getPage(i);

    // 1. Try native digital text extraction first
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items.map((item) => item.str).filter(Boolean);

    if (pageStrings.length > 5) {
      // PDF contains digital text stream!
      fullText += `--- Page ${i} (Native Digital Text) ---\n` + pageStrings.join(" ") + "\n\n";
    } else {
      // Scanned PDF page: Fallback to Canvas + Tesseract OCR
      await initOCRWorker();
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Apply preprocessing
      const prep = window.OCRPreprocessor.preprocessImage(canvas, preprocessSettings);
      const ret = await tesseractWorker.recognize(prep.canvas);
      fullText += `--- Page ${i} (OCR Scanned) ---\n` + ret.data.text.trim() + "\n\n";
    }
  }

  return fullText.trim();
}

function showStatus(msg) {
  statusBar.innerText = msg;
  statusBar.classList.remove("hidden");
}

function hideStatus() {
  statusBar.classList.add("hidden");
}

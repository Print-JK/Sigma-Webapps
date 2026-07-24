// Setup PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "../../lib/pdf.worker.min.js";

// DOM Elements
const dropZone = document.getElementById("drop-zone");
const browseBtn = document.getElementById("browse-btn");
const fileInput = document.getElementById("file-input");
const workspace = document.getElementById("workspace");
const fileList = document.getElementById("file-list");
const activeFileName = document.getElementById("active-file-name");
const activeFileMeta = document.getElementById("active-file-meta");
const outputText = document.getElementById("output-text");
const copyBtn = document.getElementById("copy-btn");
const addMoreBtn = document.getElementById("add-more-btn");
const statusBar = document.getElementById("status-bar");

// Supported File Extensions
const SUPPORTED_TEXT = ["md", "txt"];
const SUPPORTED_IMAGE = ["png", "jpg", "jpeg", "webp", "bmp"];
const SUPPORTED_PDF = ["pdf"];

// Application State
let filesData = [];
let activeFileId = null;
let paddleOcrEngine = null;

// Initialize PaddleOCR Engine
async function getPaddleOcrEngine() {
  if (!paddleOcrEngine) {
    showStatus("Downloading & initializing PaddleOCR ONNX models (~12MB)...");
    
    // PaddleOCR.js initializes the text detector (DBNet) and text recognizer (CRNN)
    paddleOcrEngine = await PaddleOCR.create({
      lang: "en",
      ocrVersion: "PP-OCRv5",
      ortOptions: {
        backend: "wasm",
        numThreads: 2
      }
    });
    
    hideStatus();
  }
  return paddleOcrEngine;
}

// Event Listeners for File Selection
browseBtn.addEventListener("click", () => fileInput.click());
addMoreBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

// Drag and Drop Events
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
  const dt = e.dataTransfer;
  handleFiles(dt.files);
});

// Copy Button
copyBtn.addEventListener("click", () => {
  if (outputText.value) {
    navigator.clipboard.writeText(outputText.value);
    const origText = copyBtn.innerText;
    copyBtn.innerText = "Copied!";
    setTimeout(() => (copyBtn.innerText = origText), 2000);
  }
});

// File Handling Strategy
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
    tagSpan.innerText = item.status === "PROCESSING" ? "SCANNING..." : item.type;

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

  renderFileList();
}

// Queue Processor
async function processQueue() {
  for (let item of filesData) {
    if (item.status === "PENDING") {
      item.status = "PROCESSING";
      renderFileList();

      if (item.id === activeFileId) {
        showStatus(`Processing ${item.name}...`);
      }

      try {
        if (item.type === "TEXT") {
          item.content = await readTextFile(item.file);
        } else if (item.type === "IMAGE") {
          item.content = await performPaddleOCR(item.file);
        } else if (item.type === "PDF") {
          item.content = await performPDFPaddleOCR(item.file);
        }
      } catch (err) {
        console.error(err);
        item.content = `[OCR Error]: ${err.message}`;
      }

      item.status = "DONE";
      hideStatus();
      renderFileList();

      if (item.id === activeFileId) {
        outputText.value = item.content;
      }
    }
  }
}

function readTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsText(file);
  });
}

// PaddleOCR Inference for Images
async function performPaddleOCR(file) {
  const ocr = await getPaddleOcrEngine();
  
  // Predict text regions and characters
  const [results] = await ocr.predict(file);

  if (!results || !results.items || results.items.length === 0) {
    return "No text detected in image.";
  }

  // Extract detected text strings from bounding boxes
  return results.items.map((item) => item.text).join("\n");
}

// PaddleOCR Inference for PDFs
async function performPDFPaddleOCR(file) {
  const ocr = await getPaddleOcrEngine();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    showStatus(`Processing PDF Page ${i}/${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // Scale up for better OCR detail

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // Run PaddleOCR on rendered canvas element
    const [results] = await ocr.predict(canvas);
    
    let pageText = "";
    if (results && results.items) {
      pageText = results.items.map((item) => item.text).join("\n");
    }

    fullText += `--- Page ${i} ---\n` + (pageText || "No text detected.") + "\n\n";
  }

  return fullText;
}

function showStatus(msg) {
  statusBar.innerText = msg;
  statusBar.classList.remove("hidden");
}

function hideStatus() {
  statusBar.classList.add("hidden");
}
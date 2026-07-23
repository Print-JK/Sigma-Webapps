// Setup PDF.js Worker
/* 
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";*/
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "../lib/pdf.worker.min.js";


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
let filesData = []; // Array of { id, file, name, ext, type, status, content }
let activeFileId = null;
let tesseractWorker = null;

// Initialize Tesseract Worker
async function initOCRWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker("eng");
  }
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

// Copy to Clipboard Action
copyBtn.addEventListener("click", () => {
  if (outputText.value) {
    navigator.clipboard.writeText(outputText.value);
    const origText = copyBtn.innerText;
    copyBtn.innerText = "Copied!";
    setTimeout(() => (copyBtn.innerText = origText), 2000);
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
    };

    filesData.push(fileObj);
  });

  renderFileList();

  // If no file is selected yet, select the first newly added valid file
  if (!activeFileId && filesData.length > 0) {
    selectFile(filesData[filesData.length - incomingFiles.length].id);
  }

  processQueue();
}

// Render the sidebar list
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

// Select active file in sidebar
function selectFile(id) {
  activeFileId = id;
  const fileObj = filesData.find((f) => f.id === id);

  if (!fileObj) return;

  activeFileName.innerText = fileObj.name;
  activeFileMeta.innerText = `${fileObj.file.size} Bytes • ${fileObj.type}`;
  outputText.value = fileObj.content;

  renderFileList();
}

// Process extraction queue
async function processQueue() {
  for (let item of filesData) {
    if (item.status === "PENDING") {
      item.status = "PROCESSING";
      renderFileList();

      if (item.id === activeFileId) {
        showStatus(`Processing ${item.name}...`);
      }

      if (item.type === "TEXT") {
        item.content = await readTextFile(item.file);
      } else if (item.type === "IMAGE") {
        item.content = await performOCROnImage(item.file);
      } else if (item.type === "PDF") {
        item.content = await performOCROnPDF(item.file);
      }

      item.status = "DONE";
      hideStatus();
      renderFileList();

      // If active item was updated, sync UI
      if (item.id === activeFileId) {
        outputText.value = item.content;
      }
    }
  }
}

// Read Markdown & Plain Text
function readTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsText(file);
  });
}

// OCR for Images
async function performOCROnImage(file) {
  await initOCRWorker();
  const url = URL.createObjectURL(file);
  const ret = await tesseractWorker.recognize(url);
  URL.revokeObjectURL(url);
  return ret.data.text;
}

// OCR for PDFs using PDF.js + Canvas + Tesseract
async function performOCROnPDF(file) {
  await initOCRWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    showStatus(`Processing PDF Page ${i}/${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    // Render page to canvas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // Run OCR on rendered canvas
    const ret = await tesseractWorker.recognize(canvas);
    fullText += `--- Page ${i} ---\n` + ret.data.text + "\n\n";
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
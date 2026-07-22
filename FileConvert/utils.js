/**
 * utils.js
 * Shared, dependency-free helpers used by every converter module.
 * Exposed on window.ConvUtils so converters/*.js and app.js can share them.
 */
(function (global) {
  "use strict";

  // pdf.js needs an explicit local worker script (no CDN).
  if (global.pdfjsLib) {
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function baseName(fileName) {
    return fileName.replace(/\.[^/.]+$/, "");
  }

  function ext(fileName) {
    const m = /\.([^/.]+)$/.exec(fileName);
    return m ? m[1].toLowerCase() : "";
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /**
   * Bundle several {name, data} outputs into a single zip Blob when there is
   * more than one; otherwise return the single file directly. `data` may be
   * a Blob, ArrayBuffer, or Uint8Array.
   */
  async function packageResults(files, singleZipName) {
    if (files.length === 1) {
      return [{ name: files[0].name, blob: toBlob(files[0].data, files[0].mime) }];
    }
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.data);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    return [{ name: singleZipName || "output.zip", blob }];
  }

  function toBlob(data, mime) {
    if (data instanceof Blob) return data;
    return new Blob([data], { type: mime || "application/octet-stream" });
  }

  const MIME = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    zip: "application/zip",
  };

  // Render one PDF page to a canvas via pdf.js. Returns the canvas element.
  async function renderPdfPageToCanvas(pdfDoc, pageNum, scale) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale || 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  // Very small XML-escaping helper for hand-written OOXML / SVG text nodes.
  function escapeXml(str) {
    return String(str).replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case '"': return "&quot;";
      }
    });
  }

  global.ConvUtils = {
    readFileAsArrayBuffer,
    readFileAsDataURL,
    formatBytes,
    baseName,
    ext,
    downloadBlob,
    packageResults,
    toBlob,
    MIME,
    renderPdfPageToCanvas,
    canvasToBlob,
    escapeXml,
  };
})(window);

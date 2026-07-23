/**
 * utils.js
 * Shared, dependency-free helpers used by every converter module.
 * Exposed on window.ConvUtils so converters/*.js and app.js can share them.
 */
(function (global) {
  "use strict";

  // pdf.js needs an explicit local worker script (no CDN).
  if (global.pdfjsLib) {
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = "../lib/pdf.worker.min.js";
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

  // ---------------------------------------------------------------------
  // Lightweight file-type sniffing (magic bytes), independent of the file
  // extension the user happened to save the file with. Used to give real
  // feedback ("this isn't actually a PDF") instead of a silent failure or
  // a raw library stack trace.
  // ---------------------------------------------------------------------
  async function detectFileKind(file) {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const bytesEqual = (offset, arr) => arr.every((b, i) => head[offset + i] === b);

    if (bytesEqual(0, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
    if (bytesEqual(0, [0x89, 0x50, 0x4e, 0x47])) return "png"; // \x89PNG
    if (bytesEqual(0, [0xff, 0xd8, 0xff])) return "jpg"; // JPEG SOI marker
    if (bytesEqual(0, [0xd0, 0xcf, 0x11, 0xe0])) return "ole-legacy"; // old .doc/.xls/.ppt (unsupported)

    if (bytesEqual(0, [0x50, 0x4b, 0x03, 0x04]) || bytesEqual(0, [0x50, 0x4b, 0x05, 0x06])) {
      // Zip-based Office format — peek inside to tell docx/pptx/xlsx apart.
      try {
        const zip = await JSZip.loadAsync(file);
        if (zip.file("word/document.xml")) return "docx";
        if (zip.file("ppt/presentation.xml")) return "pptx";
        if (zip.file("xl/workbook.xml")) return "xlsx";
        return "zip-unknown";
      } catch (e) {
        return "zip-unknown";
      }
    }
    return "unknown";
  }

  const KIND_LABEL = {
    pdf: "PDF",
    png: "PNG",
    jpg: "JPG",
    docx: "DOCX",
    pptx: "PPTX",
    xlsx: "XLSX",
    "ole-legacy": "UNSUPPORTED",
    "zip-unknown": "UNSUPPORTED",
    unknown: "UNSUPPORTED",
  };

  // Parses a PDF File into a pdf.js document proxy exactly once. Callers
  // (page-count lookup, thumbnail rendering) share the result instead of
  // each re-reading and re-parsing the same bytes.
  async function loadPdfDocument(file) {
    const bytes = await readFileAsArrayBuffer(file);
    return pdfjsLib.getDocument({ data: bytes }).promise;
  }

  // First-page thumbnail (data URL) from an already-loaded pdf.js document.
  async function getPdfThumbnail(pdfDoc, scale) {
    const canvas = await renderPdfPageToCanvas(pdfDoc, 1, scale || 0.5);
    return canvas.toDataURL("image/png");
  }

  // Convenience one-shot used where the caller doesn't need to keep the
  // parsed document around afterwards.
  async function getPdfInfo(file) {
    const pdf = await loadPdfDocument(file);
    const thumbnailUrl = await getPdfThumbnail(pdf, 0.5);
    return { pageCount: pdf.numPages, thumbnailUrl };
  }

  // ---------------------------------------------------------------------
  // Unicode text support for pdf-lib's drawText.
  //
  // pdf-lib's 14 "standard" fonts (Helvetica etc.) only support WinAnsi
  // encoding — a Latin-1-ish subset. Any character outside it (zero-width
  // spaces Word silently inserts, Greek/Cyrillic letters, CJK, many
  // symbols) makes drawText throw immediately and abort the whole
  // conversion. We embed DejaVu Sans (bundled locally, no network) via
  // fontkit instead, which covers Latin Extended + Greek + Cyrillic
  // properly, and safely falls back to a placeholder glyph — instead of
  // throwing — for scripts it doesn't include (e.g. CJK). One font pair
  // is loaded and cached per PDFDocument.
  // ---------------------------------------------------------------------
  const decodedFontCache = {};

  function base64ToUint8Array(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function getFontBytes(key) {
    if (!decodedFontCache[key]) {
      if (!global.FONT_DATA || !global.FONT_DATA[key]) {
        throw new Error(`Font data "${key}" isn't loaded — is ../lib/fonts-data.js present and included in index.html?`);
      }
      decodedFontCache[key] = base64ToUint8Array(global.FONT_DATA[key]);
    }
    return decodedFontCache[key];
  }

  async function loadUnicodeFonts(pdfDoc) {
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(getFontBytes("dejaVuSansRegular"), { subset: true });
    const boldFont = await pdfDoc.embedFont(getFontBytes("dejaVuSansBold"), { subset: true });
    return { font, boldFont };
  }

  // Strips zero-width/invisible format characters (Unicode category Cf —
  // zero-width space, joiners, BOM, bidi controls, soft hyphen) that
  // Word/PowerPoint/Excel often embed invisibly. They have no visual
  // representation, so dropping them loses nothing and avoids rendering
  // stray placeholder glyphs for characters nobody would ever see anyway.
  function stripInvisibleChars(str) {
    return String(str).replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, "");
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
    detectFileKind,
    KIND_LABEL,
    getPdfInfo,
    loadPdfDocument,
    getPdfThumbnail,
    loadUnicodeFonts,
    stripInvisibleChars,
  };
})(window);

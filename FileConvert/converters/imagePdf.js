/**
 * imagePdf.js — JPG/PNG/WEBP/BMP/GIF <-> PDF.
 * imagesToPdf: embeds each image as a full page (pdf-lib embedJpg/embedPng, with canvas conversion for WEBP/BMP/GIF).
 * pdfToImages: rasterizes each PDF page to a canvas via pdf.js at chosen DPI (72/150/300), then exports JPEG or PNG.
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer, renderPdfPageToCanvas, canvasToBlob, baseName, ext } =
    window.ConvUtils;

  const PAGE_MARGIN = 24;

  async function normalizeImageToPngBytes(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(`Could not decode image "${file.name}".`));
        el.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 1;
      canvas.height = img.naturalHeight || img.height || 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const blob = await canvasToBlob(canvas, "image/png");
      return await blob.arrayBuffer();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function imagesToPdf(files, options, onProgress) {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      onProgress && onProgress({
        pct: Math.round((i / files.length) * 90),
        message: `Placing "${files[i].name}" (${i + 1}/${files.length})…`,
      });
      const bytes = await readFileAsArrayBuffer(files[i]);
      const kind = ext(files[i].name);
      let image;
      if (kind === "png") {
        image = await pdfDoc.embedPng(bytes);
      } else if (kind === "jpg" || kind === "jpeg") {
        try {
          image = await pdfDoc.embedJpg(bytes);
        } catch (_) {
          const pngBytes = await normalizeImageToPngBytes(files[i]);
          image = await pdfDoc.embedPng(pngBytes);
        }
      } else {
        const pngBytes = await normalizeImageToPngBytes(files[i]);
        image = await pdfDoc.embedPng(pngBytes);
      }

      const maxW = 612 - PAGE_MARGIN * 2;
      const maxH = 792 - PAGE_MARGIN * 2;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;

      const page = pdfDoc.addPage([w + PAGE_MARGIN * 2, h + PAGE_MARGIN * 2]);
      page.drawImage(image, { x: PAGE_MARGIN, y: PAGE_MARGIN, width: w, height: h });
    }

    onProgress && onProgress({ pct: 95, message: "Writing PDF…" });
    const outBytes = await pdfDoc.save();
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{ name: "converted.pdf", data: outBytes, mime: "application/pdf" }];
  }

  async function pdfToImages(files, options, onProgress) {
    const file = files[0];
    const format = (options && options.imageFormat === "png") ? "png" : "jpg";
    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    const quality = format === "jpg" ? 0.92 : undefined;
    const dpi = parseInt((options && options.dpi) || 150, 10);
    const scale = Math.max(0.5, Math.min(4.5, dpi / 72));

    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const outputs = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress({
        pct: Math.round(((p - 1) / pdf.numPages) * 90),
        message: `Rendering page ${p}/${pdf.numPages} at ${dpi} DPI…`,
      });
      const canvas = await renderPdfPageToCanvas(pdf, p, scale);
      const blob = await canvasToBlob(canvas, mimeType, quality);
      const num = String(p).padStart(3, "0");
      outputs.push({
        name: `${baseName(file.name)}_page-${num}.${format}`,
        data: blob,
        mime: mimeType,
      });
    }

    onProgress && onProgress({ pct: 100, message: "Done." });
    return outputs;
  }

  window.Converters = window.Converters || {};
  window.Converters.imagesToPdf = imagesToPdf;
  window.Converters.pdfToImages = pdfToImages;
})(window);

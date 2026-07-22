/**
 * imagePdf.js — JPG/PNG <-> PDF.
 * imagesToPdf: embeds each image as a full page (pdf-lib embedJpg/embedPng).
 * pdfToImages: rasterizes each PDF page to a canvas via pdf.js, then exports
 * PNG or JPEG. Multiple pages come back as a zip.
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer, renderPdfPageToCanvas, canvasToBlob, baseName, ext } =
    window.ConvUtils;

  const PAGE_MARGIN = 24; // pt, purely cosmetic breathing room around the image

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
      } else {
        // Treat jpg/jpeg (and anything else) as JPEG — embedJpg will throw
        // a clear error if the bytes aren't actually a JPEG.
        image = await pdfDoc.embedJpg(bytes);
      }

      const maxW = 612 - PAGE_MARGIN * 2; // US Letter width in pt, minus margins
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
    return [{ name: "images.pdf", data: outBytes, mime: "application/pdf" }];
  }

  async function pdfToImages(files, options, onProgress) {
    const file = files[0];
    const format = options.imageFormat === "jpg" ? "jpg" : "png";
    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    const quality = format === "jpg" ? 0.92 : undefined;

    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const outputs = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress({
        pct: Math.round(((p - 1) / pdf.numPages) * 90),
        message: `Rendering page ${p}/${pdf.numPages}…`,
      });
      const canvas = await renderPdfPageToCanvas(pdf, p, 2);
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

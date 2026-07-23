/**
 * pdfMerge.js — combine N PDF files (in the given order) into a single PDF.
 * Engine: pdf-lib (copyPages).
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer } = window.ConvUtils;

  async function pdfMerge(files, options, onProgress) {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      onProgress && onProgress({
        pct: Math.round((i / files.length) * 90),
        message: `Reading "${files[i].name}" (${i + 1}/${files.length})…`,
      });
      const bytes = await readFileAsArrayBuffer(files[i]);
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await merged.copyPages(src, src.getPageIndices());
      copied.forEach((p) => merged.addPage(p));
    }

    onProgress && onProgress({ pct: 95, message: "Writing merged PDF…" });
    const outBytes = await merged.save();
    onProgress && onProgress({ pct: 100, message: "Done." });

    return [{ name: "merged.pdf", data: outBytes, mime: "application/pdf" }];
  }

  window.Converters = window.Converters || {};
  window.Converters.pdfMerge = pdfMerge;
})(window);

/**
 * pdfSplit.js — split one PDF into several PDFs.
 * Two modes:
 *   "every"  -> one output PDF per page
 *   "ranges" -> user-supplied ranges string, e.g. "1-3,5,8-10"
 * Engine: pdf-lib (copyPages). Multiple outputs are zipped by app.js via
 * ConvUtils.packageResults.
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer } = window.ConvUtils;

  function parseRanges(rangeStr, pageCount) {
    const parts = rangeStr.split(",").map((s) => s.trim()).filter(Boolean);
    const groups = [];
    for (const part of parts) {
      const m = /^(\d+)(?:-(\d+))?$/.exec(part);
      if (!m) throw new Error(`Invalid range "${part}". Use formats like 1-3 or 5.`);
      let start = parseInt(m[1], 10);
      let end = m[2] ? parseInt(m[2], 10) : start;
      if (start < 1 || end > pageCount || start > end) {
        throw new Error(`Range "${part}" is out of bounds (document has ${pageCount} pages).`);
      }
      groups.push({ start, end });
    }
    if (groups.length === 0) throw new Error("Please specify at least one page range.");
    return groups;
  }

  async function pdfSplit(files, options, onProgress) {
    const { PDFDocument } = PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = src.getPageCount();

    let groups;
    if (options.mode === "every") {
      groups = Array.from({ length: pageCount }, (_, i) => ({ start: i + 1, end: i + 1 }));
    } else {
      groups = parseRanges(options.ranges || "", pageCount);
    }

    const outputs = [];
    for (let i = 0; i < groups.length; i++) {
      const { start, end } = groups[i];
      onProgress && onProgress({
        pct: Math.round((i / groups.length) * 90),
        message: `Building part ${i + 1}/${groups.length} (pages ${start}-${end})…`,
      });
      const outDoc = await PDFDocument.create();
      const indices = [];
      for (let p = start; p <= end; p++) indices.push(p - 1);
      const copied = await outDoc.copyPages(src, indices);
      copied.forEach((p) => outDoc.addPage(p));
      const outBytes = await outDoc.save();
      const label = start === end ? `page-${start}` : `pages-${start}-${end}`;
      outputs.push({
        name: `${window.ConvUtils.baseName(file.name)}_${label}.pdf`,
        data: outBytes,
        mime: "application/pdf",
      });
    }

    onProgress && onProgress({ pct: 100, message: "Done." });
    return outputs;
  }

  window.Converters = window.Converters || {};
  window.Converters.pdfSplit = pdfSplit;
})(window);

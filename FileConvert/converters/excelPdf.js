/**
 * excelPdf.js — PDF <-> Excel (.xlsx).
 *
 * pdfToExcel: pdf.js gives us text items with x/y positions per page. We
 * group items into rows by y-coordinate, then split each row into columns
 * wherever the horizontal gap between two items is unusually large. This is
 * a heuristic, not real table detection — it works reasonably well on
 * grid-like PDFs (invoices, simple reports) and poorly on free-flowing text
 * or complex multi-span tables, which is an inherent limit of inferring
 * table structure from a text stream alone.
 *
 * excelToPdf: SheetJS reads the workbook; each sheet's cells are drawn as a
 * simple ruled grid with pdf-lib, paginating rows to fit the page height.
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer, baseName, stripInvisibleChars, loadUnicodeFonts } = window.ConvUtils;

  // ---------------------------------------------------------------------
  // PDF -> Excel
  // ---------------------------------------------------------------------
  async function extractTableFromPage(page) {
    const content = await page.getTextContent();
    // Group by rounded y (line), keep each item's x for column splitting.
    const rows = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2);
      const rowKey = key !== undefined ? key : y;
      if (!rows.has(rowKey)) rows.set(rowKey, []);
      rows.get(rowKey).push({ x, text: item.str });
    }

    // Sort rows top-to-bottom (PDF y grows upward, so descending order).
    const sortedRowKeys = [...rows.keys()].sort((a, b) => b - a);
    const grid = [];
    for (const key of sortedRowKeys) {
      const items = rows.get(key).sort((a, b) => a.x - b.x);
      const cells = [];
      let curCell = "";
      let lastX = null;
      const GAP_THRESHOLD = 12; // pt — larger gaps are treated as column breaks
      for (const it of items) {
        if (lastX !== null && it.x - lastX > GAP_THRESHOLD) {
          cells.push(curCell.trim());
          curCell = it.text;
        } else {
          curCell += it.text;
        }
        lastX = it.x + (it.width || 0);
      }
      if (curCell) cells.push(curCell.trim());
      if (cells.some((c) => c !== "")) grid.push(cells);
    }
    return grid;
  }

  async function pdfToExcel(files, options, onProgress) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    const workbook = XLSX.utils.book_new();

    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress({
        pct: Math.round(((p - 1) / pdf.numPages) * 90),
        message: `Detecting table structure on page ${p}/${pdf.numPages}…`,
      });
      const page = await pdf.getPage(p);
      const grid = await extractTableFromPage(page);
      const sheet = XLSX.utils.aoa_to_sheet(grid.length ? grid : [[""]]);
      XLSX.utils.book_append_sheet(workbook, sheet, `Page ${p}`.slice(0, 31));
    }

    onProgress && onProgress({ pct: 95, message: "Writing .xlsx…" });
    const outArrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{
      name: `${baseName(file.name)}.xlsx`,
      data: outArrayBuffer,
      mime: window.ConvUtils.MIME.xlsx,
    }];
  }

  // ---------------------------------------------------------------------
  // Excel -> PDF
  // ---------------------------------------------------------------------
  async function excelToPdf(files, options, onProgress) {
    const { PDFDocument, rgb } = PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(bytes, { type: "array" });

    const pdfDoc = await PDFDocument.create();
    const { font, boldFont: headerFont } = await loadUnicodeFonts(pdfDoc);

    const pageW = 792, pageH = 612, margin = 36; // US Letter landscape — a bit more room for columns
    const rowHeight = 20;
    const fontSize = 9;

    for (let s = 0; s < workbook.SheetNames.length; s++) {
      const sheetName = workbook.SheetNames[s];
      onProgress && onProgress({
        pct: Math.round((s / workbook.SheetNames.length) * 90),
        message: `Rendering sheet "${sheetName}" (${s + 1}/${workbook.SheetNames.length})…`,
      });
      const sheet = workbook.Sheets[sheetName];
      const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      if (grid.length === 0) continue;

      const colCount = Math.max(...grid.map((r) => r.length));
      const colWidth = (pageW - margin * 2) / Math.max(colCount, 1);

      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;
      page.drawText(stripInvisibleChars(sheetName), { x: margin, y, size: 14, font: headerFont, color: rgb(0.1, 0.1, 0.12) });
      y -= 28;

      for (let r = 0; r < grid.length; r++) {
        if (y < margin + rowHeight) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        const row = grid[r];
        const isHeader = r === 0;
        for (let c = 0; c < colCount; c++) {
          const text = stripInvisibleChars((row[c] ?? "").toString());
          if (!text) continue;
          const x = margin + c * colWidth;
          const truncated = truncateToWidth(text, isHeader ? headerFont : font, fontSize, colWidth - 6);
          page.drawText(truncated, {
            x: x + 3,
            y: y - fontSize,
            size: fontSize,
            font: isHeader ? headerFont : font,
            color: rgb(0.15, 0.15, 0.17),
          });
        }
        // Row separator line
        page.drawLine({
          start: { x: margin, y: y - rowHeight + 4 },
          end: { x: pageW - margin, y: y - rowHeight + 4 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.82),
        });
        y -= rowHeight;
      }
    }

    onProgress && onProgress({ pct: 95, message: "Writing PDF…" });
    const outBytes = await pdfDoc.save();
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{ name: `${baseName(file.name)}.pdf`, data: outBytes, mime: "application/pdf" }];
  }

  function truncateToWidth(text, font, size, maxWidth) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + "…";
  }

  window.Converters = window.Converters || {};
  window.Converters.pdfToExcel = pdfToExcel;
  window.Converters.excelToPdf = excelToPdf;
})(window);

/**
 * pdfOps.js
 * Comprehensive PDF operations suite inspired by Stirling-PDF and iLovePDF:
 * - Rotate PDF Pages
 * - Organize / Delete / Reorder Pages
 * - Add Page Numbers
 * - Add Text Watermarks
 * - Client-Side PDF Compression
 * - Markdown / Plain Text to PDF
 * - CSV <-> XLSX Bidirectional Conversion
 * 100% offline, client-side via pdf-lib, pdf.js, and SheetJS.
 */

(function (global) {
  "use strict";

  const { PDFDocument, rgb, degrees, StandardFonts } = global.PDFLib || {};
  const ConvUtils = global.ConvUtils;

  /**
   * Rotate PDF Pages
   */
  async function rotatePdf(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(15, "Reading PDF…");
    const bytes = await ConvUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    const angle = parseInt(options.angle || 90, 10);

    if (onProgress) onProgress(40, `Rotating ${pages.length} pages by ${angle}°…`);
    pages.forEach((page) => {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    });

    if (onProgress) onProgress(80, "Saving rotated PDF…");
    const outBytes = await pdfDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Organize / Delete / Reorder Pages
   */
  async function organizePdf(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(15, "Reading PDF…");
    const bytes = await ConvUtils.readFileAsArrayBuffer(file);
    const srcDoc = await PDFDocument.load(bytes);
    const totalPages = srcDoc.getPageCount();

    // Parse page selection or deletion
    // e.g. "1-3, 5" or exclude
    const rangeStr = (options.pageRange || "").trim();
    let pageIndices = [];

    if (rangeStr) {
      pageIndices = ConvUtils.parsePageRanges(rangeStr, totalPages);
    } else {
      for (let i = 0; i < totalPages; i++) pageIndices.push(i);
    }

    if (options.deletePages && options.deletePages.length > 0) {
      const deleteSet = new Set(options.deletePages);
      pageIndices = pageIndices.filter((idx) => !deleteSet.has(idx));
    }

    if (pageIndices.length === 0) {
      throw new Error("No pages remaining after selection / deletion.");
    }

    if (onProgress) onProgress(45, `Copying ${pageIndices.length} pages…`);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    if (onProgress) onProgress(85, "Generating PDF…");
    const outBytes = await newDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Add Page Numbers to PDF
   */
  async function addPageNumbers(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(15, "Reading PDF…");
    const bytes = await ConvUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;
    const format = options.format || "page_of_total"; // "page_of_total" or "number_only"
    const position = options.position || "bottom_center"; // "bottom_center" or "bottom_right"
    const fontSize = options.fontSize || 10;

    if (onProgress) onProgress(40, "Stamping page numbers…");
    pages.forEach((page, idx) => {
      const pageNum = idx + 1;
      const text = format === "page_of_total" ? `Page ${pageNum} of ${total}` : `${pageNum}`;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const { width } = page.getSize();

      let x = (width - textWidth) / 2;
      if (position === "bottom_right") {
        x = width - textWidth - 36;
      } else if (position === "bottom_left") {
        x = 36;
      }
      const y = 24;

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
    });

    if (onProgress) onProgress(85, "Saving PDF with page numbers…");
    const outBytes = await pdfDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Watermark PDF
   */
  async function watermarkPdf(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(15, "Reading PDF…");
    const bytes = await ConvUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const text = (options.watermarkText || "CONFIDENTIAL").trim();
    const opacity = parseFloat(options.opacity || 0.25);
    const fontSize = parseInt(options.fontSize || 48, 10);

    if (onProgress) onProgress(40, `Stamping watermark "${text}" on ${pages.length} pages…`);
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - textHeight) / 2,
        size: fontSize,
        font,
        color: rgb(0.7, 0.2, 0.2),
        opacity: opacity,
        rotate: degrees(45)
      });
    });

    if (onProgress) onProgress(85, "Saving watermarked PDF…");
    const outBytes = await pdfDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Client-Side PDF Compression
   * Re-renders PDF pages to canvas and encodes as optimized JPEG images
   */
  async function compressPdf(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(10, "Loading PDF for compression…");
    const arrayBuffer = await ConvUtils.readFileAsArrayBuffer(file);
    const pdf = await global.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    const newDoc = await PDFDocument.create();
    const quality = parseFloat(options.quality || 0.65);
    const scale = parseFloat(options.scale || 1.2);

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) {
        const pct = Math.round(15 + (i / numPages) * 70);
        onProgress(pct, `Compressing page ${i}/${numPages}…`);
      }

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Encode as JPEG at desired compression quality
      const imgDataUrl = canvas.toDataURL("image/jpeg", quality);
      const imgBytes = await (await fetch(imgDataUrl)).arrayBuffer();
      const embeddedImg = await newDoc.embedJpg(imgBytes);

      const newPage = newDoc.addPage([viewport.width / scale, viewport.height / scale]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: viewport.width / scale,
        height: viewport.height / scale
      });
    }

    if (onProgress) onProgress(90, "Finalizing compressed PDF…");
    const outBytes = await newDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Markdown or Plain Text to PDF
   */
  async function mdToPdf(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(15, "Reading document…");
    const rawText = await ConvUtils.readFileAsText ? await ConvUtils.readFileAsText(file) : await file.text();

    if (onProgress) onProgress(40, "Typesetting document…");
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const lines = rawText.split(/\r?\n/);
    const fontSize = 11;
    const lineHeight = 16;
    const margin = 48;
    const pageWidth = 595;
    const pageHeight = 842; // A4 standard

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    for (const rawLine of lines) {
      if (currentY < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }

      let line = rawLine;
      let activeFont = font;
      let currentSize = fontSize;

      if (line.startsWith("# ")) {
        line = line.substring(2);
        activeFont = boldFont;
        currentSize = 20;
      } else if (line.startsWith("## ")) {
        line = line.substring(3);
        activeFont = boldFont;
        currentSize = 16;
      } else if (line.startsWith("### ")) {
        line = line.substring(4);
        activeFont = boldFont;
        currentSize = 13;
      }

      // Word wrapping
      const words = line.split(" ");
      let curLineText = "";

      for (const word of words) {
        const testLine = curLineText ? `${curLineText} ${word}` : word;
        const testWidth = activeFont.widthOfTextAtSize(testLine, currentSize);

        if (testWidth > pageWidth - margin * 2 && curLineText) {
          currentPage.drawText(curLineText, {
            x: margin,
            y: currentY,
            size: currentSize,
            font: activeFont,
            color: rgb(0.1, 0.1, 0.1)
          });
          currentY -= currentSize + 4;
          if (currentY < margin + lineHeight) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          curLineText = word;
        } else {
          curLineText = testLine;
        }
      }

      if (curLineText) {
        currentPage.drawText(curLineText, {
          x: margin,
          y: currentY,
          size: currentSize,
          font: activeFont,
          color: rgb(0.1, 0.1, 0.1)
        });
        currentY -= currentSize + 4;
      } else {
        currentY -= lineHeight / 2; // Blank line spacing
      }
    }

    if (onProgress) onProgress(85, "Saving PDF…");
    const outBytes = await pdfDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Bidirectional CSV <-> XLSX Conversion
   */
  async function csvExcel(files, options = {}, onProgress) {
    const file = files[0];
    const isCsv = file.name.toLowerCase().endsWith(".csv");

    if (isCsv) {
      if (onProgress) onProgress(20, "Reading CSV data…");
      const text = await file.text();
      const workbook = global.XLSX.read(text, { type: "string" });
      if (onProgress) onProgress(60, "Encoding as Excel XLSX…");
      const outArray = global.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      return new Blob([outArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
    } else {
      if (onProgress) onProgress(20, "Reading Excel spreadsheet…");
      const bytes = await ConvUtils.readFileAsArrayBuffer(file);
      const workbook = global.XLSX.read(bytes, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      if (onProgress) onProgress(60, "Generating CSV…");
      const csvData = global.XLSX.utils.sheet_to_csv(worksheet);
      return new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    }
  }

  // Register on Converters namespace
  global.Converters = global.Converters || {};
  global.Converters.rotatePdf = rotatePdf;
  global.Converters.organizePdf = organizePdf;
  global.Converters.addPageNumbers = addPageNumbers;
  global.Converters.watermarkPdf = watermarkPdf;
  global.Converters.compressPdf = compressPdf;
  global.Converters.mdToPdf = mdToPdf;
  global.Converters.csvExcel = csvExcel;

})(typeof window !== "undefined" ? window : globalThis);

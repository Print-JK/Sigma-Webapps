/**
 * wordPdf.js — Word (.docx) <-> PDF.
 *
 * wordToPdf: mammoth.js unpacks the docx into semantic HTML (paragraphs,
 * headings, lists, bold/italic runs); we then walk that HTML and lay the
 * text out into a PDF with pdf-lib, wrapping lines to the page width and
 * paginating automatically. This preserves reading order and basic
 * emphasis but NOT the original page layout, fonts, tables, or images —
 * a well-known limit of reconstructing a flowed document client-side.
 *
 * pdfToWord: pdf.js extracts the text stream per page; we group items into
 * lines/paragraphs by their vertical position and write a minimal, valid
 * .docx (OOXML) package by hand via JSZip. This recovers text content but
 * not the source formatting.
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer, escapeXml, stripInvisibleChars, loadUnicodeFonts } = window.ConvUtils;

  // ---------------------------------------------------------------------
  // Word (.docx) -> PDF
  // ---------------------------------------------------------------------
  async function wordToPdf(files, options, onProgress) {
    const { PDFDocument, rgb } = PDFLib;
    const file = files[0];

    onProgress && onProgress({ pct: 10, message: "Unpacking .docx with mammoth…" });
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

    onProgress && onProgress({ pct: 30, message: "Parsing document structure…" });
    const container = document.createElement("div");
    container.innerHTML = html;

    // Flatten to a simple block list: { text, bold, heading }
    const blocks = [];
    container.querySelectorAll("p, h1, h2, h3, h4, li").forEach((el) => {
      const text = stripInvisibleChars(el.textContent).trim();
      if (!text) return;
      blocks.push({
        text,
        heading: /^H[1-4]$/.test(el.tagName),
        level: /^H([1-4])$/.test(el.tagName) ? parseInt(el.tagName[1], 10) : 0,
        bullet: el.tagName === "LI",
      });
    });
    if (blocks.length === 0) blocks.push({ text: "(empty document)", heading: false, level: 0 });

    onProgress && onProgress({ pct: 45, message: "Laying out pages…" });
    const pdfDoc = await PDFDocument.create();
    const { font, boldFont } = await loadUnicodeFonts(pdfDoc);

    const pageW = 612, pageH = 792, margin = 56;
    const maxWidth = pageW - margin * 2;
    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - margin;

    function newPage() {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - margin;
    }

    function wrapLine(text, useFont, size) {
      const words = text.split(/\s+/);
      const lines = [];
      let cur = "";
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (useFont.widthOfTextAtSize(trial, size) > maxWidth && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = trial;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    }

    for (const block of blocks) {
      const size = block.heading ? Math.max(18 - block.level * 2, 12) : 11;
      const useFont = block.heading ? boldFont : font;
      const prefix = block.bullet ? "•  " : "";
      const lines = wrapLine(prefix + block.text, useFont, size);
      const lineHeight = size * 1.4;

      for (const line of lines) {
        if (y - lineHeight < margin) newPage();
        page.drawText(line, { x: margin, y: y - size, size, font: useFont, color: rgb(0.08, 0.08, 0.1) });
        y -= lineHeight;
      }
      y -= size * 0.5; // paragraph spacing
    }

    onProgress && onProgress({ pct: 90, message: "Writing PDF…" });
    const outBytes = await pdfDoc.save();
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{ name: `${window.ConvUtils.baseName(file.name)}.pdf`, data: outBytes, mime: "application/pdf" }];
  }

  // ---------------------------------------------------------------------
  // PDF -> Word (.docx)
  // ---------------------------------------------------------------------
  async function extractParagraphsFromPdf(file, onProgress) {
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const paragraphs = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress({
        pct: Math.round(((p - 1) / pdf.numPages) * 70),
        message: `Extracting text from page ${p}/${pdf.numPages}…`,
      });
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // Group text items into lines using their y position, then into
      // paragraphs using vertical gaps — a simple but effective heuristic
      // for reconstructing reading order without real layout analysis.
      const lines = [];
      let curLine = null;
      let lastY = null;
      for (const item of content.items) {
        const y = Math.round(item.transform[5]);
        if (curLine === null || lastY === null || Math.abs(y - lastY) > 2) {
          curLine = { y, text: item.str };
          lines.push(curLine);
        } else {
          curLine.text += item.str;
        }
        lastY = y;
      }

      let lastLineY = null;
      for (const line of lines) {
        const text = stripInvisibleChars(line.text).trim();
        if (!text) continue;
        const gap = lastLineY === null ? 0 : Math.abs(line.y - lastLineY);
        if (paragraphs.length === 0 || gap > 18) {
          paragraphs.push(text);
        } else {
          paragraphs[paragraphs.length - 1] += " " + text;
        }
        lastLineY = line.y;
      }
      paragraphs.push(""); // page break marker (blank paragraph)
    }
    return paragraphs;
  }

  function buildMinimalDocx(paragraphs) {
    const bodyXml = paragraphs
      .map((p) => {
        if (p === "") return `<w:p/>`;
        return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`;
      })
      .join("");

    const documentXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body>${bodyXml}<w:sectPr/></w:body></w:document>`;

    const contentTypesXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`;

    const relsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`;

    const zip = new JSZip();
    zip.file("[Content_Types].xml", contentTypesXml);
    zip.folder("_rels").file(".rels", relsXml);
    zip.folder("word").file("document.xml", documentXml);
    return zip.generateAsync({ type: "blob" });
  }

  async function pdfToWord(files, options, onProgress) {
    const file = files[0];
    const paragraphs = await extractParagraphsFromPdf(file, onProgress);
    onProgress && onProgress({ pct: 85, message: "Assembling .docx package…" });
    const blob = await buildMinimalDocx(paragraphs);
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{
      name: `${window.ConvUtils.baseName(file.name)}.docx`,
      data: blob,
      mime: window.ConvUtils.MIME.docx,
    }];
  }

  window.Converters = window.Converters || {};
  window.Converters.wordToPdf = wordToPdf;
  window.Converters.pdfToWord = pdfToWord;
})(window);

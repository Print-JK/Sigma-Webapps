/**
 * pptPdf.js — PDF <-> PowerPoint (.pptx).
 *
 * pdfToPpt: each PDF page is rasterized (pdf.js) and dropped in as a
 * full-bleed image on its own slide (pptxgenjs). This is the one direction
 * where client-side fidelity is genuinely high, since a picture of the page
 * is visually identical to the source — the tradeoff is that the result is
 * an image, not editable PowerPoint text/shapes.
 *
 * pptToPdf: the .pptx is just a zip of OOXML — we open it directly with
 * JSZip, pull the text runs out of each slideN.xml and any raster images
 * referenced in that slide's relationships, then lay both onto a PDF page
 * with pdf-lib. This recovers content but not the original slide design,
 * vector shapes, fonts, or animations — a fundamental limit of rebuilding
 * a slide layout without a real presentation-rendering engine.
 */
(function (global) {
  "use strict";
  const { readFileAsArrayBuffer, renderPdfPageToCanvas, baseName, stripInvisibleChars, loadUnicodeFonts } = window.ConvUtils;

  // ---------------------------------------------------------------------
  // PDF -> PPTX
  // ---------------------------------------------------------------------
  async function pdfToPpt(files, options, onProgress) {
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in — safest default for full-bleed images

    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress({
        pct: Math.round(((p - 1) / pdf.numPages) * 90),
        message: `Rendering page ${p}/${pdf.numPages} to slide…`,
      });
      const canvas = await renderPdfPageToCanvas(pdf, p, 2);
      const dataUrl = canvas.toDataURL("image/png");
      const slide = pptx.addSlide();
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
    }

    onProgress && onProgress({ pct: 95, message: "Packaging .pptx…" });
    const blob = await pptx.write({ outputType: "blob" });
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{ name: `${baseName(file.name)}.pptx`, data: blob, mime: window.ConvUtils.MIME.pptx }];
  }

  // ---------------------------------------------------------------------
  // PPTX -> PDF
  // ---------------------------------------------------------------------
  function decodeXmlEntities(str) {
    return str
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function extractSlideTexts(xml) {
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
    return matches.map((m) => stripInvisibleChars(decodeXmlEntities(m[1]))).filter((t) => t.trim());
  }

  async function extractSlideImages(zip, slideRelsPath, slideNum) {
    const relsFile = zip.file(slideRelsPath);
    if (!relsFile) return [];
    const relsXml = await relsFile.async("string");
    const targets = [...relsXml.matchAll(/Target="([^"]*image[^"]*)"/gi)].map((m) => m[1]);

    const images = [];
    for (const target of targets) {
      // Targets are relative to ppt/slides/, e.g. "../media/image1.png"
      const normalized = new URL(target, "zip://ppt/slides/").pathname.replace(/^\/+/, "");
      const mediaFile = zip.file(normalized);
      if (!mediaFile) continue;
      const extMatch = /\.([a-z0-9]+)$/i.exec(normalized);
      const extension = extMatch ? extMatch[1].toLowerCase() : "";
      if (extension !== "png" && extension !== "jpg" && extension !== "jpeg") {
        continue; // pdf-lib can only embed PNG/JPEG — vector/EMF assets are skipped
      }
      const data = await mediaFile.async("uint8array");
      images.push({ data, extension });
    }
    return images;
  }

  async function pptToPdf(files, options, onProgress) {
    const { PDFDocument, rgb } = PDFLib;
    const file = files[0];
    const bytes = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(bytes);

    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => {
        const na = parseInt(/slide(\d+)\.xml$/.exec(a)[1], 10);
        const nb = parseInt(/slide(\d+)\.xml$/.exec(b)[1], 10);
        return na - nb;
      });

    if (slidePaths.length === 0) {
      throw new Error("No slides found — is this a valid .pptx file?");
    }

    const pdfDoc = await PDFDocument.create();
    const { font, boldFont: titleFont } = await loadUnicodeFonts(pdfDoc);
    const pageW = 720, pageH = 540, margin = 40; // 10in x 7.5in @72dpi, matches common slide size

    for (let i = 0; i < slidePaths.length; i++) {
      const slideNum = i + 1;
      onProgress && onProgress({
        pct: Math.round((i / slidePaths.length) * 90),
        message: `Rebuilding slide ${slideNum}/${slidePaths.length}…`,
      });

      const xml = await zip.file(slidePaths[i]).async("string");
      const texts = extractSlideTexts(xml);
      const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      const images = await extractSlideImages(zip, relsPath, slideNum);

      const page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      // Title = first text run (bold, larger); remaining runs as body lines.
      if (texts.length > 0) {
        page.drawText(texts[0], {
          x: margin, y: y - 20, size: 20, font: titleFont, color: rgb(0.1, 0.1, 0.12),
        });
        y -= 40;
      }
      for (let t = 1; t < texts.length; t++) {
        if (y < margin + 60) break; // reserve room for images below
        const line = texts[t];
        const wrapped = wrapToWidth(line, font, 13, pageW - margin * 2);
        for (const w of wrapped) {
          if (y < margin + 60) break;
          page.drawText(w, { x: margin, y: y - 13, size: 13, font, color: rgb(0.2, 0.2, 0.22) });
          y -= 18;
        }
      }

      // Lay out any extracted images in a row beneath the text, scaled down.
      if (images.length > 0) {
        const rowY = margin;
        const availW = pageW - margin * 2;
        const slotW = availW / images.length;
        const maxH = Math.max(y - margin - 10, 60);
        for (let k = 0; k < images.length; k++) {
          try {
            const embedded = images[k].extension === "png"
              ? await pdfDoc.embedPng(images[k].data)
              : await pdfDoc.embedJpg(images[k].data);
            const scale = Math.min((slotW - 10) / embedded.width, maxH / embedded.height, 1);
            const w = embedded.width * scale;
            const h = embedded.height * scale;
            page.drawImage(embedded, {
              x: margin + k * slotW + (slotW - w) / 2,
              y: rowY,
              width: w,
              height: h,
            });
          } catch (e) {
            // Skip images pdf-lib can't decode rather than failing the whole slide.
          }
        }
      }
    }

    onProgress && onProgress({ pct: 95, message: "Writing PDF…" });
    const outBytes = await pdfDoc.save();
    onProgress && onProgress({ pct: 100, message: "Done." });
    return [{ name: `${baseName(file.name)}.pdf`, data: outBytes, mime: "application/pdf" }];
  }

  function wrapToWidth(text, font, size, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  window.Converters = window.Converters || {};
  window.Converters.pdfToPpt = pdfToPpt;
  window.Converters.pptToPdf = pptToPdf;
})(window);

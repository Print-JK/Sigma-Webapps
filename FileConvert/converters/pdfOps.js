/**
 * pdfOps.js
 * Comprehensive PDF operations suite (iLovePDF-Clone + Sigma FileConvert):
 * - Rotate PDF Pages (90°, 180°, 270°, all or specific pages)
 * - Protect PDF (ISO 32000-1 Standard Security Handler V=2, R=3, 128-bit encryption)
 * - Unlock PDF (Lossless Standard Security Handler decryption + pdf.js fallback)
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

  const { PDFDocument, rgb, degrees, StandardFonts, PDFRawStream, PDFDict, PDFArray, PDFString, PDFHexString, PDFName } = global.PDFLib || {};
  const ConvUtils = global.ConvUtils;

  // ---------------------------------------------------------------------------
  // Pure-JS RFC 1321 MD5 + RC4 for PDF Standard Security Handler (ISO 32000-1 7.6)
  // ---------------------------------------------------------------------------
  const PDF_PAD = new Uint8Array([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
  ]);

  const MD5_K = new Int32Array([
    -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426, -1473231341, -45705983,
    1770035416, -1958414417, -42063, -1990404162, 1804603682, -40341101, -1502002290, 1236535329,
    -165796510, -1069501632, 643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
    568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784, 1735328473, -1926607734,
    -378558, -2022574463, 1839030562, -35309556, -1530992060, 1272893353, -155497632, -1094730640,
    681279174, -358537222, -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
    -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606, -1051523, -2054922799,
    1873313359, -30611744, -1560198380, 1309151649, -145523070, -1120210379, 718787259, -343485551
  ]);
  const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  function md5(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bitLen = bytes.length * 8;
    const padLen = ((bytes.length + 8) >>> 6 << 4) + 16;
    const words = new Int32Array(padLen);
    for (let i = 0; i < bytes.length; i++) {
      words[i >> 2] |= bytes[i] << ((i & 3) * 8);
    }
    words[bytes.length >> 2] |= 0x80 << ((bytes.length & 3) * 8);
    words[padLen - 2] = bitLen & 0xFFFFFFFF;
    words[padLen - 1] = Math.floor(bitLen / 0x100000000);

    let a0 = 0x67452301, b0 = -271733879, c0 = -1732584194, d0 = 0x10325476;
    for (let i = 0; i < padLen; i += 16) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let j = 0; j < 64; j++) {
        let F, g;
        if (j < 16) { F = (B & C) | ((~B) & D); g = j; }
        else if (j < 32) { F = (D & B) | ((~D) & C); g = (5 * j + 1) % 16; }
        else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
        else { F = C ^ (B | (~D)); g = (7 * j) % 16; }
        const temp = D;
        D = C;
        C = B;
        const sum = (A + F + MD5_K[j] + words[i + g]) | 0;
        const s = MD5_S[j];
        B = (B + ((sum << s) | (sum >>> (32 - s)))) | 0;
        A = temp;
      }
      a0 = (a0 + A) | 0;
      b0 = (b0 + B) | 0;
      c0 = (c0 + C) | 0;
      d0 = (d0 + D) | 0;
    }
    const out = new Uint8Array(16);
    const dv = new DataView(out.buffer);
    dv.setInt32(0, a0, true);
    dv.setInt32(4, b0, true);
    dv.setInt32(8, c0, true);
    dv.setInt32(12, d0, true);
    return out;
  }

  function concatBytes(...arrs) {
    const total = arrs.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
  }

  function padPassword(pw) {
    const str = String(pw || "");
    const b = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 0xFF;
    const out = new Uint8Array(32);
    const n = Math.min(b.length, 32);
    out.set(b.subarray(0, n), 0);
    if (n < 32) out.set(PDF_PAD.subarray(0, 32 - n), n);
    return out;
  }

  function rc4(key, data) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) & 0xFF;
      const t = S[i]; S[i] = S[j]; S[j] = t;
    }
    const out = new Uint8Array(data.length);
    let x = 0, y = 0;
    for (let k = 0; k < data.length; k++) {
      x = (x + 1) & 0xFF;
      y = (y + S[x]) & 0xFF;
      const t = S[x]; S[x] = S[y]; S[y] = t;
      out[k] = data[k] ^ S[(S[x] + S[y]) & 0xFF];
    }
    return out;
  }

  function toHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function fromHex(hex) {
    const clean = String(hex || "").replace(/[^0-9a-fA-F]/g, "");
    const out = new Uint8Array(clean.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  function computeO(userPw, ownerPw, rev = 3, keyLenBytes = 16) {
    let digest = md5(padPassword(ownerPw || userPw));
    if (rev >= 3) {
      for (let i = 0; i < 50; i++) digest = md5(digest);
    }
    const baseKey = digest.subarray(0, keyLenBytes);
    let out = padPassword(userPw);
    if (rev === 2) {
      return rc4(baseKey, out);
    }
    for (let i = 0; i <= 19; i++) {
      const k = new Uint8Array(keyLenBytes);
      for (let j = 0; j < keyLenBytes; j++) k[j] = baseKey[j] ^ i;
      out = rc4(k, out);
    }
    return out;
  }

  function computeFileKey(userPw, O, P, fileId, keyLenBytes = 16, rev = 3) {
    const pBuf = new Uint8Array(4);
    new DataView(pBuf.buffer).setInt32(0, P, true);
    let digest = md5(concatBytes(padPassword(userPw), O, pBuf, fileId));
    if (rev >= 3) {
      for (let i = 0; i < 50; i++) digest = md5(digest.subarray(0, keyLenBytes));
    }
    return digest.subarray(0, keyLenBytes);
  }

  function computeU(fileKey, fileId, rev = 3) {
    if (rev === 2) {
      return rc4(fileKey, PDF_PAD);
    }
    let out = md5(concatBytes(PDF_PAD, fileId));
    for (let i = 0; i <= 19; i++) {
      const k = new Uint8Array(fileKey.length);
      for (let j = 0; j < fileKey.length; j++) k[j] = fileKey[j] ^ i;
      out = rc4(k, out);
    }
    return concatBytes(out, new Uint8Array(16));
  }

  function computeObjectKey(fileKey, objNum, genNum) {
    const extra = new Uint8Array([
      objNum & 0xFF, (objNum >> 8) & 0xFF, (objNum >> 16) & 0xFF,
      genNum & 0xFF, (genNum >> 8) & 0xFF
    ]);
    const digest = md5(concatBytes(fileKey, extra));
    return digest.subarray(0, Math.min(fileKey.length + 5, 16));
  }

  function transformPdfObject(obj, objKey) {
    if (!obj) return;
    if (obj instanceof PDFRawStream) {
      obj.contents = rc4(objKey, obj.contents);
      transformPdfObject(obj.dict, objKey);
    } else if (obj instanceof PDFDict) {
      for (const [k, v] of obj.entries()) {
        if (v instanceof PDFString) {
          obj.set(k, PDFHexString.of(toHex(rc4(objKey, v.asBytes()))));
        } else if (v instanceof PDFHexString) {
          obj.set(k, PDFHexString.of(toHex(rc4(objKey, fromHex(v.asString())))));
        } else {
          transformPdfObject(v, objKey);
        }
      }
    } else if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) {
        const v = obj.get(i);
        if (v instanceof PDFString) {
          obj.set(i, PDFHexString.of(toHex(rc4(objKey, v.asBytes()))));
        } else if (v instanceof PDFHexString) {
          obj.set(i, PDFHexString.of(toHex(rc4(objKey, fromHex(v.asString())))));
        } else {
          transformPdfObject(v, objKey);
        }
      }
    }
  }

  /**
   * Protect PDF with 128-bit Standard Security Handler (ISO 32000-1 V=2, R=3)
   */
  async function protectPdf(files, options = {}, onProgress) {
    const file = files[0];
    const password = String(options.password || "");
    if (!password) throw new Error("Please enter a password to protect the PDF.");

    if (onProgress) onProgress(15, "Reading PDF document…");
    const rawBytes = await ConvUtils.readFileAsArrayBuffer(file);
    const srcDoc = await PDFDocument.load(rawBytes);

    // Normalize indirect objects without object streams
    const normalizedBytes = await srcDoc.save({ useObjectStreams: false });
    const encDoc = await PDFDocument.load(normalizedBytes);

    if (onProgress) onProgress(45, "Encrypting PDF objects (128-bit Standard Security)…");
    const fileId = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(fileId);
    } else {
      for (let i = 0; i < 16; i++) fileId[i] = Math.floor(Math.random() * 256);
    }

    const P = -4;
    const O = computeO(password, password, 3, 16);
    const fileKey = computeFileKey(password, O, P, fileId, 16, 3);
    const U = computeU(fileKey, fileId, 3);

    for (const [ref, obj] of encDoc.context.enumerateIndirectObjects()) {
      const objKey = computeObjectKey(fileKey, ref.objectNumber, ref.generationNumber);
      transformPdfObject(obj, objKey);
    }

    const encryptRef = encDoc.context.register(
      encDoc.context.obj({
        Filter: "Standard",
        V: 2,
        R: 3,
        Length: 128,
        P,
        O: PDFHexString.of(toHex(O)),
        U: PDFHexString.of(toHex(U)),
      })
    );
    encDoc.context.trailerInfo.Encrypt = encryptRef;
    encDoc.context.trailerInfo.ID = encDoc.context.obj([
      PDFHexString.of(toHex(fileId)),
      PDFHexString.of(toHex(fileId)),
    ]);

    if (onProgress) onProgress(85, "Writing password-protected PDF…");
    const outBytes = await encDoc.save({ useObjectStreams: false });
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Unlock Password-Protected PDF
   */
  async function unlockPdf(files, options = {}, onProgress) {
    const file = files[0];
    const password = String(options.password || "");

    if (onProgress) onProgress(15, "Reading protected PDF…");
    const rawBytes = await ConvUtils.readFileAsArrayBuffer(file);

    // First attempt lossless Standard Security Handler decryption via pdf-lib
    try {
      const unlockDoc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
      const encRef = unlockDoc.context.trailerInfo.Encrypt;
      if (!encRef) {
        // Already unlocked
        const outBytes = await unlockDoc.save();
        return new Blob([outBytes], { type: "application/pdf" });
      }
      const encDict = unlockDoc.context.lookup(encRef);
      const vObj = encDict && encDict.get(PDFName.of("V"));
      const rObj = encDict && encDict.get(PDFName.of("R"));
      const lenObj = encDict && encDict.get(PDFName.of("Length"));
      const pObj = encDict && encDict.get(PDFName.of("P"));
      const oObj = encDict && encDict.get(PDFName.of("O"));
      const uObj = encDict && encDict.get(PDFName.of("U"));
      const idArr = unlockDoc.context.lookup(unlockDoc.context.trailerInfo.ID);

      const V = vObj ? vObj.asNumber() : 2;
      const R = rObj ? rObj.asNumber() : 3;
      const keyLenBytes = V === 1 ? 5 : (lenObj ? Math.floor(lenObj.asNumber() / 8) : 16);

      if ((V === 1 || V === 2) && (R === 2 || R === 3) && oObj && uObj && pObj && idArr) {
        const extractBytes = (pdfVal) => {
          if (pdfVal instanceof PDFHexString) return fromHex(pdfVal.asString());
          if (pdfVal instanceof PDFString) return pdfVal.asBytes();
          return new Uint8Array(0);
        };
        const id0 = extractBytes(idArr.get(0));
        const oBytes = extractBytes(oObj);
        const uBytes = extractBytes(uObj);
        const pVal = pObj.asNumber();

        const testKey = computeFileKey(password, oBytes, pVal, id0, keyLenBytes, R);
        const testU = computeU(testKey, id0, R);
        const cmpLen = R === 2 ? 32 : 16;
        const matches = toHex(testU.subarray(0, cmpLen)) === toHex(uBytes.subarray(0, cmpLen));
        if (!matches) {
          throw new Error("WRONG_PASSWORD");
        }

        if (onProgress) onProgress(50, "Decrypting PDF objects losslessly…");
        for (const [ref, obj] of unlockDoc.context.enumerateIndirectObjects()) {
          if (ref === encRef) continue;
          const objKey = computeObjectKey(testKey, ref.objectNumber, ref.generationNumber);
          transformPdfObject(obj, objKey);
        }
        delete unlockDoc.context.trailerInfo.Encrypt;
        unlockDoc.context.delete(encRef);

        if (onProgress) onProgress(85, "Saving unlocked PDF…");
        const unlockedBytes = await unlockDoc.save({ useObjectStreams: false });
        return new Blob([unlockedBytes], { type: "application/pdf" });
      }
    } catch (err) {
      if (err && err.message === "WRONG_PASSWORD") {
        throw new Error("Wrong password. Please enter the correct PDF password.");
      }
    }

    // Fallback for AES-128 / AES-256 (V=4 / V=5) PDFs via pdf.js
    if (onProgress) onProgress(30, "Decrypting via PDF engine…");
    let pdf;
    try {
      pdf = await global.pdfjsLib.getDocument({ data: rawBytes, password }).promise;
    } catch (err) {
      if (err && (err.name === "PasswordException" || /password/i.test(String(err.message || err)))) {
        throw new Error("Wrong password. Please enter the correct PDF password.");
      }
      throw err;
    }

    const numPages = pdf.numPages;
    const outDoc = await PDFDocument.create();
    const scale = 2.0;
    for (let i = 1; i <= numPages; i++) {
      if (onProgress) {
        onProgress(Math.round(35 + (i / numPages) * 55), `Unlocking page ${i}/${numPages}…`);
      }
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const imgBytes = await (await fetch(imgDataUrl)).arrayBuffer();
      const embeddedImg = await outDoc.embedJpg(imgBytes);
      const newPage = outDoc.addPage([viewport.width / scale, viewport.height / scale]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: viewport.width / scale,
        height: viewport.height / scale,
      });
    }
    const outBytes = await outDoc.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  /**
   * Rotate PDF Pages
   */
  async function rotatePdf(files, options = {}, onProgress) {
    const file = files[0];
    if (onProgress) onProgress(15, "Reading PDF…");
    const bytes = await ConvUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const total = pages.length;
    const angle = parseInt(options.degrees || options.angle || 90, 10);
    const pagesParam = String(options.pages || "all").trim();

    let targetIndices = [];
    if (!pagesParam || pagesParam.toLowerCase() === "all") {
      targetIndices = pages.map((_, idx) => idx);
    } else {
      targetIndices = ConvUtils.parsePageRanges(pagesParam, total);
    }

    if (onProgress) onProgress(40, `Rotating ${targetIndices.length} page(s) by ${angle}°…`);
    targetIndices.forEach((idx) => {
      if (idx >= 0 && idx < total) {
        const page = pages[idx];
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      }
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
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

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
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;
    const format = options.format || "page_of_total";
    const position = options.position || "bottom_center";
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
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const text = (options.text || options.watermarkText || "CONFIDENTIAL").trim();
    const opacity = parseFloat(options.opacity || 0.3);
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
        color: rgb(0.65, 0.2, 0.25),
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
    const rawText = ConvUtils.readFileAsText ? await ConvUtils.readFileAsText(file) : await file.text();

    if (onProgress) onProgress(40, "Typesetting document…");
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const lines = rawText.split(/\r?\n/);
    const fontSize = 11;
    const lineHeight = 16;
    const margin = 48;
    const pageWidth = 595;
    const pageHeight = 842;

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
        currentY -= lineHeight / 2;
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

  global.Converters = global.Converters || {};
  global.Converters.rotatePdf = rotatePdf;
  global.Converters.protectPdf = protectPdf;
  global.Converters.unlockPdf = unlockPdf;
  global.Converters.organizePdf = organizePdf;
  global.Converters.addPageNumbers = addPageNumbers;
  global.Converters.watermarkPdf = watermarkPdf;
  global.Converters.compressPdf = compressPdf;
  global.Converters.mdToPdf = mdToPdf;
  global.Converters.csvExcel = csvExcel;

})(typeof window !== "undefined" ? window : globalThis);

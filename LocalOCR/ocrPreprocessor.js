/**
 * ocrPreprocessor.js
 * High-performance, client-side canvas image preprocessing engine for OCR.
 * Improves OCR accuracy on noisy, rotated, low-contrast, and dark-mode images.
 * 100% offline, zero server required.
 */

(function (global) {
  "use strict";

  /**
   * Applies user-configured preprocessing pipeline to an HTMLImageElement or Canvas.
   * Options:
   *  - grayscale: boolean
   *  - invert: boolean (for light-on-dark text / screenshots)
   *  - contrast: number (-100 to 100, default 30)
   *  - brightness: number (-100 to 100, default 0)
   *  - binarize: boolean (Otsu adaptive thresholding)
   *  - denoise: boolean (removes single-pixel salt-and-pepper noise)
   *  - rotation: number (degrees: -180 to 180, default 0)
   *  - scale: number (scale factor for low-res screenshots, default 1.5 or 2.0)
   */
  function preprocessImage(sourceElement, options = {}) {
    const {
      grayscale = true,
      invert = false,
      contrast = 25,
      brightness = 0,
      binarize = true,
      denoise = true,
      rotation = 0,
      scale = 1.0
    } = options;

    const srcWidth = sourceElement.naturalWidth || sourceElement.width;
    const srcHeight = sourceElement.naturalHeight || sourceElement.height;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Handle rotation & scaling
    const rad = (rotation * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));

    const scaledW = Math.round(srcWidth * scale);
    const scaledH = Math.round(srcHeight * scale);

    const rotW = Math.round(scaledW * absCos + scaledH * absSin);
    const rotH = Math.round(scaledW * absSin + scaledH * absCos);

    canvas.width = rotW;
    canvas.height = rotH;

    ctx.save();
    ctx.translate(rotW / 2, rotH / 2);
    ctx.rotate(rad);
    ctx.drawImage(sourceElement, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
    ctx.restore();

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    // 1. Grayscale & Brightness/Contrast
    // Contrast factor formula
    const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (grayscale) {
        // Luminance weights (ITU-R BT.601)
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray;
        g = gray;
        b = gray;
      }

      // Brightness & Contrast adjustment
      if (brightness !== 0) {
        r += brightness;
        g += brightness;
        b += brightness;
      }

      if (contrast !== 0) {
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;
      }

      // Invert if dark mode screenshot (light text on dark background)
      if (invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }

    // 2. Otsu Adaptive Binarization (Optimal Global Thresholding)
    if (binarize) {
      const threshold = calculateOtsuThreshold(data);
      for (let i = 0; i < len; i += 4) {
        const val = data[i] > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
    }

    // 3. Noise Reduction (Simple 3x3 Median / Majority Filter)
    if (denoise && binarize) {
      applySpeckleRemoval(data, canvas.width, canvas.height);
    }

    ctx.putImageData(imgData, 0, 0);

    return {
      canvas,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height
    };
  }

  /**
   * Otsu's Thresholding algorithm
   * Automatically computes the optimal threshold separating foreground text from background.
   */
  function calculateOtsuThreshold(data) {
    const histogram = new Uint32Array(256);
    const totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }

    let sum = 0;
    for (let t = 0; t < 256; t++) {
      sum += t * histogram[t];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let optimalThreshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      // Between-class variance
      const varBetween = wB * wF * (mB - mF) * (mB - mF);

      if (varBetween > varMax) {
        varMax = varBetween;
        optimalThreshold = t;
      }
    }

    return optimalThreshold;
  }

  /**
   * 3x3 Speckle / Despeckle Filter for Binarized Images
   */
  function applySpeckleRemoval(data, width, height) {
    const copy = new Uint8Array(data.length);
    copy.set(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const current = copy[idx];

        // Count dark neighbors
        let darkNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (copy[nIdx] < 128) darkNeighbors++;
          }
        }

        // Isolated dark pixel in white background -> remove
        if (current < 128 && darkNeighbors <= 1) {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        }
        // Isolated white hole inside dark text -> fill
        else if (current > 128 && darkNeighbors >= 7) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        }
      }
    }
  }

  global.OCRPreprocessor = {
    preprocessImage,
    calculateOtsuThreshold
  };

})(typeof window !== "undefined" ? window : globalThis);

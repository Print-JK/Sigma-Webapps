/**
 * DeckCraft — Slide Presentation Engine
 * Pure client-side slide editing, multi-slide management, PPTX export, and fullscreen presenter mode.
 */

(function () {
  "use strict";

  // State
  let presentation = {
    title: "Untitled Presentation",
    slides: [
      {
        id: "slide_1",
        bg: "#1a1817",
        elements: [
          {
            id: "el_1",
            type: "text",
            x: 80,
            y: 160,
            width: 800,
            height: 100,
            text: "Welcome to DeckCraft",
            fontSize: "48px",
            color: "#ffffff",
            fontWeight: "bold"
          },
          {
            id: "el_2",
            type: "text",
            x: 80,
            y: 280,
            width: 800,
            height: 60,
            text: "Create, present, and export beautiful slide decks locally.",
            fontSize: "24px",
            color: "#d4af37",
            fontWeight: "normal"
          }
        ]
      }
    ]
  };

  let currentSlideIndex = 0;
  let selectedElementId = null;
  let isDragging = false;
  let resizeState = null;
  let dragOffset = { x: 0, y: 0 };
  let presSlideIndex = 0;

  // DOM Elements
  const deckTitleInput = document.getElementById("deckTitle");
  const slideListEl = document.getElementById("slideList");
  const slideStage = document.getElementById("slideStage");
  const slideCountBadge = document.getElementById("slideCountBadge");
  const slideThemeSelect = document.getElementById("slideThemeSelect");
  const fontSizeSelect = document.getElementById("fontSizeSelect");
  const textColorPicker = document.getElementById("textColorPicker");
  const fillColorPicker = document.getElementById("fillColorPicker");
  const imgFileInput = document.getElementById("imgFileInput");
  const jsonFileInput = document.getElementById("jsonFileInput");

  // Presenter Overlay Elements
  const presenterOverlay = document.getElementById("presenterOverlay");
  const presenterSlide = document.getElementById("presenterSlide");
  const presPageNum = document.getElementById("presPageNum");

  // Helpers
  function generateId(prefix = "el") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  function getCurrentSlide() {
    return presentation.slides[currentSlideIndex];
  }

  function getSelectedElement() {
    if (!selectedElementId) return null;
    return getCurrentSlide().elements.find((el) => el.id === selectedElementId);
  }

  // Render Slide Stage
  function renderStage() {
    const slide = getCurrentSlide();
    if (!slide) return;

    slideStage.style.background = slide.bg;
    slideStage.innerHTML = "";

    slide.elements.forEach((el) => {
      const elDiv = document.createElement("div");
      elDiv.id = el.id;
      elDiv.className = `slide-el ${el.id === selectedElementId ? "selected" : ""}`;
      elDiv.style.left = `${el.x}px`;
      elDiv.style.top = `${el.y}px`;
      elDiv.style.width = `${el.width}px`;
      elDiv.style.height = `${el.height}px`;
      elDiv.style.transform = `rotate(${el.rotation || 0}deg)`;

      if (el.type === "text") {
        elDiv.className += " slide-text";
        elDiv.style.fontSize = el.fontSize || "24px";
        elDiv.style.color = el.color || "#ffffff";
        elDiv.style.fontWeight = el.fontWeight || "normal";
        elDiv.contentEditable = "true";
        elDiv.innerHTML = el.text || "";

        elDiv.addEventListener("input", (e) => {
          const content = e.target.cloneNode(true);
          content.querySelectorAll(".resize-handle").forEach((handle) => handle.remove());
          el.text = content.innerHTML;
          renderThumbnails();
        });
      } else if (el.type === "rect") {
        const shape = document.createElement("div");
        shape.className = "slide-shape";
        shape.style.background = el.fill || "rgba(255,255,255,0.1)";
        shape.style.border = `1px solid ${el.borderColor || "rgba(255,255,255,0.2)"}`;
        elDiv.appendChild(shape);
      } else if (el.type === "circle") {
        const shape = document.createElement("div");
        shape.className = "slide-shape";
        shape.style.borderRadius = "50%";
        shape.style.background = el.fill || "rgba(255,255,255,0.1)";
        shape.style.border = `1px solid ${el.borderColor || "rgba(255,255,255,0.2)"}`;
        elDiv.appendChild(shape);
      } else if (el.type === "image") {
        const img = document.createElement("img");
        img.className = "slide-img";
        img.src = el.src;
        elDiv.appendChild(img);
      }

      ["n", "ne", "e", "se", "s", "sw", "w", "nw"].forEach((direction) => {
        const handle = document.createElement("span");
        handle.className = "resize-handle";
        handle.contentEditable = "false";
        handle.dataset.direction = direction;
        handle.addEventListener("mousedown", (event) => {
          event.preventDefault(); event.stopPropagation(); selectElement(el.id);
          resizeState = { id: el.id, direction, startX: event.clientX, startY: event.clientY, x: el.x, y: el.y, width: el.width, height: el.height };
        });
        elDiv.appendChild(handle);
      });

      // Dragging Interaction
      elDiv.addEventListener("mousedown", (e) => {
        selectElement(el.id);
        if (e.target.contentEditable === "true" && e.target === document.activeElement) {
          return; // Let user select text
        }
        isDragging = true;
        const rect = slideStage.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left - el.x;
        dragOffset.y = e.clientY - rect.top - el.y;
        e.stopPropagation();
      });

      slideStage.appendChild(elDiv);
    });

    slideThemeSelect.value = slide.bg;
    renderThumbnails();
  }

  // Dragging Mouse Move / Up
  window.addEventListener("mousemove", (e) => {
    if (resizeState) {
      const el = getCurrentSlide().elements.find((item) => item.id === resizeState.id);
      if (!el) return;
      const dx = e.clientX - resizeState.startX, dy = e.clientY - resizeState.startY, dir = resizeState.direction;
      el.width = Math.max(24, resizeState.width + (dir.includes("e") ? dx : dir.includes("w") ? -dx : 0));
      el.height = Math.max(20, resizeState.height + (dir.includes("s") ? dy : dir.includes("n") ? -dy : 0));
      el.x = dir.includes("w") ? resizeState.x + resizeState.width - el.width : resizeState.x;
      el.y = dir.includes("n") ? resizeState.y + resizeState.height - el.height : resizeState.y;
      const elDiv = document.getElementById(el.id);
      if (elDiv) { elDiv.style.width = `${el.width}px`; elDiv.style.height = `${el.height}px`; elDiv.style.left = `${el.x}px`; elDiv.style.top = `${el.y}px`; }
      return;
    }
    if (!isDragging) return;
    const el = getSelectedElement();
    if (!el) return;

    const rect = slideStage.getBoundingClientRect();
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;

    // Bounds checking
    newX = Math.max(0, Math.min(newX, 960 - el.width));
    newY = Math.max(0, Math.min(newY, 540 - el.height));

    el.x = Math.round(newX);
    el.y = Math.round(newY);

    const elDiv = document.getElementById(el.id);
    if (elDiv) {
      elDiv.style.left = `${el.x}px`;
      elDiv.style.top = `${el.y}px`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (resizeState) { resizeState = null; renderStage(); return; }
    if (isDragging) {
      isDragging = false;
      renderThumbnails();
    }
  });

  // Select Element
  function selectElement(id) {
    selectedElementId = id;
    document.querySelectorAll(".slide-el").forEach((el) => {
      el.classList.toggle("selected", el.id === id);
    });

    const el = getSelectedElement();
    if (el) {
      if (el.fontSize) fontSizeSelect.value = el.fontSize;
      if (el.color) textColorPicker.value = el.color;
      if (el.fill) fillColorPicker.value = el.fill;
      const rotation = el.rotation || 0;
      document.getElementById("elementRotation").value = rotation;
      document.getElementById("elementRotationValue").value = `${rotation}°`;
    }
  }

  document.getElementById("elementRotation").addEventListener("input", (event) => {
    const el = getSelectedElement();
    if (!el) return;
    el.rotation = Number(event.target.value);
    document.getElementById("elementRotationValue").value = `${el.rotation}°`;
    const node = document.getElementById(el.id);
    if (node) node.style.transform = `rotate(${el.rotation}deg)`;
    renderThumbnails();
  });

  document.getElementById("btnApplyLayout").addEventListener("click", () => {
    const slide = getCurrentSlide();
    const title = (text, x, y, width, size, color = "#ffffff") => ({ id: generateId("text"), type: "text", x, y, width, height: size * 2, text, fontSize: `${size}px`, color, fontWeight: "bold" });
    const body = (text, x, y, width) => ({ id: generateId("text"), type: "text", x, y, width, height: 260, text, fontSize: "24px", color: "#e5e7eb", fontWeight: "normal" });
    const preset = document.getElementById("slideLayoutSelect").value;
    if (preset === "blank") slide.elements = [];
    if (preset === "title") slide.elements = [title("Presentation Title", 80, 150, 800, 48), body("Subtitle", 84, 235, 780)];
    if (preset === "content") slide.elements = [title("Slide Title", 64, 42, 830, 38), body("Add your content here…", 68, 125, 820)];
    if (preset === "columns") slide.elements = [title("Slide Title", 64, 38, 830, 38), body("Left column…", 68, 125, 390), body("Right column…", 500, 125, 390)];
    selectedElementId = null;
    renderStage();
  });

  // Click Stage Deselect
  slideStage.addEventListener("mousedown", (e) => {
    if (e.target === slideStage) {
      selectedElementId = null;
      document.querySelectorAll(".slide-el").forEach((el) => el.classList.remove("selected"));
    }
  });

  // Render Slide Thumbnails
  function renderThumbnails() {
    slideListEl.innerHTML = "";
    slideCountBadge.textContent = `${presentation.slides.length} ${presentation.slides.length === 1 ? "slide" : "slides"}`;

    presentation.slides.forEach((slide, idx) => {
      const card = document.createElement("div");
      card.className = `slide-thumb-card ${idx === currentSlideIndex ? "active" : ""}`;

      const preview = document.createElement("div");
      preview.className = "slide-thumb-preview";
      preview.style.background = slide.bg;

      // Extract first text as snippet
      const firstText = slide.elements.find((el) => el.type === "text" && el.text);
      if (firstText) {
        const snippet = document.createElement("div");
        snippet.style.fontSize = "7px";
        snippet.style.color = firstText.color || "#fff";
        snippet.style.overflow = "hidden";
        snippet.style.textOverflow = "ellipsis";
        snippet.style.whiteSpace = "nowrap";
        snippet.style.maxWidth = "90%";
        snippet.textContent = firstText.text.replace(/<[^>]*>/g, "");
        preview.appendChild(snippet);
      }

      const meta = document.createElement("div");
      meta.className = "slide-thumb-meta";
      meta.innerHTML = `<span>#${idx + 1}</span><span>${slide.elements.length} items</span>`;

      card.appendChild(preview);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        currentSlideIndex = idx;
        selectedElementId = null;
        renderStage();
      });

      slideListEl.appendChild(card);
    });
  }

  // Add Elements
  document.getElementById("btnAddHeading").addEventListener("click", () => {
    const slide = getCurrentSlide();
    const newEl = {
      id: generateId("heading"),
      type: "text",
      x: 100,
      y: 100,
      width: 760,
      height: 70,
      text: "Heading Title",
      fontSize: "48px",
      color: "#ffffff",
      fontWeight: "bold"
    };
    slide.elements.push(newEl);
    selectedElementId = newEl.id;
    renderStage();
  });

  document.getElementById("btnAddText").addEventListener("click", () => {
    const slide = getCurrentSlide();
    const newEl = {
      id: generateId("text"),
      type: "text",
      x: 100,
      y: 180,
      width: 600,
      height: 80,
      text: "Enter your body text here...",
      fontSize: "20px",
      color: "#cccccc",
      fontWeight: "normal"
    };
    slide.elements.push(newEl);
    selectedElementId = newEl.id;
    renderStage();
  });

  document.getElementById("btnAddRect").addEventListener("click", () => {
    const slide = getCurrentSlide();
    const newEl = {
      id: generateId("rect"),
      type: "rect",
      x: 150,
      y: 150,
      width: 280,
      height: 180,
      fill: "rgba(255, 255, 255, 0.08)",
      borderColor: "rgba(255, 255, 255, 0.2)"
    };
    slide.elements.push(newEl);
    selectedElementId = newEl.id;
    renderStage();
  });

  document.getElementById("btnAddCircle").addEventListener("click", () => {
    const slide = getCurrentSlide();
    const newEl = {
      id: generateId("circle"),
      type: "circle",
      x: 200,
      y: 150,
      width: 180,
      height: 180,
      fill: "rgba(212, 175, 55, 0.2)",
      borderColor: "rgba(212, 175, 55, 0.5)"
    };
    slide.elements.push(newEl);
    selectedElementId = newEl.id;
    renderStage();
  });

  document.getElementById("btnAddImage").addEventListener("click", () => imgFileInput.click());
  imgFileInput.addEventListener("change", () => {
    const file = imgFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const slide = getCurrentSlide();
      const newEl = {
        id: generateId("img"),
        type: "image",
        x: 120,
        y: 100,
        width: 320,
        height: 240,
        src: e.target.result
      };
      slide.elements.push(newEl);
      selectedElementId = newEl.id;
      renderStage();
    };
    reader.readAsDataURL(file);
    imgFileInput.value = "";
  });

  // Formatting Listeners
  fontSizeSelect.addEventListener("change", (e) => {
    const el = getSelectedElement();
    if (el && el.type === "text") {
      el.fontSize = e.target.value;
      const elDiv = document.getElementById(el.id);
      if (elDiv) elDiv.style.fontSize = el.fontSize;
    }
  });

  textColorPicker.addEventListener("input", (e) => {
    const el = getSelectedElement();
    if (el && el.type === "text") {
      el.color = e.target.value;
      const elDiv = document.getElementById(el.id);
      if (elDiv) elDiv.style.color = el.color;
    }
  });

  fillColorPicker.addEventListener("input", (e) => {
    const el = getSelectedElement();
    if (el && (el.type === "rect" || el.type === "circle")) {
      el.fill = e.target.value;
      renderStage();
    }
  });

  slideThemeSelect.addEventListener("change", (e) => {
    const slide = getCurrentSlide();
    if (slide) {
      slide.bg = e.target.value;
      renderStage();
    }
  });

  // Element Layering
  function bringForward() {
    if (!selectedElementId) return;
    const slide = getCurrentSlide();
    const idx = slide.elements.findIndex((el) => el.id === selectedElementId);
    if (idx !== -1 && idx < slide.elements.length - 1) {
      const temp = slide.elements[idx];
      slide.elements[idx] = slide.elements[idx + 1];
      slide.elements[idx + 1] = temp;
      renderStage();
    }
  }

  function sendBackward() {
    if (!selectedElementId) return;
    const slide = getCurrentSlide();
    const idx = slide.elements.findIndex((el) => el.id === selectedElementId);
    if (idx > 0) {
      const temp = slide.elements[idx];
      slide.elements[idx] = slide.elements[idx - 1];
      slide.elements[idx - 1] = temp;
      renderStage();
    }
  }

  document.getElementById("btnBringForward")?.addEventListener("click", bringForward);
  document.getElementById("btnSendBackward")?.addEventListener("click", sendBackward);

  // Delete Element
  function deleteElement() {
    if (!selectedElementId) return;
    const slide = getCurrentSlide();
    slide.elements = slide.elements.filter((el) => el.id !== selectedElementId);
    selectedElementId = null;
    renderStage();
  }
  document.getElementById("btnDeleteElement").addEventListener("click", deleteElement);

  window.addEventListener("keydown", (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId) {
      if (document.activeElement.contentEditable === "true") return;
      deleteElement();
    }
  });

  // Slide Management
  document.getElementById("btnAddSlide").addEventListener("click", () => {
    const newSlide = {
      id: generateId("slide"),
      bg: getCurrentSlide().bg || "#1a1817",
      elements: [
        {
          id: generateId("heading"),
          type: "text",
          x: 80,
          y: 80,
          width: 800,
          height: 60,
          text: "Slide Title",
          fontSize: "40px",
          color: "#ffffff",
          fontWeight: "bold"
        }
      ]
    };
    presentation.slides.push(newSlide);
    currentSlideIndex = presentation.slides.length - 1;
    selectedElementId = null;
    renderStage();
  });

  document.getElementById("btnDuplicateSlide").addEventListener("click", () => {
    const current = getCurrentSlide();
    const dup = JSON.parse(JSON.stringify(current));
    dup.id = generateId("slide");
    presentation.slides.splice(currentSlideIndex + 1, 0, dup);
    currentSlideIndex++;
    selectedElementId = null;
    renderStage();
  });

  document.getElementById("btnDeleteSlide").addEventListener("click", () => {
    if (presentation.slides.length <= 1) {
      alert("A presentation must have at least one slide.");
      return;
    }
    presentation.slides.splice(currentSlideIndex, 1);
    if (currentSlideIndex >= presentation.slides.length) {
      currentSlideIndex = presentation.slides.length - 1;
    }
    selectedElementId = null;
    renderStage();
  });

  // Fullscreen Presentation Mode
  function startPresentation() {
    presSlideIndex = currentSlideIndex;
    presenterOverlay.style.display = "flex";
    if (presenterOverlay.requestFullscreen) {
      presenterOverlay.requestFullscreen().catch(() => {});
    }
    renderPresenterSlide();
  }

  function renderPresenterSlide() {
    const slide = presentation.slides[presSlideIndex];
    if (!slide) return;

    presenterSlide.style.background = slide.bg;
    presenterSlide.innerHTML = "";

    slide.elements.forEach((el) => {
      const elDiv = document.createElement("div");
      elDiv.style.position = "absolute";
      elDiv.style.left = `${(el.x / 960) * 100}%`;
      elDiv.style.top = `${(el.y / 540) * 100}%`;
      elDiv.style.width = `${(el.width / 960) * 100}%`;
      elDiv.style.height = `${(el.height / 540) * 100}%`;

      if (el.type === "text") {
        elDiv.style.fontSize = `calc(${(parseInt(el.fontSize, 10) / 960) * 100}vw)`;
        elDiv.style.color = el.color || "#ffffff";
        elDiv.style.fontWeight = el.fontWeight || "normal";
        elDiv.innerHTML = el.text || "";
      } else if (el.type === "rect" || el.type === "circle") {
        elDiv.style.background = el.fill;
        elDiv.style.border = `1px solid ${el.borderColor || "transparent"}`;
        if (el.type === "circle") elDiv.style.borderRadius = "50%";
      } else if (el.type === "image") {
        const img = document.createElement("img");
        img.src = el.src;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        elDiv.appendChild(img);
      }
      presenterSlide.appendChild(elDiv);
    });

    presPageNum.textContent = `${presSlideIndex + 1} / ${presentation.slides.length}`;
  }

  function exitPresentation() {
    presenterOverlay.style.display = "none";
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  document.getElementById("btnPresent").addEventListener("click", startPresentation);
  document.getElementById("btnPresExit").addEventListener("click", exitPresentation);

  document.getElementById("btnPresNext").addEventListener("click", () => {
    if (presSlideIndex < presentation.slides.length - 1) {
      presSlideIndex++;
      renderPresenterSlide();
    }
  });

  document.getElementById("btnPresPrev").addEventListener("click", () => {
    if (presSlideIndex > 0) {
      presSlideIndex--;
      renderPresenterSlide();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (presenterOverlay.style.display === "flex") {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        if (presSlideIndex < presentation.slides.length - 1) {
          presSlideIndex++;
          renderPresenterSlide();
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (presSlideIndex > 0) {
          presSlideIndex--;
          renderPresenterSlide();
        }
      } else if (e.key === "Escape") {
        exitPresentation();
      }
    } else if (e.key === "F5") {
      e.preventDefault();
      startPresentation();
    }
  });

  // Project File Save & Load (JSON)
  document.getElementById("btnSaveJson").addEventListener("click", () => {
    presentation.title = deckTitleInput.value.trim() || "Presentation";
    const blob = new Blob([JSON.stringify(presentation, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${presentation.title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btnOpenJson").addEventListener("click", () => jsonFileInput.click());
  jsonFileInput.addEventListener("change", async () => {
    const file = jsonFileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.slides && Array.isArray(parsed.slides)) {
        presentation = parsed;
        deckTitleInput.value = presentation.title || "Untitled Presentation";
        currentSlideIndex = 0;
        selectedElementId = null;
        renderStage();
      } else {
        alert("Invalid presentation file.");
      }
    } catch (err) {
      alert("Error reading file: " + err.message);
    }
    jsonFileInput.value = "";
  });

  // Native PPTX Generation via pptxgen.min.js
  document.getElementById("btnExportPptx").addEventListener("click", async () => {
    if (!window.PptxGenJS) {
      alert("PptxGenJS library is missing.");
      return;
    }

    const pptx = new window.PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    const title = deckTitleInput.value.trim() || "Presentation";
    const pptColor = (value, fallback = "333333") => {
      const text = String(value || "").trim();
      const hex = text.match(/^#?([\da-f]{6})$/i);
      if (hex) return { color: hex[1].toUpperCase(), transparency: 0 };
      const rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
      if (!rgb) return { color: fallback, transparency: 0 };
      const color = [rgb[1], rgb[2], rgb[3]].map(value => Math.min(255, Number(value)).toString(16).padStart(2, "0")).join("").toUpperCase();
      const alpha = rgb[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(rgb[4])));
      return { color, transparency: Math.round((1 - alpha) * 100) };
    };

    presentation.slides.forEach((slide) => {
      const pSlide = pptx.addSlide();
      // Hex without #
      const bgHex = (slide.bg || "#ffffff").replace("#", "");
      pSlide.background = { color: bgHex };

      slide.elements.forEach((el) => {
        // Convert 960x540 canvas px coordinates to inches (16:9 is 10 x 5.625 inches in pptxgenjs)
        const xInch = (el.x / 960) * 10;
        const yInch = (el.y / 540) * 5.625;
        const wInch = (el.width / 960) * 10;
        const hInch = (el.height / 540) * 5.625;

        if (el.type === "text") {
          const rawText = (el.text || "").replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]*>/g, "");
          const ptSize = Math.round((parseInt(el.fontSize, 10) || 24) * 0.75);
          const color = pptColor(el.color, "FFFFFF");
          pSlide.addText(rawText, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            fontSize: ptSize,
            color: color.color,
            transparency: color.transparency,
            bold: el.fontWeight === "bold",
            rotate: Number(el.rotation) || 0,
            breakLine: false,
            valign: "mid",
            margin: 0
          });
        } else if (el.type === "rect") {
          const fill = pptColor(el.fill);
          const line = pptColor(el.borderColor, fill.color);
          pSlide.addShape(pptx.ShapeType.rect, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            rotate: Number(el.rotation) || 0,
            fill,
            line: { color: line.color, transparency: line.transparency, width: 1 }
          });
        } else if (el.type === "circle") {
          const fill = pptColor(el.fill);
          const line = pptColor(el.borderColor, fill.color);
          pSlide.addShape(pptx.ShapeType.oval, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            rotate: Number(el.rotation) || 0,
            fill,
            line: { color: line.color, transparency: line.transparency, width: 1 }
          });
        } else if (el.type === "image" && el.src) {
          pSlide.addImage({
            data: el.src,
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            rotate: Number(el.rotation) || 0
          });
        }
      });
    });

    try {
      await pptx.writeFile({ fileName: `${title}.pptx` });
    } catch (err) {
      alert("Error exporting PPTX: " + err.message);
    }
  });

  // Initialize
  renderStage();
})();

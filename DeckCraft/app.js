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

      if (el.type === "text") {
        elDiv.className += " slide-text";
        elDiv.style.fontSize = el.fontSize || "24px";
        elDiv.style.color = el.color || "#ffffff";
        elDiv.style.fontWeight = el.fontWeight || "normal";
        elDiv.contentEditable = "true";
        elDiv.innerHTML = el.text || "";

        elDiv.addEventListener("input", (e) => {
          el.text = e.target.innerHTML;
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
    }
  }

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
          const colorHex = (el.color || "#ffffff").replace("#", "");
          pSlide.addText(rawText, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            fontSize: ptSize,
            color: colorHex,
            bold: el.fontWeight === "bold"
          });
        } else if (el.type === "rect") {
          const fillHex = (el.fill || "#333333").replace("#", "");
          pSlide.addShape(pptx.ShapeType.rect, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            fill: { color: fillHex.length === 6 ? fillHex : "333333" }
          });
        } else if (el.type === "circle") {
          const fillHex = (el.fill || "#333333").replace("#", "");
          pSlide.addShape(pptx.ShapeType.oval, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            fill: { color: fillHex.length === 6 ? fillHex : "333333" }
          });
        } else if (el.type === "image" && el.src) {
          pSlide.addImage({
            data: el.src,
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch
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

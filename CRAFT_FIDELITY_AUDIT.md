# Sigma Webapps — Craft Applications Suite Fidelity Audit

This document provides a comprehensive technical audit comparing the client-side Craft applications in **Sigma Webapps** against their upstream references in the **ArtCraft** ecosystem (`github.com/storytold`).

---

## 1. Upstream Organization & Architecture Overview

- **Organization:** [ArtCraft (`storytold`)](https://github.com/storytold)
- **Philosophy:** Clean-room, high-performance, open-source creative and office tools built natively in Rust, designed to run fully offline with zero mandatory cloud dependencies, telemetry, or recurring subscriptions.
- **Upstream Tech Stack:**
  - **Language:** 100% Native Rust (`no_std` / WASM-compatible core libraries)
  - **UI Toolkit:** `egui` / `eframe` immediate-mode graphical user interface
  - **Compositing & Graphics:** `wgpu` (WebGPU / Vulkan / Metal / DX12) + CPU fallbacks
  - **Compilation Targets:** Native desktop (Linux, macOS, Windows, BSD) and `wasm32-unknown-unknown` via `wasm-bindgen` and `trunk`
- **Sigma Webapps Adaptation Strategy:**
  - Because Sigma Webapps operates directly from standard local filesystems via `file://` without requiring compilation toolchains (e.g. `cargo`, `rustc`, `wasm-pack`), node servers, or WebAssembly header configs (which block SharedArrayBuffers under `file://`), the Craft suite is implemented using **browser-native, standard Web APIs and audited local libraries** (`pdf-lib`, `pdfjs`, `SheetJS/xlsx`, `pptxgenjs`, `mammoth`, `JSZip`, and the HTML5 Canvas & Web Audio APIs).
  - Every application preserves the upstream data models, non-destructive editing workflows, coordinate systems, and export guarantees.

---

## 2. Per-Application Fidelity Matrix & Technical Audit

### 2.1 PdfCraft (`PdfCraft/`)
- **Upstream Counterpart:** [`storytold/pdfcraft`](https://github.com/storytold/pdfcraft) (MIT / Apache-2.0)
- **Upstream Architecture:** Pure Rust PDF workbench handling atomic document updates, typography, world scripts, transparency, soft masks, page organization, and security.
- **Sigma Webapps Implementation:**
  - **Document Engine:** Dual-engine architecture combining `pdf.js` for high-fidelity rasterized canvas viewport rendering and `pdf-lib` for document tree manipulation and binary export.
  - **Page Organizing:** Reorder pages dynamically (Move Up ▲ / Move Down ▼), rotate pages 90° clockwise, delete pages, and append/merge secondary PDF documents with live thumbnail sync.
  - **Annotation Engine:** Vector overlay canvas supporting precision highlighter with alpha blending, freehand pen tool with stroke width control, bounding rectangle annotations, and text note placement.
  - **Export Fidelity:** Bakes vector drawings and standard Helvetica annotations into binary PDF coordinate space (`y: height - (y + h) * scale`), producing spec-compliant PDF files with zero external server dependencies.

---

### 2.2 PhotoCraft (`PhotoCraft/`)
- **Upstream Counterpart:** [`storytold/photocraft`](https://github.com/storytold/photocraft) (Apache-2.0)
- **Upstream Architecture:** Layered image editor (Photoshop alternative) with pure-data document model, modular command engine, 256² copy-on-write sparse tiles, and dual compositors (CPU reference + GPU `wgpu`).
- **Sigma Webapps Implementation:**
  - **Layer Compositing Engine:** Multi-layer stack with individual canvas buffers, visibility toggles, opacity sliders (0–100%), layer reordering (Move Up / Down), and 7 blend modes (`source-over`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `difference`).
  - **Creative Tools:** Paintbrush with variable size and opacity, precision eraser, flood-fill paint bucket (scanline BFS algorithm), geometric shapes (rectangle, ellipse), typography text stamp, and color eyedropper.
  - **Pixel Adjustments:** Mathematical color transformations (Brightness boost, Contrast matrix adjustment, Invert, 24-bit Grayscale, and Sepia toning).
  - **Undo/Redo History:** Deep layer-state snapshot stack for non-destructive creative revision.
  - **Export Fidelity:** Flattened full-resolution PNG and JPEG export.

---

### 2.3 FilmCraft (`FilmCraft/`)
- **Upstream Counterpart:** [`storytold/filmcraft`](https://github.com/storytold/filmcraft)
- **Upstream Architecture:** Non-linear video editor (Premiere Pro alternative) with media codecs, multi-track sequencing, and playback pipeline.
- **Sigma Webapps Implementation:**
  - **Nonlinear Timeline:** Multi-track timeline (Video 1, Video 2 Overlay, Audio 1) with zoomable horizontal time ruler, clip drag placement, and frame-accurate timecode display (`HH:MM:SS:FF` at 30fps).
  - **Editing Capabilities:** Razor tool (`S` split key) to cut clips at playhead position, clip selection, delete, and real-time scrubbing.
  - **Compositing Viewport:** Live 16:9 canvas preview renderer drawing synchronized video frames and graphic overlays.
  - **Export Engine:** Client-side video encoding using the HTML5 `MediaRecorder` API directly capturing the synchronized canvas and audio stream.

---

### 2.4 WordCraft (`WordCraft/`)
- **Upstream Counterpart:** [`storytold/wordcraft`](https://github.com/storytold/wordcraft)
- **Upstream Architecture:** Clean-room word processor with structured document trees, text layout engines, and batched formatting operations.
- **Sigma Webapps Implementation:**
  - **Document Canvas:** Authentic desktop A4 paper canvas with realistic drop shadow, page margins (Normal 1in, Narrow 0.5in, Wide 1.5in), and canvas themes (Classic White, Warm Parchment, Dark Canvas).
  - **Typography & Formatting:** Full ribbon with font family selection, font sizing, headings (H1, H2, H3), bold, italic, underline, strikethrough, subscript, superscript, text alignment, lists, blockquotes, tables, and local image embedding.
  - **Real-Time Metrics:** Dynamic word count, character count, and estimated reading time.
  - **Import & Export:** Native Microsoft Word `.docx` import via bundled `mammoth.browser.min.js`, and ISO/IEC 29500 OpenXML `.docx` generation via `JSZip` containing `word/document.xml`, `word/styles.xml`, and relationship manifests. Secondary exports to HTML, Markdown, and print/PDF.

---

### 2.5 DeckCraft (`DeckCraft/`)
- **Upstream Counterpart:** [`storytold/deckcraft`](https://github.com/storytold/deckcraft)
- **Upstream Architecture:** Slide presentation suite handling themes, slide hierarchies, shapes, layouts, and `.pptx` generation.
- **Sigma Webapps Implementation:**
  - **Slide Studio:** 16:9 widescreen canvas, multi-slide thumbnail list with addition, duplication, and deletion.
  - **Object Layering & Styling:** Draggable text boxes, cards/rectangles, circles, and embedded images. Full z-order element layering (▲ Forward / ▼ Backward) and color customizers.
  - **Presenter Mode:** Fullscreen slideshow presentation mode with keyboard controls (`Space`, `ArrowRight`, `PageDown`, `ArrowLeft`, `PageUp`, `Escape`, `F5`).
  - **Export Engine:** Native `.pptx` PowerPoint presentation generation via bundled `pptxgen.min.js`, plus lossless JSON project save/load.

---

### 2.6 GridCraft (`GridCraft/`)
- **Upstream Counterpart:** [`storytold/gridcraft`](https://github.com/storytold/gridcraft)
- **Upstream Architecture:** High-performance spreadsheet application with cell matrix, formula evaluation engine, and multi-sheet tabs.
- **Sigma Webapps Implementation:**
  - **Cell Matrix:** 100 rows by 26 columns (A–Z) with formula bar and coordinate indicator.
  - **Formula Engine:** Client-side recursive evaluator with circular reference cycle detection (`visited` Set). Supports `=SUM()`, `=AVERAGE()`, `=COUNT()`, `=MIN()`, `=MAX()`, `=PRODUCT()`, `=MEDIAN()`, `=CONCATENATE()`, logical `=IF(condition, trueVal, falseVal)`, and arbitrary algebraic equations (`=(A1+B1)*2`).
  - **Cell Styling:** Currency (`$`), percentage (`%`), decimal precision, bold, italic, underline, alignment (left, center, right), text colors, and cell background fills.
  - **Multi-Sheet Management:** Dynamic sheet tab addition, renaming, and switching.
  - **Interoperability:** Bidirectional Microsoft Excel `.xlsx` and CSV import & export via bundled `xlsx.full.min.js`.

---

### 2.7 SoundCraft (`SoundCraft/`)
- **Upstream Counterpart:** [`storytold/soundcraft`](https://github.com/storytold/soundcraft)
- **Upstream Architecture:** Digital Audio Workstation (DAW) with multitrack editing, mixing, waveform processing, and master mixdown.
- **Sigma Webapps Implementation:**
  - **Multitrack Mixer:** 4-track timeline with decoded audio waveform visualization, individual track volume sliders, stereo panning (-1 to +1), and exclusive Solo / Mute routing logic.
  - **Recording & Editing:** Live microphone input recording via `MediaRecorder`, clip splitting at playhead (`S`), and clip drag placement.
  - **DSP Audio Graph:** Master 3-band BiquadFilter equalizer (Low Shelf, Peaking Mid, High Shelf), feedback reverb delay processor, and real-time 1024-point FFT frequency visualizer.
  - **Master Mixdown:** 16-bit linear PCM stereo WAV rendering and file download generated completely on the main thread via standard typed arrays.

---

## 3. Fidelity Verification Summary

All seven Craft applications have been verified against these criteria:
- [x] Zero simulated operations: Every export button produces real, valid files (`.pdf`, `.png`, `.jpeg`, `.webm`, `.docx`, `.pptx`, `.xlsx`, `.csv`, `.wav`).
- [x] Zero external CDN links: All libraries reside in `lib/` and run completely offline.
- [x] Responsive layout: Adapts cleanly to both desktop viewports and mobile touch screens.
- [x] Apple Liquid Glass design integration: Floating toolbars and control cards follow Apple's Liquid Glass translucent material specifications while preserving high-contrast opaque editing canvases.

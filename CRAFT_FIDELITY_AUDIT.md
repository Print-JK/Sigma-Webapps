# Sigma Webapps — Craft Applications Suite Fidelity Audit

This document is a scoped implementation audit, not a claim of complete upstream parity. The upstream repositories are Rust applications (mostly egui/WASM builds); the Sigma tools are separate browser-native prototypes. Feature names below describe Sigma's current implementation and do not establish behavioural or file-format equivalence with upstream.

## Audit status (2026-10-22)

The local source repositories were inspected. Each Craft source contains Rust crates and a web app target; its browser UI is compiled from Rust rather than a reusable JavaScript component library. Upstream assets and source were not copied into Sigma. This distinction matters: a Cargo workspace and its models cannot be treated as proof that a JavaScript prototype has matching architecture or semantics. The seven parity matrices below are inventory summaries and require end-to-end comparison before any feature can be marked as parity-complete.

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
  - Sigma uses browser-native APIs and bundled libraries to retain direct `file://` launchability.
  - The current apps do not preserve every upstream model, workflow, coordinate system, or export guarantee. Their feature claims should be read as implemented prototype functionality only.

---

## 2. Per-Application Fidelity Matrix & Technical Audit

### 2.1 PdfCraft (`PdfCraft/`)
- **Upstream Counterpart:** [`storytold/pdfcraft`](https://github.com/storytold/pdfcraft) (MIT / Apache-2.0)
- **Upstream Architecture:** Pure Rust PDF workbench handling atomic document updates, typography, world scripts, transparency, soft masks, page organization, and security.
- **Sigma Webapps Implementation:**
  - **Document Engine:** Dual-engine architecture combining `pdf.js` for high-fidelity rasterized canvas viewport rendering and `pdf-lib` for document tree manipulation and binary export.
  - **Page Organizing:** Reorder pages dynamically (Move Up ▲ / Move Down ▼), rotate pages 90° clockwise, delete pages, and append/merge secondary PDF documents with live thumbnail sync.
  - **Annotation Engine:** Vector overlay canvas supporting precision highlighter with alpha blending, freehand pen tool with stroke width control, bounding rectangle annotations, and text note placement.
- **Export Fidelity:** Stores annotation geometry in page coordinates so zoom changes do not move marks, and bakes pen strokes, highlights, rectangles, and text into exported PDFs. Export works on a fresh document copy to avoid accumulating rotation or duplicate annotations across repeated saves. This is flattened vector content, not editable native PDF annotation objects.

---

### 2.2 PhotoCraft (`PhotoCraft/`)
- **Upstream Counterpart:** [`storytold/photocraft`](https://github.com/storytold/photocraft) (Apache-2.0)
- **Upstream Architecture:** Layered image editor (Photoshop alternative) with pure-data document model, modular command engine, 256² copy-on-write sparse tiles, and dual compositors (CPU reference + GPU `wgpu`).
- **Sigma Webapps Implementation:**
  - **Layer Compositing Engine:** Multi-layer stack with individual canvas buffers, visibility toggles, opacity sliders (0–100%), layer reordering (Move Up / Down), and 7 blend modes (`source-over`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `difference`).
  - **Creative Tools:** Paintbrush with variable size and opacity, precision eraser, flood-fill paint bucket, foreground-to-background linear/radial gradient tool, geometric shapes (rectangle, ellipse), rectangular and elliptical marquee selections, typography text stamp, and color eyedropper. Paint operations and adjustments are clipped to the active selection. Gradients can edit layer pixels or translate color luminance into alpha for a layer mask.
  - **Pixel Adjustments:** Mathematical color transformations (Brightness boost, Contrast matrix adjustment, Invert, 24-bit Grayscale, and Sepia toning).
  - **Undo/Redo History:** Deep layer-state snapshot stack for non-destructive creative revision.
  - **Export Fidelity:** Flattened full-resolution PNG and JPEG export.

---

### 2.3 FilmCraft (`FilmCraft/`)
- **Upstream Counterpart:** [`storytold/filmcraft`](https://github.com/storytold/filmcraft)
- **Upstream Architecture:** Non-linear video editor (Premiere Pro alternative) with media codecs, multi-track sequencing, and playback pipeline.
- **Sigma Webapps Implementation:**
  - **Nonlinear Timeline:** Multi-track timeline (Video 1, Video 2 Overlay, Audio 1, Audio 2) with horizontal time ruler, clip drag placement, and frame-accurate timecode display (`HH:MM:SS:FF` at 30fps). Media-bin items can be dragged to compatible video/audio tracks with the drop position mapped to timeline time.
  - **Editing Capabilities:** Razor tool (`S` split key) to cut clips at playhead position, clip selection, delete, and real-time scrubbing.
  - **Compositing Viewport:** Separate source monitor for selected local media and a live 16:9 program canvas preview renderer drawing synchronized video frames and graphic overlays.
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
  - **Cell Matrix:** 100 rows by 52 columns (A–AZ) with formula bar and coordinate indicator.
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

## 3. Fidelity Verification Summary (corrected)

The source inventory does not establish comprehensive parity. Export implementations exist in the Sigma code, but output validity and round-trip fidelity have not been established for every format. A headless Chromium pass loaded all eight Craft/game entry pages without uncaught exceptions after adding the missing local JSZip include to DeckCraft. WordCraft row and column insertion was exercised in a selected table and produced two rows and three cells. PdfCraft loaded a generated one-page PDF, drew a pen stroke, preserved visible ink at 125% and 150% zoom, and exported a one-page PDF whose rendered output contains the red stroke; `qpdf --check` reported no syntax or stream-encoding errors. Two repeated highlight exports rendered to identical sampled pixels, confirming the flattened annotation was not accumulated. DeckCraft generated a PPTX that passed ZIP integrity; its slide XML contained the expected 37-degree rotation and alpha values. GridCraft also exported a B2:B3 `>3` rule as one OOXML `cellIs` rule and differential fill, then imported it back with the expected red cell fill. LibreOffice 26.8 opened the XLSX, converted it to ODS, and retained the `cell-content()>3` conditional rule. These targeted checks do not establish full format round trips or broad visual fidelity. No full runtime network audit of every entry point has been completed.

## 4. Work completed in this pass

- Inspected the seven upstream workspace structures and the NZ:P hub repository. NZ:P's README identifies it as the hub for nightly builds and points to separate engine, QuakeC, and asset repositories; the local hub clone does not include those components or a Nacht map implementation.
- Added a prototype barricade loop in `Zombies3D/game.js`: four openings, five individually visible boards each, zombie board damage, held-F repair, and +10 points per restored board. Restart restores all boards.
- Remaining major gaps include an upstairs/stairs layout and full Nacht geometry, general collision/pathfinding, animation/audio asset parity, cross-app upstream model parity, and systematic import/export validation. No fidelity percentage is claimed.

## 5. Fidelity implementation pass (2026-10-22)

- **PhotoCraft:** Added layer duplicate, merge-down, alpha masks, mask painting with black/white brush strokes and luminance-aware linear/radial gradients, mask-aware undo/redo, and the upstream Lucide gradient icon. Added rectangular and elliptical marquee selections with marching-ants outlines and M/Shift+M shortcuts. Brush, eraser, flood fill, gradients, shapes, text, and pixel adjustments respect the selection; Escape clears it. Authentic `square-dashed.svg` and `circle-dashed.svg` icons were copied from the upstream asset tree (already covered by its Lucide license file). Chromium pixel checks confirmed the rectangle and ellipse strokes changed only pixels inside their bounds. Browser pixel checks caught the offscreen mask compositor retaining `destination-in` after compositing; saving/restoring the 2D context now resets that state for every recomposite. Linear foreground/background endpoints, radial center/corner, gradient undo, and a black-to-white mask gradient revealing the underlying layer were exercised in Chromium. Merge-down remains an approximation of a full document compositor.
- **WordCraft:** Added Heading 4–6, a subtitle style, paragraph line spacing, a visible/print page break marker, inline run formatting, basic list/table run formatting, DOCX page breaks, and actual inline picture parts (image bytes, content-type declarations, relationship IDs, and DrawingML sizing). Local data/blob images are embedded; unsupported raster inputs are converted to PNG, and remote images are not fetched. A generated PNG+JPEG DOCX passed ZIP integrity and XML well-formedness checks and reopened both images through bundled Mammoth as data URLs. Added selected-cell row and column insertion controls. The editor now flows through CSS multi-columns over separately positioned A4 paper tiles and reports its page count. Editable header/footer fields are repeated across page tiles, synchronized, stored locally, and DOCX import/export code reads and writes OpenXML header/footer parts and section relationships. A four-page Chromium fixture confirmed the repeated values and local-storage persistence. A minimal local DOCX package round trip passed in Chromium: header/footer text, content-type overrides, relationship targets, and section references were present, and Mammoth plus the local header/footer reader restored both values. This does not validate complex third-party section variants or native Office layout. This remains a browser layout approximation, not the upstream layout engine; widow/orphan control, table splitting, page numbering fields, first/even-page variants, and exact DOCX pagination remain incomplete or unverified. Opening in a native Office application is not verified.
- **GridCraft:** Added mouse range selection, range sum/average/count, a fill handle that copies values/styles and adjusts relative cell references, sheet duplication and tab colors, selected-range merge/unmerge with XLSX merge metadata import/export, and per-range comparison-based conditional fills. Replaced dynamic `Function` formula execution with a bounded arithmetic parser and a limited comparison-based `IF`. Numeric/text comparison conditional fills now serialize as XLSX `cellIs` rules with differential fill styles and are read back from workbook relationships/styles; a browser round trip confirmed B2:B3 `>3` retained its red inline cell fill. Column and row headers now support drag resizing; pixel dimensions are stored per sheet and mapped to XLSX `!cols`/`!rows` on export and import. Chromium exercised a drag to 137px column width and 57px row height. A bundled SheetJS XLSX round trip retained both dimensions when imported with `cellStyles: true`. Expanded the rendered grid to 52 columns (A–AZ), and replaced single-letter coordinate conversion with base-26 column labels. A Chromium interaction entered 5 in AA1 and evaluated `=AA1*2` as 10 in A2. The formula engine remains a small subset of Excel/GridCraft and the grid remains limited to 52 columns by 100 rows.
- **DeckCraft:** Added Title, Title & Content, Two Columns, and Blank layout presets, object rotation, and eight resize handles. Fixed a missing `JSZip` dependency in `DeckCraft/index.html` by loading the bundled `lib/jszip.min.js` before PptxGenJS. PPTX export carries element rotation and parses hex/RGB/RGBA fill and outline colors (including alpha transparency). A generated rotated, translucent shape appeared in the PPTX XML with the expected `rot` and alpha values, and the package passed ZIP integrity; LibreOffice 26.8 converted the PPTX to a one-page PDF, confirming it opens in a real presentation engine; pixel-level comparison against the editor remains unverified.
- **SoundCraft:** Added left/right clip trim handles that update source offset and duration and are respected by playback and WAV render scheduling; record-arm selection per track; and a live master dynamics compressor. Offline WAV mixdown now reproduces per-track mute/solo/gain/pan and the 3-band EQ, feedback delay, compressor, and master gain, including a delay tail. A generated 60 Hz local WAV fixture exported as stereo 44.1 kHz PCM; +12 dB low EQ measured 3.30× dry RMS, and enabled delay produced the expected longer file. This does not verify microphone capture, long-session performance, or full project round trips.
- **FilmCraft:** Added a selected-media source monitor alongside the program monitor, and implemented media-bin drag/drop onto compatible video/audio track rows. A generated local WebM was imported, previewed in the source monitor, and dropped onto Video 2; the clip appeared with no browser exceptions. Also added per-clip scale, position, and opacity controls; frame-snapped seeking and clip movement; cross-track compatible clip drops; left/right clip trimming; video/audio track routing including Audio 2; removed the hard 15-second export stop; and mixed audio timeline clips into the canvas MediaRecorder stream through Web Audio. A headless Chromium test imported generated local video/WAV fixtures and recorded a WebM containing video and Opus audio tracks. Real user codecs, embedded source-video audio, long exports, and audio/video sync on complex timelines still need validation.
- **PdfCraft:** Added drag-and-drop thumbnail reordering, current-page extraction, and imported upstream Lucide icons and license. Annotation strokes, highlights, rectangles, and notes now use PDF page coordinates and are included in both page extraction and full export. Export runs against a fresh document copy to avoid accumulating rotations or annotation content. A browser interaction drew a pen line on a generated PDF, preserved the annotation across zoom changes, and exported a PDF whose rendered image contains the red stroke; `qpdf --check` found no syntax or stream encoding errors. Annotations are flattened into page content; native annotation editing and complex PDF fidelity remain gaps.
- **Zombies3D:** Added cardinal window openings, five-board barricades and repair scoring, round-five runner pacing, and a second 30×30 annex connected by the 1000-point debris gate. The Mystery Box and rifle buy are in the annex, with an exterior spawn window; player bounds enforce the passage and room edges, and zombie movement respects the passage width. Health below 30% now enables an animated blood-edge overlay and a procedural double-beat Web Audio heartbeat; leaving pointer lock or reaching game over stops the heartbeat timer. A `file://` screenshot confirmed the critical overlay renders; the live health threshold and audio timing were not exercised during combat. Headless Chromium entered round I and acquired pointer lock without runtime exceptions; the purchase/traversal loop and combat have not been exercised. There is still no upstairs/stairs route or general pathfinding.
- **Asset availability:** The local upstream `wordcraft`, `gridcraft`, `deckcraft`, `soundcraft`, and `filmcraft` asset trees do not contain `assets/icons/`; there were no authentic icon sets to extract for those apps. No icons were fabricated or mislabeled as upstream assets.
- **Verification:** All non-vendored project JavaScript passes `node --check`; `git diff --check` passes; each Craft app and Zombies3D initializes from `file://` in headless Chromium. A temporary 100-paragraph WordCraft fixture flowed across multiple A4 tiles in Chromium, showing the first two full paper tiles and part of a third, while the status bar reported 7 pages; the fixture was removed after the check. A separate four-page fixture confirmed header/footer text synchronization between tiles and local-storage persistence; the temporary fixture was removed. A minimal DOCX export/import fixture verified both parts, content-type overrides, relationships, section references, and restored editor values; complex third-party section variants and native Office layout remain unverified. WordCraft's generated PNG/JPEG DOCX passed ZIP integrity, XML parsing, and Mammoth image round-trip. Interactive checks confirmed PhotoCraft duplicate/merge/mask toggle, linear/radial gradients and mask compositor output, plus rectangular and elliptical selection clipping at inside/outside pixels; GridCraft column and row drag resizing to 137px and 57px respectively, XLSX dimension round-trip, AA1 multi-letter formula evaluation (`=AA1*2` returned 10), plus arithmetic evaluation, range drag selection, fill-handle formula adjustment, safe rejection of a global-assignment formula, merged-range display and unmerge, sheet-switch isolation, conditional fill, and generated XLSX merge metadata. SoundCraft's generated-tone WAV export was checked for stereo PCM header, sample rate, the expected EQ gain change, and delay-tail length. FilmCraft's generated media export was checked for an actual combined WebM with Opus audio and video tracks. An HTML asset-reference scan found no remote script, stylesheet, or image URLs. These checks do not establish full parity. Complex Excel formula compatibility, XLSX conditional-format variants outside the supported comparison fills, microphone capture, real media codec diversity, other apps' editing interactions, and in-game barricade interaction remain unverified.

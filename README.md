# Sigma Webapps
A client-side locally hosted tool suite you can run and bring anywhere!

## Overview
Sigma Webapps is a comprehensive collection of self-contained, client-side web tools designed to run entirely offline and locally via standard web browsers. It provides a unified hub for personal file management, encryption, document conversion, text extraction, multimedia editing, and offline gaming without requiring any backend server, Node.js runtime, Python server, Docker, database, or external cloud dependencies.

Each tool operates in modular isolation, running directly under `file://` or static file hosting, accessible through a central dashboard.

## File Structure:
```
SIGMA-WEBAPPS/
├── assets/
│   ├── modern-theme.css      # Dark warm glassmorphism design system
│   ├── Home.gif
│   ├── FileConvert.png, fileprev.jpg, NCS.jpg, OCR.png, passman.jpg
│   └── pdfcraft.svg, photocraft.svg, filmcraft.svg, wordcraft.svg, deckcraft.svg, gridcraft.svg, soundcraft.svg, zombies3d.svg
│
├── Main/
│   └── index.html            # Primary landing page launch point
├── index.html                # Root mirror landing page launch point
│
├── lib/                      # Bundled offline libraries (0 CDN dependencies)
│   ├── three.min.js          # Three.js 3D WebGL engine
│   ├── pdf.min.js            # PDF.js document viewer
│   ├── pdf-lib.min.js        # PDF generation & manipulation
│   ├── pptxgen.min.js        # PowerPoint presentation generator
│   ├── xlsx.full.min.js      # Excel spreadsheet processor
│   ├── mammoth.browser.min.js# DOCX parser & HTML converter
│   ├── ort.min.js            # ONNX Runtime Web for PaddleOCR
│   ├── jszip.min.js          # ZIP archive creation & extraction
│   └── fontkit.umd.min.js
│
├── SecureStorage/            # Encrypted PassMan vault & ZIPEncrypt archive studio
│   ├── index.html
│   ├── PassMan.js
│   ├── zipDecryptor.js       # Client-side ZipCrypto / WinZip AES / XOR .enc decryptor
│   ├── ZIPencrypt.html
│   └── style.css
│
├── FilePreview/              # Multi-format local viewer (PDF, PSD, Audio, Video, CSV, MD, Images)
│   ├── index.html
│   ├── FilePrev.js
│   ├── style.css
│   └── SpeedReader/          # RSVP focus reader & auto-scroller with WPM presets
│       ├── index.html
│       ├── script.js
│       └── style.css
│
├── LocalOCR/                 # Offline image OCR & preprocessing studio
│   ├── index.html
│   ├── OCR.js
│   ├── ocrPreprocessor.js    # Canvas Otsu binarization, contrast boost, noise reduction
│   ├── style.css
│   └── PaddleOCR/            # Offline ONNX Runtime Web OCR engine
│       ├── index.html
│       ├── script.js
│       └── style.css
│
├── FileConvert/              # Stirling-PDF style client-side conversion suite
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── converters/
│       ├── pdfOps.js         # Rotate, Organize, Watermark, Page Numbers, Compress, MD/PDF, CSV/Excel
│       ├── pdfMerge.js, pdfSplit.js, imagePdf.js, wordPdf.js, pptPdf.js, excelPdf.js, utils.js
│
├── RadioLocal/               # Offline audio player with 3-band EQ, 3-mode visualizer, and filter
│   ├── index.html
│   ├── RadioLocal.js
│   └── style.css
│
├── PdfCraft/                 # PDF workbench: page reordering, rotation, deletion, merging, annotations
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── PhotoCraft/               # Layered raster graphics editor with blend modes, drawing tools, filters
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── FilmCraft/                # Nonlinear video editor with multi-track timeline, splitting, canvas export
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── WordCraft/                # Word processor with A4 paper canvas, margins, themes, DOCX/HTML/MD export
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── DeckCraft/                # Presentation editor with 16:9 canvas, presenter slideshow (F5), PPTX export
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── GridCraft/                # Spreadsheet editor with dynamic formula engine (=SUM, =AVERAGE, =IF), XLSX export
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── SoundCraft/               # Digital Audio Workstation (DAW) with timeline, mic recording, EQ, WAV export
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── Zombies3D/                # 3D Call of Duty Zombies-inspired FPS survival game (Three.js & Web Audio SFX)
│   ├── index.html
│   ├── game.js
│   └── style.css
│
├── UPGRADE_PROGRESS.md       # Complete verification checklist & progress matrix
├── LICENSE
└── README.md
```

## How to Run Locally

Clone the repository:
```bash
git clone https://github.com/Print-JK/Sigma-Webapps.git
```
or download the repository as a ZIP and extract it.

### Launching the Application:
Simply open:
```
Sigma-Webapps/Main/index.html
```
(or `Sigma-Webapps/index.html`) directly in any modern browser (Chrome, Firefox, Safari, Edge, Brave, Android Chrome). No web server, Node.js, Python, or installation is needed!

---

## Tool Suites & Capabilities

### 1. SecureStorage (PassMan & ZIPEncrypt)
- **Password Manager (PassMan):** Encrypts and decrypts credentials stored in CSV format with Web Crypto AES-GCM. Features instant search filtering, password visibility toggles, and clipboard copy buttons.
- **Encrypted ZIP Importer:** Built-in client-side ZIP decryptor (`zipDecryptor.js`) supporting PKWARE ZipCrypto, WinZip AES-128/256, and custom XOR `.enc` files.
- **Key Selection Modal:** Automatically detects embedded `.key` files in imported ZIPs, displays file sizes and format validation, and allows interactive key selection with active key overwrite confirmation.
- **ZIPEncrypt:** Client-side ZIP archive encryption with direct preview of decrypted media.

### 2. FilePreview & SpeedReader
- **FilePreview:** Unified viewer for PDFs, PNG, JPG, GIF, WebP, PSD (Adobe Photoshop), MP4, WebM, MP3, WAV, CSV, Markdown, and plain text. Features drag-and-drop, keyboard navigation, and automatic memory cleanup (`URL.revokeObjectURL`).
- **SpeedReader:** Rapid Serial Visual Presentation (RSVP) streaming with focus guide and WPM presets (200, 350, 500, 750 WPM) or smooth auto-scroller. Fully compatible with `file://` execution.

### 3. LocalOCR & PaddleOCR
- **LocalOCR:** Extracts text from images and scanned documents with Tesseract.js.
- **Preprocessing Studio:** Built-in canvas preprocessing pipeline with Otsu adaptive binarization, contrast stretching, dark mode inversion, 0–360° rotation, and speckle noise reduction.
- **Features:** Before/After visual comparison drawer, confidence score badge, and one-click TXT/Markdown export.
- **PaddleOCR:** High-accuracy OCR powered by bundled ONNX Runtime Web (`lib/ort.min.js`) running completely offline.

### 4. FileConvert (Document Operations Suite)
- **PDF Suite:** Merge PDFs, Split PDFs, Rotate Pages, Organize (custom page ranges & deletion), Add Page Numbers, Diagonal Watermarks, and JPEG Canvas Compression.
- **Document & Image Conversions:** Images to PDF, PDF to Images, Markdown to PDF, and Bidirectional CSV <-> Excel conversion.
- **100% Client-Side:** Processes files in-browser with zero uploads or external servers.

### 5. RadioLocal
- **Audio Player:** Glassmorphic media card design inspired by the Dribbble design reference.
- **Equalizer:** 3-band parametric equalizer (Flat, Bass Boost, Treble Boost, Vocal Enhance).
- **Visualizer:** 3-mode real-time canvas visualizer (gold circular wave, frequency bars, and ambient pulse).
- **Features:** Filename filtering, playlist reordering, repeat/shuffle, and lockscreen MediaSession API controls.

### 6. ArtCraft Applications Suite
- **PdfCraft (`PdfCraft/`):** Full PDF workbench with thumbnail strip, page rotation, deletion, merging, vector annotation canvas (highlighter, freehand pen, rectangle, sticky notes), zoom controls, and export to new PDF via `pdf-lib`.
- **PhotoCraft (`PhotoCraft/`):** Layered raster graphics editor with layer stack (visibility, opacity, blend modes: normal/multiply/screen/overlay/darken/lighten/difference, reordering), drawing tools (brush, eraser, paint bucket fill, shapes, text, eyedropper), undo/redo history (`Ctrl+Z`/`Ctrl+Y`), color adjustments, and PNG/JPEG export.
- **FilmCraft (`FilmCraft/`):** Nonlinear video editor with media pool, multi-track timeline (Video 1, Video 2 Overlay, Audio 1), clip splitting at playhead (`S`), playhead scrubbing, live 16:9 canvas preview, and in-browser video export via MediaRecorder canvas capture.
- **WordCraft (`WordCraft/`):** Desktop word processor with authentic A4 paper canvas, margins (Normal, Narrow, Wide), paper themes (Classic White, Warm Parchment, Dark Canvas), formatting toolbar, table insertion, local image embedding, real-time statistics, DOCX import (`mammoth.browser.min.js`), and OOXML `.docx` generation (`jszip.min.js`).
- **DeckCraft (`DeckCraft/`):** Slide presentation studio with left slide list (add, duplicate, delete), 16:9 widescreen canvas with draggable text/shapes/images, fullscreen presenter mode (`F5`), JSON project save/load, and Microsoft PowerPoint `.pptx` export via bundled `pptxgen.min.js`.
- **GridCraft (`GridCraft/`):** Spreadsheet editor with 100x26 cell grid, dynamic formula evaluator (`=SUM`, `=AVERAGE`, `=COUNT`, `=MIN`, `=MAX`, `=IF`, basic arithmetic), text alignment, number formatting (currency, percentage, decimals), multi-sheet tabs, and Excel `.xlsx` / `.csv` import & export via bundled `xlsx.full.min.js`.
- **SoundCraft (`SoundCraft/`):** Digital Audio Workstation (DAW) with 4-track timeline, decoded audio waveform visualization, live microphone recording, clip trimming and splitting, per-track volume/pan/mute/solo, 3-band EQ, space reverb, real-time master FFT spectrum visualizer, and 16-bit PCM WAV master mixdown export.

### 7. Zombies3D (Call of Duty Zombies-Inspired FPS Survival)
- **3D Engine:** Three.js 3D rendering pipeline running 100% offline from bundled `lib/three.min.js`.
- **Atmosphere:** Underground bunker with emergency red beacon, corner lamps, support pillars, crates, and volumetric fog.
- **Controls:** Pointer Lock mouse look, WASD movement, Sprint (`Shift`), Jump (`Space`), and collision detection.
- **Zombies AI:** Round-based spawner with progressive difficulty, zombie health, speed, and spawn counts per round. Humanoid 3D meshes with glowing yellow eyes, limping animation cycle, path pursuit, and melee attacks.
- **Weapons:** M1911 Pistol, Trench Shotgun, and Assault Rifle. Raycast shooting with headshot damage multiplier, recoil kick, muzzle flash, spark particles, ammo counter, and reload timer (`R`).
- **Economy & Wall Buys:** Points system (+10 per hit, +60 per kill, +100 per headshot). Wall buy stations for Trench Shotgun (500 pts), Assault Rifle (1200 pts), Ammo, and Juggernog perk machine (250 HP, 2500 pts).
- **Sound & Audio:** 100% procedural Web Audio API synthesis (gunshots, reload, zombie growls, melee hits, damage grunts, round start sting, purchase chimes) — zero external audio files needed.
- **HUD:** Round indicator, points counter, crosshair with dynamic hitmarker (white for body, red for headshot), health bar, weapon & ammo display, and Game Over screen with stats and restart.

---

## Technical Design & Privacy Principles
- **100% Local-First:** No telemetry, analytics, remote logging, or hidden network requests.
- **Serverless & Zero-Build:** All tools execute directly in standard browsers via `file://`.
- **Offline Dependency Policy:** Zero CDN imports. All libraries (`three.min.js`, `pdf-lib.min.js`, `xlsx.full.min.js`, `pptxgen.min.js`, `mammoth.browser.min.js`, `ort.min.js`, `jszip.min.js`) are locally bundled in `lib/`.
- **Memory Safety:** Automatic cleanup of object URLs and canvas contexts prevents memory bloat during prolonged sessions.

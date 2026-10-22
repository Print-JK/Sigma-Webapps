# Sigma Webapps — Master Project Upgrade Report & Architecture Tracker

## Project Overview
- **Project Name:** Sigma Webapps
- **Repository:** https://github.com/Print-JK/Sigma-Webapps
- **Core Architecture:** 100% Local-first, serverless, modular browser tools designed to launch directly via `file://` or static file hosting without any mandatory backend, Python/Node server, build step, or cloud service.
- **Entry Points:**
  - `Main/index.html` (Primary intended launch point)
  - `index.html` (Root mirror launch point)
  - Direct launch for any tool directory (e.g. `SecureStorage/index.html`, `Zombies3D/index.html`, etc.)

---

## Second-Pass Engineering Tracker & Fidelity Repairs

### Priority 1: RadioLocal Hidden Interface Bar & Contrast Fixes
- **Root Cause 1 (Layout Overflow):** `#wrapper` was sized with `height: calc(100% - var(--player-bar-height))` while the body had `display: flex; flex-direction: column; overflow: hidden;` containing 3 children: `.top-bar-container` (48px), `#wrapper`, and `.player-bar` (84px). Because `#wrapper` did not account for `.top-bar-container`'s 48px height, the cumulative height exceeded the viewport by exactly 48px, pushing `.player-bar` partially/completely off-screen.
- **Root Cause 2 (CSS Variable Cycle & Invisibility):** In `RadioLocal/style.css`, `--text-main: var(--text-main, #f5f5f7);` was defined inside `:root`. Under CSS Custom Properties Level 1 specification, referencing a custom property within its own fallback creates an invalid computed-value cycle, causing the property to become unset and default to black text (`#000000`). On the dark charcoal/black background, this rendered the playlist titles, track labels, and hamburger lines virtually invisible.
- **Root Cause 3 (Sidebar Off-Canvas Bleed & Mobile Overlap):** Sizing `#sidebar-wrapper` with `width: 0;` caused content to overflow and leak onto the canvas. On mobile screens (<480px), the player transport controls bar exceeded screen width due to hardcoded flex percentage bases (`flex: 0 0 160px;`).
- **Files Changed:** `RadioLocal/style.css`, `RadioLocal/RadioLocal.js`, `RadioLocal/index.html`
- **Remedies Applied:**
  - Resolved circular CSS variable by explicitly declaring `--text-main: #f5f5f7;` and `--text-bright: #ffffff;`.
  - Styled floating hamburger button as a clean glass circle with crisp white icon lines (`#ffffff`).
  - Converted `#wrapper` to `flex: 1; min-height: 0; width: 100%;` and pinned `.player-bar` with `flex-shrink: 0; min-height: var(--player-bar-height);`.
  - Added `flex-shrink: 0; height: var(--top-bar-height);` to `.top-bar-container`.
  - Converted `#sidebar-wrapper` off-canvas behavior to GPU-accelerated `transform: translateX(-100%);` with smooth 0.35s ease transition.
  - Sized mobile player bar with flexible containers (`flex: 0 1 110px`, `flex: 1 1 auto; max-width: none;`).
  - Added Android safe-area padding `env(safe-area-inset-bottom)` and short viewport `@media (max-height: 480px)` breakpoint.
- **Verification:** Verified via Chromium headless CDP on desktop (1280x800) and Android mobile (390x844). Bounding rects confirm `topBar` (0–48px), `wrapper` (48–629px), and `playerBar` (629–713px) with `isFullyVisible: true` and all transport controls (shuffle, prev, play/pause, next, repeat, volume, scrubber) interactive. High contrast text and controls verified via screenshot captures.

### Priority 2: Apple Liquid Glass Design System & Non-Craft Apps UI Alignment
- **Design Philosophy:** Faithful realization of Apple's official Liquid Glass specifications ([WWDC / SwiftUI Human Interface](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)). Translucent layered materials, dynamic refraction hints, physical specular edge highlights (`inset 0 1px 1px 0 rgba(255,255,255,0.32)`), and concentric geometry.
- **Theme Standardization Across All Non-Craft Tools:**
  To ensure visual unity across the entire suite, all non-craft utilities have been redesigned to match RadioLocal's dark slate palette and centered floating Liquid Glass pill bar navigation:
  - **`SecureStorage` (`PassMan` & `ZIPEncrypt`):**
    - Replaced the confusing slider checkbox with a centered Liquid Glass pill nav: `⌂ Home | 🔐 PassMan | 🗜️ ZIPEncrypt | AES-GCM Local`.
    - Added responsive `.main-container`, glass cards with specular highlights, and Apple System Blue buttons (`#0a84ff`).
    - Standardized `ZIPencrypt.html` to share identical `--bg-base`, `--glass-bg`, and button styles.
  - **`FilePreview`:**
    - Centered top navigation pill bar (`⌂ Home | 📂 FilePrev | ⚡ SpeedReader | Local Offline`).
    - Moved `📄 Choose File` and `📁 Choose Folder` directly inside the sidebar drawer header, eliminating top header clutter.
    - Integrated mobile drawer toggle `☰ Files` into the floating pill bar, avoiding overlap.
  - **`SpeedReader`:**
    - Centered top pill navbar outside `#wrapper` with integrated `☰ Settings` toggle pill.
    - Converted sidebar to hardware-accelerated `transform: translateX(-100%)`.
    - Modernized word display stage into a concentric glass card with Apple System Blue controls.
  - **`LocalOCR` & `PaddleOCR`:**
    - Standardized centered Liquid Glass pill navigation.
    - Added mobile hiding rules (`.nav-pipe-mobile-hide`, `.hide-mobile`) preventing pill bar wrapping on 375px screens.
    - Unified glass panels for preprocessing controls, Before/After preview drawer, and results viewer.
  - **`FileConvert`:**
    - Centered `.top-nav-bar` to standard 48px height matching RadioLocal.
    - Applied `--bg-primary: var(--bg-base)` and Liquid Glass cards with subtle hover elevations.
- **Clear Layer Separation:** Glass is strictly reserved for the navigation and control layer (floating pill bars, toolbars, sheets, action bars, modal dialogs). Data content viewports (A4 paper in WordCraft, spreadsheet cells in GridCraft, PDF viewport in PdfCraft, drawing canvas in PhotoCraft, DAW clips in SoundCraft) maintain high-contrast, opaque legibility.
- **Accessibility:** Built-in automatic degradation for `@media (prefers-reduced-transparency: reduce)` (replaces translucency with solid high-contrast backgrounds) and `@media (prefers-reduced-motion: reduce)`.

### Priority 2.1: Reverse Engineering Anything (REA) Skills Integration
- Integrated 5 specialized REA skills into `.agents/skills/` and global configurations:
  - `reverse-engineer-anything`: Reverse engineer native, managed, Electron/JS, packaged, firmware, and browser targets.
  - `rea-tool-design`: Design or modify REA tools, CLI/MCP contracts, and Evidence semantics.
  - `rea-analysis-optimization`: Optimize analysis workflows for context, latency, CPU, and memory.
  - `rea-ci-tests-audit`: Audit CI and test suites for correctness, fixture drift, and measured performance.
  - `rea-changelog-update`: Changelog preparation from Git history with contributor attribution.

### Priority 3: 7 Craft Applications Fidelity Audit & Strengthening
- **Upstream Audit:** Researched the upstream **ArtCraft** organization ([`github.com/storytold`](https://github.com/storytold)) and its suite (`pdfcraft`, `photocraft`, `filmcraft`, `wordcraft`, `deckcraft`, `gridcraft`, `soundcraft`). Documented the Rust/egui/WASM architecture and mapped data models to browser-native standards in `CRAFT_FIDELITY_AUDIT.md`.
- **Feature Enhancements Applied:**
  - `PdfCraft`: Added dynamic page reordering (Move Up ▲ / Move Down ▼) with synchronized `pdf-lib` document recreation and PDF.js thumbnail re-rendering.
  - `GridCraft`: Expanded formula evaluation engine to support `=PRODUCT()`, `=MEDIAN()`, and `=CONCATENATE()`, along with existing arithmetic, `=SUM()`, `=AVERAGE()`, `=COUNT()`, `=MIN()`, `=MAX()`, and logical `=IF()`.
  - `DeckCraft`: Added z-index element layering controls (▲ Forward / ▼ Backward) to reorder presentation elements in both the live editing stage and full-screen presenter mode.
  - `PhotoCraft`: Audited 7-blend mode layer compositor, scanline flood fill, undo/redo state stack, and math-accurate adjustment filters (brightness, contrast, invert, grayscale, sepia).
  - `WordCraft`: Confirmed ISO/IEC 29500 OpenXML `.docx` package creation via JSZip, Mammoth import, A4 page margins, and rich typography.
  - `FilmCraft`: Verified multi-track timeline, frame-accurate timecode (`HH:MM:SS:FF`), razor split tool (`S`), and in-browser MediaRecorder video export.
  - `SoundCraft`: Verified 4-track Web Audio mixer, stereo panning, solo/mute routing, live microphone recording, biquad EQ, reverb delay, and 16-bit linear PCM WAV master rendering.

### Priority 4: 3D Zombies Survival Game Repairs & Assets
- **Camera Euler Defect Root Cause:** The camera was previously rotated with default `'XYZ'` Euler order via `camera.rotation.y = yaw; camera.rotation.x = pitch;` while shooting raycasts used a separate Euler instance with `'YXZ'` order. This mismatch caused gimbal drift, tilt roll instability, and bullet raycasts that diverged from the screen crosshair.
- **Camera Repairs:**
  - Configured `camera.rotation.order = "YXZ"` on camera initialization.
  - Unified orientation update to `camera.rotation.set(player.pitch, player.yaw, 0, "YXZ")`.
  - Raycaster now derives its origin and direction directly from `camera.getWorldDirection()` and camera orientation vectors (`right` / `up` from `camera.quaternion`), guaranteeing 100% crosshair alignment.
  - Added mouse delta sanitization (`Math.abs(delta) > 250px` discard) to prevent initial snap/flip glitches on pointer lock acquisition.
  - Added window `blur` and pointer lock release handlers to reset input keys and firing state, preventing continuous sliding.
- **Visual Assets & Articulated Models:**
  - Replaced flat solid box geometry with procedurally generated high-detail Canvas2D textures: Bunker Floor (expansion seams & aggregate), Bunker Walls (horizontal masonry courses & water streaks), Hazard Pillars (diagonal warning bands), and Military Supply Crates (wood planks, steel brackets, stenciled markings).
  - Built multi-part 3D viewmodels for all 5 weapons (M1911 Pistol, Trench Shotgun, Assault Rifle, Ray Gun, Heavy Machine Gun) with dynamic switching on slot selection.
  - Upgraded zombie meshes into articulated hierarchical groups with jointed neck, shoulder, and hip pivots, executing authentic limping stride animations, reaching arm clawing, and head twitches during pursuit.
- **Call of Duty Zombies Mechanics (inspired by CoD / NZPortable):**
  - **Wonder Weapon (Ray Gun):** 3D crimson viewmodel, firing emerald green plasma blasts with explosive splash damage and procedural Web Audio laser chirp sweeps.
  - **Heavy Machine Gun (HMG):** Rapid-fire suppressive automatic weapon with 60-round drum magazine.
  - **Mystery Box:** Interactive 3D crate with glowing `??` symbols and interior light. 950 pts roulette with 3.5s weapon cycling animation, sound jingle, weighted probabilities, and 10s collection window.
  - **Perk Machines:** Speed Cola (3000 pts, cuts reload duration in half) and Juggernog (2500 pts, expands health to 250 HP).
  - **Power-Up Drops (15% drop rate):** Max Ammo (reserves refilled), Insta-Kill (1-hit kills for 30s), Nuke (screen flash, smart bomb detonation, +400 pts), Double Points (2x score for 30s). Modeled as rotating 3D emblems with aura rings and point lights, 6s despawn blinking, HUD announcer banner, and badge countdown timers.
  - **Authentic CoD Round Tally Marks:** Rounds 1–5 rendered as chalk hash marks (`I`, `II`, `III`, `IIII`, `<span class="tally-slash">IIII</span>`), rounds 6+ rendered in classic blood-red stencil numerals.
- **Documentation:** Created `GAME_ASSETS_AND_LICENSES.md` detailing asset generation algorithms, Three.js shaders, Web Audio synthesizer architectures, and MIT/CC0 open-source licensing.

---

## Tool Feature Matrix & Implementation Status

| Tool | Status | Type | Technical Implementation | Offline / `file://` Verified |
| :--- | :--- | :--- | :--- | :--- |
| **Main Landing Page** | **Implemented** | Landing Page | Original black hero design preserved; links to all 13 tools | Yes |
| **PassMan / SecureStorage** | **Implemented** | Encryption & Keys | Encrypted ZIP importer (ZipCrypto, WinZip AES-128/256, XOR .enc), multi-key selector modal, Web Crypto AES-GCM | Yes |
| **ZIPEncrypt** | **Implemented** | Archive Security | Dark glassmorphism pill UI, client-side ZIP encryption/decryption, FilePreview cross-link | Yes |
| **FilePreview** | **Implemented** | Multi-Format Viewer | PDF, PSD, Audio, Video, CSV, Markdown, Images; Object URL lifecycle cleanup; keyboard navigation | Yes |
| **SpeedReader** | **Implemented** | Reading Utility | RSVP streaming with focus guide, WPM presets (200, 350, 500, 750), PDF native text stream fallback | Yes |
| **LocalOCR** | **Implemented** | Document Vision | Canvas preprocessing studio (Otsu binarization, contrast boost, invert, deskew, noise reduction), Before/After drawer, TXT/MD export | Yes |
| **PaddleOCR** | **Implemented** | High-Accuracy OCR | ONNX Runtime Web (`lib/ort.min.js`), preprocessing studio, local bundle without remote CDNs | Yes |
| **FileConvert** | **Implemented** | Document Suite | Stirling-PDF/iLovePDF expansion: Merge, Split, Rotate, Organize, Watermark, Page Numbers, Compress, MD to PDF, CSV <-> Excel | Yes |
| **RadioLocal** | **Implemented** | Media Player | Dribbble glassmorphic media card, 3-band EQ, 3-mode visualizer (gold ring wave, bars, pulse), MediaSession API | Yes |
| **PdfCraft** | **Implemented** | PDF Workbench | Page thumbnails strip, rotation, deletion, merging, vector annotation canvas (pen, highlight, rect, notes), pdf-lib export | Yes |
| **PhotoCraft** | **Implemented** | Graphic Studio | Layer stack (blend modes, opacity, visibility, reorder), drawing tools (brush, eraser, fill bucket, shapes, text), undo/redo, PNG/JPEG export | Yes |
| **FilmCraft** | **Implemented** | Video Editor | Nonlinear multi-track timeline (Video 1, Video 2, Audio 1), clip splitting, dragging, live 16:9 canvas preview, MediaRecorder video export | Yes |
| **WordCraft** | **Implemented** | Word Processor | Standard A4 paper canvas, margins, parchment/dark themes, rich formatting, tables, image insertion, DOCX (Mammoth/JSZip) & PDF export | Yes |
| **DeckCraft** | **Implemented** | Slide Studio | 16:9 widescreen canvas, multi-slide thumbnails, draggable text/shapes/images, fullscreen presenter mode (F5), PPTXGenJS export | Yes |
| **GridCraft** | **Implemented** | Spreadsheet Suite | 100x26 cell grid, formula engine (=SUM, =AVERAGE, =COUNT, =MIN, =MAX, =IF), formatting, multi-sheet tabs, XLSX/CSV export | Yes |
| **SoundCraft** | **Implemented** | Audio DAW | 4-track timeline, waveform rendering, live mic recording, 3-band EQ, space reverb, master FFT spectrum visualizer, 16-bit PCM WAV export | Yes |
| **Zombies3D** | **Implemented** | 3D Survival Game | Three.js bunker arena, first-person controller, round zombie spawner, raycast shooting, M1911/Shotgun/Rifle/RayGun/HMG, perks (Juggernog & Speed Cola), mystery box, power-ups, procedural Web Audio SFX | Yes |

---

## Detailed Upgrade Summary

### 1. Modern Design System (`assets/modern-theme.css`)
- **Visual Reference:** Modeled after the luxury dark warm glassmorphism dashboard reference.
- **Palette:** Deep charcoal/espresso background (`#11100f`), frosted glass cards (`rgba(28,26,25,0.72)` with `backdrop-filter: blur(20px)`), glowing accents (emerald green `#10b981`, electric blue `#3b82f6`, warm gold `#d4af37`, crimson `#ef4444`).
- **Components:** Floating pill navigation bars, status indicator dots, sleek buttons, custom range sliders, modal overlays, responsive breakpoints for mobile/Android touch screens.
- **Main Landing Page Exception:** Root `index.html` and `Main/index.html` retain their original stark black layout, hero gif, and card grid, now populated with cards for all 13 tools.

### 2. Upgraded Existing Tools
- **SecureStorage & ZIPEncrypt:**
  - Added `SecureStorage/zipDecryptor.js` with client-side decryption for standard ZipCrypto, WinZip AES-128/256 via Web Crypto PBKDF2/AES-CTR, and custom XOR `.enc` files.
  - Interactive password prompt distinguishing between archive password and vault key password.
  - Multi-key detection and selection modal allowing users to inspect detected `.key` files (file size, format validation) and select their target key.
  - PassMan search filter, eye toggle for password reveal, clipboard copy, and zero network leakage.
- **FilePreview & SpeedReader:**
  - Added drag-and-drop onto the main preview stage, keyboard navigation (`ArrowUp`/`ArrowDown`), and object URL lifecycle cleanup (`URL.revokeObjectURL`).
  - SpeedReader updated with PDF.js worker fallback for `file://` compatibility, RSVP word streaming, and speed presets (200 to 750 WPM).
- **LocalOCR & PaddleOCR:**
  - Added `LocalOCR/ocrPreprocessor.js`: Otsu adaptive binarization, contrast adjustment, invert for dark mode screenshots, rotation 0–360°, speckle noise reduction.
  - Before/After interactive preview drawer, confidence score badge, TXT and Markdown export.
  - PaddleOCR converted to run fully offline using bundled `lib/ort.min.js` and removed remote CDN dependencies.
- **FileConvert:**
  - Fixed PDF.js worker instantiation under `file://` by providing synchronous main-thread execution fallback.
  - Expanded tools with `converters/pdfOps.js`: PDF Rotate, PDF Organize (reorder/delete pages), Page Numbers, Diagonal Watermarks, PDF JPEG Compression, Markdown to PDF, and Bidirectional CSV <-> Excel conversion.
- **RadioLocal:**
  - Upgraded to dark glassmorphic media player widget.
  - Added 3-band Equalizer (flat, bass boost, treble boost, vocal enhance).
  - Built 3-mode real-time visualizer (gold circular wave, frequency bars, ambient pulse).
  - Memory cleanup and mobile lockscreen MediaSession API integration.
  - **Second-Pass Repair (Priority 1): Hidden Player Bar Layout Defect Fixed**
    - *Root Cause:* `#wrapper` was sized with `height: calc(100% - var(--player-bar-height))` while the body had `display: flex; flex-direction: column; overflow: hidden;` containing 3 children: `.top-bar-container` (48px), `#wrapper`, and `.player-bar` (84px). Because `#wrapper` did not account for `.top-bar-container`'s 48px height, the cumulative height exceeded the viewport by exactly 48px, pushing `.player-bar` partially/completely off-screen.
    - *Files Changed:* `RadioLocal/style.css`
    - *Remedy:* Converted `#wrapper` to `flex: 1; min-height: 0; width: 100%;` and pinned `.player-bar` with `flex-shrink: 0; min-height: var(--player-bar-height);`. Added `flex-shrink: 0; height: var(--top-bar-height);` to `.top-bar-container`. Added Android safe-area padding `env(safe-area-inset-bottom)` and short viewport `@media (max-height: 480px)` breakpoint.
    - *Verification:* Verified via Chromium headless CDP on desktop (1280x800) and Android mobile (390x844). Bounding rects confirm `topBar` (0–48px), `wrapper` (48–629px), and `playerBar` (629–713px) with `isFullyVisible: true` and all transport controls (shuffle, prev, play/pause, next, repeat, volume, scrubber) interactive.

### 3. Craft Applications Suite
- **PdfCraft (`PdfCraft/`):** Full PDF workbench with left thumbnail strip, page rotation, deletion, PDF merging, vector annotation canvas (highlighter, pen, rectangle, text notes), and PDF export via `pdf-lib`.
- **PhotoCraft (`PhotoCraft/`):** Layered raster image editor with layer visibility, opacity, blend modes (normal, multiply, screen, overlay, darken, lighten, difference), drawing tools (brush, eraser, paint bucket fill, shapes, text, eyedropper), undo/redo stack, and PNG/JPEG export.
- **FilmCraft (`FilmCraft/`):** Nonlinear video editor with project media pool, multi-track timeline (Video 1, Video 2 Overlay, Audio 1), clip splitting at playhead (`S`), playhead scrubbing, live 16:9 canvas preview, and in-browser video export via MediaRecorder canvas capture.
- **WordCraft (`WordCraft/`):** Desktop word processor with authentic A4 paper canvas, margin controls (Normal, Narrow, Wide), paper themes (Classic White, Warm Parchment, Dark Canvas), formatting toolbar, table insertion, local image embedding, real-time statistics, DOCX import (`mammoth.browser.min.js`), and OOXML `.docx` generation (`jszip.min.js`).
- **DeckCraft (`DeckCraft/`):** Slide presentation studio with left slide list (add, duplicate, delete), 16:9 widescreen canvas with draggable text/shapes/images, fullscreen slideshow mode (`F5`), JSON project save/load, and Microsoft PowerPoint `.pptx` export via bundled `pptxgen.min.js`.
- **GridCraft (`GridCraft/`):** Spreadsheet editor with 100x26 cell grid, dynamic formula evaluator (`=SUM`, `=AVERAGE`, `=COUNT`, `=MIN`, `=MAX`, `=IF`, basic arithmetic), text alignment, number formatting (currency, percentage, decimals), multi-sheet tabs, and Excel `.xlsx` / `.csv` import & export via bundled `xlsx.full.min.js`.
- **SoundCraft (`SoundCraft/`):** Digital Audio Workstation (DAW) with 4-track timeline, decoded audio waveform visualization, live microphone recording, clip trimming and splitting, per-track volume/pan/mute/solo, 3-band EQ, space reverb, real-time master FFT spectrum visualizer, and 16-bit PCM WAV master mixdown export.

### 4. 3D Zombies Survival Game (`Zombies3D/`)
- **Engine:** Three.js 3D rendering pipeline running 100% locally from bundled `lib/three.min.js`.
- **Arena:** Dark, atmospheric 50x50m underground bunker with emergency red beacon, corner lamps, support pillars, crates, and volumetric fog.
- **First-Person Controller:** Pointer Lock Controls with mouse look, WASD movement, Sprint (`Shift`), Jump (`Space`), and collision detection against arena walls and pillars. Strict `YXZ` Euler orientation eliminates camera roll or crosshair misalignment.
- **Zombies AI:** Round-based spawner with progressive difficulty, zombie health, speed, and spawn counts per round. Articulated humanoid 3D meshes with glowing yellow eyes, jointed limping animation cycle, path pursuit, and melee attacks.
- **Weapons Arsenal:** M1911 Pistol, Trench Shotgun, Assault Rifle, Ray Gun (wonder weapon with splash damage), and Heavy Machine Gun (60-round drum magazine). Raycast shooting with headshot damage multiplier, recoil kick, muzzle flash, spark particles, ammo counter, and reload timer (`R`).
- **Economy, Wall Buys, Perks & Mystery Box:**
  - Points system (+10 per hit, +60 per kill, +100 per headshot, +400 for Nuke, 2x during Double Points).
  - Wall buy stations for Trench Shotgun (500 pts), Assault Rifle (1200 pts), Ammo refill.
  - Perk machines: Juggernog (2500 pts, expands max HP to 250) and Speed Cola (3000 pts, cuts reload duration in half).
  - Mystery Box: 3D interactive crate (950 pts) with animated lid opening, cycling weapon roulette, weighted probabilities, and 10s collection window.
- **Power-Up Drops (15% drop rate):** Max Ammo (reserves refilled), Insta-Kill (1-hit kills for 30s), Nuke (kills active zombies + 400 pts + white screen flash), Double Points (2x score for 30s). Modeled as rotating 3D emblems with aura rings, point lights, 6s despawn blinking, HUD announcer banner, and badge countdown timers.
- **Sound & Audio:** 100% procedural Web Audio API synthesis (gunshots, reload, zombie growls, melee hits, damage grunts, round start sting, purchase chimes, Ray Gun plasma chirp, mystery box jingle, power-up arpeggios, and nuke detonation) — zero external audio files needed.
- **HUD:** Round indicator with authentic chalk tally marks (`I`, `II`, `III`, `IIII`, `<span class="tally-slash">IIII</span>`, red numbers for round 6+), points counter, crosshair with dynamic hitmarker (white for body, red for headshot), health bar, weapon & ammo display, power-up badges, and Game Over screen with stats and restart.

---

## Verification & Compatibility Checklist
- [x] Strict local-first architecture: No Node.js server, Python server, backend API, Docker, or build step required.
- [x] Launchable directly from `Main/index.html` or `index.html` via `file://`.
- [x] Zero external CDN links in tool sources (no unpkg, jsdelivr, cdnjs, Google Fonts).
- [x] All libraries locally bundled in `lib/` (`three.min.js`, `pdf.min.js`, `pdf-lib.min.js`, `xlsx.full.min.js`, `pptxgen.min.js`, `mammoth.browser.min.js`, `ort.min.js`, `jszip.min.js`).
- [x] PDF.js worker fallback for `file://` security policy in FileConvert, LocalOCR, and SpeedReader.
- [x] All JavaScript files validated with Node.js syntax checker (0 syntax errors).
- [x] Android/desktop responsive touch controls and dark warm glassmorphism UI.

# FileConvert (prototype)

A fully client-side file conversion & merging tool. Everything — reading,
transforming, and writing files — happens in your browser. Nothing is
uploaded anywhere, and the app makes **zero network calls** at runtime.

## Running it

No build step needed. From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. (Opening the file directly
via `file://` also works for most tools; a local server avoids occasional
`file://` fetch restrictions in some browsers.)

## What's implemented

| Conversion | Engine | Fidelity |
|---|---|---|
| Merge PDF | pdf-lib | High |
| Split PDF (ranges or per-page) | pdf-lib | High |
| JPG/PNG → PDF | pdf-lib | High |
| PDF → JPG/PNG | pdf.js (render to canvas) | High |
| PDF → PowerPoint | pdf.js + pptxgenjs (page image per slide) | Good |
| Word → PDF | mammoth.js (docx→HTML) + pdf-lib (text layout) | Good |
| Excel → PDF | SheetJS + pdf-lib (ruled table) | Good |
| PowerPoint → PDF | JSZip (read OOXML) + pdf-lib | Best-effort |
| PDF → Word | pdf.js (text extraction) + hand-written minimal .docx | Best-effort |
| PDF → Excel | pdf.js (text extraction, heuristic columns) + SheetJS | Best-effort |

"Best-effort" conversions recover **content**, not original layout/design —
this is a fundamental limitation of doing rich-format reconstruction
entirely in the browser without a real layout/rendering engine for the
source format. The UI surfaces a warning on these tools.

## Project layout

```
index.html            App shell / tool grid / workspace panel
styles.css            Dark theme (matches provided token set)
app.js                UI wiring only — no conversion logic
converters/
  utils.js            Shared helpers (file reading, zipping, PDF rendering)
  pdfMerge.js          Merge PDF
  pdfSplit.js          Split PDF
  imagePdf.js          JPG/PNG <-> PDF
  wordPdf.js           Word <-> PDF
  pptPdf.js            PowerPoint <-> PDF
  excelPdf.js          Excel <-> PDF
vendor/                Local, pre-bundled copies of the libraries below —
                       no CDN references, no runtime downloads.
  pdf-lib.min.js        (PDF creation/editing)          window.PDFLib
  pdf.min.js            (PDF parsing/rendering)          window.pdfjsLib
  pdf.worker.min.js     (pdf.js background worker)
  mammoth.browser.min.js (docx -> HTML)                  window.mammoth
  pptxgen.min.js        (pptx generation)                window.PptxGenJS
  jszip.min.js          (zip/OOXML read+write)           window.JSZip
  xlsx.full.min.js      (xlsx read/write — SheetJS)       window.XLSX
```

Each converter is a self-contained module attached to `window.Converters`,
so adding a new conversion later just means dropping in a new file and
registering it in `app.js`'s `TOOLS` array — no changes needed elsewhere.

## Known rough edges (good next iterations)

- PDF → Word/Excel column & paragraph detection is heuristic (based on
  text-item x/y gaps from pdf.js) — works fine on simple layouts, breaks on
  multi-column or densely spaced content.
- PPTX → PDF only recovers text runs + raster images (PNG/JPEG); vector
  shapes, charts, and EMF/WMF images are currently skipped.
- Word → PDF layout is a single-column reflow — original tables, multi-
  column sections, and embedded images aren't carried over yet.
- No password/encrypted-file handling yet.

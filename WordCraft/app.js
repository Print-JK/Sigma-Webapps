/**
 * WordCraft — Word Processor Engine
 * Pure client-side document authoring, DOCX/HTML/MD import & export, and real-time formatting.
 */

(function () {
  "use strict";

  // Elements
  const wordCanvas = document.getElementById("wordCanvas");
  const docTitleInput = document.getElementById("docTitle");
  const wordCountEl = document.getElementById("wordCount");
  const charCountEl = document.getElementById("charCount");
  const readTimeEl = document.getElementById("readTime");
  const saveStatusEl = document.getElementById("saveStatus");

  // Format Dropdowns & Pickers
  const fontFamilySelect = document.getElementById("fontFamilySelect");
  const fontSizeSelect = document.getElementById("fontSizeSelect");
  const headingSelect = document.getElementById("headingSelect");
  const textColorPicker = document.getElementById("textColorPicker");
  const hiliteColorPicker = document.getElementById("hiliteColorPicker");
  const marginSelect = document.getElementById("marginSelect");
  const themeSelect = document.getElementById("themeSelect");

  // File Controls
  const fileInput = document.getElementById("fileInput");
  const imageInput = document.getElementById("imageInput");
  const btnExportMenu = document.getElementById("btnExportMenu");
  const exportDropdown = document.getElementById("exportDropdown");

  // Find & Replace
  const findReplacePanel = document.getElementById("findReplacePanel");
  const findInput = document.getElementById("findInput");
  const replaceInput = document.getElementById("replaceInput");

  // State
  const STORAGE_KEY = "sigma_wordcraft_doc";
  const TITLE_KEY = "sigma_wordcraft_title";

  // ExecCommand Helper
  function format(command, value = null) {
    document.execCommand(command, false, value);
    wordCanvas.focus();
    updateStats();
  }

  // Bind Ribbon Actions
  document.getElementById("btnUndo").addEventListener("click", () => format("undo"));
  document.getElementById("btnRedo").addEventListener("click", () => format("redo"));
  document.getElementById("btnBold").addEventListener("click", () => format("bold"));
  document.getElementById("btnItalic").addEventListener("click", () => format("italic"));
  document.getElementById("btnUnderline").addEventListener("click", () => format("underline"));
  document.getElementById("btnStrike").addEventListener("click", () => format("strikeThrough"));
  document.getElementById("btnSub").addEventListener("click", () => format("subscript"));
  document.getElementById("btnSuper").addEventListener("click", () => format("superscript"));
  document.getElementById("btnClearFormat").addEventListener("click", () => format("removeFormat"));

  // Alignments
  document.getElementById("btnAlignLeft").addEventListener("click", () => {
    format("justifyLeft");
    updateAlignButtons("left");
  });
  document.getElementById("btnAlignCenter").addEventListener("click", () => {
    format("justifyCenter");
    updateAlignButtons("center");
  });
  document.getElementById("btnAlignRight").addEventListener("click", () => {
    format("justifyRight");
    updateAlignButtons("right");
  });
  document.getElementById("btnAlignJustify").addEventListener("click", () => {
    format("justifyFull");
    updateAlignButtons("justify");
  });

  function updateAlignButtons(align) {
    document.getElementById("btnAlignLeft").classList.toggle("active", align === "left");
    document.getElementById("btnAlignCenter").classList.toggle("active", align === "center");
    document.getElementById("btnAlignRight").classList.toggle("active", align === "right");
    document.getElementById("btnAlignJustify").classList.toggle("active", align === "justify");
  }

  // Lists & Indents
  document.getElementById("btnBulletList").addEventListener("click", () => format("insertUnorderedList"));
  document.getElementById("btnNumberList").addEventListener("click", () => format("insertOrderedList"));
  document.getElementById("btnOutdent").addEventListener("click", () => format("outdent"));
  document.getElementById("btnIndent").addEventListener("click", () => format("indent"));
  document.getElementById("btnInsertHr").addEventListener("click", () => format("insertHorizontalRule"));

  // Font & Size
  fontFamilySelect.addEventListener("change", (e) => format("fontName", e.target.value));
  fontSizeSelect.addEventListener("change", (e) => format("fontSize", e.target.value));

  // Headings
  headingSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    format("formatBlock", `<${val}>`);
  });

  // Colors
  textColorPicker.addEventListener("input", (e) => format("foreColor", e.target.value));
  hiliteColorPicker.addEventListener("input", (e) => format("hiliteColor", e.target.value));

  // Link Insertion
  document.getElementById("btnInsertLink").addEventListener("click", () => {
    const url = prompt("Enter hyperlink URL:", "https://");
    if (url) {
      format("createLink", url);
    }
  });

  // Table Insertion
  document.getElementById("btnInsertTable").addEventListener("click", () => {
    const rows = parseInt(prompt("Number of rows:", "3") || "3", 10);
    const cols = parseInt(prompt("Number of columns:", "3") || "3", 10);
    if (rows > 0 && cols > 0) {
      let tableHtml = "<table><thead><tr>";
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<th>Header ${c}</th>`;
      }
      tableHtml += "</tr></thead><tbody>";
      for (let r = 1; r <= rows; r++) {
        tableHtml += "<tr>";
        for (let c = 1; c <= cols; c++) {
          tableHtml += `<td>Cell ${r},${c}</td>`;
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</tbody></table><p></p>";
      format("insertHTML", tableHtml);
    }
  });

  // Image Insertion
  document.getElementById("btnInsertImage").addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgHtml = `<p><img src="${e.target.result}" alt="Document Image" style="max-width: 100%; border-radius: 4px;" /></p><p></p>`;
        format("insertHTML", imgHtml);
      };
      reader.readAsDataURL(file);
      imageInput.value = "";
    }
  });

  // Margins & Themes
  marginSelect.addEventListener("change", (e) => {
    wordCanvas.classList.remove("margin-narrow", "margin-wide");
    if (e.target.value === "narrow") wordCanvas.classList.add("margin-narrow");
    else if (e.target.value === "wide") wordCanvas.classList.add("margin-wide");
  });

  themeSelect.addEventListener("change", (e) => {
    wordCanvas.classList.remove("theme-parchment", "theme-dark");
    if (e.target.value === "parchment") wordCanvas.classList.add("theme-parchment");
    else if (e.target.value === "dark") wordCanvas.classList.add("theme-dark");
  });

  // Find & Replace
  document.getElementById("btnToggleFind").addEventListener("click", () => {
    findReplacePanel.style.display = findReplacePanel.style.display === "none" ? "flex" : "none";
    if (findReplacePanel.style.display === "flex") findInput.focus();
  });
  document.getElementById("btnCloseFind").addEventListener("click", () => {
    findReplacePanel.style.display = "none";
  });

  document.getElementById("btnFindNext").addEventListener("click", () => {
    const query = findInput.value;
    if (query && window.find) {
      window.find(query, false, false, true, false, true, false);
    }
  });

  document.getElementById("btnReplace").addEventListener("click", () => {
    const q = findInput.value;
    const r = replaceInput.value;
    if (!q) return;
    const selection = window.getSelection();
    if (selection.toString().toLowerCase() === q.toLowerCase()) {
      format("insertText", r);
    }
    if (window.find) window.find(q, false, false, true, false, true, false);
  });

  document.getElementById("btnReplaceAll").addEventListener("click", () => {
    const q = findInput.value;
    const r = replaceInput.value;
    if (!q) return;
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    wordCanvas.innerHTML = wordCanvas.innerHTML.replace(regex, r);
    updateStats();
  });

  // Document Statistics
  function updateStats() {
    const text = wordCanvas.innerText || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readMin = Math.ceil(words / 200);

    wordCountEl.textContent = `${words} words`;
    charCountEl.textContent = `${chars} characters`;
    readTimeEl.textContent = `${readMin} min read`;

    saveToStorage();
  }

  // Storage Persistence
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, wordCanvas.innerHTML);
      localStorage.setItem(TITLE_KEY, docTitleInput.value);
      saveStatusEl.textContent = "Saved locally";
    } catch (e) {
      saveStatusEl.textContent = "Auto-save error";
    }
  }

  function loadFromStorage() {
    try {
      const savedContent = localStorage.getItem(STORAGE_KEY);
      const savedTitle = localStorage.getItem(TITLE_KEY);
      if (savedTitle) docTitleInput.value = savedTitle;
      if (savedContent) {
        wordCanvas.innerHTML = savedContent;
      }
    } catch (e) {
      console.warn("Storage load error:", e);
    }
    updateStats();
  }

  // File Operations: New, Open, Export
  document.getElementById("btnNewDoc").addEventListener("click", () => {
    if (confirm("Create a new document? Any unsaved edits will be cleared.")) {
      wordCanvas.innerHTML = "<h1>Untitled Document</h1><p>Start typing here...</p>";
      docTitleInput.value = "Untitled Document";
      updateStats();
    }
  });

  document.getElementById("btnOpenDoc").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    docTitleInput.value = file.name.replace(/\.[^/.]+$/, "");

    if (file.name.endsWith(".docx")) {
      if (window.mammoth) {
        try {
          const ab = await file.arrayBuffer();
          const result = await window.mammoth.convertToHtml({ arrayBuffer: ab });
          wordCanvas.innerHTML = result.value || "<p>Empty document</p>";
          updateStats();
        } catch (err) {
          alert("Error opening DOCX: " + err.message);
        }
      } else {
        alert("Mammoth DOCX parser library not loaded.");
      }
    } else {
      const text = await file.text();
      if (file.name.endsWith(".html")) {
        wordCanvas.innerHTML = text;
      } else if (file.name.endsWith(".md")) {
        // Simple markdown converter
        let html = text
          .replace(/^### (.*$)/gim, "<h3>$1</h3>")
          .replace(/^## (.*$)/gim, "<h2>$1</h2>")
          .replace(/^# (.*$)/gim, "<h1>$1</h1>")
          .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
          .replace(/\*(.*?)\*/gim, "<i>$1</i>")
          .replace(/\n\n/gim, "</p><p>")
          .replace(/\n/gim, "<br/>");
        wordCanvas.innerHTML = `<p>${html}</p>`;
      } else {
        // Plain text
        wordCanvas.innerText = text;
      }
      updateStats();
    }
    fileInput.value = "";
  });

  // Export Menu Toggle
  btnExportMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", () => {
    exportDropdown.style.display = "none";
  });

  // Export Downloads
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  document.getElementById("exportPdf").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("exportHtml").addEventListener("click", () => {
    const title = docTitleInput.value.trim() || "Document";
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1, h2, h3 { color: #111; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; }
    th { background: #f4f4f4; }
    blockquote { border-left: 4px solid #3b82f6; padding: 6px 16px; margin: 16px 0; background: #f9f9f9; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${wordCanvas.innerHTML}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    downloadBlob(blob, `${title}.html`);
  });

  document.getElementById("exportTxt").addEventListener("click", () => {
    const title = docTitleInput.value.trim() || "Document";
    const blob = new Blob([wordCanvas.innerText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${title}.txt`);
  });

  document.getElementById("exportMd").addEventListener("click", () => {
    const title = docTitleInput.value.trim() || "Document";
    let md = "";
    wordCanvas.childNodes.forEach((node) => {
      const tag = node.nodeName.toLowerCase();
      if (tag === "h1") md += `# ${node.innerText}\n\n`;
      else if (tag === "h2") md += `## ${node.innerText}\n\n`;
      else if (tag === "h3") md += `### ${node.innerText}\n\n`;
      else if (tag === "blockquote") md += `> ${node.innerText}\n\n`;
      else if (tag === "ul") {
        node.childNodes.forEach((li) => { if (li.innerText) md += `- ${li.innerText}\n`; });
        md += "\n";
      } else if (tag === "ol") {
        let i = 1;
        node.childNodes.forEach((li) => { if (li.innerText) md += `${i++}. ${li.innerText}\n`; });
        md += "\n";
      } else if (node.innerText && node.innerText.trim()) {
        md += `${node.innerText}\n\n`;
      }
    });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `${title}.md`);
  });

  // DOCX Export via JSZip
  document.getElementById("exportDocx").addEventListener("click", async () => {
    if (!window.JSZip) {
      alert("JSZip library is required for DOCX generation.");
      return;
    }
    const title = docTitleInput.value.trim() || "Document";
    const zip = new window.JSZip();

    // 1. [Content_Types].xml
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
    zip.file("[Content_Types].xml", contentTypesXml);

    // 2. _rels/.rels
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    zip.folder("_rels").file(".rels", relsXml);

    // 3. word/_rels/document.xml.rels
    const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
    zip.folder("word").folder("_rels").file("document.xml.rels", docRelsXml);

    // 4. word/styles.xml
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>`;
    zip.folder("word").file("styles.xml", stylesXml);

    // 5. word/document.xml - Convert editor DOM elements to OOXML paragraphs
    function escapeXml(str) {
      return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    let paragraphsXml = "";
    wordCanvas.childNodes.forEach((node) => {
      const tag = node.nodeName.toLowerCase();
      const text = escapeXml(node.innerText || node.textContent || "");
      if (!text.trim() && tag !== "p") return;

      if (tag === "h1") {
        paragraphsXml += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
      } else if (tag === "h2") {
        paragraphsXml += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
      } else if (tag === "h3") {
        paragraphsXml += `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
      } else if (tag === "blockquote") {
        paragraphsXml += `<w:p><w:r><w:rPr><w:i/><w:color w:val="555555"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
      } else if (tag === "ul" || tag === "ol") {
        node.childNodes.forEach((li) => {
          const liText = escapeXml(li.innerText || li.textContent || "");
          if (liText.trim()) {
            paragraphsXml += `<w:p><w:r><w:t>• ${liText}</w:t></w:r></w:p>`;
          }
        });
      } else if (tag === "table") {
        let tblXml = "<w:tbl><w:tblPr><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\"/><w:bottom w:val=\"single\" w:sz=\"4\"/><w:insideH w:val=\"single\" w:sz=\"4\"/><w:insideV w:val=\"single\" w:sz=\"4\"/></w:tblBorders></w:tblPr>";
        node.querySelectorAll("tr").forEach((tr) => {
          tblXml += "<w:tr>";
          tr.querySelectorAll("th, td").forEach((cell) => {
            const cellText = escapeXml(cell.innerText || "");
            tblXml += `<w:tc><w:p><w:r><w:t>${cellText}</w:t></w:r></w:p></w:tc>`;
          });
          tblXml += "</w:tr>";
        });
        tblXml += "</w:tbl>";
        paragraphsXml += tblXml;
      } else {
        // Regular paragraph
        paragraphsXml += `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
      }
    });

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml || "<w:p><w:r><w:t></w:t></w:r></w:p>"}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
    zip.folder("word").file("document.xml", docXml);

    const docxBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(docxBlob, `${title}.docx`);
  });

  // Listeners
  wordCanvas.addEventListener("input", updateStats);
  docTitleInput.addEventListener("input", saveToStorage);

  // Initialize
  loadFromStorage();
})();

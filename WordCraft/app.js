/**
 * WordCraft — Word Processor Engine
 * Pure client-side document authoring, DOCX/HTML/MD import & export, and real-time formatting.
 */

(function () {
  "use strict";

  // Elements
  const wordCanvas = document.getElementById("wordCanvas");
  const wordPageStage = document.getElementById("wordPageStage");
  const wordPageBackplates = document.getElementById("wordPageBackplates");
  const wordPageFurniture = document.getElementById("wordPageFurniture");
  const docTitleInput = document.getElementById("docTitle");
  const wordCountEl = document.getElementById("wordCount");
  const charCountEl = document.getElementById("charCount");
  const readTimeEl = document.getElementById("readTime");
  const pageCountEl = document.getElementById("pageCount");
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
  const HEADER_KEY = "sigma_wordcraft_header";
  const FOOTER_KEY = "sigma_wordcraft_footer";
  let pageHeaderText = "";
  let pageFooterText = "";

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
    if (val === "subtitle") {
      format("formatBlock", "<p>");
      const selection = window.getSelection();
      const block = selection && selection.anchorNode && selection.anchorNode.parentElement.closest("p");
      if (block) { block.classList.add("doc-subtitle"); block.style.fontSize = "1.35em"; block.style.color = "#777"; }
    } else {
      format("formatBlock", `<${val}>`);
    }
  });

  document.getElementById("lineSpacingSelect").addEventListener("change", (e) => {
    const selection = window.getSelection();
    const node = selection && selection.anchorNode;
    const block = node && (node.nodeType === 1 ? node : node.parentElement)?.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre");
    if (block && wordCanvas.contains(block)) block.style.lineHeight = e.target.value;
    wordCanvas.focus();
    updateStats();
  });

  document.getElementById("btnPageBreak").addEventListener("click", () => {
    format("insertHTML", '<div class="word-page-break" contenteditable="false" data-page-break="true"><span>Page Break</span></div><p><br></p>');
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

  function selectedTableCell() {
    const selection = window.getSelection();
    const node = selection && selection.anchorNode;
    const cell = node && (node.nodeType === 1 ? node : node.parentElement)?.closest("td,th");
    return cell && wordCanvas.contains(cell) ? cell : null;
  }

  ["btnAddTableRow", "btnAddTableColumn"].forEach(id => {
    document.getElementById(id).addEventListener("mousedown", event => event.preventDefault());
  });
  document.getElementById("btnAddTableRow").addEventListener("click", () => {
    const cell = selectedTableCell();
    if (!cell) return alert("Place the cursor in a table cell first.");
    const row = cell.parentElement;
    const newRow = row.cloneNode(false);
    for (let i = 0; i < row.cells.length; i++) {
      const newCell = newRow.insertCell();
      newCell.innerHTML = "<br>";
    }
    row.insertAdjacentElement("afterend", newRow);
    newRow.cells[0]?.focus();
    updateStats();
  });
  document.getElementById("btnAddTableColumn").addEventListener("click", () => {
    const cell = selectedTableCell();
    if (!cell) return alert("Place the cursor in a table cell first.");
    const table = cell.closest("table");
    const column = cell.cellIndex + 1;
    for (const row of table.rows) {
      const newCell = row.insertCell(Math.min(column, row.cells.length));
      if (row.parentElement.tagName === "THEAD") {
        const header = document.createElement("th");
        header.innerHTML = "<br>";
        newCell.replaceWith(header);
      } else newCell.innerHTML = "<br>";
    }
    updateStats();
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
    updateStats();
  });

  themeSelect.addEventListener("change", (e) => {
    wordCanvas.classList.remove("theme-parchment", "theme-dark");
    wordPageStage.classList.remove("theme-parchment", "theme-dark");
    if (e.target.value === "parchment") {
      wordCanvas.classList.add("theme-parchment");
      wordPageStage.classList.add("theme-parchment");
    } else if (e.target.value === "dark") {
      wordCanvas.classList.add("theme-dark");
      wordPageStage.classList.add("theme-dark");
    }
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
    const statsCopy = wordCanvas.cloneNode(true);
    statsCopy.querySelectorAll(".word-page-break").forEach((marker) => marker.remove());
    const text = statsCopy.innerText || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readMin = Math.ceil(words / 200);

    wordCountEl.textContent = `${words} words`;
    charCountEl.textContent = `${chars} characters`;
    readTimeEl.textContent = `${readMin} min read`;
    const pageStyle = getComputedStyle(wordCanvas);
    const stride = parseFloat(pageStyle.columnWidth) + parseFloat(pageStyle.columnGap);
    const pageWidth = parseFloat(pageStyle.width);
    const pageCount = stride > 0 ? Math.max(1, Math.ceil((wordCanvas.scrollWidth - pageWidth) / stride) + 1) : 1;
    pageCountEl.textContent = `${pageCount} ${pageCount === 1 ? "page" : "pages"}`;
    wordPageStage.style.width = `${pageWidth + (pageCount - 1) * stride}px`;
    while (wordPageBackplates.children.length > pageCount) wordPageBackplates.lastElementChild.remove();
    while (wordPageBackplates.children.length < pageCount) {
      const tile = document.createElement("div");
      tile.className = "word-page-backplate";
      wordPageBackplates.appendChild(tile);
    }
    Array.from(wordPageBackplates.children).forEach((tile, index) => {
      tile.style.left = `${index * stride}px`;
    });
    updatePageFurniture(pageCount, stride, pageWidth, parseFloat(pageStyle.paddingLeft) || 96);

    saveToStorage();
  }

  function updatePageFurniture(pageCount, stride, pageWidth, margin) {
    while (wordPageFurniture.children.length > pageCount) wordPageFurniture.lastElementChild.remove();
    while (wordPageFurniture.children.length < pageCount) {
      const page = document.createElement("div");
      page.className = "word-page-furniture-page";
      const header = document.createElement("input");
      header.className = "page-header-field";
      header.type = "text";
      header.setAttribute("aria-label", "Page header");
      header.placeholder = "Click to edit header";
      const footer = document.createElement("input");
      footer.className = "page-footer-field";
      footer.type = "text";
      footer.setAttribute("aria-label", "Page footer");
      footer.placeholder = "Click to edit footer";
      header.addEventListener("input", () => setPageFurnitureText("header", header.value));
      footer.addEventListener("input", () => setPageFurnitureText("footer", footer.value));
      page.append(header, footer);
      wordPageFurniture.appendChild(page);
    }
    Array.from(wordPageFurniture.children).forEach((page, index) => {
      page.style.left = `${index * stride}px`;
      const header = page.querySelector(".page-header-field");
      const footer = page.querySelector(".page-footer-field");
      header.style.left = `${margin}px`;
      header.style.width = `${Math.max(40, pageWidth - margin * 2)}px`;
      footer.style.left = `${margin}px`;
      footer.style.width = `${Math.max(40, pageWidth - margin * 2)}px`;
      if (header.value !== pageHeaderText) header.value = pageHeaderText;
      if (footer.value !== pageFooterText) footer.value = pageFooterText;
    });
  }

  function setPageFurnitureText(kind, value) {
    if (kind === "header") pageHeaderText = value;
    else pageFooterText = value;
    wordPageFurniture.querySelectorAll(kind === "header" ? ".page-header-field" : ".page-footer-field").forEach((field) => {
      if (field.value !== value) field.value = value;
    });
    saveToStorage();
  }

  function clearPageFurniture() {
    setPageFurnitureText("header", "");
    setPageFurnitureText("footer", "");
  }

  // Storage Persistence
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, wordCanvas.innerHTML);
      localStorage.setItem(TITLE_KEY, docTitleInput.value);
      localStorage.setItem(HEADER_KEY, pageHeaderText);
      localStorage.setItem(FOOTER_KEY, pageFooterText);
      saveStatusEl.textContent = "Saved locally";
    } catch (e) {
      saveStatusEl.textContent = "Auto-save error";
    }
  }

  function loadFromStorage() {
    try {
      const savedContent = localStorage.getItem(STORAGE_KEY);
      const savedTitle = localStorage.getItem(TITLE_KEY);
      pageHeaderText = localStorage.getItem(HEADER_KEY) || "";
      pageFooterText = localStorage.getItem(FOOTER_KEY) || "";
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
      clearPageFurniture();
      updateStats();
    }
  });

  document.getElementById("btnOpenDoc").addEventListener("click", () => fileInput.click());

  async function readDocxPageFurniture(arrayBuffer) {
    if (!window.JSZip) return { header: "", footer: "" };
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const relsFile = zip.file("word/_rels/document.xml.rels");
    if (!relsFile) return { header: "", footer: "" };
    const relsXml = new DOMParser().parseFromString(await relsFile.async("string"), "application/xml");
    const result = { header: "", footer: "" };
    for (const rel of Array.from(relsXml.getElementsByTagName("Relationship"))) {
      const type = rel.getAttribute("Type") || "";
      const kind = type.endsWith("/header") ? "header" : type.endsWith("/footer") ? "footer" : null;
      if (!kind || result[kind]) continue;
      let target = rel.getAttribute("Target") || "";
      const parts = (target.startsWith("/") ? target.slice(1) : `word/${target}`).split("/");
      const normalized = [];
      parts.forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") normalized.pop();
        else normalized.push(part);
      });
      target = normalized.join("/");
      const part = zip.file(target);
      if (!part) continue;
      const xml = new DOMParser().parseFromString(await part.async("string"), "application/xml");
      const paragraphs = Array.from(xml.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "p"));
      result[kind] = paragraphs.map((paragraph) => Array.from(paragraph.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t")).map((node) => node.textContent).join("")).join("\n");
    }
    return result;
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    docTitleInput.value = file.name.replace(/\.[^/.]+$/, "");
    clearPageFurniture();

    if (file.name.endsWith(".docx")) {
      if (window.mammoth) {
        try {
          const ab = await file.arrayBuffer();
          const result = await window.mammoth.convertToHtml({ arrayBuffer: ab });
          wordCanvas.innerHTML = result.value || "<p>Empty document</p>";
          const pageFurniture = await readDocxPageFurniture(ab);
          setPageFurnitureText("header", pageFurniture.header);
          setPageFurnitureText("footer", pageFurniture.footer);
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
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="bmp" ContentType="image/bmp"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
    zip.file("[Content_Types].xml", contentTypesXml);

    // 2. _rels/.rels
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    zip.folder("_rels").file(".rels", relsXml);

    // 3. word/styles.xml
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
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

    const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(pageHeaderText)}</w:t></w:r></w:p></w:hdr>`;
    const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(pageFooterText)}</w:t></w:r></w:p></w:ftr>`;

    const embeddedImages = new WeakMap();
    const imageRelationships = [];
    let imageNumber = 0;
    for (const image of wordCanvas.querySelectorAll("img")) {
      const source = image.getAttribute("src") || "";
      // Never fetch remote HTML images while creating a local DOCX package.
      if (!source.startsWith("data:image/") && !source.startsWith("blob:")) continue;
      try {
        let blob = await (await fetch(source)).blob();
        let extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/bmp": "bmp" })[blob.type.toLowerCase()];
        if (!extension) {
          await image.decode();
          const width = image.naturalWidth || image.width;
          const height = image.naturalHeight || image.height;
          if (!width || !height) continue;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!blob) continue;
          extension = "png";
        }

        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;
        const displayedWidth = image.getBoundingClientRect().width || image.width || naturalWidth;
        const maxWidthEmu = 6 * 914400;
        const scale = Math.min(1, maxWidthEmu / (displayedWidth * 9525));
        const cx = Math.max(1, Math.round(displayedWidth * scale * 9525));
        const cy = Math.max(1, Math.round(displayedWidth * naturalHeight / naturalWidth * scale * 9525));
        const index = ++imageNumber;
        const fileName = `image${index}.${extension}`;
        const relationshipId = `rId${index + 3}`;
        zip.folder("word").folder("media").file(fileName, blob);
        imageRelationships.push(`<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/>`);
        embeddedImages.set(image, { relationshipId, docPrId: index, fileName, cx, cy });
      } catch (error) {
        // An expired local blob or unsupported image is represented by its alt text below.
      }
    }

    function inlineRuns(node, inherited = {}) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.nodeValue) return "";
        const p = [];
        if (inherited.bold) p.push("<w:b/>");
        if (inherited.italic) p.push("<w:i/>");
        if (inherited.underline) p.push('<w:u w:val="single"/>');
        if (inherited.strike) p.push("<w:strike/>");
        if (inherited.sup) p.push('<w:vertAlign w:val="superscript"/>');
        if (inherited.sub) p.push('<w:vertAlign w:val="subscript"/>');
        if (inherited.color) p.push(`<w:color w:val="${inherited.color}"/>`);
        if (inherited.highlight) p.push(`<w:shd w:fill="${inherited.highlight}"/>`);
        if (inherited.size) p.push(`<w:sz w:val="${inherited.size}"/>`);
        return `<w:r>${p.length ? `<w:rPr>${p.join("")}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(node.nodeValue)}</w:t></w:r>`;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const style = { ...inherited };
      const tag = node.tagName.toLowerCase();
      if (tag === "b" || tag === "strong") style.bold = true;
      if (tag === "i" || tag === "em") style.italic = true;
      if (tag === "u") style.underline = true;
      if (["s", "strike", "del"].includes(tag)) style.strike = true;
      if (tag === "sup") style.sup = true;
      if (tag === "sub") style.sub = true;
      const color = node.style?.color?.match(/#([0-9a-f]{6})/i);
      if (color) style.color = color[1].toUpperCase();
      const highlight = node.style?.backgroundColor?.match(/#([0-9a-f]{6})/i);
      if (highlight) style.highlight = highlight[1].toUpperCase();
      const size = node.style?.fontSize?.match(/([\d.]+)px/);
      if (size) style.size = String(Math.max(2, Math.min(200, Math.round(Number(size[1]) * 1.5))));
      if (tag === "br") return "<w:r><w:br/></w:r>";
      if (tag === "img") {
        const image = embeddedImages.get(node);
        if (!image) return `<w:r><w:t>[Image: ${escapeXml(node.alt || "image unavailable")}]</w:t></w:r>`;
        const name = escapeXml(image.fileName);
        const description = escapeXml(node.alt || "Document image");
        return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${image.cx}" cy="${image.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${image.docPrId}" name="${name}" descr="${description}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${image.docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${image.cx}" cy="${image.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      }
      return Array.from(node.childNodes).map((child) => inlineRuns(child, style)).join("");
    }

    let paragraphsXml = "";
    wordCanvas.childNodes.forEach((node) => {
      const tag = node.nodeName.toLowerCase();
      const text = escapeXml(node.innerText || node.textContent || "");
      if (node.nodeType === Node.ELEMENT_NODE && node.dataset.pageBreak === "true") {
        paragraphsXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        return;
      }
      const runs = inlineRuns(node);
      if (!text.trim() && tag !== "p" && !node.querySelector?.("img")) return;

      if (/^h[1-6]$/.test(tag)) {
        const level = tag.slice(1);
        paragraphsXml += `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr>${runs}</w:p>`;
      } else if (tag === "blockquote") {
        paragraphsXml += `<w:p><w:pPr><w:ind w:left="720"/></w:pPr>${inlineRuns(node, { italic: true, color: "555555" })}</w:p>`;
      } else if (tag === "ul" || tag === "ol") {
        node.childNodes.forEach((li) => {
          const liText = escapeXml(li.innerText || li.textContent || "");
          if (liText.trim() || li.querySelector("img")) {
            paragraphsXml += `<w:p>${inlineRuns(li)}</w:p>`;
          }
        });
      } else if (tag === "table") {
        let tblXml = "<w:tbl><w:tblPr><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\"/><w:bottom w:val=\"single\" w:sz=\"4\"/><w:insideH w:val=\"single\" w:sz=\"4\"/><w:insideV w:val=\"single\" w:sz=\"4\"/></w:tblBorders></w:tblPr>";
        node.querySelectorAll("tr").forEach((tr) => {
          tblXml += "<w:tr>";
          tr.querySelectorAll("th, td").forEach((cell) => {
            tblXml += `<w:tc><w:p>${inlineRuns(cell)}</w:p></w:tc>`;
          });
          tblXml += "</w:tr>";
        });
        tblXml += "</w:tbl>";
        paragraphsXml += tblXml;
      } else {
        const lineHeight = node.nodeType === Node.ELEMENT_NODE ? parseFloat(node.style?.lineHeight) : NaN;
        const spacing = Number.isFinite(lineHeight) ? `<w:pPr><w:spacing w:line="${Math.round(lineHeight * 240)}" w:lineRule="auto"/></w:pPr>` : "";
        paragraphsXml += `<w:p>${spacing}${runs || `<w:r><w:t>${text}</w:t></w:r>`}</w:p>`;
      }
    });

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${paragraphsXml || "<w:p><w:r><w:t></w:t></w:r></w:p>"}
    <w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr>
  </w:body>
</w:document>`;
    const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  ${imageRelationships.join("\n  ")}
</Relationships>`;
    zip.folder("word").folder("_rels").file("document.xml.rels", docRelsXml);
    zip.folder("word").file("header1.xml", headerXml);
    zip.folder("word").file("footer1.xml", footerXml);
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

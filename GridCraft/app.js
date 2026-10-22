/**
 * GridCraft — Spreadsheet Engine
 * Pure client-side workbook model, dynamic formula evaluator, multi-sheet manager, and XLSX/CSV import & export.
 */

(function () {
  "use strict";

  // Grid Dimensions
  const NUM_ROWS = 100;
  const NUM_COLS = 26; // A - Z

  // State
  let workbook = {
    title: "Untitled Spreadsheet",
    sheets: [
      {
        name: "Sheet1",
        cells: {} // Key: "A1", Value: { raw: string, bold: bool, italic: bool, underline: bool, align: string, format: string, color: string, fill: string }
      }
    ]
  };

  let activeSheetIdx = 0;
  let activeCell = { row: 1, col: 1 }; // 1-based (A1)
  let isEditingInline = false;

  // DOM Elements
  const sheetTitleInput = document.getElementById("sheetTitle");
  const sheetTable = document.getElementById("sheetTable");
  const cellCoordEl = document.getElementById("cellCoord");
  const formulaInput = document.getElementById("formulaInput");
  const sheetTabsList = document.getElementById("sheetTabsList");
  const fileInput = document.getElementById("fileInput");

  // Formatting Elements
  const btnBold = document.getElementById("btnBold");
  const btnItalic = document.getElementById("btnItalic");
  const btnUnderline = document.getElementById("btnUnderline");
  const btnAlignLeft = document.getElementById("btnAlignLeft");
  const btnAlignCenter = document.getElementById("btnAlignCenter");
  const btnAlignRight = document.getElementById("btnAlignRight");
  const numFormatSelect = document.getElementById("numFormatSelect");
  const textColorPicker = document.getElementById("textColorPicker");
  const fillColorPicker = document.getElementById("fillColorPicker");
  const quickFormulaSelect = document.getElementById("quickFormulaSelect");

  // Status Stats
  const statSum = document.getElementById("statSum");
  const statAvg = document.getElementById("statAvg");
  const statCount = document.getElementById("statCount");

  // Coord Utilities
  function colToLetter(col) {
    return String.fromCharCode(64 + col);
  }

  function letterToCol(letter) {
    return letter.toUpperCase().charCodeAt(0) - 64;
  }

  function getCoord(row, col) {
    return `${colToLetter(col)}${row}`;
  }

  function parseCoord(coord) {
    const match = coord.match(/^([A-Z]+)([0-9]+)$/i);
    if (!match) return null;
    return {
      col: letterToCol(match[1]),
      row: parseInt(match[2], 10)
    };
  }

  function getActiveSheet() {
    return workbook.sheets[activeSheetIdx];
  }

  function getCellData(coord) {
    const sheet = getActiveSheet();
    return sheet.cells[coord] || { raw: "" };
  }

  function setCellData(coord, data) {
    const sheet = getActiveSheet();
    if (!sheet.cells[coord]) {
      sheet.cells[coord] = { raw: "" };
    }
    Object.assign(sheet.cells[coord], data);
  }

  // Formula Evaluator
  function evaluateCell(coord, visited = new Set()) {
    if (visited.has(coord)) return "#CIRCULAR!";
    visited.add(coord);

    const cell = getCellData(coord);
    const raw = (cell.raw || "").trim();
    if (!raw.startsWith("=")) {
      return raw;
    }

    const expr = raw.substring(1).trim();

    try {
      // 1. Range functions: SUM, AVERAGE, COUNT, MIN, MAX
      const funcMatch = expr.match(/^([A-Z]+)\(([A-Z0-9:]+)\)$/i);
      if (funcMatch) {
        const fn = funcMatch[1].toUpperCase();
        const range = funcMatch[2];
        const vals = getRangeValues(range, visited);

        if (fn === "SUM") {
          return vals.reduce((a, b) => a + b, 0);
        } else if (fn === "AVERAGE") {
          return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        } else if (fn === "COUNT") {
          return vals.length;
        } else if (fn === "MIN") {
          return vals.length ? Math.min(...vals) : 0;
        } else if (fn === "MAX") {
          return vals.length ? Math.max(...vals) : 0;
        } else if (fn === "PRODUCT") {
          return vals.length ? vals.reduce((a, b) => a * b, 1) : 0;
        } else if (fn === "MEDIAN") {
          if (!vals.length) return 0;
          const sorted = [...vals].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        } else if (fn === "CONCATENATE") {
          return getRangeRawStrings(range).join("");
        }
      }

      // 2. IF condition: IF(condition, trueVal, falseVal)
      const ifMatch = expr.match(/^IF\((.+?),\s*(.+?),\s*(.+?)\)$/i);
      if (ifMatch) {
        const cond = ifMatch[1];
        const valTrue = ifMatch[2].replace(/"/g, "");
        const valFalse = ifMatch[3].replace(/"/g, "");
        // Resolve refs in condition
        const resolvedCond = cond.replace(/[A-Z]+[0-9]+/gi, (m) => {
          const val = Number(evaluateCell(m.toUpperCase(), new Set(visited)));
          return isNaN(val) ? 0 : val;
        });
        const result = Function(`"use strict"; return (${resolvedCond});`)();
        return result ? valTrue : valFalse;
      }

      // 3. Basic arithmetic expression with cell replacement
      const resolvedExpr = expr.replace(/[A-Z]+[0-9]+/gi, (m) => {
        const val = Number(evaluateCell(m.toUpperCase(), new Set(visited)));
        return isNaN(val) ? 0 : val;
      });

      // Safe arithmetic evaluator
      if (/^[0-9+\-*/().\s]+$/.test(resolvedExpr)) {
        const res = Function(`"use strict"; return (${resolvedExpr});`)();
        return typeof res === "number" ? Math.round(res * 10000) / 10000 : res;
      }
    } catch (e) {
      return "#ERROR!";
    }

    return expr;
  }

  // Range value helper
  function getRangeValues(rangeStr, visited) {
    const parts = rangeStr.split(":");
    if (parts.length !== 2) return [];
    const start = parseCoord(parts[0]);
    const end = parseCoord(parts[1]);
    if (!start || !end) return [];

    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    const values = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cellVal = evaluateCell(getCoord(r, c), new Set(visited));
        const num = parseFloat(cellVal);
        if (!isNaN(num)) values.push(num);
      }
    }
    return values;
  }

  // Range raw string helper for CONCATENATE
  function getRangeRawStrings(rangeStr) {
    const parts = rangeStr.split(":");
    if (parts.length !== 2) return [];
    const start = parseCoord(parts[0]);
    const end = parseCoord(parts[1]);
    if (!start || !end) return [];

    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    const strings = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = getCell(r, c);
        if (cell && cell.raw) strings.push(cell.raw);
      }
    }
    return strings;
  }

  // Number Formatter
  function formatValue(value, format) {
    if (value === "" || value === null || value === undefined) return "";
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    if (format === "currency") {
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (format === "percentage") {
      return `${(num * 100).toFixed(1)}%`;
    } else if (format === "decimal") {
      return num.toFixed(2);
    } else if (format === "integer") {
      return Math.round(num).toString();
    }
    return value;
  }

  // Build DOM Table Once
  function buildTableDOM() {
    sheetTable.innerHTML = "";

    // Thead
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Corner cell
    const cornerTh = document.createElement("th");
    cornerTh.className = "corner-header";
    headerRow.appendChild(cornerTh);

    // Columns A-Z
    for (let c = 1; c <= NUM_COLS; c++) {
      const th = document.createElement("th");
      th.className = "col-header";
      th.dataset.col = c;
      th.textContent = colToLetter(c);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    sheetTable.appendChild(thead);

    // Tbody
    const tbody = document.createElement("tbody");
    for (let r = 1; r <= NUM_ROWS; r++) {
      const tr = document.createElement("tr");

      // Row Number Header
      const rowTh = document.createElement("th");
      rowTh.className = "row-header";
      rowTh.dataset.row = r;
      rowTh.textContent = r;
      tr.appendChild(rowTh);

      // Data Cells
      for (let c = 1; c <= NUM_COLS; c++) {
        const td = document.createElement("td");
        td.dataset.row = r;
        td.dataset.col = c;
        td.dataset.coord = getCoord(r, c);

        td.addEventListener("mousedown", (e) => {
          setActiveCell(r, c);
        });

        td.addEventListener("dblclick", () => {
          editActiveCell();
        });

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    sheetTable.appendChild(tbody);
  }

  // Update All Visible Cells Display
  function refreshGridDisplay() {
    const sheet = getActiveSheet();

    for (let r = 1; r <= NUM_ROWS; r++) {
      for (let c = 1; c <= NUM_COLS; c++) {
        const coord = getCoord(r, c);
        const td = sheetTable.querySelector(`td[data-coord="${coord}"]`);
        if (!td) continue;

        const cell = sheet.cells[coord] || { raw: "" };
        const evaluated = evaluateCell(coord);
        const formatted = formatValue(evaluated, cell.format);

        td.textContent = formatted;

        // Apply Styles
        td.style.fontWeight = cell.bold ? "bold" : "normal";
        td.style.fontStyle = cell.italic ? "italic" : "normal";
        td.style.textDecoration = cell.underline ? "underline" : "none";
        td.style.textAlign = cell.align || "left";
        td.style.color = cell.color || "var(--text-main)";
        td.style.backgroundColor = cell.fill || "transparent";
      }
    }

    updateActiveCellUI();
    updateStatsBar();
  }

  // Set Active Cell
  function setActiveCell(row, col) {
    activeCell = { row, col };
    updateActiveCellUI();
  }

  function updateActiveCellUI() {
    const coord = getCoord(activeCell.row, activeCell.col);
    cellCoordEl.textContent = coord;

    // Remove old active styling
    sheetTable.querySelectorAll(".active-cell").forEach((el) => el.classList.remove("active-cell"));
    const td = sheetTable.querySelector(`td[data-coord="${coord}"]`);
    if (td) {
      td.classList.add("active-cell");
      td.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    const cell = getCellData(coord);
    formulaInput.value = cell.raw || "";

    // Sync Toolbar
    btnBold.classList.toggle("active", !!cell.bold);
    btnItalic.classList.toggle("active", !!cell.italic);
    btnUnderline.classList.toggle("active", !!cell.underline);
    btnAlignLeft.classList.toggle("active", cell.align === "left" || !cell.align);
    btnAlignCenter.classList.toggle("active", cell.align === "center");
    btnAlignRight.classList.toggle("active", cell.align === "right");
    numFormatSelect.value = cell.format || "general";
    textColorPicker.value = cell.color || "#ffffff";
    fillColorPicker.value = cell.fill || "#1c1a19";
  }

  // Inline Editing
  function editActiveCell() {
    const coord = getCoord(activeCell.row, activeCell.col);
    const td = sheetTable.querySelector(`td[data-coord="${coord}"]`);
    if (!td) return;

    formulaInput.focus();
    formulaInput.select();
  }

  // Formula Input Listener
  formulaInput.addEventListener("input", (e) => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { raw: e.target.value });
    refreshGridDisplay();
  });

  formulaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      setActiveCell(Math.min(NUM_ROWS, activeCell.row + 1), activeCell.col);
      formulaInput.blur();
    }
  });

  // Keyboard Navigation on Grid
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === formulaInput || document.activeElement === sheetTitleInput) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCell(Math.min(NUM_ROWS, activeCell.row + 1), activeCell.col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCell(Math.max(1, activeCell.row - 1), activeCell.col);
    } else if (e.key === "ArrowRight" || e.key === "Tab") {
      e.preventDefault();
      setActiveCell(activeCell.row, Math.min(NUM_COLS, activeCell.col + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveCell(activeCell.row, Math.max(1, activeCell.col - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      editActiveCell();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      clearActiveCell();
    }
  });

  function clearActiveCell() {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { raw: "" });
    refreshGridDisplay();
  }

  document.getElementById("btnClearCell").addEventListener("click", clearActiveCell);

  // Formatting Listeners
  btnBold.addEventListener("click", () => {
    const coord = getCoord(activeCell.row, activeCell.col);
    const cell = getCellData(coord);
    setCellData(coord, { bold: !cell.bold });
    refreshGridDisplay();
  });

  btnItalic.addEventListener("click", () => {
    const coord = getCoord(activeCell.row, activeCell.col);
    const cell = getCellData(coord);
    setCellData(coord, { italic: !cell.italic });
    refreshGridDisplay();
  });

  btnUnderline.addEventListener("click", () => {
    const coord = getCoord(activeCell.row, activeCell.col);
    const cell = getCellData(coord);
    setCellData(coord, { underline: !cell.underline });
    refreshGridDisplay();
  });

  btnAlignLeft.addEventListener("click", () => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { align: "left" });
    refreshGridDisplay();
  });

  btnAlignCenter.addEventListener("click", () => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { align: "center" });
    refreshGridDisplay();
  });

  btnAlignRight.addEventListener("click", () => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { align: "right" });
    refreshGridDisplay();
  });

  numFormatSelect.addEventListener("change", (e) => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { format: e.target.value });
    refreshGridDisplay();
  });

  textColorPicker.addEventListener("input", (e) => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { color: e.target.value });
    refreshGridDisplay();
  });

  fillColorPicker.addEventListener("input", (e) => {
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { fill: e.target.value });
    refreshGridDisplay();
  });

  quickFormulaSelect.addEventListener("change", (e) => {
    if (!e.target.value) return;
    formulaInput.value = e.target.value;
    formulaInput.focus();
    const coord = getCoord(activeCell.row, activeCell.col);
    setCellData(coord, { raw: e.target.value });
    refreshGridDisplay();
    e.target.value = "";
  });

  // Stats Bar (Calculates statistics on current column)
  function updateStatsBar() {
    const colLetter = colToLetter(activeCell.col);
    const vals = [];
    for (let r = 1; r <= NUM_ROWS; r++) {
      const coord = `${colLetter}${r}`;
      const v = parseFloat(evaluateCell(coord));
      if (!isNaN(v)) vals.push(v);
    }

    if (vals.length > 0) {
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      statSum.textContent = `Sum: ${sum.toFixed(2)}`;
      statAvg.textContent = `Avg: ${avg.toFixed(2)}`;
      statCount.textContent = `Count: ${vals.length}`;
    } else {
      statSum.textContent = "Sum: 0";
      statAvg.textContent = "Avg: 0";
      statCount.textContent = "Count: 0";
    }
  }

  // Sheets Management
  function renderSheetTabs() {
    sheetTabsList.innerHTML = "";
    workbook.sheets.forEach((sheet, idx) => {
      const tab = document.createElement("div");
      tab.className = `sheet-tab ${idx === activeSheetIdx ? "active" : ""}`;
      tab.textContent = sheet.name;

      tab.addEventListener("click", () => {
        activeSheetIdx = idx;
        renderSheetTabs();
        refreshGridDisplay();
      });

      tab.addEventListener("dblclick", () => {
        const newName = prompt("Rename sheet:", sheet.name);
        if (newName && newName.trim()) {
          sheet.name = newName.trim();
          renderSheetTabs();
        }
      });

      sheetTabsList.appendChild(tab);
    });
  }

  document.getElementById("btnAddSheet").addEventListener("click", () => {
    const newName = `Sheet${workbook.sheets.length + 1}`;
    workbook.sheets.push({ name: newName, cells: {} });
    activeSheetIdx = workbook.sheets.length - 1;
    renderSheetTabs();
    refreshGridDisplay();
  });

  // File Operations: New, Open, Export
  document.getElementById("btnNewSheet").addEventListener("click", () => {
    if (confirm("Create a new workbook? Unsaved changes will be cleared.")) {
      workbook = {
        title: "Untitled Spreadsheet",
        sheets: [{ name: "Sheet1", cells: {} }]
      };
      sheetTitleInput.value = "Untitled Spreadsheet";
      activeSheetIdx = 0;
      activeCell = { row: 1, col: 1 };
      renderSheetTabs();
      refreshGridDisplay();
    }
  });

  document.getElementById("btnOpenSheet").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    sheetTitleInput.value = file.name.replace(/\.[^/.]+$/, "");

    if (window.XLSX) {
      try {
        const ab = await file.arrayBuffer();
        const wb = window.XLSX.read(ab, { type: "array" });

        workbook.sheets = [];
        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const cells = {};

          Object.keys(ws).forEach((cellKey) => {
            if (cellKey.startsWith("!")) return;
            const cell = ws[cellKey];
            cells[cellKey] = {
              raw: String(cell.v !== undefined ? cell.v : "")
            };
          });

          workbook.sheets.push({ name: sheetName, cells });
        });

        if (workbook.sheets.length === 0) {
          workbook.sheets.push({ name: "Sheet1", cells: {} });
        }

        activeSheetIdx = 0;
        activeCell = { row: 1, col: 1 };
        renderSheetTabs();
        refreshGridDisplay();
      } catch (err) {
        alert("Error loading spreadsheet: " + err.message);
      }
    } else {
      alert("XLSX engine library missing.");
    }
    fileInput.value = "";
  });

  // Export CSV
  document.getElementById("btnExportCsv").addEventListener("click", () => {
    const title = sheetTitleInput.value.trim() || "Spreadsheet";
    const sheet = getActiveSheet();

    let csvContent = "";
    // Find bounds
    let maxR = 1;
    let maxC = 1;
    Object.keys(sheet.cells).forEach((coord) => {
      const p = parseCoord(coord);
      if (p) {
        if (p.row > maxR) maxR = p.row;
        if (p.col > maxC) maxC = p.col;
      }
    });

    for (let r = 1; r <= maxR; r++) {
      const rowVals = [];
      for (let c = 1; c <= maxC; c++) {
        const val = evaluateCell(getCoord(r, c));
        const escaped = `"${String(val).replace(/"/g, '""')}"`;
        rowVals.push(escaped);
      }
      csvContent += rowVals.join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Export XLSX via xlsx.full.min.js
  document.getElementById("btnExportXlsx").addEventListener("click", () => {
    if (!window.XLSX) {
      alert("XLSX library missing.");
      return;
    }
    const title = sheetTitleInput.value.trim() || "Spreadsheet";
    const wb = window.XLSX.utils.book_new();

    workbook.sheets.forEach((sheet) => {
      const wsData = [];
      // Find bounds
      let maxR = 1;
      let maxC = 1;
      Object.keys(sheet.cells).forEach((coord) => {
        const p = parseCoord(coord);
        if (p) {
          if (p.row > maxR) maxR = p.row;
          if (p.col > maxC) maxC = p.col;
        }
      });

      for (let r = 1; r <= maxR; r++) {
        const row = [];
        for (let c = 1; c <= maxC; c++) {
          const val = evaluateCell(getCoord(r, c));
          const num = Number(val);
          row.push(!isNaN(num) && val !== "" ? num : val);
        }
        wsData.push(row);
      }

      const ws = window.XLSX.utils.aoa_to_sheet(wsData);
      window.XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    window.XLSX.writeFile(wb, `${title}.xlsx`);
  });

  // Seed sample starter data
  function seedSampleData() {
    const s = getActiveSheet();
    s.cells["A1"] = { raw: "Item", bold: true, align: "left" };
    s.cells["B1"] = { raw: "Quantity", bold: true, align: "right" };
    s.cells["C1"] = { raw: "Unit Price", bold: true, align: "right" };
    s.cells["D1"] = { raw: "Total", bold: true, align: "right" };

    s.cells["A2"] = { raw: "MacBook Pro M3", align: "left" };
    s.cells["B2"] = { raw: "2", align: "right" };
    s.cells["C2"] = { raw: "1999", format: "currency", align: "right" };
    s.cells["D2"] = { raw: "=B2*C2", format: "currency", bold: true, align: "right" };

    s.cells["A3"] = { raw: "Dell 4K Monitor", align: "left" };
    s.cells["B3"] = { raw: "4", align: "right" };
    s.cells["C3"] = { raw: "450", format: "currency", align: "right" };
    s.cells["D3"] = { raw: "=B3*C3", format: "currency", bold: true, align: "right" };

    s.cells["A4"] = { raw: "Mechanical Keyboard", align: "left" };
    s.cells["B4"] = { raw: "5", align: "right" };
    s.cells["C4"] = { raw: "120", format: "currency", align: "right" };
    s.cells["D4"] = { raw: "=B4*C4", format: "currency", bold: true, align: "right" };

    s.cells["A5"] = { raw: "Grand Total", bold: true, align: "left" };
    s.cells["D5"] = { raw: "=SUM(D2:D4)", format: "currency", bold: true, align: "right" };
  }

  // Initialize
  buildTableDOM();
  seedSampleData();
  renderSheetTabs();
  refreshGridDisplay();
})();

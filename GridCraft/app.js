/**
 * GridCraft — Spreadsheet Engine
 * Pure client-side workbook model, dynamic formula evaluator, multi-sheet manager, and XLSX/CSV import & export.
 */

(function () {
  "use strict";

  // Grid Dimensions
  const NUM_ROWS = 100;
  const NUM_COLS = 52; // A - AZ; keeps the rendered worksheet practical while supporting multi-letter references.

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
  let rangeAnchor = { row: 1, col: 1 };
  let rangeHead = { row: 1, col: 1 };
  let isSelectingRange = false;
  let fillDrag = null;

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
  const btnMergeCells = document.getElementById("btnMergeCells");
  const btnUnmergeCells = document.getElementById("btnUnmergeCells");
  const btnConditionalFormat = document.getElementById("btnConditionalFormat");

  // Status Stats
  const statSum = document.getElementById("statSum");
  const statAvg = document.getElementById("statAvg");
  const statCount = document.getElementById("statCount");

  // Coord Utilities
  function colToLetter(col) {
    let value = Math.max(1, Math.floor(col));
    let label = "";
    while (value > 0) {
      value--;
      label = String.fromCharCode(65 + value % 26) + label;
      value = Math.floor(value / 26);
    }
    return label;
  }

  function letterToCol(letter) {
    return [...letter.toUpperCase()].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
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

  function selectedBounds() {
    return {
      r1: Math.min(rangeAnchor.row, rangeHead.row), r2: Math.max(rangeAnchor.row, rangeHead.row),
      c1: Math.min(rangeAnchor.col, rangeHead.col), c2: Math.max(rangeAnchor.col, rangeHead.col)
    };
  }

  function selectedRange() {
    const { r1, r2, c1, c2 } = selectedBounds();
    return { start: getCoord(r1, c1), end: getCoord(r2, c2), r1, r2, c1, c2 };
  }

  function parseRange(range) {
    const [a, b = a] = range.split(":");
    const start = parseCoord(a), end = parseCoord(b);
    if (!start || !end) return null;
    return { r1: Math.min(start.row, end.row), r2: Math.max(start.row, end.row), c1: Math.min(start.col, end.col), c2: Math.max(start.col, end.col) };
  }

  function applyMergeDOM() {
    const sheet = getActiveSheet();
    for (const range of (sheet.mergedRanges || [])) {
      const bounds = parseRange(range);
      if (!bounds) continue;
      const anchor = sheetTable.querySelector(`td[data-coord="${getCoord(bounds.r1, bounds.c1)}"]`);
      if (!anchor) continue;
      anchor.colSpan = bounds.c2 - bounds.c1 + 1;
      anchor.rowSpan = bounds.r2 - bounds.r1 + 1;
      for (let row = bounds.r1; row <= bounds.r2; row++) for (let col = bounds.c1; col <= bounds.c2; col++) {
        if (row === bounds.r1 && col === bounds.c1) continue;
        const covered = sheetTable.querySelector(`td[data-coord="${getCoord(row, col)}"]`);
        if (covered) covered.style.display = "none";
      }
    }
  }

  function mergeSelectedCells() {
    const range = selectedRange();
    if (range.r1 === range.r2 && range.c1 === range.c2) return;
    const sheet = getActiveSheet();
    sheet.mergedRanges ||= [];
    const overlaps = sheet.mergedRanges.some((item) => {
      const b = parseRange(item);
      return b && range.r1 <= b.r2 && range.r2 >= b.r1 && range.c1 <= b.c2 && range.c2 >= b.c1;
    });
    if (overlaps) return alert("The selected cells overlap an existing merged range. Unmerge it first.");
    for (let row = range.r1; row <= range.r2; row++) for (let col = range.c1; col <= range.c2; col++) {
      if (row !== range.r1 || col !== range.c1) delete sheet.cells[getCoord(row, col)];
    }
    sheet.mergedRanges.push(`${range.start}:${range.end}`);
    buildTableDOM();
    refreshGridDisplay();
  }

  function unmergeSelectedCells() {
    const range = selectedRange();
    const sheet = getActiveSheet();
    const before = sheet.mergedRanges || [];
    sheet.mergedRanges = before.filter((item) => {
      const b = parseRange(item);
      return !(b && range.r1 <= b.r2 && range.r2 >= b.r1 && range.c1 <= b.c2 && range.c2 >= b.c1);
    });
    if (sheet.mergedRanges.length === before.length) return;
    buildTableDOM();
    refreshGridDisplay();
  }

  function applyConditionalFormats(coord, value, background) {
    const sheet = getActiveSheet();
    const cell = parseCoord(coord);
    const comparable = Number.isFinite(Number(value)) && String(value).trim() !== "" ? Number(value) : String(value).toLowerCase();
    for (const rule of (sheet.conditionalFormats || [])) {
      const b = parseRange(rule.range);
      if (!b || cell.row < b.r1 || cell.row > b.r2 || cell.col < b.c1 || cell.col > b.c2) continue;
      const threshold = Number.isFinite(Number(rule.value)) && String(rule.value).trim() !== "" ? Number(rule.value) : String(rule.value).toLowerCase();
      const compare = typeof comparable === "number" && typeof threshold === "number" ? (comparable - threshold) : String(comparable).localeCompare(String(threshold));
      const matches = rule.operator === "gt" ? compare > 0 : rule.operator === "gte" ? compare >= 0 : rule.operator === "lt" ? compare < 0 : rule.operator === "lte" ? compare <= 0 : rule.operator === "eq" ? compare === 0 : compare !== 0;
      if (matches) background = rule.fill;
    }
    return background;
  }

  function addConditionalFormat() {
    const range = selectedRange();
    const operator = prompt("Rule: gt (>), gte (≥), lt (<), lte (≤), eq (=), ne (≠)", "gt");
    if (operator === null) return;
    const normalized = operator.trim().toLowerCase();
    if (!["gt", "gte", "lt", "lte", "eq", "ne"].includes(normalized)) return alert("Choose gt, gte, lt, lte, eq, or ne.");
    const value = prompt(`Format ${range.start}:${range.end} when the cell is ${normalized} this value:`, "0");
    if (value === null) return;
    const fill = prompt("Matching cell fill color (hex):", "#14532d");
    if (fill === null) return;
    if (!/^#[0-9a-f]{6}$/i.test(fill)) return alert("Enter a color such as #14532d.");
    const sheet = getActiveSheet();
    sheet.conditionalFormats ||= [];
    sheet.conditionalFormats.push({ range: `${range.start}:${range.end}`, operator: normalized, value, fill });
    refreshGridDisplay();
  }

  function xmlEscape(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[character]);
  }

  async function readXlsxConditionalFormats(arrayBuffer, sheetNames) {
    if (!window.JSZip || typeof DOMParser === "undefined") return new Map();
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const workbookFile = zip.file("xl/workbook.xml"), relsFile = zip.file("xl/_rels/workbook.xml.rels");
    if (!workbookFile || !relsFile) return new Map();
    const parseXml = value => new DOMParser().parseFromString(value, "application/xml");
    const workbookXml = parseXml(await workbookFile.async("string"));
    const relsXml = parseXml(await relsFile.async("string"));
    const relationships = new Map(Array.from(relsXml.getElementsByTagNameNS("*", "Relationship"), node => [node.getAttribute("Id"), node.getAttribute("Target")]));
    const sheetTargets = new Map();
    for (const node of Array.from(workbookXml.getElementsByTagNameNS("*", "sheet"))) {
      const relId = node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || node.getAttribute("r:id");
      let target = relationships.get(relId);
      if (target) {
        const resolved = [];
        const packagePath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
        packagePath.split("/").forEach(part => {
          if (!part || part === ".") return;
          if (part === "..") resolved.pop();
          else resolved.push(part);
        });
        sheetTargets.set(node.getAttribute("name"), resolved.join("/"));
      }
    }
    const stylesFile = zip.file("xl/styles.xml");
    const stylesXml = stylesFile ? parseXml(await stylesFile.async("string")) : null;
    const differentialFormats = stylesXml ? Array.from(stylesXml.getElementsByTagNameNS("*", "dxfs")[0]?.children || []) : [];
    const differentialFill = index => {
      const dxf = differentialFormats[index];
      const color = dxf?.getElementsByTagNameNS("*", "fgColor")[0]?.getAttribute("rgb");
      return color && /^[0-9a-f]{8}$/i.test(color) ? `#${color.slice(-6)}` : null;
    };
    const operatorNames = { greaterThan: "gt", greaterThanOrEqual: "gte", lessThan: "lt", lessThanOrEqual: "lte", equal: "eq", notEqual: "ne" };
    const result = new Map();
    for (const name of sheetNames) {
      const target = sheetTargets.get(name), sheetFile = target && zip.file(target);
      if (!sheetFile) continue;
      const sheetXml = parseXml(await sheetFile.async("string"));
      const rules = [];
      for (const block of Array.from(sheetXml.getElementsByTagNameNS("*", "conditionalFormatting"))) {
        const ranges = block.getAttribute("sqref").trim().split(/\s+/).filter(Boolean);
        for (const node of Array.from(block.getElementsByTagNameNS("*", "cfRule"))) {
          if (node.getAttribute("type") !== "cellIs") continue;
          const operator = operatorNames[node.getAttribute("operator")];
          const fill = differentialFill(Number(node.getAttribute("dxfId")));
          const formula = node.getElementsByTagNameNS("*", "formula")[0]?.textContent || "";
          if (!operator || !fill || !ranges.length) continue;
          let value = formula.trim();
          if (/^".*"$/.test(value)) value = value.slice(1, -1).replace(/""/g, "\"");
          for (const range of ranges) rules.push({ range, operator, value, fill });
        }
      }
      result.set(name, rules);
    }
    return result;
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

  // Small recursive-descent arithmetic parser. Formula text is data: never
  // pass it to eval/Function, even after replacing cell references.
  function evaluateArithmetic(source) {
    const tokens = [];
    const pattern = /\s*(\d+(?:\.\d*)?|\.\d+|[()+\-*/^])/y;
    let offset = 0;
    while (offset < source.length) {
      if (!source.slice(offset).trim()) break;
      pattern.lastIndex = offset;
      const match = pattern.exec(source);
      if (!match) throw new Error("Unsupported formula expression");
      tokens.push(match[1]);
      offset = pattern.lastIndex;
    }
    let cursor = 0;
    const parsePrimary = () => {
      const token = tokens[cursor++];
      if (token === "+") return parsePrimary();
      if (token === "-") return -parsePrimary();
      if (token === "(") {
        const value = parseExpression(0);
        if (tokens[cursor++] !== ")") throw new Error("Missing closing parenthesis");
        return value;
      }
      const number = Number(token);
      if (token === undefined || !Number.isFinite(number)) throw new Error("Invalid formula number");
      return number;
    };
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
    const parseExpression = (minimum) => {
      let left = parsePrimary();
      while (cursor < tokens.length) {
        const op = tokens[cursor];
        const level = precedence[op] || 0;
        if (level < minimum || !level) break;
        cursor++;
        const right = parseExpression(level + (op === "^" ? 0 : 1));
        if (op === "+") left += right;
        else if (op === "-") left -= right;
        else if (op === "*") left *= right;
        else if (op === "/") left /= right;
        else left = left ** right;
      }
      return left;
    };
    const result = parseExpression(0);
    if (cursor !== tokens.length || !Number.isFinite(result)) throw new Error("Invalid formula result");
    return result;
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
        const comparison = resolvedCond.match(/^\s*(.*?)\s*(>=|<=|<>|!=|=|>|<)\s*(.*?)\s*$/);
        let result;
        if (comparison) {
          const left = evaluateArithmetic(comparison[1]), right = evaluateArithmetic(comparison[3]);
          const op = comparison[2];
          result = op === ">" ? left > right : op === "<" ? left < right : op === ">=" ? left >= right : op === "<=" ? left <= right : op === "<>" || op === "!=" ? left !== right : left === right;
        } else result = evaluateArithmetic(resolvedCond) !== 0;
        return result ? valTrue : valFalse;
      }

      // 3. Basic arithmetic expression with cell replacement
      const resolvedExpr = expr.replace(/[A-Z]+[0-9]+/gi, (m) => {
        const val = Number(evaluateCell(m.toUpperCase(), new Set(visited)));
        return isNaN(val) ? 0 : val;
      });

      // Safe arithmetic evaluator
      const res = evaluateArithmetic(resolvedExpr);
      return Math.round(res * 10000) / 10000;
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
    const sheet = getActiveSheet();
    sheet.columnWidths ||= {};
    sheet.rowHeights ||= {};

    const colgroup = document.createElement("colgroup");
    const rowHeaderCol = document.createElement("col");
    rowHeaderCol.style.width = "44px";
    colgroup.appendChild(rowHeaderCol);
    for (let c = 1; c <= NUM_COLS; c++) {
      const col = document.createElement("col");
      col.dataset.col = c;
      col.style.width = `${sheet.columnWidths[c] || 90}px`;
      colgroup.appendChild(col);
    }
    sheetTable.appendChild(colgroup);

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
      const handle = document.createElement("span");
      handle.className = "grid-resize-handle column-resize-handle";
      handle.title = "Drag to resize column";
      handle.addEventListener("mousedown", (event) => beginGridResize(event, "column", c));
      th.appendChild(handle);
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
      const rowHandle = document.createElement("span");
      rowHandle.className = "grid-resize-handle row-resize-handle";
      rowHandle.title = "Drag to resize row";
      rowHandle.addEventListener("mousedown", (event) => beginGridResize(event, "row", r));
      rowTh.appendChild(rowHandle);
      tr.style.height = `${sheet.rowHeights[r] || 24}px`;
      tr.appendChild(rowTh);

      // Data Cells
      for (let c = 1; c <= NUM_COLS; c++) {
        const td = document.createElement("td");
        td.dataset.row = r;
        td.dataset.col = c;
        td.dataset.coord = getCoord(r, c);

        td.addEventListener("mousedown", (e) => {
          if (e.target.classList.contains("fill-handle")) {
            e.preventDefault(); e.stopPropagation();
            fillDrag = { source: { ...activeCell }, target: { row: r, col: c } };
            return;
          }
          isSelectingRange = true;
          rangeAnchor = { row: r, col: c };
          rangeHead = { row: r, col: c };
          setActiveCell(r, c);
        });
        td.addEventListener("mouseenter", (e) => {
          if (fillDrag && (e.buttons & 1)) { fillDrag.target = { row: r, col: c }; return; }
          if (!isSelectingRange || !(e.buttons & 1)) return;
          rangeHead = { row: r, col: c };
          activeCell = { row: r, col: c };
          updateActiveCellUI();
        });

        td.addEventListener("dblclick", () => {
          editActiveCell();
        });

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    sheetTable.appendChild(tbody);
    applyMergeDOM();
  }

  function beginGridResize(event, axis, index) {
    event.preventDefault();
    event.stopPropagation();
    const sheet = getActiveSheet();
    const sizeMap = axis === "column" ? (sheet.columnWidths ||= {}) : (sheet.rowHeights ||= {});
    const fallback = axis === "column" ? 90 : 24;
    const startSize = sizeMap[index] || fallback;
    const startPoint = axis === "column" ? event.clientX : event.clientY;
    const column = axis === "column" ? sheetTable.querySelector(`col[data-col="${index}"]`) : null;
    const row = axis === "row" ? sheetTable.querySelector(`th.row-header[data-row="${index}"]`)?.parentElement : null;
    const onMove = (moveEvent) => {
      const point = axis === "column" ? moveEvent.clientX : moveEvent.clientY;
      const nextSize = Math.max(axis === "column" ? 40 : 22, Math.min(axis === "column" ? 600 : 240, startSize + point - startPoint));
      sizeMap[index] = Math.round(nextSize);
      if (column) column.style.width = `${sizeMap[index]}px`;
      if (row) row.style.height = `${sizeMap[index]}px`;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  document.addEventListener("mouseup", () => {
    isSelectingRange = false;
    if (!fillDrag) return;
    const { source, target } = fillDrag;
    const sourceCoord = getCoord(source.row, source.col);
    const sourceData = { ...getCellData(sourceCoord) };
    const rowStep = target.row >= source.row ? 1 : -1;
    const colStep = target.col >= source.col ? 1 : -1;
    for (let row = source.row; rowStep > 0 ? row <= target.row : row >= target.row; row += rowStep) {
      for (let col = source.col; colStep > 0 ? col <= target.col : col >= target.col; col += colStep) {
        if (row === source.row && col === source.col) continue;
        const raw = sourceData.raw || "";
        const shifted = raw.startsWith("=") ? raw.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, (m, absCol, letters, absRow, digits) => {
          const column = letterToCol(letters) + (absCol ? 0 : col - source.col);
          const rowNumber = Number(digits) + (absRow ? 0 : row - source.row);
          return `${absCol}${colToLetter(Math.max(1, Math.min(NUM_COLS, column)))}${absRow}${Math.max(1, rowNumber)}`;
        }) : raw;
        setCellData(getCoord(row, col), { ...sourceData, raw: shifted });
      }
    }
    rangeAnchor = { ...source }; rangeHead = { ...target }; activeCell = { ...target };
    fillDrag = null;
    refreshGridDisplay();
  });

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
        td.style.backgroundColor = applyConditionalFormats(coord, evaluated, cell.fill || "transparent");
      }
    }

    updateActiveCellUI();
    updateStatsBar();
  }

  // Set Active Cell
  function setActiveCell(row, col, preserveRange = false) {
    activeCell = { row, col };
    if (!preserveRange) rangeAnchor = rangeHead = { row, col };
    updateActiveCellUI();
  }

  function updateActiveCellUI() {
    const coord = getCoord(activeCell.row, activeCell.col);
    const r1 = Math.min(rangeAnchor.row, rangeHead.row), r2 = Math.max(rangeAnchor.row, rangeHead.row);
    const c1 = Math.min(rangeAnchor.col, rangeHead.col), c2 = Math.max(rangeAnchor.col, rangeHead.col);
    const selectionLabel = r1 === r2 && c1 === c2 ? coord : `${getCoord(r1, c1)}:${getCoord(r2, c2)}`;
    cellCoordEl.textContent = selectionLabel;

    // Remove old active styling
    sheetTable.querySelectorAll(".active-cell, .range-selected").forEach((el) => el.classList.remove("active-cell", "range-selected"));
    for (let row = r1; row <= r2; row++) for (let col = c1; col <= c2; col++) {
      const selected = sheetTable.querySelector(`td[data-coord="${getCoord(row, col)}"]`);
      if (selected) selected.classList.add("range-selected");
    }
    const td = sheetTable.querySelector(`td[data-coord="${coord}"]`);
    if (td) {
      td.classList.add("active-cell");
      td.querySelectorAll(".fill-handle").forEach((handle) => handle.remove());
      const handle = document.createElement("span");
      handle.className = "fill-handle";
      handle.title = "Drag to fill cells";
      td.appendChild(handle);
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
    updateStatsBar();
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
  btnMergeCells.addEventListener("click", mergeSelectedCells);
  btnUnmergeCells.addEventListener("click", unmergeSelectedCells);
  btnConditionalFormat.addEventListener("click", addConditionalFormat);

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
    const vals = [];
    const r1 = Math.min(rangeAnchor.row, rangeHead.row), r2 = Math.max(rangeAnchor.row, rangeHead.row);
    const c1 = Math.min(rangeAnchor.col, rangeHead.col), c2 = Math.max(rangeAnchor.col, rangeHead.col);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const raw = evaluateCell(getCoord(r, c));
      if (raw !== "" && Number.isFinite(Number(raw))) vals.push(Number(raw));
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
      if (sheet.tabColor) tab.style.borderTop = `3px solid ${sheet.tabColor}`;

      tab.addEventListener("click", () => {
        activeSheetIdx = idx;
        renderSheetTabs();
        buildTableDOM();
        refreshGridDisplay();
      });

      tab.addEventListener("dblclick", () => {
        const newName = prompt("Rename sheet:", sheet.name);
        if (newName && newName.trim()) {
          sheet.name = newName.trim();
          renderSheetTabs();
        }
      });
      tab.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const color = prompt("Sheet tab color (hex, blank to clear):", sheet.tabColor || "#10b981");
        if (color === null) return;
        if (color === "") delete sheet.tabColor;
        else if (/^#[0-9a-f]{6}$/i.test(color)) sheet.tabColor = color;
        else return alert("Enter a color such as #10b981.");
        renderSheetTabs();
      });

      sheetTabsList.appendChild(tab);
    });
  }

  document.getElementById("btnAddSheet").addEventListener("click", () => {
    const newName = `Sheet${workbook.sheets.length + 1}`;
    workbook.sheets.push({ name: newName, cells: {} });
    activeSheetIdx = workbook.sheets.length - 1;
    renderSheetTabs();
    buildTableDOM();
    refreshGridDisplay();
  });

  document.getElementById("btnDuplicateSheet").addEventListener("click", () => {
    const source = getActiveSheet();
    const copy = JSON.parse(JSON.stringify(source));
    copy.name = `${source.name} copy`;
    workbook.sheets.splice(activeSheetIdx + 1, 0, copy);
    activeSheetIdx += 1;
    renderSheetTabs();
    buildTableDOM();
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
      buildTableDOM();
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
        const wb = window.XLSX.read(ab, { type: "array", cellStyles: true });
        const importedConditionalFormats = await readXlsxConditionalFormats(ab, wb.SheetNames);

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

        const columnWidths = {};
        (ws["!cols"] || []).forEach((column, index) => {
          if (column && Number.isFinite(column.wpx)) columnWidths[index + 1] = Math.max(40, Math.min(600, column.wpx));
        });
        const rowHeights = {};
        (ws["!rows"] || []).forEach((row, index) => {
          if (row && Number.isFinite(row.hpx)) rowHeights[index + 1] = Math.max(22, Math.min(240, row.hpx));
        });
        workbook.sheets.push({ name: sheetName, cells, columnWidths, rowHeights, mergedRanges: (ws["!merges"] || []).map((merge) => `${window.XLSX.utils.encode_cell(merge.s)}:${window.XLSX.utils.encode_cell(merge.e)}`), conditionalFormats: importedConditionalFormats.get(sheetName) || [] });
        });

        if (workbook.sheets.length === 0) {
          workbook.sheets.push({ name: "Sheet1", cells: {} });
        }

        activeSheetIdx = 0;
        activeCell = { row: 1, col: 1 };
        renderSheetTabs();
        buildTableDOM();
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
  document.getElementById("btnExportXlsx").addEventListener("click", async () => {
    if (!window.XLSX) {
      alert("XLSX library missing.");
      return;
    }
    if (!window.JSZip) {
      alert("Local XLSX package editor is missing.");
      return;
    }
    const title = sheetTitleInput.value.trim() || "Spreadsheet";
    const wb = window.XLSX.utils.book_new();
    const pendingConditionalFormats = [];

    workbook.sheets.forEach((sheet, sheetIndex) => {
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
      ws["!cols"] = Array.from({ length: NUM_COLS }, (_, index) => ({ wpx: sheet.columnWidths?.[index + 1] || 90 }));
      ws["!rows"] = Array.from({ length: NUM_ROWS }, (_, index) => ({ hpx: sheet.rowHeights?.[index + 1] || 24 }));
      ws["!merges"] = (sheet.mergedRanges || []).map((range) => {
        const bounds = parseRange(range);
        return bounds ? { s: { r: bounds.r1 - 1, c: bounds.c1 - 1 }, e: { r: bounds.r2 - 1, c: bounds.c2 - 1 } } : null;
      }).filter(Boolean);
      window.XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      const operatorNames = { gt: "greaterThan", gte: "greaterThanOrEqual", lt: "lessThan", lte: "lessThanOrEqual", eq: "equal", ne: "notEqual" };
      const rules = (sheet.conditionalFormats || []).map(rule => {
        const bounds = parseRange(rule.range);
        const operator = operatorNames[rule.operator];
        if (!bounds || !operator || !/^#[0-9a-f]{6}$/i.test(rule.fill || "")) return null;
        const raw = String(rule.value).trim();
        const formula = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(raw) ? raw : `"${raw.replace(/"/g, '""')}"`;
        return { range: `${getCoord(bounds.r1, bounds.c1)}:${getCoord(bounds.r2, bounds.c2)}`, operator, formula, fill: rule.fill.slice(1).toUpperCase() };
      }).filter(Boolean);
      pendingConditionalFormats.push({ sheetIndex, rules });
    });

    try {
      const generated = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const zip = await window.JSZip.loadAsync(generated);
      const stylesFile = zip.file("xl/styles.xml");
      if (!stylesFile) throw new Error("Generated workbook has no xl/styles.xml.");
      let stylesXml = await stylesFile.async("string");
      const dxfMatch = stylesXml.match(/<dxfs\b([^>]*)>([\s\S]*?)<\/dxfs>/i);
      const selfClosingDxfMatch = stylesXml.match(/<dxfs\b([^>]*)\s*\/>/i);
      const baseDxfCount = dxfMatch ? Number(dxfMatch[1].match(/count="(\d+)"/i)?.[1] || 0) : selfClosingDxfMatch ? Number(selfClosingDxfMatch[1].match(/count="(\d+)"/i)?.[1] || 0) : 0;
      const dxfXml = [];
      const conditionalXml = new Map();
      let priority = 1;
      pendingConditionalFormats.forEach(({ sheetIndex, rules }) => {
        const sheetBlocks = [];
        rules.forEach(rule => {
          const dxfId = baseDxfCount + dxfXml.length;
          dxfXml.push(`<dxf><fill><patternFill patternType="solid"><fgColor rgb="FF${rule.fill}"/><bgColor indexed="64"/></patternFill></fill></dxf>`);
          sheetBlocks.push(`<conditionalFormatting sqref="${xmlEscape(rule.range)}"><cfRule type="cellIs" dxfId="${dxfId}" priority="${priority++}" operator="${rule.operator}"><formula>${xmlEscape(rule.formula)}</formula></cfRule></conditionalFormatting>`);
        });
        conditionalXml.set(sheetIndex, sheetBlocks.join(""));
      });
      if (dxfXml.length) {
        const entries = dxfMatch ? dxfMatch[2] : "";
        const newDxfs = `<dxfs count="${baseDxfCount + dxfXml.length}">${entries}${dxfXml.join("")}</dxfs>`;
        if (dxfMatch) stylesXml = stylesXml.replace(dxfMatch[0], newDxfs);
        else if (selfClosingDxfMatch) stylesXml = stylesXml.replace(selfClosingDxfMatch[0], newDxfs);
        else stylesXml = stylesXml.replace(/<\/styleSheet>/i, `${newDxfs}</styleSheet>`);
        zip.file("xl/styles.xml", stylesXml);
      }

      for (const [sheetIndex, blocks] of conditionalXml) {
        if (!blocks) continue;
        const path = `xl/worksheets/sheet${sheetIndex + 1}.xml`, file = zip.file(path);
        if (!file) throw new Error(`Generated workbook is missing ${path}.`);
        let xml = await file.async("string");
        if (xml.includes("</mergeCells>")) xml = xml.replace("</mergeCells>", `</mergeCells>${blocks}`);
        else if (xml.includes("</sheetData>")) xml = xml.replace("</sheetData>", `</sheetData>${blocks}`);
        else throw new Error(`Cannot find the conditional formatting insertion point in ${path}.`);
        zip.file(path, xml);
      }

      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${title}.xlsx`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      alert(`Error exporting spreadsheet: ${error.message}`);
    }
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

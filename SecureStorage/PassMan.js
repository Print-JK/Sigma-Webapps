// ===================== Helper Functions =====================
const str2ab = str => new TextEncoder().encode(str);
const ab2str = buf => new TextDecoder().decode(buf);
const buf2base64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const base642buf = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(file);
    });
}

// Robust CSV Parser (Handles quoted fields & commas)
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    return lines.map(line => {
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*)/g;
        const row = [];
        let matches;
        while ((matches = regex.exec(line)) !== null) {
            let val = matches[1];
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
            }
            row.push(val);
        }
        return row;
    });
}

// ===================== Crypto Logic =====================
async function generateKey() {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const exported = await crypto.subtle.exportKey("raw", key);
    return { key, b64: buf2base64(exported) };
}

async function importKey(b64) {
    return await crypto.subtle.importKey("raw", base642buf(b64), "AES-GCM", true, ["encrypt", "decrypt"]);
}

async function encryptData(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, str2ab(text));
    return `${buf2base64(iv)}.${buf2base64(encrypted)}`;
}

async function decryptData(combined, key) {
    const [ivB64, dataB64] = combined.split(".");
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base642buf(ivB64) }, key, base642buf(dataB64));
    return ab2str(decrypted);
}

// ===================== Dynamic Table Logic =====================
let currentKey = null;
let tableHeaders = ["Website/Service", "Username", "Password"];

function renderHeaders() {
    const thead = document.getElementById("tableHead");
    thead.innerHTML = "";
    const tr = document.createElement("tr");

    tableHeaders.forEach((header, index) => {
        const th = document.createElement("th");
        th.contentEditable = "true";
        th.innerText = header;
        th.addEventListener("blur", (e) => {
            tableHeaders[index] = e.target.innerText;
        });
        tr.appendChild(th);
    });

    // Action Column Header
    const actionTh = document.createElement("th");
    actionTh.style.width = "60px";
    actionTh.innerText = "Action";
    tr.appendChild(actionTh);

    thead.appendChild(tr);
}

function addRow(rowData = null) {
    const tbody = document.getElementById("tableBody");
    const tr = document.createElement("tr");

    const columnsCount = tableHeaders.length;
    const values = rowData || Array(columnsCount).fill("New Entry");

    for (let i = 0; i < columnsCount; i++) {
        const td = document.createElement("td");
        td.contentEditable = "true";
        td.innerText = values[i] !== undefined ? values[i] : "";
        
        // Auto-detect password column by header name for blur effect
        const isPasswordCol = tableHeaders[i] && tableHeaders[i].toLowerCase().includes("pass");
        if (isPasswordCol) {
            td.classList.add("password-cell");
        }

        tr.appendChild(td);
    }

    // Delete Button Column
    const actionTd = document.createElement("td");
    actionTd.innerHTML = `<button class="delete-btn" onclick="removeRow(this)">Delete</button>`;
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
    updateRecordCount();
}

function removeRow(btn) {
    btn.closest("tr").remove();
    updateRecordCount();
}

function addColumn() {
    const colName = prompt("Enter new column name:", "Notes");
    if (!colName) return;

    tableHeaders.push(colName);
    renderHeaders();

    // Add empty cell to existing rows
    const rows = document.querySelectorAll("#tableBody tr");
    rows.forEach(tr => {
        const actionTd = tr.lastElementChild;
        const td = document.createElement("td");
        td.contentEditable = "true";
        td.innerText = "";
        tr.insertBefore(td, actionTd);
    });
}

function updateRecordCount() {
    const count = document.querySelectorAll("#tableBody tr").length;
    document.getElementById("recordCount").innerText = `${count} Records`;
}

function buildTableFromCSV(csvText) {
    const data = parseCSV(csvText);
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (data.length === 0) return;

    // Check if first line resembles headers (non-empty string check)
    const hasHeader = prompt("Does your CSV file contain a header row? (yes/no)", "yes");
    
    if (hasHeader && hasHeader.toLowerCase().startsWith("y")) {
        tableHeaders = data[0];
        renderHeaders();
        data.slice(1).forEach(row => addRow(row));
    } else {
        tableHeaders = data[0].map((_, i) => `Column ${i + 1}`);
        renderHeaders();
        data.forEach(row => addRow(row));
    }
}

function tableToCSV() {
    const rows = [tableHeaders];
    const trs = document.querySelectorAll("#tableBody tr");

    trs.forEach(tr => {
        const row = [];
        const tds = Array.from(tr.querySelectorAll("td")).slice(0, tableHeaders.length);
        tds.forEach(td => {
            let val = td.innerText.replace(/"/g, '""');
            if (val.includes(",") || val.includes("\n")) val = `"${val}"`;
            row.push(val);
        });
        rows.push(row);
    });

    return rows.map(r => r.join(",")).join("\n");
}

async function processKeyFile(file) {
    if (!file) return;
    const text = await readFileAsText(file);
    currentKey = await importKey(text.trim());
    document.getElementById("keyStatus").innerText = `Key active: (${file.name})`;
}

async function processVaultFile(file) {
    if (!file) return;
    if (!currentKey) return alert("Please load a decryption key first!");
    
    const content = await readFileAsText(file);
    try {
        const decrypted = await decryptData(content.trim(), currentKey);
        buildTableFromCSV(decrypted);
    } catch (err) {
        alert("Decryption failed. Reading as unencrypted CSV...");
        buildTableFromCSV(content);
    }
}

// ===================== Drag & Drop Setup =====================
function setupDropZone(zoneId, handleFileFn) {
    const dropZone = document.getElementById(zoneId);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => {
        dropZone.addEventListener(eName, e => e.preventDefault(), false);
        dropZone.addEventListener(eName, e => e.stopPropagation(), false);
    });

    ['dragenter', 'dragover'].forEach(eName => {
        dropZone.addEventListener(eName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eName => {
        dropZone.addEventListener(eName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileFn(files[0]);
    });
}

setupDropZone('keyDropZone', processKeyFile);
setupDropZone('csvDropZone', processVaultFile);

// ===================== Event Listeners =====================
document.getElementById("generateKeyBtn").addEventListener("click", async () => {
    const { key, b64 } = await generateKey();
    currentKey = key;
    downloadBlob(b64, "passman.key");
    document.getElementById("keyStatus").innerText = "Key active: (New key generated & saved)";
});

document.getElementById("keyFileUpload").addEventListener("change", (e) => processKeyFile(e.target.files[0]));
document.getElementById("csvFileInput").addEventListener("change", (e) => processVaultFile(e.target.files[0]));

document.getElementById("addNewBtn").addEventListener("click", () => {
    if (!currentKey) return alert("Generate or load a key first.");
    addRow();
});

document.getElementById("addColumnBtn").addEventListener("click", addColumn);

document.getElementById("downloadEncryptedBtn").addEventListener("click", async () => {
    if (!currentKey) return alert("No key loaded.");
    const csv = tableToCSV();
    const encrypted = await encryptData(csv, currentKey);
    downloadBlob(encrypted, "vault.enc");
});

document.getElementById("downloadCSVBtn").addEventListener("click", () => {
    downloadBlob(tableToCSV(), "passwords_plaintext.csv");
});

function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
}

// Initialize Default Table Headers on Load
renderHeaders();

const pageToggle = document.getElementById("pageToggle");

pageToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
        window.location.href = "ZIPencrypt.html";
    }
});
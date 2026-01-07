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

// ===================== Table Logic =====================
let currentKey = null;

function addRow(site = "New Site", user = "Username", pass = "Password") {
    const tbody = document.getElementById("tableBody");
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td contenteditable="true">${site}</td>
        <td contenteditable="true">${user}</td>
        <td contenteditable="true" class="password-cell">${pass}</td>
        <td><button class="delete-btn" onclick="this.parentElement.parentElement.remove()">Delete</button></td>
    `;
    tbody.appendChild(tr);
}

function tableToCSV() {
    const rows = Array.from(document.querySelectorAll("#tableBody tr"));
    return rows.map(tr => {
        const cells = Array.from(tr.querySelectorAll("td")).slice(0, 3);
        return cells.map(td => td.innerText.replace(/,/g, "")).join(","); // Simple CSV (no commas allowed in text)
    }).join("\n");
}

function csvToTable(csvText) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";
    const lines = csvText.split("\n").filter(l => l.trim());
    lines.forEach(line => {
        const [site, user, pass] = line.split(",");
        addRow(site, user, pass);
    });
}

// ===================== Event Listeners =====================

// Generate Key
document.getElementById("generateKeyBtn").addEventListener("click", async () => {
    const { key, b64 } = await generateKey();
    currentKey = key;
    const blob = new Blob([b64], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "passman.key"; a.click();
    document.getElementById("keyStatus").innerText = "Key active: (New key generated)";
});

// Upload Key
document.getElementById("keyFileUpload").addEventListener("change", async (e) => {
    const text = await readFileAsText(e.target.files[0]);
    currentKey = await importKey(text.trim());
    document.getElementById("keyStatus").innerText = "Key active: (Imported from file)";
});

// Decrypt/Load File
document.getElementById("csvFileInput").addEventListener("change", async (e) => {
    if (!currentKey) return alert("Please load a key first!");
    const content = await readFileAsText(e.target.files[0]);
    try {
        const decrypted = await decryptData(content.trim(), currentKey);
        csvToTable(decrypted);
    } catch (err) {
        alert("Decryption failed. Using as raw CSV...");
        csvToTable(content); // Try loading as raw CSV if decryption fails
    }
});

// Create New Entry
document.getElementById("addNewBtn").addEventListener("click", () => {
    if (!currentKey) return alert("Generate/Load a key first to start a vault.");
    addRow();
});

// Download Encrypted
document.getElementById("downloadEncryptedBtn").addEventListener("click", async () => {
    if (!currentKey) return alert("No key loaded.");
    const csv = tableToCSV();
    const encrypted = await encryptData(csv, currentKey);
    downloadBlob(encrypted, "vault.enc");
});

// Download Plaintext CSV
document.getElementById("downloadCSVBtn").addEventListener("click", () => {
    downloadBlob(tableToCSV(), "passwords_plaintext.csv");
});

function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
}
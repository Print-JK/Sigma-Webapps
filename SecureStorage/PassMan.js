/**
 * PassMan.js — Secure Password Manager & Vault Engine
 * 100% Client-Side AES-GCM Cryptography & Encrypted ZIP Key Importer
 */

// ===================== Helper Functions =====================
const str2ab = str => new TextEncoder().encode(str);
const ab2str = buf => new TextDecoder().decode(buf);
const buf2base64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const base642buf = b64 => Uint8Array.from(atob(b64.trim()), c => c.charCodeAt(0));

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read binary file."));
    reader.readAsArrayBuffer(file);
  });
}

// Robust CSV Parser (Handles quoted fields, commas & newlines)
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
  const buf = base642buf(b64);
  if (buf.length !== 32) {
    throw new Error(`Invalid AES key size: expected 32 bytes (256-bit), got ${buf.length} bytes.`);
  }
  return await crypto.subtle.importKey("raw", buf, "AES-GCM", true, ["encrypt", "decrypt"]);
}

async function encryptData(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, str2ab(text));
  return `${buf2base64(iv)}.${buf2base64(encrypted)}`;
}

async function decryptData(combined, key) {
  const parts = combined.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted format. Expected 'iv.ciphertext'.");
  }
  const [ivB64, dataB64] = parts;
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base642buf(ivB64) }, key, base642buf(dataB64));
  return ab2str(decrypted);
}

// ===================== Vault State & Table Logic =====================
let currentKey = null;
let currentKeyMetadata = null; // { name, source }
let tableHeaders = ["Website/Service", "Username", "Password", "Notes"];

function renderHeaders() {
  const thead = document.getElementById("tableHead");
  thead.innerHTML = "";
  const tr = document.createElement("tr");

  tableHeaders.forEach((header, index) => {
    const th = document.createElement("th");
    th.contentEditable = "true";
    th.innerText = header;
    th.addEventListener("blur", (e) => {
      tableHeaders[index] = e.target.innerText.trim() || `Column ${index + 1}`;
    });
    tr.appendChild(th);
  });

  // Action Column Header
  const actionTh = document.createElement("th");
  actionTh.style.width = "100px";
  actionTh.innerText = "Actions";
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
    const val = values[i] !== undefined ? values[i] : "";
    const isPasswordCol = tableHeaders[i] && tableHeaders[i].toLowerCase().includes("pass");

    if (isPasswordCol) {
      td.innerHTML = `
        <div class="password-cell-wrapper">
          <span class="password-cell-text blurred" contenteditable="true">${escapeHTML(val)}</span>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="table-icon-btn toggle-pwd" title="Reveal / Hide password">👁</button>
            <button type="button" class="table-icon-btn copy-pwd" title="Copy password">📋</button>
          </div>
        </div>
      `;
      const pwdText = td.querySelector(".password-cell-text");
      const toggleBtn = td.querySelector(".toggle-pwd");
      const copyBtn = td.querySelector(".copy-pwd");

      toggleBtn.addEventListener("click", () => {
        const isBlurred = pwdText.classList.toggle("blurred");
        toggleBtn.innerText = isBlurred ? "👁" : "🙈";
      });

      copyBtn.addEventListener("click", async () => {
        await copyToClipboard(pwdText.innerText);
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "✓";
        setTimeout(() => (copyBtn.innerText = originalText), 1500);
      });
    } else {
      td.contentEditable = "true";
      td.innerText = val;
    }

    tr.appendChild(td);
  }

  // Delete & Row Actions
  const actionTd = document.createElement("td");
  actionTd.innerHTML = `<button class="delete-btn" type="button" onclick="removeRow(this)">Delete</button>`;
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

  tableHeaders.push(colName.trim());
  renderHeaders();

  // Add empty cell to existing rows before the action column
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
  const countBadge = document.getElementById("recordCount");
  if (countBadge) countBadge.innerText = `${count} Records`;
}

function buildTableFromCSV(csvText) {
  const data = parseCSV(csvText);
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (data.length === 0) return;

  // Ask user about header row with a clean prompt
  const hasHeader = confirm("Does your file contain a header row in the first line?\n\nClick OK for Yes, Cancel for No.");

  if (hasHeader) {
    tableHeaders = data[0].map(h => h.trim() || "Column");
    renderHeaders();
    data.slice(1).forEach(row => addRow(row));
  } else {
    tableHeaders = data[0].map((_, i) => `Column ${i + 1}`);
    renderHeaders();
    data.forEach(row => addRow(row));
  }

  const vaultBadge = document.getElementById("vaultBadge");
  if (vaultBadge) {
    vaultBadge.innerText = "Loaded";
    vaultBadge.className = "badge badge-accent";
  }
}

function tableToCSV() {
  const rows = [tableHeaders];
  const trs = document.querySelectorAll("#tableBody tr");

  trs.forEach(tr => {
    const row = [];
    const tds = Array.from(tr.querySelectorAll("td")).slice(0, tableHeaders.length);
    tds.forEach((td, i) => {
      const isPasswordCol = tableHeaders[i] && tableHeaders[i].toLowerCase().includes("pass");
      let val = "";
      if (isPasswordCol) {
        const textSpan = td.querySelector(".password-cell-text");
        val = textSpan ? textSpan.innerText : td.innerText;
      } else {
        val = td.innerText;
      }
      val = val.replace(/"/g, '""');
      if (val.includes(",") || val.includes("\n") || val.includes('"')) {
        val = `"${val}"`;
      }
      row.push(val);
    });
    rows.push(row);
  });

  return rows.map(r => r.join(",")).join("\n");
}

function escapeHTML(str) {
  const p = document.createElement("p");
  p.textContent = str;
  return p.innerHTML;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// ===================== Key Management & Status =====================
function setActiveKey(key, metadata) {
  currentKey = key;
  currentKeyMetadata = metadata;

  const keyStatus = document.getElementById("keyStatus");
  const keyBadge = document.getElementById("keyBadge");
  const keyStatusDot = document.getElementById("keyStatusDot");

  if (key) {
    keyStatus.innerHTML = `Active key: <strong>${escapeHTML(metadata.name)}</strong> (${escapeHTML(metadata.source)})`;
    if (keyBadge) {
      keyBadge.innerText = "Active";
      keyBadge.className = "badge badge-accent";
    }
    if (keyStatusDot) {
      keyStatusDot.className = "status-dot online";
    }
  } else {
    keyStatus.innerText = "No key loaded.";
    if (keyBadge) {
      keyBadge.innerText = "No Key";
      keyBadge.className = "badge";
    }
    if (keyStatusDot) {
      keyStatusDot.className = "status-dot";
    }
  }
}

async function processKeyFile(file) {
  if (!file) return;

  // Check if user accidentally dropped a zip archive into the key dropzone
  if (file.name.toLowerCase().endsWith(".zip") || file.name.toLowerCase().endsWith(".enc")) {
    const isEncVault = file.name.toLowerCase().endsWith(".enc") && file.size < 50000;
    // Check if it's an encrypted ZIP
    try {
      const buf = await readFileAsArrayBuffer(file);
      const inspection = window.ZipDecryptor.inspectZipEncryption(buf);
      if (inspection.type === "standard_zip" || (inspection.type === "xor_container" && file.size > 100)) {
        await handleZipArchiveBuffer(buf, file.name);
        return;
      }
    } catch (_) {}
  }

  // Confirm overwrite if an existing key is loaded
  if (currentKey && !confirm(`A key (${currentKeyMetadata?.name || "active"}) is already loaded. Do you want to replace it with "${file.name}"?`)) {
    return;
  }

  try {
    const text = await readFileAsText(file);
    const key = await importKey(text.trim());
    setActiveKey(key, { name: file.name, source: "Local .key file" });
  } catch (err) {
    alert(`Failed to import key from "${file.name}": ${err.message}`);
  }
}

async function processVaultFile(file) {
  if (!file) return;
  if (!currentKey) {
    return alert("Please generate or import a decryption key first in step 1.");
  }

  const content = await readFileAsText(file);
  try {
    const decrypted = await decryptData(content.trim(), currentKey);
    buildTableFromCSV(decrypted);
  } catch (err) {
    const proceed = confirm(`Decryption failed with current key (${err.message}).\n\nWould you like to try loading this file as unencrypted CSV?`);
    if (proceed) {
      try {
        buildTableFromCSV(content);
      } catch (e2) {
        alert("Failed to parse file as CSV: " + e2.message);
      }
    }
  }
}

// ===================== Encrypted ZIP Import Workflow =====================
let pendingZipBuffer = null;
let pendingZipFileName = "";
let pendingExtractedFiles = [];
let pendingCandidateKeys = [];
let selectedCandidateKeyIndex = -1;

async function handleZipArchiveFile(file) {
  if (!file) return;
  const buffer = await readFileAsArrayBuffer(file);
  await handleZipArchiveBuffer(buffer, file.name);
}

async function handleZipArchiveBuffer(buffer, fileName) {
  pendingZipBuffer = buffer;
  pendingZipFileName = fileName;

  const inspection = window.ZipDecryptor.inspectZipEncryption(buffer);
  const modal = document.getElementById("zipPasswordModal");
  const methodText = document.getElementById("zipMethodText");
  const passwordInput = document.getElementById("zipPasswordInput");
  const progressContainer = document.getElementById("zipDecryptProgress");

  if (progressContainer) progressContainer.classList.add("hidden");
  passwordInput.value = "";

  if (!inspection.encrypted) {
    // Unencrypted ZIP — decrypt immediately without password prompt
    try {
      const extracted = await window.ZipDecryptor.decryptZipArchive(buffer, null);
      await processExtractedArchiveFiles(extracted);
    } catch (err) {
      alert("Failed to extract ZIP archive: " + err.message);
    }
    return;
  }

  // Archive is encrypted: prompt user
  methodText.innerText = `Detected: ${inspection.methodName} — ${inspection.details}`;
  modal.classList.add("open");
  passwordInput.focus();
}

async function submitZipPassword() {
  const passwordInput = document.getElementById("zipPasswordInput");
  const password = passwordInput.value;
  const progressContainer = document.getElementById("zipDecryptProgress");
  const progressBar = document.getElementById("zipProgressBar");
  const progressText = document.getElementById("zipProgressText");

  if (!password && !confirm("No archive password entered. Attempt decryption anyway?")) {
    return;
  }

  progressContainer.classList.remove("hidden");
  progressBar.style.width = "10%";
  progressText.innerText = "Authenticating & decrypting archive…";

  try {
    const extracted = await window.ZipDecryptor.decryptZipArchive(
      pendingZipBuffer,
      password,
      (pct, msg) => {
        progressBar.style.width = `${pct}%`;
        progressText.innerText = msg;
      }
    );

    // Close password modal
    closeZipModal();
    // Process extracted contents
    await processExtractedArchiveFiles(extracted);
  } catch (err) {
    progressContainer.classList.add("hidden");
    alert(`Decryption failed: ${err.message}\n\nPlease verify the ZIP archive password and try again.`);
  }
}

function closeZipModal() {
  const modal = document.getElementById("zipPasswordModal");
  modal.classList.remove("open");
  const passwordInput = document.getElementById("zipPasswordInput");
  passwordInput.value = "";
}

async function processExtractedArchiveFiles(extractedFiles) {
  pendingExtractedFiles = extractedFiles;
  const candidateKeys = window.ZipDecryptor.findSupportedKeys(extractedFiles);
  pendingCandidateKeys = candidateKeys;

  if (candidateKeys.length === 0) {
    const fileListStr = extractedFiles.map(f => ` • ${f.name} (${f.size} bytes)`).join("\n");
    alert(`Archive extracted successfully (${extractedFiles.length} files), but no supported key files were detected inside.\n\nFiles found:\n${fileListStr}\n\nSupported key files include .key (PassMan Base64 AES-256) and .bin (32-byte binary).`);
    return;
  }

  if (candidateKeys.length === 1) {
    const singleKey = candidateKeys[0];
    const confirmUse = confirm(
      `Discovered 1 compatible key in archive:\n\n` +
      `File: ${singleKey.fileName}\n` +
      `Type: ${singleKey.typeName}\n` +
      `Size: ${singleKey.size} bytes\n\n` +
      `Use this key for PassMan?`
    );
    if (confirmUse) {
      await activateCandidateKey(singleKey);
      checkForVaultFiles(extractedFiles);
    }
    return;
  }

  // Multiple candidate keys found: Show Interactive Selection Modal
  openKeySelectionModal(candidateKeys);
}

function openKeySelectionModal(candidateKeys) {
  const modal = document.getElementById("keySelectModal");
  const listEl = document.getElementById("keyCandidatesList");
  const confirmBtn = document.getElementById("keySelectConfirmBtn");

  listEl.innerHTML = "";
  selectedCandidateKeyIndex = -1;
  confirmBtn.disabled = true;

  candidateKeys.forEach((cand, idx) => {
    const card = document.createElement("div");
    card.className = "key-candidate-card";
    card.innerHTML = `
      <div class="key-candidate-info">
        <span class="key-candidate-name">${escapeHTML(cand.fileName)}</span>
        <span class="key-candidate-meta">${escapeHTML(cand.typeName)} &middot; ${cand.size} bytes &middot; ${cand.details}</span>
      </div>
      <span class="badge ${cand.isValid ? "badge-accent" : ""}">${cand.isValid ? "Valid Format" : "Unknown"}</span>
    `;

    card.addEventListener("click", () => {
      document.querySelectorAll(".key-candidate-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedCandidateKeyIndex = idx;
      confirmBtn.disabled = false;
    });

    listEl.appendChild(card);
  });

  modal.classList.add("open");
}

function closeKeySelectModal() {
  document.getElementById("keySelectModal").classList.remove("open");
  selectedCandidateKeyIndex = -1;
}

async function confirmKeySelection() {
  if (selectedCandidateKeyIndex < 0 || !pendingCandidateKeys[selectedCandidateKeyIndex]) return;
  const chosenKey = pendingCandidateKeys[selectedCandidateKeyIndex];
  closeKeySelectModal();
  await activateCandidateKey(chosenKey);
  checkForVaultFiles(pendingExtractedFiles);
}

async function activateCandidateKey(candidate) {
  if (currentKey && !confirm(`An active key (${currentKeyMetadata?.name}) is currently loaded. Replace with "${candidate.fileName}"?`)) {
    return;
  }

  try {
    let b64 = candidate.rawKeyB64;
    if (!b64 && candidate.data) {
      b64 = buf2base64(candidate.data);
    }
    const key = await importKey(b64);
    setActiveKey(key, {
      name: candidate.fileName,
      source: `Imported from ZIP (${pendingZipFileName || "archive"})`
    });
  } catch (err) {
    alert(`Failed to activate key "${candidate.fileName}": ${err.message}`);
  }
}

function checkForVaultFiles(extractedFiles) {
  // Check if archive also contained a vault file (.enc or .csv)
  const vaultCandidates = extractedFiles.filter(f => {
    const n = f.name.toLowerCase();
    return (n.endsWith(".enc") || n.endsWith(".csv")) && !n.includes("key");
  });

  if (vaultCandidates.length > 0 && currentKey) {
    const vault = vaultCandidates[0];
    const shouldLoad = confirm(
      `Found vault file "${vault.name}" inside the archive!\n\nWould you like to decrypt and load it into your vault now?`
    );
    if (shouldLoad) {
      const text = new TextDecoder().decode(vault.data);
      if (vault.name.toLowerCase().endsWith(".enc")) {
        decryptData(text.trim(), currentKey)
          .then(decrypted => buildTableFromCSV(decrypted))
          .catch(e => alert("Could not decrypt vault with selected key: " + e.message));
      } else {
        buildTableFromCSV(text);
      }
    }
  }
}

// ===================== Drag & Drop Setup =====================
function setupDropZone(zoneId, handleFileFn) {
  const dropZone = document.getElementById(zoneId);
  if (!dropZone) return;

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
  setActiveKey(key, { name: "passman.key", source: "Newly Generated (Downloaded)" });
  downloadBlob(b64, "passman.key");
});

document.getElementById("keyFileUpload").addEventListener("change", (e) => processKeyFile(e.target.files[0]));
document.getElementById("zipArchiveUpload").addEventListener("change", (e) => handleZipArchiveFile(e.target.files[0]));
document.getElementById("csvFileInput").addEventListener("change", (e) => processVaultFile(e.target.files[0]));

document.getElementById("addNewBtn").addEventListener("click", () => {
  if (!currentKey && !confirm("No key is currently loaded. Create an entry anyway? (You will need a key to encrypt)")) {
    return;
  }
  addRow();
});

document.getElementById("addColumnBtn").addEventListener("click", addColumn);

document.getElementById("downloadEncryptedBtn").addEventListener("click", async () => {
  if (!currentKey) return alert("Please load or generate an encryption key first.");
  const csv = tableToCSV();
  try {
    const encrypted = await encryptData(csv, currentKey);
    downloadBlob(encrypted, "vault.enc");
  } catch (err) {
    alert("Encryption failed: " + err.message);
  }
});

document.getElementById("downloadCSVBtn").addEventListener("click", () => {
  downloadBlob(tableToCSV(), "passwords_plaintext.csv");
});

// ZIP Password Modal Listeners
document.getElementById("zipSubmitBtn").addEventListener("click", submitZipPassword);
document.getElementById("zipCancelBtn").addEventListener("click", closeZipModal);
document.getElementById("zipModalCloseBtn").addEventListener("click", closeZipModal);
document.getElementById("zipPasswordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitZipPassword();
  if (e.key === "Escape") closeZipModal();
});
document.getElementById("zipPwdToggleBtn").addEventListener("click", () => {
  const input = document.getElementById("zipPasswordInput");
  const btn = document.getElementById("zipPwdToggleBtn");
  if (input.type === "password") {
    input.type = "text";
    btn.innerText = "🙈";
  } else {
    input.type = "password";
    btn.innerText = "👁";
  }
});

// Key Selection Modal Listeners
document.getElementById("keySelectConfirmBtn").addEventListener("click", confirmKeySelection);
document.getElementById("keySelectCancelBtn").addEventListener("click", closeKeySelectModal);
document.getElementById("keySelectCloseBtn").addEventListener("click", closeKeySelectModal);

// Vault Real-Time Search Filter
const vaultSearchInput = document.getElementById("vaultSearchInput");
if (vaultSearchInput) {
  vaultSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll("#tableBody tr");
    rows.forEach(tr => {
      const text = tr.innerText.toLowerCase();
      tr.style.display = (!query || text.includes(query)) ? "" : "none";
    });
  });
}

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Initialize Default Table Headers on Load
renderHeaders();

// Page Toggle (PassMan <-> ZIPEncrypt)
const pageToggle = document.getElementById("pageToggle");
if (pageToggle) {
  pageToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      window.location.href = "ZIPencrypt.html";
    }
  });
}

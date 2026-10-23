/**
 * zipDecryptor.js
 * Standalone client-side ZIP decryptor & key extractor for SecureStorage.
 * 100% offline, zero server requirement, runs in-browser and under file://.
 * Supports:
 *  - Traditional PKWARE Encryption (ZipCrypto)
 *  - WinZip AES-128 / AES-256 (PBKDF2 + AES-CTR)
 *  - Custom XOR Encrypted Container (.enc from ZIPEncrypt)
 *  - Plain unencrypted ZIPs (.zip)
 */

(function (global) {
  "use strict";

  // Precomputed CRC32 table
  const CRC32_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC32_TABLE[i] = c;
  }

  function crc32Byte(crc, byte) {
    return (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }

  function crc32Buffer(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * ZipCrypto (Traditional PKWARE stream cipher)
   */
  class ZipCrypto {
    constructor(passwordStr) {
      this.key0 = 0x12345678;
      this.key1 = 0x23456789;
      this.key2 = 0x34567890;
      const pwdBytes = new TextEncoder().encode(passwordStr);
      for (let i = 0; i < pwdBytes.length; i++) {
        this.updateKeys(pwdBytes[i]);
      }
    }

    updateKeys(byte) {
      this.key0 = crc32Byte(this.key0, byte) >>> 0;
      this.key1 = (Math.imul(this.key1 + (this.key0 & 0xff), 134775813) + 1) >>> 0;
      this.key2 = crc32Byte(this.key2, (this.key1 >>> 24) & 0xff) >>> 0;
    }

    decryptByte(cipherByte) {
      const temp = (this.key2 | 2) >>> 0;
      const k = (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
      const plain = cipherByte ^ k;
      this.updateKeys(plain);
      return plain;
    }

    decrypt(cipherBytes) {
      const plain = new Uint8Array(cipherBytes.length);
      for (let i = 0; i < cipherBytes.length; i++) {
        plain[i] = this.decryptByte(cipherBytes[i]);
      }
      return plain;
    }

    encryptByte(plainByte) {
      const temp = (this.key2 | 2) >>> 0;
      const k = (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
      const cipherByte = (plainByte ^ k) & 0xff;
      this.updateKeys(plainByte);
      return cipherByte;
    }

    encrypt(plainBytes) {
      const out = new Uint8Array(plainBytes.length);
      for (let i = 0; i < plainBytes.length; i++) {
        out[i] = this.encryptByte(plainBytes[i]);
      }
      return out;
    }
  }

  /**
   * WinZip AES Decryption (PBKDF2 + AES-CTR)
   */
  async function decryptWinZipAES(cipherBytes, passwordStr, keyStrength, salt, pwdVerify) {
    // keyStrength: 1 = 128-bit (salt 8 bytes, key 16 bytes), 2 = 192-bit, 3 = 256-bit (salt 16 bytes, key 32 bytes)
    const keyLen = keyStrength === 1 ? 16 : (keyStrength === 2 ? 24 : 32);
    const totalBits = (keyLen * 2 + 2) * 8; // encKey + authKey + 2 bytes verify

    const pwdBytes = new TextEncoder().encode(passwordStr);
    const baseKey = await crypto.subtle.importKey("raw", pwdBytes, "PBKDF2", false, ["deriveBits"]);
    const derived = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 1000,
        hash: "SHA-1"
      },
      baseKey,
      totalBits
    );

    const derivedBytes = new Uint8Array(derived);
    const encKeyBytes = derivedBytes.subarray(0, keyLen);
    const verifyBytes = derivedBytes.subarray(keyLen * 2, keyLen * 2 + 2);

    if (verifyBytes[0] !== pwdVerify[0] || verifyBytes[1] !== pwdVerify[1]) {
      throw new Error("Incorrect archive password (AES password verification failed).");
    }

    // WinZip AES CTR mode: counter is a 16-byte block initialized with counter = 1 (little-endian uint32 in first 4 bytes or 16-byte block)
    // Modern Web Crypto supports AES-CTR
    const aesKey = await crypto.subtle.importKey("raw", encKeyBytes, { name: "AES-CTR" }, false, ["decrypt"]);
    
    // WinZip AES CTR block format: 16 bytes, Little-Endian counter in first 4 bytes, rest 0
    // Standard AES-CTR counter
    const counterBlock = new Uint8Array(16);
    counterBlock[0] = 1;

    // Decrypt in 16-byte blocks or using AES-CTR with counter length 128
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-CTR",
        counter: counterBlock,
        length: 128
      },
      aesKey,
      cipherBytes
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Raw Inflate / Decompression using native DecompressionStream or raw deflate
   */
  async function decompressDeflate(compressedBytes) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compressedBytes);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        let totalLen = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }
        const out = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.length;
        }
        return out;
      } catch (e) {
        // Fallback to pako if available
        if (global.pako && global.pako.inflateRaw) {
          return global.pako.inflateRaw(compressedBytes);
        }
        throw e;
      }
    }
    if (global.pako && global.pako.inflateRaw) {
      return global.pako.inflateRaw(compressedBytes);
    }
    throw new Error("No Deflate decompressor available in browser environment.");
  }

  /**
   * Inspect ZIP / Container Format & Encryption
   */
  function inspectZipEncryption(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 1. Check for standard ZIP signature PK\x03\x04
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      // Find Central Directory or first file header
      const flags = view.getUint16(6, true);
      const isEncrypted = (flags & 1) !== 0;
      const compMethod = view.getUint16(8, true);

      if (!isEncrypted) {
        return {
          type: "standard_zip",
          encrypted: false,
          methodName: "Unencrypted ZIP",
          details: "Standard unencrypted ZIP archive"
        };
      }

      // Check if it's WinZip AES (compMethod == 99)
      if (compMethod === 99) {
        return {
          type: "standard_zip",
          encrypted: true,
          methodName: "WinZip AES",
          details: "Encrypted with standard WinZip AES-128/256. Password required."
        };
      }

      return {
        type: "standard_zip",
        encrypted: true,
        methodName: "ZipCrypto",
        details: "Encrypted with traditional PKWARE ZipCrypto. Password required."
      };
    }

    // 2. Check if it might be a ZIPEncrypt custom .enc XOR container (32-byte XOR)
    return {
      type: "xor_container",
      encrypted: true,
      methodName: "ZIPEncrypt XOR Container",
      details: "Encrypted container file (.enc) produced by ZIPEncrypt. Requires 32-byte key.bin or password."
    };
  }

  /**
   * Parse Central Directory from a standard ZIP
   */
  function parseZipEntries(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Search for End of Central Directory Record (EOCD)
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error("Invalid ZIP file: End of Central Directory signature not found.");
    }

    const cdEntriesCount = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    const entries = [];
    let cur = cdOffset;
    const decoder = new TextDecoder("utf-8");

    for (let i = 0; i < cdEntriesCount; i++) {
      if (cur + 46 > bytes.length) break;
      if (view.getUint32(cur, true) !== 0x02014b50) break; // PK\x01\x02

      const flags = view.getUint16(cur + 8, true);
      const compMethod = view.getUint16(cur + 10, true);
      const crc = view.getUint32(cur + 16, true);
      const compSize = view.getUint32(cur + 20, true);
      const uncompSize = view.getUint32(cur + 24, true);
      const nameLen = view.getUint16(cur + 28, true);
      const extraLen = view.getUint16(cur + 30, true);
      const commentLen = view.getUint16(cur + 32, true);
      const localHeaderOffset = view.getUint32(cur + 42, true);

      const nameBytes = bytes.subarray(cur + 46, cur + 46 + nameLen);
      const name = decoder.decode(nameBytes);

      entries.push({
        name,
        isDir: name.endsWith("/"),
        encrypted: (flags & 1) !== 0,
        compMethod,
        crc,
        compSize,
        uncompSize,
        localHeaderOffset,
        extraLen
      });

      cur += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
  }

  /**
   * Decrypt and extract all files from a standard ZIP or XOR container
   */
  async function decryptZipArchive(buffer, credential, onProgress) {
    const inspection = inspectZipEncryption(buffer);
    const extractedFiles = [];

    if (inspection.type === "xor_container") {
      // Credential can be Uint8Array key or string
      let keyBytes;
      if (credential instanceof Uint8Array) {
        keyBytes = credential;
      } else if (typeof credential === "string") {
        // If string, could be base64 or text password
        try {
          const binStr = atob(credential.trim());
          if (binStr.length === 32) {
            keyBytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
          }
        } catch (_) {}
        if (!keyBytes) {
          keyBytes = new TextEncoder().encode(credential);
        }
      }

      if (!keyBytes || keyBytes.length === 0) {
        throw new Error("ZIPEncrypt container requires a valid 32-byte key or key file.");
      }

      if (onProgress) onProgress(15, "Decrypting XOR container…");
      const src = new Uint8Array(buffer);
      const decrypted = new Uint8Array(src.length);
      const kLen = keyBytes.length;
      for (let i = 0; i < src.length; i++) {
        decrypted[i] = src[i] ^ keyBytes[i % kLen];
      }

      // Check if decrypted into valid ZIP
      if (decrypted[0] !== 0x50 || decrypted[1] !== 0x4b) {
        throw new Error("Decryption failed. The provided key does not match this container.");
      }

      if (onProgress) onProgress(50, "Parsing decrypted archive…");
      // Use JSZip to parse the decrypted ZIP
      if (global.JSZip) {
        const zip = await global.JSZip.loadAsync(decrypted.buffer);
        const fileNames = Object.keys(zip.files);
        for (let i = 0; i < fileNames.length; i++) {
          const fn = fileNames[i];
          const entry = zip.files[fn];
          if (!entry.dir) {
            const data = await entry.async("uint8array");
            extractedFiles.push({
              name: fn,
              data: data,
              size: data.length
            });
          }
        }
        return extractedFiles;
      }
      buffer = decrypted.buffer;
    }

    // Standard ZIP parsing & entry decryption
    const entries = parseZipEntries(buffer);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx];
      if (entry.isDir) continue;

      if (onProgress) {
        const pct = Math.round(20 + (idx / entries.length) * 75);
        onProgress(pct, `Extracting ${entry.name}…`);
      }

      // Read Local Header
      const lhOffset = entry.localHeaderOffset;
      if (view.getUint32(lhOffset, true) !== 0x04034b50) {
        throw new Error(`Corrupted ZIP entry: invalid local header for ${entry.name}`);
      }
      const lhNameLen = view.getUint16(lhOffset + 26, true);
      const lhExtraLen = view.getUint16(lhOffset + 28, true);
      const dataOffset = lhOffset + 30 + lhNameLen + lhExtraLen;
      const rawPayload = bytes.subarray(dataOffset, dataOffset + entry.compSize);

      let payload = rawPayload;

      if (entry.encrypted) {
        if (!credential || (typeof credential === "string" && !credential.length)) {
          throw new Error("Archive is password-protected. Please enter the archive password.");
        }
        const passwordStr = typeof credential === "string" ? credential : new TextDecoder().decode(credential);

        if (entry.compMethod === 99) {
          // WinZip AES: parse extra field in local header
          const extraBytes = bytes.subarray(lhOffset + 30 + lhNameLen, dataOffset);
          let extraCur = 0;
          let aesStrength = 3; // default 256
          let actualCompMethod = 8;
          while (extraCur + 4 <= extraBytes.length) {
            const tag = extraBytes[extraCur] | (extraBytes[extraCur + 1] << 8);
            const tagLen = extraBytes[extraCur + 2] | (extraBytes[extraCur + 3] << 8);
            if (tag === 0x9901 && tagLen >= 7) {
              aesStrength = extraBytes[extraCur + 8]; // 1=128, 2=192, 3=256
              actualCompMethod = extraBytes[extraCur + 9] | (extraBytes[extraCur + 10] << 8);
            }
            extraCur += 4 + tagLen;
          }

          const saltLen = aesStrength === 1 ? 8 : (aesStrength === 2 ? 12 : 16);
          const salt = rawPayload.subarray(0, saltLen);
          const pwdVerify = rawPayload.subarray(saltLen, saltLen + 2);
          const cipherData = rawPayload.subarray(saltLen + 2, rawPayload.length - 10); // exclude 10-byte auth code

          const decryptedData = await decryptWinZipAES(cipherData, passwordStr, aesStrength, salt, pwdVerify);
          if (actualCompMethod === 8) {
            payload = await decompressDeflate(decryptedData);
          } else {
            payload = decryptedData;
          }
        } else {
          // ZipCrypto: First 12 bytes are encryption header
          if (rawPayload.length < 12) {
            throw new Error(`ZipCrypto header truncated for ${entry.name}`);
          }
          const cipher = new ZipCrypto(passwordStr);
          const encHeader = cipher.decrypt(rawPayload.subarray(0, 12));
          // Last byte of 12-byte header verifies password (matches high byte of CRC or MS-DOS file time)
          const checkByte = encHeader[11];
          const expectedCheck = (entry.crc >>> 24) & 0xff;
          // In some ZIP files flags bit 3 is set and checkByte is compared to MS-DOS time, so we test decryption
          const decryptedPayload = cipher.decrypt(rawPayload.subarray(12));

          if (entry.compMethod === 8) {
            try {
              payload = await decompressDeflate(decryptedPayload);
            } catch (err) {
              throw new Error("Incorrect archive password (decompression verification failed).");
            }
          } else {
            payload = decryptedPayload;
          }
          if (entry.crc && crc32Buffer(payload) !== (entry.crc >>> 0)) {
            throw new Error("Incorrect archive password (CRC32 verification failed).");
          }
        }
      } else {
        // Not encrypted
        if (entry.compMethod === 8) {
          payload = await decompressDeflate(rawPayload);
        }
      }

      extractedFiles.push({
        name: entry.name,
        data: payload,
        size: payload.length
      });
    }

    if (onProgress) onProgress(100, "Decryption complete.");
    return extractedFiles;
  }

  /**
   * Key Format Detection & Validation
   * Detects:
   *  - PassMan AES-GCM 256-bit Key (.key or 44-char Base64 string)
   *  - ZIPEncrypt Binary Key (.bin or exactly 32 raw bytes)
   *  - Encrypted Vault Data (.enc)
   *  - Plain CSV Vault Data (.csv)
   */
  function inspectKeyCandidate(fileName, dataBytes) {
    const decoder = new TextDecoder("utf-8");
    let text = "";
    try {
      text = decoder.decode(dataBytes).trim();
    } catch (_) {}

    const lowerName = fileName.toLowerCase();

    // 1. PassMan Key: Base64 string that decodes to 32 bytes (256-bit AES key)
    const base64Regex = /^[A-Za-z0-9+/]{43}=$/;
    if (base64Regex.test(text) || (text.length >= 40 && text.length <= 48 && !text.includes(" "))) {
      try {
        const decoded = atob(text);
        if (decoded.length === 32) {
          return {
            fileName,
            keyType: "passman_key",
            typeName: "PassMan Key (AES-256 GCM)",
            isValid: true,
            size: dataBytes.length,
            preview: text.substring(0, 10) + "…" + text.substring(text.length - 6),
            rawKeyB64: text,
            data: dataBytes,
            details: "Standard PassMan 256-bit AES-GCM Base64 key."
          };
        }
      } catch (_) {}
    }

    // 2. ZIPEncrypt Raw Binary Key: exactly 32 bytes
    if (dataBytes.length === 32 && (lowerName.endsWith(".bin") || lowerName.includes("key"))) {
      let b64 = "";
      try {
        b64 = btoa(String.fromCharCode(...dataBytes));
      } catch (_) {}
      return {
        fileName,
        keyType: "zipencrypt_key",
        typeName: "ZIPEncrypt Key (32-byte Binary)",
        isValid: true,
        size: 32,
        preview: b64 ? b64.substring(0, 10) + "…" : "32 Raw Bytes",
        rawKeyB64: b64,
        data: dataBytes,
        details: "32-byte raw binary encryption key."
      };
    }

    // 3. Vault File (.enc)
    if (lowerName.endsWith(".enc") || (text.includes(".") && text.split(".").length === 2 && text.length > 30)) {
      return {
        fileName,
        keyType: "vault_enc",
        typeName: "Encrypted Vault (.enc)",
        isValid: true,
        size: dataBytes.length,
        preview: text.substring(0, 16) + "…",
        data: dataBytes,
        textContent: text,
        details: "Encrypted CSV password vault file."
      };
    }

    // 4. Plain CSV Vault File (.csv)
    if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
      return {
        fileName,
        keyType: "vault_csv",
        typeName: "Plaintext Vault (.csv)",
        isValid: true,
        size: dataBytes.length,
        preview: text.substring(0, 30) + "…",
        data: dataBytes,
        textContent: text,
        details: "CSV plaintext password data."
      };
    }

    // General fallback
    return {
      fileName,
      keyType: "other",
      typeName: "Generic File",
      isValid: false,
      size: dataBytes.length,
      preview: fileName,
      data: dataBytes,
      details: "Not recognized as a supported key file."
    };
  }

  /**
   * Filter and scan extracted archive contents for all supported keys and vault files
   */
  function findSupportedKeys(extractedFiles) {
    const candidates = [];
    for (const file of extractedFiles) {
      const info = inspectKeyCandidate(file.name, file.data);
      if (info.keyType === "passman_key" || info.keyType === "zipencrypt_key") {
        candidates.push(info);
      }
    }
    return candidates;
  }

  /**
   * Create a standard PKWARE ZipCrypto password-protected ZIP archive
   * from an array of { name: string, data: Uint8Array } entries.
   */
  async function createPasswordProtectedZip(entries, passwordStr, onProgress) {
    if (!passwordStr || !passwordStr.length) {
      throw new Error("Password is required to create a password-protected ZIP.");
    }
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (let idx = 0; idx < entries.length; idx++) {
      const item = entries[idx];
      const nameBytes = encoder.encode(item.name);
      const plainBytes = item.data instanceof Uint8Array ? item.data : new Uint8Array(item.data);
      const crc = crc32Buffer(plainBytes) >>> 0;
      const uncompSize = plainBytes.length;

      // 12-byte ZipCrypto encryption header (11 random bytes + high byte of CRC32)
      const headerPlain = new Uint8Array(12);
      crypto.getRandomValues(headerPlain.subarray(0, 11));
      headerPlain[11] = (crc >>> 24) & 0xff;

      const cipher = new ZipCrypto(passwordStr);
      const encHeader = cipher.encrypt(headerPlain);
      const encPayload = cipher.encrypt(plainBytes);
      const compSize = 12 + encPayload.length;

      // Local File Header (30 + nameBytes.length)
      const lh = new Uint8Array(30 + nameBytes.length);
      const lhv = new DataView(lh.buffer);
      lhv.setUint32(0, 0x04034b50, true); // signature
      lhv.setUint16(4, 20, true);         // version needed (2.0)
      lhv.setUint16(6, 0x0801, true);     // flags: bit 0 (encrypted) | bit 11 (UTF-8)
      lhv.setUint16(8, 0, true);          // compression: STORE (0)
      lhv.setUint16(10, 0, true);         // mod time
      lhv.setUint16(12, 0x21, true);      // mod date
      lhv.setUint32(14, crc, true);       // crc32
      lhv.setUint32(18, compSize, true);  // compressed size
      lhv.setUint32(22, uncompSize, true);// uncompressed size
      lhv.setUint16(26, nameBytes.length, true); // file name length
      lhv.setUint16(28, 0, true);         // extra field length
      lh.set(nameBytes, 30);

      // Central Directory File Header (46 + nameBytes.length)
      const cd = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014b50, true); // signature
      cdv.setUint16(4, 20, true);         // version made by
      cdv.setUint16(6, 20, true);         // version needed
      cdv.setUint16(8, 0x0801, true);     // flags: encrypted + UTF-8
      cdv.setUint16(10, 0, true);         // compression: STORE (0)
      cdv.setUint16(12, 0, true);         // mod time
      cdv.setUint16(14, 0x21, true);      // mod date
      cdv.setUint32(16, crc, true);       // crc32
      cdv.setUint32(20, compSize, true);  // compressed size
      cdv.setUint32(24, uncompSize, true);// uncompressed size
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);         // extra len
      cdv.setUint16(32, 0, true);         // comment len
      cdv.setUint16(34, 0, true);         // disk number
      cdv.setUint16(36, 0, true);         // internal attrs
      cdv.setUint32(38, 0, true);         // external attrs
      cdv.setUint32(42, localOffset, true);
      cd.set(nameBytes, 46);

      localParts.push(lh, encHeader, encPayload);
      centralParts.push(cd);
      localOffset += lh.length + encHeader.length + encPayload.length;

      if (onProgress) {
        onProgress(Math.round(20 + ((idx + 1) / entries.length) * 70), `Encrypting ${item.name}…`);
      }
    }

    let cdSize = 0;
    for (const c of centralParts) cdSize += c.length;

    const eocd = new Uint8Array(22);
    const eocdv = new DataView(eocd.buffer);
    eocdv.setUint32(0, 0x06054b50, true);
    eocdv.setUint16(4, 0, true);
    eocdv.setUint16(6, 0, true);
    eocdv.setUint16(8, entries.length, true);
    eocdv.setUint16(10, entries.length, true);
    eocdv.setUint32(12, cdSize, true);
    eocdv.setUint32(16, localOffset, true);
    eocdv.setUint16(20, 0, true);

    const out = new Uint8Array(localOffset + cdSize + 22);
    let pos = 0;
    for (const p of localParts) { out.set(p, pos); pos += p.length; }
    for (const c of centralParts) { out.set(c, pos); pos += c.length; }
    out.set(eocd, pos);

    if (onProgress) onProgress(100, "Password-protected ZIP ready.");
    return out;
  }

  // Export to global scope
  global.ZipDecryptor = {
    inspectZipEncryption,
    decryptZipArchive,
    createPasswordProtectedZip,
    inspectKeyCandidate,
    findSupportedKeys,
    crc32Buffer
  };

})(typeof window !== "undefined" ? window : globalThis);

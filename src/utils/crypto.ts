/**
 * Cryptographic Utility for Encrypted Visual Communication (EVC)
 * Uses Browser Web Crypto API (window.crypto.subtle)
 * Algorithm: AES-GCM 256-bit
 * Key Derivation: PBKDF2 (SHA-256, 100,000 iterations)
 */

export interface EVCMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  timestamp: number;
}

export interface EncryptionResult {
  blob: Blob;
  evcFileName: string;
  originalName: string;
  encryptedSize: number;
}

export interface DecryptionResult {
  blob: Blob;
  originalName: string;
  mimeType: string;
  size: number;
  objectUrl: string;
}

const MAGIC_BYTES = new Uint8Array([0x45, 0x56, 0x43, 0x31]); // "EVC1"
const SALT_SIZE = 16;
const IV_SIZE = 12;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives an AES-GCM 256-bit key from a plain text password and salt using PBKDF2.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  
  // Ensure we pass a clean 16-byte ArrayBuffer copy
  const cleanSalt = salt.byteOffset === 0 && salt.byteLength === salt.buffer.byteLength
    ? salt
    : salt.slice();

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: cleanSalt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts an image File into a structured .evc binary container.
 */
export async function encryptImage(
  file: File,
  password: string,
  onProgress?: (step: string) => void
): Promise<EncryptionResult> {
  onProgress?.("Preparing image...");
  const imageArrayBuffer = await file.arrayBuffer();

  onProgress?.("Generating secure key...");
  // Cryptographically random salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));

  const key = await deriveKey(password, salt);

  onProgress?.("Encrypting image...");
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    imageArrayBuffer
  );

  onProgress?.("Creating EVC file...");
  // Construct Metadata
  const metadata: EVCMetadata = {
    originalName: file.name,
    mimeType: file.type || "image/png",
    size: file.size,
    timestamp: Date.now(),
  };

  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);

  // Calculate container size
  const containerSize =
    4 + 2 + SALT_SIZE + 2 + IV_SIZE + 4 + metadataBytes.byteLength + ciphertextBuffer.byteLength;

  const containerBuffer = new ArrayBuffer(containerSize);
  const view = new DataView(containerBuffer);
  const uint8View = new Uint8Array(containerBuffer);

  let offset = 0;

  // 1. Magic Bytes (4 bytes)
  uint8View.set(MAGIC_BYTES, offset);
  offset += 4;

  // 2. Salt Length (2 bytes)
  view.setUint16(offset, SALT_SIZE, false);
  offset += 2;

  // 3. Salt (16 bytes)
  uint8View.set(salt, offset);
  offset += SALT_SIZE;

  // 4. IV Length (2 bytes)
  view.setUint16(offset, IV_SIZE, false);
  offset += 2;

  // 5. IV (12 bytes)
  uint8View.set(iv, offset);
  offset += IV_SIZE;

  // 6. Metadata Length (4 bytes)
  view.setUint32(offset, metadataBytes.byteLength, false);
  offset += 4;

  // 7. Metadata Bytes
  uint8View.set(metadataBytes, offset);
  offset += metadataBytes.byteLength;

  // 8. Ciphertext
  uint8View.set(new Uint8Array(ciphertextBuffer), offset);

  onProgress?.("Encryption complete");

  const evcBlob = new Blob([containerBuffer], { type: "application/octet-stream" });
  const evcFileName = file.name.replace(/\.[^/.]+$/, "") + ".evc";

  return {
    blob: evcBlob,
    evcFileName,
    originalName: file.name,
    encryptedSize: evcBlob.size,
  };
}

/**
 * Inspects an .evc container file header to extract metadata without decrypting payload.
 */
export function inspectEVCHeader(arrayBuffer: ArrayBuffer): {
  valid: boolean;
  metadata?: EVCMetadata;
  error?: string;
} {
  try {
    if (arrayBuffer.byteLength < 4 + 2 + SALT_SIZE + 2 + IV_SIZE + 4) {
      return { valid: false, error: "File is too small to be a valid .EVC file." };
    }

    const view = new DataView(arrayBuffer);
    const uint8View = new Uint8Array(arrayBuffer);

    let offset = 0;

    // Check magic bytes
    for (let i = 0; i < 4; i++) {
      if (uint8View[i] !== MAGIC_BYTES[i]) {
        return { valid: false, error: "Invalid EVC header format. Magic bytes mismatch." };
      }
    }
    offset += 4;

    const saltLen = view.getUint16(offset, false);
    offset += 2 + saltLen;

    const ivLen = view.getUint16(offset, false);
    offset += 2 + ivLen;

    const metaLen = view.getUint32(offset, false);
    offset += 4;

    if (offset + metaLen > arrayBuffer.byteLength) {
      return { valid: false, error: "Corrupted EVC metadata length." };
    }

    const metaBytes = uint8View.slice(offset, offset + metaLen);
    const metaString = new TextDecoder().decode(metaBytes);
    const metadata: EVCMetadata = JSON.parse(metaString);

    return { valid: true, metadata };
  } catch {
    return { valid: false, error: "Unable to parse .EVC container header." };
  }
}

/**
 * Decrypts an .evc container buffer back into original image Blob using entered password.
 */
export async function decryptEVC(
  evcArrayBuffer: ArrayBuffer,
  password: string
): Promise<DecryptionResult> {
  const header = inspectEVCHeader(evcArrayBuffer);
  if (!header.valid || !header.metadata) {
    throw new Error(header.error || "The selected file is not a valid .EVC encrypted file.");
  }

  const view = new DataView(evcArrayBuffer);
  const uint8View = new Uint8Array(evcArrayBuffer);

  let offset = 4; // Skip magic

  const saltLen = view.getUint16(offset, false);
  offset += 2;
  const salt = uint8View.slice(offset, offset + saltLen);
  offset += saltLen;

  const ivLen = view.getUint16(offset, false);
  offset += 2;
  const iv = uint8View.slice(offset, offset + ivLen);
  offset += ivLen;

  const metaLen = view.getUint32(offset, false);
  offset += 4 + metaLen;

  const ciphertext = uint8View.slice(offset);

  try {
    const key = await deriveKey(password, salt);

    const decryptedArrayBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    const blob = new Blob([decryptedArrayBuffer], { type: header.metadata.mimeType });
    const objectUrl = URL.createObjectURL(blob);

    return {
      blob,
      originalName: header.metadata.originalName,
      mimeType: header.metadata.mimeType,
      size: header.metadata.size || blob.size,
      objectUrl,
    };
  } catch (err: unknown) {
    console.error("AES-GCM Decryption failed:", err);
    throw new Error(
      "Unable to Decrypt — The secret key is incorrect or the encrypted file has been corrupted."
    );
  }
}

/**
 * Calculates password strength metrics.
 */
export function getPasswordStrength(password: string): {
  score: 'weak' | 'medium' | 'strong';
  label: string;
  percentage: number;
} {
  if (!password) {
    return { score: 'weak', label: 'Empty', percentage: 0 };
  }
  if (password.length < 8) {
    return { score: 'weak', label: 'Weak (min 8 chars)', percentage: 25 };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { score: 'weak', label: 'Weak', percentage: 33 };
  } else if (score <= 4) {
    return { score: 'medium', label: 'Medium', percentage: 66 };
  } else {
    return { score: 'strong', label: 'Strong', percentage: 100 };
  }
}

/**
 * Formats bytes to readable string (e.g., 1.5 MB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Cryptographic Utility for Encrypted Visual Communication (EVC)
 * Uses Browser Web Crypto API (window.crypto.subtle)
 * Supported Algorithms:
 *  - Symmetric: AES-GCM (128-bit, 192-bit, 256-bit) via PBKDF2 (SHA-256, 100,000 iterations)
 *  - Asymmetric: RSA-OAEP (2048-bit, 3072-bit, 4096-bit) Hybrid with AES-GCM 256-bit
 *  - Passphrase-Protected RSA Private Key Export/Import
 *  - Full backward compatibility with existing .evc container formats
 */

import {
  deriveShuffleSeed,
  generatePermutationMap,
} from './pixelShuffle.ts';

export type AESKeySize = 128 | 192 | 256;
export type RSAKeySize = 2048 | 3072 | 4096;
export type EncryptionMethod = 'standard' | 'pixel-shuffle';
export type EncryptionType = 'symmetric' | 'asymmetric';

export interface EVCMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  timestamp: number;
  // Versioning and algorithm identifiers
  version?: number; // 1 for legacy, 2 for enhanced
  method?: EncryptionMethod; // default 'standard'
  encryptionType?: EncryptionType; // default 'symmetric'
  algorithm?: string; // 'AES-GCM' | 'RSA-OAEP+AES-GCM'
  keySize?: number; // 128 | 192 | 256 | 2048 | 3072 | 4096
  encryptedKey?: string; // Base64-encoded encrypted AES key for RSA hybrid
  pixelShuffle?: {
    enabled: boolean;
    protectedWithAES: boolean;
    width: number;
    height: number;
  };
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

export interface PasswordStrength {
  score: 'weak' | 'medium' | 'strong' | 'very-strong';
  label: string;
  percentage: number;
  feedback?: string;
}

const MAGIC_BYTES = new Uint8Array([0x45, 0x56, 0x43, 0x31]); // "EVC1"
const SALT_SIZE = 16;
const IV_SIZE = 12;
const PBKDF2_ITERATIONS = 100000;

// Helper: Base64 encoding / decoding
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

/**
 * Derives an AES-GCM key from a plain text password and salt using PBKDF2.
 * Supports keyLength: 128, 192, or 256 bits (default 256).
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  keyLength: AESKeySize = 256
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  
  const cleanSalt = salt.byteOffset === 0 && salt.byteLength === salt.buffer.byteLength
    ? salt
    : salt.slice();

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  const keyMaterial = await cryptoObj.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: cleanSalt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: keyLength },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts an image File into a structured .evc binary container using Symmetric AES-GCM.
 * Supports AES-128, AES-192, and AES-256 (default).
 */
export async function encryptImage(
  file: File,
  password: string,
  onProgress?: (step: string) => void,
  keySize: AESKeySize = 256
): Promise<EncryptionResult> {
  onProgress?.("Preparing image...");
  const imageArrayBuffer = await file.arrayBuffer();

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  onProgress?.("Generating secure key...");
  const salt = cryptoObj.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_SIZE));

  const key = await deriveKey(password, salt, keySize);

  onProgress?.(`Encrypting image with AES-${keySize}-GCM...`);
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    imageArrayBuffer
  );

  onProgress?.("Creating EVC file...");
  const metadata: EVCMetadata = {
    version: 2,
    method: 'standard',
    encryptionType: 'symmetric',
    algorithm: 'AES-GCM',
    keySize: keySize,
    originalName: file.name,
    mimeType: file.type || "image/png",
    size: file.size,
    timestamp: Date.now(),
  };

  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);

  const containerSize =
    4 + 2 + SALT_SIZE + 2 + IV_SIZE + 4 + metadataBytes.byteLength + ciphertextBuffer.byteLength;

  const containerBuffer = new ArrayBuffer(containerSize);
  const view = new DataView(containerBuffer);
  const uint8View = new Uint8Array(containerBuffer);

  let offset = 0;
  uint8View.set(MAGIC_BYTES, offset); offset += 4;
  view.setUint16(offset, SALT_SIZE, false); offset += 2;
  uint8View.set(salt, offset); offset += SALT_SIZE;
  view.setUint16(offset, IV_SIZE, false); offset += 2;
  uint8View.set(iv, offset); offset += IV_SIZE;
  view.setUint32(offset, metadataBytes.byteLength, false); offset += 4;
  uint8View.set(metadataBytes, offset); offset += metadataBytes.byteLength;
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
 * Generates an RSA-OAEP key pair with SHA-256 for asymmetric hybrid encryption.
 * Supports modulusLength: 2048, 3072, 4096 bits.
 */
export async function generateRSAKeyPair(
  modulusLength: RSAKeySize = 2048
): Promise<CryptoKeyPair> {
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  return cryptoObj.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports an RSA Public Key in standard SPKI PEM format.
 */
export async function exportRSAPublicKeyPEM(publicKey: CryptoKey): Promise<string> {
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  const spki = await cryptoObj.subtle.exportKey("spki", publicKey);
  const b64 = arrayBufferToBase64(spki);
  const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64;
  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
}

/**
 * Imports an RSA Public Key from SPKI PEM format.
 */
export async function importRSAPublicKeyPEM(pem: string): Promise<CryptoKey> {
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  const cleaned = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!cleaned) throw new Error("Invalid or empty Public Key PEM.");
  const der = base64ToArrayBuffer(cleaned);
  return cryptoObj.subtle.importKey(
    "spki",
    der,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

/**
 * Exports an RSA Private Key PROTECTED with a user-provided passphrase.
 * Encrypts PKCS#8 private key bytes using AES-GCM 256-bit derived via PBKDF2/SHA-256.
 * Never exports an unprotected private key.
 */
export async function exportProtectedRSAPrivateKeyPEM(
  privateKey: CryptoKey,
  passphrase: string
): Promise<string> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("A passphrase of at least 8 characters is required to protect the private key.");
  }
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  
  // 1. Export raw PKCS#8 bytes
  const pkcs8 = await cryptoObj.subtle.exportKey("pkcs8", privateKey);

  // 2. Encrypt the PKCS#8 bytes with AES-GCM
  const salt = cryptoObj.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_SIZE));
  const derivedKey = await deriveKey(passphrase, salt, 256);

  const encryptedBytes = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    derivedKey,
    pkcs8
  );

  // 3. Envelope: [16B salt] [12B IV] [encrypted PKCS#8]
  const envelope = new Uint8Array(SALT_SIZE + IV_SIZE + encryptedBytes.byteLength);
  envelope.set(salt, 0);
  envelope.set(iv, SALT_SIZE);
  envelope.set(new Uint8Array(encryptedBytes), SALT_SIZE + IV_SIZE);

  const b64 = arrayBufferToBase64(envelope);
  const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64;
  return `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${formatted}\n-----END ENCRYPTED PRIVATE KEY-----`;
}

/**
 * Imports an RSA Private Key from a passphrase-protected PEM file.
 */
export async function importProtectedRSAPrivateKeyPEM(
  pem: string,
  passphrase: string
): Promise<CryptoKey> {
  if (!passphrase) {
    throw new Error("Passphrase is required to unlock the protected private key.");
  }
  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  const cleaned = pem
    .replace(/-----BEGIN ENCRYPTED PRIVATE KEY-----/g, '')
    .replace(/-----END ENCRYPTED PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) throw new Error("Invalid or empty Private Key PEM.");

  const envelope = new Uint8Array(base64ToArrayBuffer(cleaned));
  if (envelope.byteLength < SALT_SIZE + IV_SIZE + 16) {
    throw new Error("Invalid or corrupted encrypted private key container.");
  }

  const salt = envelope.slice(0, SALT_SIZE);
  const iv = envelope.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
  const ciphertext = envelope.slice(SALT_SIZE + IV_SIZE);

  const derivedKey = await deriveKey(passphrase, salt, 256);

  let decryptedPkcs8: ArrayBuffer;
  try {
    decryptedPkcs8 = await cryptoObj.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      derivedKey,
      ciphertext.buffer as ArrayBuffer
    );
  } catch {
    throw new Error("Incorrect passphrase for private key or corrupted key file.");
  }

  return cryptoObj.subtle.importKey(
    "pkcs8",
    decryptedPkcs8,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

/**
 * Encrypts an image File using Asymmetric RSA Hybrid Encryption:
 * 1. Generates an ephemeral 256-bit AES-GCM key.
 * 2. Encrypts the raw image bytes with AES-GCM.
 * 3. Encrypts the ephemeral AES key with the recipient's RSA public key using RSA-OAEP.
 * 4. Stores encrypted AES key and ciphertext in the standard .evc container.
 */
export async function encryptImageRSA(
  file: File,
  recipientPublicKey: CryptoKey,
  rsaKeySize: RSAKeySize,
  onProgress?: (step: string) => void
): Promise<EncryptionResult> {
  onProgress?.("Preparing image...");
  const imageArrayBuffer = await file.arrayBuffer();

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  onProgress?.("Generating ephemeral AES key...");
  const aesRawKey = cryptoObj.getRandomValues(new Uint8Array(32)); // 256 bits
  const aesKey = await cryptoObj.subtle.importKey(
    "raw",
    aesRawKey.buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  onProgress?.("Encrypting image with AES-GCM...");
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_SIZE));
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    aesKey,
    imageArrayBuffer
  );

  onProgress?.("Encrypting AES key with RSA-OAEP...");
  const encryptedAesKeyBuffer = await cryptoObj.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    aesRawKey.buffer as ArrayBuffer
  );

  onProgress?.("Creating EVC container...");
  const dummySalt = cryptoObj.getRandomValues(new Uint8Array(SALT_SIZE));

  const metadata: EVCMetadata = {
    version: 2,
    method: 'standard',
    encryptionType: 'asymmetric',
    algorithm: 'RSA-OAEP+AES-GCM',
    keySize: rsaKeySize,
    encryptedKey: arrayBufferToBase64(encryptedAesKeyBuffer),
    originalName: file.name,
    mimeType: file.type || "image/png",
    size: file.size,
    timestamp: Date.now(),
  };

  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);

  const containerSize =
    4 + 2 + SALT_SIZE + 2 + IV_SIZE + 4 + metadataBytes.byteLength + ciphertextBuffer.byteLength;

  const containerBuffer = new ArrayBuffer(containerSize);
  const view = new DataView(containerBuffer);
  const uint8View = new Uint8Array(containerBuffer);

  let offset = 0;
  uint8View.set(MAGIC_BYTES, offset); offset += 4;
  view.setUint16(offset, SALT_SIZE, false); offset += 2;
  uint8View.set(dummySalt, offset); offset += SALT_SIZE;
  view.setUint16(offset, IV_SIZE, false); offset += 2;
  uint8View.set(iv, offset); offset += IV_SIZE;
  view.setUint32(offset, metadataBytes.byteLength, false); offset += 4;
  uint8View.set(metadataBytes, offset); offset += metadataBytes.byteLength;
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
 * Encrypts a Pixel-Shuffled image file or blob into an authenticated .evc container.
 */
export async function encryptPixelShuffleEVC(
  shuffledBlob: Blob,
  originalFileName: string,
  width: number,
  height: number,
  password: string,
  keySize: AESKeySize = 256,
  onProgress?: (step: string) => void
): Promise<EncryptionResult> {
  onProgress?.("Preparing shuffled image payload...");
  const imageArrayBuffer = await shuffledBlob.arrayBuffer();

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  onProgress?.("Deriving AES key for container protection...");
  const salt = cryptoObj.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_SIZE));
  const key = await deriveKey(password, salt, keySize);

  onProgress?.(`Encrypting shuffled payload with AES-${keySize}-GCM...`);
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    imageArrayBuffer
  );

  onProgress?.("Creating protected .evc container...");
  const metadata: EVCMetadata = {
    version: 2,
    method: 'pixel-shuffle',
    encryptionType: 'symmetric',
    algorithm: 'AES-GCM',
    keySize: keySize,
    originalName: originalFileName,
    mimeType: shuffledBlob.type || 'image/png',
    size: shuffledBlob.size,
    timestamp: Date.now(),
    pixelShuffle: {
      enabled: true,
      protectedWithAES: true,
      width,
      height,
    },
  };

  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);

  const containerSize =
    4 + 2 + SALT_SIZE + 2 + IV_SIZE + 4 + metadataBytes.byteLength + ciphertextBuffer.byteLength;

  const containerBuffer = new ArrayBuffer(containerSize);
  const view = new DataView(containerBuffer);
  const uint8View = new Uint8Array(containerBuffer);

  let offset = 0;
  uint8View.set(MAGIC_BYTES, offset); offset += 4;
  view.setUint16(offset, SALT_SIZE, false); offset += 2;
  uint8View.set(salt, offset); offset += SALT_SIZE;
  view.setUint16(offset, IV_SIZE, false); offset += 2;
  uint8View.set(iv, offset); offset += IV_SIZE;
  view.setUint32(offset, metadataBytes.byteLength, false); offset += 4;
  uint8View.set(metadataBytes, offset); offset += metadataBytes.byteLength;
  uint8View.set(new Uint8Array(ciphertextBuffer), offset);

  onProgress?.("Protection complete");

  const evcBlob = new Blob([containerBuffer], { type: "application/octet-stream" });
  const evcFileName = originalFileName.replace(/\.[^/.]+$/, "") + ".evc";

  return {
    blob: evcBlob,
    evcFileName,
    originalName: originalFileName,
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
 * Decrypts an .evc container buffer back into original image Blob.
 * Handles:
 *  - Legacy AES-256 .evc files (full backward compatibility)
 *  - Enhanced AES-128, AES-192, and AES-256 files
 *  - RSA hybrid encrypted files using recipient private key
 *  - Protected Pixel Shuffle files using secret key + inverse permutation
 */
export async function decryptEVC(
  evcArrayBuffer: ArrayBuffer,
  credential: string | CryptoKey,
  privateKeyPassphrase?: string
): Promise<DecryptionResult> {
  const header = inspectEVCHeader(evcArrayBuffer);
  if (!header.valid || !header.metadata) {
    throw new Error(header.error || "The selected file is not a valid .EVC encrypted file.");
  }

  const metadata = header.metadata;
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

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  try {
    let decryptedArrayBuffer: ArrayBuffer;

    if (metadata.encryptionType === 'asymmetric') {
      // RSA Hybrid Decryption
      if (!metadata.encryptedKey) {
        throw new Error("Missing encrypted AES key in asymmetric container metadata.");
      }

      let privateKey: CryptoKey;
      if (typeof credential === 'string') {
        // PEM string provided
        if (credential.includes('ENCRYPTED PRIVATE KEY')) {
          if (!privateKeyPassphrase) {
            throw new Error("Passphrase required to unlock the protected private key.");
          }
          privateKey = await importProtectedRSAPrivateKeyPEM(credential, privateKeyPassphrase);
        } else {
          throw new Error("Private keys must be encrypted with a passphrase.");
        }
      } else {
        privateKey = credential;
      }

      // Decrypt the ephemeral AES key
      const encryptedAesKeyBuffer = base64ToArrayBuffer(metadata.encryptedKey);
      const aesRawKey = await cryptoObj.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedAesKeyBuffer
      );

      // Import the recovered AES key
      const aesKey = await cryptoObj.subtle.importKey(
        "raw",
        aesRawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      // Decrypt image bytes with AES-GCM
      decryptedArrayBuffer = await cryptoObj.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        aesKey,
        ciphertext.buffer as ArrayBuffer
      );

    } else {
      // Symmetric AES (or Legacy EVC1 file)
      if (typeof credential !== 'string') {
        throw new Error("Password must be a text string for symmetric decryption.");
      }

      const keySize = (metadata.keySize as AESKeySize) || 256;
      const key = await deriveKey(credential, salt, keySize);

      decryptedArrayBuffer = await cryptoObj.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        key,
        ciphertext.buffer as ArrayBuffer
      );

      // If Pixel Shuffle was applied, reverse the permutation
      if (metadata.method === 'pixel-shuffle' && metadata.pixelShuffle?.enabled) {
        const { width, height } = metadata.pixelShuffle;
        // In browser context with canvas, restore original image
        if (typeof document !== 'undefined' && typeof window !== 'undefined') {
          const scrambledBlob = new Blob([decryptedArrayBuffer], { type: metadata.mimeType });
          const img = new Image();
          const imgUrl = URL.createObjectURL(scrambledBlob);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load scrambled image for un-shuffling.'));
            img.src = imgUrl;
          });
          URL.revokeObjectURL(imgUrl);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const scrambledImageData = ctx.getImageData(0, 0, width, height);

            const totalPixels = width * height;
            const seed = await deriveShuffleSeed(credential, `${width}x${height}`);
            const P = generatePermutationMap(totalPixels, seed);

            const scrambled32 = new Uint32Array(scrambledImageData.data.buffer);
            const restoredData = new Uint8ClampedArray(scrambledImageData.data.length);
            const restored32 = new Uint32Array(restoredData.buffer);

            for (let i = 0; i < totalPixels; i++) {
              restored32[i] = scrambled32[P[i]];
            }

            const restoredImageData = new ImageData(restoredData, width, height);
            ctx.putImageData(restoredImageData, 0, 0);

            const restoredBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed.'))), metadata.mimeType);
            });

            const objectUrl = URL.createObjectURL(restoredBlob);
            return {
              blob: restoredBlob,
              originalName: metadata.originalName,
              mimeType: metadata.mimeType,
              size: restoredBlob.size,
              objectUrl,
            };
          }
        }
      }
    }

    const blob = new Blob([decryptedArrayBuffer], { type: metadata.mimeType });
    const objectUrl = URL.createObjectURL(blob);

    return {
      blob,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      size: metadata.size || blob.size,
      objectUrl,
    };
  } catch (err: unknown) {
    console.error("Decryption failed:", err);
    throw new Error(
      "Unable to Decrypt — The secret key / private key is incorrect or the encrypted file has been corrupted."
    );
  }
}

/**
 * Common passwords and dictionary patterns to guard against predictable keys.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'pass1234', '12345678', '123456789',
  '1234567890', '123456', '12345', 'qwerty', 'qwertyuiop', 'qwerty123',
  'admin', 'admin123', 'administrator', 'welcome', 'welcome1', 'welcome123',
  'letmein', 'letmein123', 'iloveyou', 'iloveyou1', 'secret', 'secret123',
  'monkey', 'monkey123', 'dragon', 'dragon123', 'master', 'master123',
  'football', 'baseball', 'default', 'default123', 'trustno1', 'changeme'
]);

function hasSequentialPattern(str: string, minLength: number = 4): boolean {
  const lower = str.toLowerCase();
  let forwardCount = 1;
  let backwardCount = 1;
  for (let i = 1; i < lower.length; i++) {
    const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    if (diff === 1) {
      forwardCount++;
      if (forwardCount >= minLength) return true;
    } else {
      forwardCount = 1;
    }
    if (diff === -1) {
      backwardCount++;
      if (backwardCount >= minLength) return true;
    } else {
      backwardCount = 1;
    }
  }
  return false;
}

/**
 * Calculates password strength metrics across 4 levels: Weak, Medium, Strong, Very Strong.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 'weak', label: 'Empty', percentage: 0 };
  }

  const length = password.length;
  if (length < 8) {
    return {
      score: 'weak',
      label: 'Weak',
      percentage: 25,
      feedback: 'Password must be at least 8 characters long.'
    };
  }

  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lower)) {
    return {
      score: 'weak',
      label: 'Weak',
      percentage: 25,
      feedback: 'This is an easily guessable common password.'
    };
  }

  const containsCommonWord = ['password', 'admin', 'qwerty', '123456', 'welcome', 'letmein'].some(
    (w) => lower.includes(w)
  );

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  const hasRepeated = /(.)\1{2,}/.test(password);
  const isSequential = hasSequentialPattern(password, 4);

  if (containsCommonWord && length < 16) {
    return {
      score: 'weak',
      label: 'Weak',
      percentage: 30,
      feedback: 'Contains easily guessable dictionary words.'
    };
  }

  let points = 0;
  if (length >= 8 && length < 12) points += 25;
  else if (length >= 12 && length < 16) points += 45;
  else if (length >= 16 && length < 20) points += 65;
  else if (length >= 20) points += 80;

  points += varietyCount * 6;
  if (varietyCount === 4) points += 10;

  if (varietyCount === 1) points -= 25;
  if (hasRepeated) points -= 15;
  if (isSequential) points -= 15;
  if (containsCommonWord) points -= 20;

  points = Math.max(15, Math.min(100, points));

  if (length >= 20 && varietyCount === 4 && !hasRepeated && !isSequential && !containsCommonWord) {
    return {
      score: 'very-strong',
      label: 'Very Strong',
      percentage: 100,
      feedback: 'Cryptographically exceptional entropy. Highly resilient against brute-force attacks.'
    };
  } else if (points >= 70 && varietyCount >= 3 && length >= 12) {
    return {
      score: 'strong',
      label: 'Strong',
      percentage: 75,
      feedback: 'Strong passphrase with high character diversity.'
    };
  } else if (points >= 40 && length >= 8) {
    return {
      score: 'medium',
      label: 'Medium',
      percentage: 50,
      feedback: 'Moderate strength. Consider adding symbols, numbers, or increasing length.'
    };
  } else {
    return {
      score: 'weak',
      label: 'Weak',
      percentage: 25,
      feedback: 'Weak passphrase. Avoid predictable patterns and increase length.'
    };
  }
}

/**
 * Generates an automatic cryptographically secure random password of specified length (min 20, default 24).
 */
export function generateSecurePassword(length: number = 24): string {
  const targetLength = Math.max(20, length);

  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const allChars = uppercase + lowercase + numbers + symbols;

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure random number generator (crypto.getRandomValues) is not available.');
  }

  function getSecureRandomInt(max: number): number {
    const limit = Math.floor(0xffffffff / max) * max;
    const array = new Uint32Array(1);
    while (true) {
      cryptoObj.getRandomValues(array);
      if (array[0] < limit) {
        return array[0] % max;
      }
    }
  }

  const chars: string[] = [
    uppercase[getSecureRandomInt(uppercase.length)],
    uppercase[getSecureRandomInt(uppercase.length)],
    lowercase[getSecureRandomInt(lowercase.length)],
    lowercase[getSecureRandomInt(lowercase.length)],
    numbers[getSecureRandomInt(numbers.length)],
    numbers[getSecureRandomInt(numbers.length)],
    symbols[getSecureRandomInt(symbols.length)],
    symbols[getSecureRandomInt(symbols.length)],
  ];

  while (chars.length < targetLength) {
    chars.push(allChars[getSecureRandomInt(allChars.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join("");
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

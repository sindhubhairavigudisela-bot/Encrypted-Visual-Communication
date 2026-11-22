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

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  onProgress?.("Generating secure key...");
  // Cryptographically random salt and IV
  const salt = cryptoObj.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_SIZE));

  const key = await deriveKey(password, salt);

  onProgress?.("Encrypting image...");
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
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

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  try {
    const key = await deriveKey(password, salt);

    const decryptedArrayBuffer = await cryptoObj.subtle.decrypt(
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

/**
 * Checks for repeated sequential character patterns (e.g., "1234", "abcd", "dcba").
 */
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
 * Evaluates length, character variety, common password presence, and sequential/repetitive patterns.
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

  // Common password checks
  if (COMMON_PASSWORDS.has(lower)) {
    return {
      score: 'weak',
      label: 'Weak',
      percentage: 25,
      feedback: 'This is an easily guessable common password.'
    };
  }

  // Common substring checks (e.g. "mysecretpassword123")
  const containsCommonWord = ['password', 'admin', 'qwerty', '123456', 'welcome', 'letmein'].some(
    (w) => lower.includes(w)
  );

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  const hasRepeated = /(.)\1{2,}/.test(password); // e.g. "aaa", "111"
  const isSequential = hasSequentialPattern(password, 4);

  // If containing very common words and under 16 characters -> Weak or Medium
  if (containsCommonWord && length < 16) {
    return {
      score: 'weak',
      label: 'Weak',
      percentage: 30,
      feedback: 'Contains easily guessable dictionary words.'
    };
  }

  // Scoring algorithm (0 to 100)
  let points = 0;

  // Length contributions
  if (length >= 8 && length < 12) points += 25;
  else if (length >= 12 && length < 16) points += 45;
  else if (length >= 16 && length < 20) points += 65;
  else if (length >= 20) points += 80;

  // Variety contributions
  points += varietyCount * 6; // up to 24 points

  // Variety bonus if all 4 categories are present
  if (varietyCount === 4) points += 10;

  // Penalties
  if (varietyCount === 1) points -= 25;
  if (hasRepeated) points -= 15;
  if (isSequential) points -= 15;
  if (containsCommonWord) points -= 20;

  // Minimum and Maximum clamping
  points = Math.max(15, Math.min(100, points));

  // Determine Level: Weak, Medium, Strong, Very Strong
  // Very Strong strictly requires length >= 20, all 4 character classes, and no common/repetitive patterns.
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
 * Uses window.crypto.getRandomValues() with rejection sampling to eliminate modulo bias.
 * Ensures uppercase letters, lowercase letters, numbers, and special characters are included.
 * Never uses dictionary words, names, dates, or predictable patterns.
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

  // Cryptographically secure random integer in [0, max) using rejection sampling
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

  // Guarantee presence of character sets: at least 2 of each category
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

  // Fill remaining positions uniformly from combined character set
  while (chars.length < targetLength) {
    chars.push(allChars[getSecureRandomInt(allChars.length)]);
  }

  // Cryptographic Fisher-Yates shuffle
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

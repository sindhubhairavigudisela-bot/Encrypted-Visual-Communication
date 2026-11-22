/**
 * Pixel Shuffle Utility for Encrypted Visual Communication (EVC)
 * Performs deterministic, mathematically reversible 32-bit RGBA pixel permutations.
 * Preserves dimensions, RGB color channels, and alpha transparency.
 */

/**
 * Deterministic PRNG based on SplitMix32.
 * Generates uniform 32-bit pseudo-random unsigned integers from a 32-bit seed state.
 */
class DeterministicPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Generates next pseudo-random uint32 in [0, 2^32 - 1].
   */
  nextUint32(): number {
    this.state = (this.state + 0x9e3779b9) | 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  }

  /**
   * Generates a uniform integer in [0, max - 1] using rejection sampling to eliminate modulo bias.
   */
  nextInt(max: number): number {
    if (max <= 1) return 0;
    const limit = Math.floor(0xffffffff / max) * max;
    while (true) {
      const val = this.nextUint32();
      if (val < limit) {
        return val % max;
      }
    }
  }
}

/**
 * Derives a 32-bit integer PRNG seed from a secret passphrase and optional salt using PBKDF2 with SHA-256.
 */
export async function deriveShuffleSeed(password: string, saltText: string = 'EVC-PixelShuffle-Salt'): Promise<number> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = encoder.encode(saltText);

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    64 // 64 bits = 8 bytes
  );

  const view = new DataView(derivedBits);
  const s1 = view.getUint32(0, false);
  const s2 = view.getUint32(4, false);
  return (s1 ^ s2) >>> 0;
}

/**
 * Generates an explicit bijective permutation array P of length N.
 * P[i] represents the destination index of pixel i under forward permutation.
 * Memory: exactly 4 * N bytes (e.g. ~8MB for 2 million pixels).
 */
export function generatePermutationMap(totalPixels: number, seed: number): Uint32Array {
  const prng = new DeterministicPRNG(seed);
  const P = new Uint32Array(totalPixels);

  // Initialize identity mapping
  for (let i = 0; i < totalPixels; i++) {
    P[i] = i;
  }

  // Fisher-Yates shuffle
  for (let i = totalPixels - 1; i > 0; i--) {
    const j = prng.nextInt(i + 1);
    const temp = P[i];
    P[i] = P[j];
    P[j] = temp;
  }

  return P;
}

/**
 * Shuffles an ImageData object using a secret-derived seed.
 * Operates on packed 32-bit RGBA units, preserving transparency and color channels.
 * Formula: scrambled[P[i]] = original[i]
 */
export async function shuffleImageData(
  sourceData: ImageData,
  secretKey: string
): Promise<ImageData> {
  const totalPixels = sourceData.width * sourceData.height;
  const seed = await deriveShuffleSeed(secretKey, `${sourceData.width}x${sourceData.height}`);
  const P = generatePermutationMap(totalPixels, seed);

  // Interpret RGBA byte buffers as 32-bit integer arrays
  const original32 = new Uint32Array(sourceData.data.buffer);
  const scrambledData = new Uint8ClampedArray(sourceData.data.length);
  const scrambled32 = new Uint32Array(scrambledData.buffer);

  for (let i = 0; i < totalPixels; i++) {
    scrambled32[P[i]] = original32[i];
  }

  return new ImageData(scrambledData, sourceData.width, sourceData.height);
}

/**
 * Restores the exact original pixel arrangement from a scrambled ImageData object.
 * Inverse formula: restored[i] = scrambled[P[i]]
 */
export async function unshuffleImageData(
  scrambledData: ImageData,
  secretKey: string
): Promise<ImageData> {
  const totalPixels = scrambledData.width * scrambledData.height;
  const seed = await deriveShuffleSeed(secretKey, `${scrambledData.width}x${scrambledData.height}`);
  const P = generatePermutationMap(totalPixels, seed);

  const scrambled32 = new Uint32Array(scrambledData.data.buffer);
  const restoredData = new Uint8ClampedArray(scrambledData.data.length);
  const restored32 = new Uint32Array(restoredData.buffer);

  for (let i = 0; i < totalPixels; i++) {
    restored32[i] = scrambled32[P[i]];
  }

  return new ImageData(restoredData, scrambledData.width, scrambledData.height);
}

/**
 * Helper to load an image File or Blob into an HTML5 ImageData object via offscreen canvas.
 */
export async function fileToImageData(file: File | Blob): Promise<{
  imageData: ImageData;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Unable to create 2D canvas context for pixel processing.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      resolve({ imageData, width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file into canvas context.'));
    };

    img.src = url;
  });
}

/**
 * Converts an ImageData object into a lossless PNG Blob.
 */
export async function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Unable to acquire canvas context.'));
      return;
    }
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob conversion failed.'));
    }, 'image/png');
  });
}

/**
 * Compares two ImageData objects byte-for-byte to verify exact pixel recovery.
 */
export function verifyExactPixelMatch(a: ImageData, b: ImageData): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.data.length !== b.data.length) return false;
  const a32 = new Uint32Array(a.data.buffer);
  const b32 = new Uint32Array(b.data.buffer);
  for (let i = 0; i < a32.length; i++) {
    if (a32[i] !== b32[i]) return false;
  }
  return true;
}

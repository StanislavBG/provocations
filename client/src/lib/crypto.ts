/**
 * Client-side encryption using Web Crypto API.
 *
 * All encryption/decryption happens exclusively in the browser.
 * The server never sees the passphrase, device key, or plaintext.
 *
 * Two-factor key derivation:
 *   encryptionKey = PBKDF2(passphrase + deviceKey)
 *
 * - Passphrase: "something you know" — entered by the user
 * - Device key: "something you have" — random key stored in localStorage
 *
 * The device key is stored in localStorage (NOT cookies) because cookies
 * are sent to the server on every HTTP request, which would defeat the
 * purpose of keeping the key material client-side only.
 *
 * Algorithm: PBKDF2 (SHA-256, 100k iterations) → AES-256-GCM
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes, recommended for AES-GCM
const SALT_LENGTH = 16; // bytes
const DEVICE_KEY_LENGTH = 32; // bytes (256 bits)

const DEVICE_KEY_STORAGE_KEY = "provocations-device-key";
const IDENTITY_SALT = "provocations-identity-v1";

// ─── Helpers ──────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Device Key Management ────────────────────────────────────────────

/**
 * Get the device key from localStorage.
 * Returns null if no device key exists (first visit or cleared storage).
 */
export function getDeviceKey(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Generate a new random device key and store it in localStorage.
 * Returns the base64-encoded device key.
 */
export function generateDeviceKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(DEVICE_KEY_LENGTH));
  const key = arrayBufferToBase64(keyBytes);
  try {
    localStorage.setItem(DEVICE_KEY_STORAGE_KEY, key);
  } catch {
    // localStorage might be full or disabled — key is still returned
    // but won't persist across page reloads
  }
  return key;
}

/**
 * Get existing device key or generate a new one.
 */
export function getOrCreateDeviceKey(): string {
  const existing = getDeviceKey();
  if (existing) return existing;
  return generateDeviceKey();
}

/**
 * Import a device key (e.g., from another browser/device backup).
 * Validates the key format before storing.
 */
export function importDeviceKey(key: string): boolean {
  try {
    // Validate it's valid base64 of the right length
    const decoded = atob(key);
    if (decoded.length !== DEVICE_KEY_LENGTH) {
      return false;
    }
    localStorage.setItem(DEVICE_KEY_STORAGE_KEY, key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a device key exists in localStorage.
 */
export function hasDeviceKey(): boolean {
  return getDeviceKey() !== null;
}

// ─── Key Derivation ───────────────────────────────────────────────────

/**
 * Derive an AES-256 encryption key from passphrase + device key.
 * The combined input ensures both factors are needed to decrypt.
 */
async function deriveKey(
  passphrase: string,
  deviceKey: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  // Combine passphrase and device key — order matters, both are required
  const combined = passphrase + "|" + deviceKey;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(combined),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: string; // base64
  salt: string; // base64
  iv: string; // base64
}

/**
 * Encrypt plaintext using passphrase + device key.
 * Returns base64-encoded ciphertext, salt, and IV.
 */
export async function encrypt(
  plaintext: string,
  passphrase: string,
  deviceKey: string
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, deviceKey, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt ciphertext using passphrase + device key.
 * Throws if either the passphrase or device key is wrong
 * (AES-GCM authentication fails).
 */
export async function decrypt(
  payload: EncryptedPayload,
  passphrase: string,
  deviceKey: string
): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(payload.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const key = await deriveKey(passphrase, deviceKey, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

// ─── Owner Hash ───────────────────────────────────────────────────────

/**
 * Hash a passphrase to create a deterministic owner identifier.
 * This lets the server group documents by "user" without knowing
 * the passphrase. Uses only the passphrase (NOT the device key)
 * so document listings work from any device.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(IDENTITY_SALT + passphrase);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToBase64(hash);
}

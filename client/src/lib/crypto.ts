/**
 * Client-side encryption utilities using Web Crypto API.
 *
 * All encryption/decryption happens in the browser. The server never
 * sees the passphrase or the plaintext document. It only stores:
 *   - the encrypted ciphertext (base64)
 *   - a random salt used for key derivation (base64)
 *   - a random IV used for AES-GCM (base64)
 *
 * Algorithm: PBKDF2 (SHA-256, 100k iterations) → AES-GCM (256-bit)
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes, recommended for AES-GCM
const SALT_LENGTH = 16; // bytes

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

async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
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

export interface EncryptedPayload {
  ciphertext: string; // base64
  salt: string; // base64
  iv: string; // base64
}

/**
 * Encrypt plaintext using a passphrase.
 * Returns base64-encoded ciphertext, salt, and IV.
 */
export async function encrypt(
  plaintext: string,
  passphrase: string
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

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
 * Decrypt ciphertext using a passphrase.
 * Throws if the passphrase is wrong (AES-GCM authentication fails).
 */
export async function decrypt(
  payload: EncryptedPayload,
  passphrase: string
): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(payload.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const key = await deriveKey(passphrase, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Hash a passphrase to create a deterministic identifier.
 * This lets the server group documents by "user" without knowing the passphrase.
 * We use a fixed salt so the same passphrase always produces the same hash.
 */
const IDENTITY_SALT = "provocations-identity-v1";

export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(IDENTITY_SALT + passphrase);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToBase64(hash);
}

/**
 * Server-side encryption utilities using Node.js crypto module.
 *
 * Algorithm: PBKDF2 (SHA-256, 100k iterations) → AES-256-GCM
 * Compatible with the former Web Crypto client-side implementation.
 *
 * Performance optimizations:
 * - LRU cache for derived PBKDF2 keys (avoids re-deriving for repeated salt+passphrase)
 * - Async PBKDF2 variants to avoid blocking the Node.js event loop
 * - Batch decrypt helper for decrypting many fields concurrently
 */

import crypto from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(crypto.pbkdf2);

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes (256 bits)
const IV_LENGTH = 12; // bytes, recommended for AES-GCM
const SALT_LENGTH = 16; // bytes
const AUTH_TAG_LENGTH = 16; // bytes (128 bits, AES-GCM default)

const IDENTITY_SALT = "provocations-identity-v1";

/* ── LRU Key Cache ──
 * Caches derived keys by (passphrase + salt) to avoid repeat PBKDF2 derivations.
 * Each entry is ~32 bytes (key) + ~24 bytes (salt base64) overhead.
 * At 2000 entries max, cache uses ~112KB — negligible memory for huge time savings.
 */
const KEY_CACHE_MAX = 2000;
const keyCache = new Map<string, Buffer>();

function cacheKey(passphrase: string, saltB64: string): string {
  return passphrase + ":" + saltB64;
}

function getCachedKey(passphrase: string, saltB64: string): Buffer | undefined {
  const k = cacheKey(passphrase, saltB64);
  const val = keyCache.get(k);
  if (val) {
    // Move to end for LRU behavior
    keyCache.delete(k);
    keyCache.set(k, val);
  }
  return val;
}

function setCachedKey(passphrase: string, saltB64: string, key: Buffer): void {
  const k = cacheKey(passphrase, saltB64);
  if (keyCache.size >= KEY_CACHE_MAX) {
    // Evict oldest entry
    const first = keyCache.keys().next().value;
    if (first !== undefined) keyCache.delete(first);
  }
  keyCache.set(k, key);
}

function deriveKeySync(passphrase: string, salt: Buffer, saltB64: string): Buffer {
  const cached = getCachedKey(passphrase, saltB64);
  if (cached) return cached;
  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
  setCachedKey(passphrase, saltB64, key);
  return key;
}

async function deriveKeyAsync(passphrase: string, salt: Buffer, saltB64: string): Promise<Buffer> {
  const cached = getCachedKey(passphrase, saltB64);
  if (cached) return cached;
  const key = await pbkdf2Async(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
  setCachedKey(passphrase, saltB64, key);
  return key;
}

export interface EncryptedPayload {
  ciphertext: string; // base64 (ciphertext + auth tag combined)
  salt: string; // base64
  iv: string; // base64
}

/**
 * Hash a passphrase to create a deterministic owner identifier.
 * Uses a fixed salt so the same passphrase always produces the same hash.
 */
export function hashPassphrase(passphrase: string): string {
  const data = IDENTITY_SALT + passphrase;
  return crypto.createHash("sha256").update(data, "utf8").digest("base64");
}

/**
 * Encrypt plaintext using a passphrase (synchronous).
 * Returns base64-encoded ciphertext (with auth tag appended), salt, and IV.
 */
export function encrypt(plaintext: string, passphrase: string): EncryptedPayload {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const saltB64 = salt.toString("base64");
  const key = deriveKeySync(passphrase, salt, saltB64);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine ciphertext + auth tag (matches Web Crypto API output format)
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString("base64"),
    salt: saltB64,
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt ciphertext using a passphrase (synchronous).
 * Throws if the passphrase is wrong (AES-GCM authentication fails).
 */
export function decrypt(payload: EncryptedPayload, passphrase: string): string {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");

  // Split: last 16 bytes are the GCM auth tag
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

  const key = deriveKeySync(passphrase, salt, payload.salt);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt plaintext using a passphrase (async — doesn't block event loop).
 */
export async function encryptAsync(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const saltB64 = salt.toString("base64");
  const key = await deriveKeyAsync(passphrase, salt, saltB64);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString("base64"),
    salt: saltB64,
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt ciphertext using a passphrase (async — doesn't block event loop).
 * Throws if the passphrase is wrong (AES-GCM authentication fails).
 */
export async function decryptAsync(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");

  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

  const key = await deriveKeyAsync(passphrase, salt, payload.salt);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Decrypt a field that may be encrypted or may be legacy plaintext.
 * Returns the decrypted value, or the legacy plaintext as fallback.
 * Async version — uses non-blocking PBKDF2.
 */
export async function decryptFieldAsync(
  legacyPlaintext: string,
  ciphertext: string | null,
  salt: string | null,
  iv: string | null,
  passphrase: string,
): Promise<string> {
  if (ciphertext && salt && iv) {
    try {
      return await decryptAsync({ ciphertext, salt, iv }, passphrase);
    } catch {
      return legacyPlaintext;
    }
  }
  return legacyPlaintext;
}

/**
 * Batch decrypt multiple encrypted fields concurrently.
 * Leverages async PBKDF2 which runs on the libuv thread pool,
 * allowing multiple key derivations to happen in parallel.
 */
export async function decryptFieldsBatch<T extends { [key: string]: unknown }>(
  items: T[],
  fieldConfig: {
    legacy: keyof T;
    ciphertext: keyof T;
    salt: keyof T;
    iv: keyof T;
    output: string;
  }[],
  passphrase: string,
): Promise<(T & { [key: string]: string })[]> {
  return Promise.all(
    items.map(async (item) => {
      const decrypted: Record<string, string> = {};
      await Promise.all(
        fieldConfig.map(async (fc) => {
          decrypted[fc.output] = await decryptFieldAsync(
            item[fc.legacy] as string,
            item[fc.ciphertext] as string | null,
            item[fc.salt] as string | null,
            item[fc.iv] as string | null,
            passphrase,
          );
        }),
      );
      return { ...item, ...decrypted } as T & { [key: string]: string };
    }),
  );
}

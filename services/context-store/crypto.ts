/**
 * Context Store — Self-contained encryption layer.
 *
 * Algorithm: PBKDF2 (SHA-256, 100k iterations) → AES-256-GCM
 * Features: LRU key cache, async PBKDF2, batch decryption.
 *
 * No external imports from the parent application.
 */

import crypto from "crypto";
import { promisify } from "util";
import type { EncryptedPayload } from "./types";

const pbkdf2Async = promisify(crypto.pbkdf2);

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ── LRU Key Cache ──

const KEY_CACHE_MAX = 2000;
const keyCache = new Map<string, Buffer>();

function cacheKey(passphrase: string, saltB64: string): string {
  return passphrase + ":" + saltB64;
}

function getCachedKey(passphrase: string, saltB64: string): Buffer | undefined {
  const k = cacheKey(passphrase, saltB64);
  const val = keyCache.get(k);
  if (val) {
    keyCache.delete(k);
    keyCache.set(k, val);
  }
  return val;
}

function setCachedKey(passphrase: string, saltB64: string, key: Buffer): void {
  const k = cacheKey(passphrase, saltB64);
  if (keyCache.size >= KEY_CACHE_MAX) {
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

// ── Sync encrypt/decrypt ──

export function encrypt(plaintext: string, passphrase: string): EncryptedPayload {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const saltB64 = salt.toString("base64");
  const key = deriveKeySync(passphrase, salt, saltB64);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString("base64"),
    salt: saltB64,
    iv: iv.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload, passphrase: string): string {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const key = deriveKeySync(passphrase, salt, payload.salt);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── Async encrypt/decrypt (non-blocking) ──

export async function encryptAsync(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const saltB64 = salt.toString("base64");
  const key = await deriveKeyAsync(passphrase, salt, saltB64);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString("base64"),
    salt: saltB64,
    iv: iv.toString("base64"),
  };
}

export async function decryptAsync(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const key = await deriveKeyAsync(passphrase, salt, payload.salt);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── Field-level helpers ──

/** Decrypt a field that may be encrypted or legacy plaintext. Async. */
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

/** Sync version of decryptFieldAsync for single-doc reads. */
export function decryptField(
  legacyPlaintext: string,
  ciphertext: string | null,
  salt: string | null,
  iv: string | null,
  passphrase: string,
): string {
  if (ciphertext && salt && iv) {
    try {
      return decrypt({ ciphertext, salt, iv }, passphrase);
    } catch {
      return legacyPlaintext;
    }
  }
  return legacyPlaintext;
}

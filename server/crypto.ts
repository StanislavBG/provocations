/**
 * Server-side encryption utilities using Node.js crypto module.
 *
 * Algorithm: PBKDF2 (SHA-256, 100k iterations) → AES-256-GCM
 * Compatible with the former Web Crypto client-side implementation.
 */

import crypto from "crypto";

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes (256 bits)
const IV_LENGTH = 12; // bytes, recommended for AES-GCM
const SALT_LENGTH = 16; // bytes
const AUTH_TAG_LENGTH = 16; // bytes (128 bits, AES-GCM default)

const IDENTITY_SALT = "provocations-identity-v1";

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
 * Encrypt plaintext using a passphrase.
 * Returns base64-encoded ciphertext (with auth tag appended), salt, and IV.
 */
export function encrypt(plaintext: string, passphrase: string): EncryptedPayload {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");

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
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt ciphertext using a passphrase.
 * Throws if the passphrase is wrong (AES-GCM authentication fails).
 */
export function decrypt(payload: EncryptedPayload, passphrase: string): string {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");

  // Split: last 16 bytes are the GCM auth tag
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

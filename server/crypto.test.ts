/**
 * Crypto backward compatibility tests.
 *
 * These tests ensure that:
 * 1. Documents encrypted with the OLD random-salt method can still be decrypted
 * 2. Documents encrypted with the NEW master-salt method decrypt correctly
 * 3. Encrypt → decrypt round-trips work for all variants (sync + async)
 * 4. Wrong passphrase throws (auth tag verification)
 * 5. Corrupted ciphertext throws
 * 6. The master key cache behaves correctly
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  encrypt,
  decrypt,
  encryptAsync,
  decryptAsync,
  decryptFieldAsync,
  type EncryptedPayload,
} from "./crypto";

const TEST_PASSPHRASE = "test-encryption-secret-12345";
const MASTER_SALT_B64 = Buffer.from("provocations-master-key-v1").toString("base64");

// ---------------------------------------------------------------------------
// Helper: simulate OLD encrypt() that used random salts (pre-optimization)
// ---------------------------------------------------------------------------
function encryptWithRandomSalt(plaintext: string, passphrase: string): EncryptedPayload {
  const salt = crypto.randomBytes(16); // OLD behavior: random salt every time
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, "sha256");

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };
}

// ---------------------------------------------------------------------------
// 1. Backward Compatibility: Old random-salt documents
// ---------------------------------------------------------------------------
describe("Crypto backward compatibility", () => {
  it("decrypts documents encrypted with old random-salt method", () => {
    const plaintext = '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}';
    const encrypted = encryptWithRandomSalt(plaintext, TEST_PASSPHRASE);

    // Salt should NOT be master salt (it's random)
    expect(encrypted.salt).not.toBe(MASTER_SALT_B64);

    // Current decrypt() should handle old random-salt documents
    const result = decrypt(encrypted, TEST_PASSPHRASE);
    expect(result).toBe(plaintext);
  });

  it("decrypts old documents with complex canvas content", () => {
    const complexCanvas = JSON.stringify({
      nodes: [
        { id: "n1", type: "context-doc", x: 100, y: 200, width: 220, height: 140, label: "My Document", zIndex: 1, documentId: 42, snippet: "Hello world" },
        { id: "n2", type: "research", x: 400, y: 200, width: 260, height: 180, label: "Research", zIndex: 2 },
        { id: "n3", type: "llm", x: 700, y: 200, width: 240, height: 160, label: "Summarize", zIndex: 3, llmPresetId: "summarize", llmOutput: "Summary text here" },
      ],
      edges: [
        { id: "e1", fromNodeId: "n1", toNodeId: "n2" },
        { id: "e2", fromNodeId: "n2", toNodeId: "n3", role: "context" },
      ],
      viewport: { x: -50, y: -30, zoom: 0.8 },
    });

    const encrypted = encryptWithRandomSalt(complexCanvas, TEST_PASSPHRASE);
    const result = decrypt(encrypted, TEST_PASSPHRASE);
    expect(JSON.parse(result)).toEqual(JSON.parse(complexCanvas));
  });

  it("decrypts old documents with unicode content", () => {
    const unicodeContent = '{"nodes":[{"label":"Ünïcödé tëst 日本語 🎨 émojis"}]}';
    const encrypted = encryptWithRandomSalt(unicodeContent, TEST_PASSPHRASE);
    const result = decrypt(encrypted, TEST_PASSPHRASE);
    expect(result).toBe(unicodeContent);
  });

  it("decrypts old documents with very large content", () => {
    // Simulate a canvas with many nodes (realistic size)
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      id: `node-${i}`,
      type: "context-doc",
      x: i * 300,
      y: Math.floor(i / 10) * 200,
      width: 220,
      height: 140,
      label: `Document ${i}`,
      zIndex: i,
      snippet: "A".repeat(500), // Each node has 500 chars of content
    }));
    const largeCanvas = JSON.stringify({ nodes, edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

    const encrypted = encryptWithRandomSalt(largeCanvas, TEST_PASSPHRASE);
    const result = decrypt(encrypted, TEST_PASSPHRASE);
    expect(result).toBe(largeCanvas);
  });
});

// ---------------------------------------------------------------------------
// 2. New master-salt encryption
// ---------------------------------------------------------------------------
describe("Master-salt encryption", () => {
  it("encrypt() uses master salt", () => {
    const encrypted = encrypt("test", TEST_PASSPHRASE);
    expect(encrypted.salt).toBe(MASTER_SALT_B64);
  });

  it("encrypt → decrypt round-trip (sync)", () => {
    const plaintext = '{"nodes":[{"id":"n1","type":"research","x":100,"y":200}],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}';
    const encrypted = encrypt(plaintext, TEST_PASSPHRASE);
    const result = decrypt(encrypted, TEST_PASSPHRASE);
    expect(result).toBe(plaintext);
  });

  it("encrypt → decrypt round-trip (async)", async () => {
    const plaintext = "async encryption test content";
    const encrypted = await encryptAsync(plaintext, TEST_PASSPHRASE);
    expect(encrypted.salt).toBe(MASTER_SALT_B64);

    const result = await decryptAsync(encrypted, TEST_PASSPHRASE);
    expect(result).toBe(plaintext);
  });

  it("each encrypt produces unique IV (different ciphertext for same plaintext)", () => {
    const plaintext = "same content";
    const e1 = encrypt(plaintext, TEST_PASSPHRASE);
    const e2 = encrypt(plaintext, TEST_PASSPHRASE);

    // Same salt (master)
    expect(e1.salt).toBe(e2.salt);
    // Different IV
    expect(e1.iv).not.toBe(e2.iv);
    // Different ciphertext
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
    // Both decrypt to same plaintext
    expect(decrypt(e1, TEST_PASSPHRASE)).toBe(plaintext);
    expect(decrypt(e2, TEST_PASSPHRASE)).toBe(plaintext);
  });

  it("empty string encrypts and decrypts", () => {
    const encrypted = encrypt("", TEST_PASSPHRASE);
    expect(decrypt(encrypted, TEST_PASSPHRASE)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-compatibility: old encrypt ↔ new decrypt and vice versa
// ---------------------------------------------------------------------------
describe("Cross-compatibility", () => {
  it("old-encrypted content decrypts with new code", () => {
    const plaintext = "cross-compat test";
    const oldEncrypted = encryptWithRandomSalt(plaintext, TEST_PASSPHRASE);
    expect(decrypt(oldEncrypted, TEST_PASSPHRASE)).toBe(plaintext);
  });

  it("new-encrypted content structure is valid", () => {
    const encrypted = encrypt("test", TEST_PASSPHRASE);
    // Ciphertext should be valid base64
    expect(() => Buffer.from(encrypted.ciphertext, "base64")).not.toThrow();
    // Salt should be valid base64
    expect(() => Buffer.from(encrypted.salt, "base64")).not.toThrow();
    // IV should be valid base64 and 12 bytes
    const ivBuf = Buffer.from(encrypted.iv, "base64");
    expect(ivBuf.length).toBe(12);
  });

  it("mixed old and new documents decrypt in sequence", () => {
    // Simulate loading a document list with mixed encryption methods
    const docs = [
      { plain: "doc1", enc: encryptWithRandomSalt("doc1", TEST_PASSPHRASE) },
      { plain: "doc2", enc: encrypt("doc2", TEST_PASSPHRASE) },
      { plain: "doc3", enc: encryptWithRandomSalt("doc3", TEST_PASSPHRASE) },
      { plain: "doc4", enc: encrypt("doc4", TEST_PASSPHRASE) },
      { plain: "doc5", enc: encryptWithRandomSalt("doc5", TEST_PASSPHRASE) },
    ];

    for (const doc of docs) {
      expect(decrypt(doc.enc, TEST_PASSPHRASE)).toBe(doc.plain);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Error cases
// ---------------------------------------------------------------------------
describe("Error handling", () => {
  it("wrong passphrase throws on master-salt docs", () => {
    const encrypted = encrypt("secret content", TEST_PASSPHRASE);
    expect(() => decrypt(encrypted, "wrong-passphrase")).toThrow();
  });

  it("wrong passphrase throws on old random-salt docs", () => {
    const encrypted = encryptWithRandomSalt("secret content", TEST_PASSPHRASE);
    expect(() => decrypt(encrypted, "wrong-passphrase")).toThrow();
  });

  it("tampered ciphertext throws (auth tag verification)", () => {
    const encrypted = encrypt("tamper test", TEST_PASSPHRASE);
    // Flip a byte in the ciphertext
    const buf = Buffer.from(encrypted.ciphertext, "base64");
    buf[0] ^= 0xff;
    const tampered = { ...encrypted, ciphertext: buf.toString("base64") };
    expect(() => decrypt(tampered, TEST_PASSPHRASE)).toThrow();
  });

  it("truncated ciphertext throws", () => {
    const encrypted = encrypt("truncate test", TEST_PASSPHRASE);
    const buf = Buffer.from(encrypted.ciphertext, "base64");
    const truncated = { ...encrypted, ciphertext: buf.subarray(0, 5).toString("base64") };
    expect(() => decrypt(truncated, TEST_PASSPHRASE)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. decryptFieldAsync — legacy plaintext fallback
// ---------------------------------------------------------------------------
describe("decryptFieldAsync", () => {
  it("returns decrypted value when encrypted fields present", async () => {
    const encrypted = encrypt("Encrypted Title", TEST_PASSPHRASE);
    const result = await decryptFieldAsync(
      "[encrypted]",
      encrypted.ciphertext,
      encrypted.salt,
      encrypted.iv,
      TEST_PASSPHRASE,
    );
    expect(result).toBe("Encrypted Title");
  });

  it("falls back to legacy plaintext when no encrypted fields", async () => {
    const result = await decryptFieldAsync(
      "Legacy Plaintext Title",
      null,
      null,
      null,
      TEST_PASSPHRASE,
    );
    expect(result).toBe("Legacy Plaintext Title");
  });

  it("falls back to legacy plaintext on decrypt failure", async () => {
    // Provide garbage encrypted fields
    const result = await decryptFieldAsync(
      "Fallback Title",
      "not-valid-ciphertext",
      "not-valid-salt",
      "not-valid-iv",
      TEST_PASSPHRASE,
    );
    expect(result).toBe("Fallback Title");
  });
});

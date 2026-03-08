/**
 * Encryption round-trip tests for server/crypto.ts
 *
 * Tests the AES-256-GCM encryption/decryption pipeline:
 * - Round-trip for various content types and sizes
 * - Unique IV per encryption
 * - Decryption failure with wrong key
 * - Legacy plaintext fallback via decryptFieldAsync
 * - Async variants (encryptAsync/decryptAsync)
 * - Batch decryption (decryptFieldsBatch)
 */

import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  encryptAsync,
  decryptAsync,
  decryptFieldAsync,
  decryptFieldsBatch,
  hashPassphrase,
  type EncryptedPayload,
} from "../../../server/crypto";

const PASSPHRASE = "test-encryption-secret-for-unit-tests";
const WRONG_PASSPHRASE = "definitely-wrong-passphrase";

// ---------------------------------------------------------------------------
// 1. Basic round-trip tests (sync)
// ---------------------------------------------------------------------------
describe("encrypt/decrypt round-trip (sync)", () => {
  it("round-trips a simple string", () => {
    const plaintext = "Hello, world!";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const encrypted = encrypt("", PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe("");
  });

  it("round-trips a single character", () => {
    const encrypted = encrypt("x", PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe("x");
  });

  it("round-trips unicode content", () => {
    const plaintext = "Hello 🌍 привет мир 你好世界 مرحبا 🎨🔥💻";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips emoji-only content", () => {
    const plaintext = "🎉🎊🎈🎁🎀🎃🎄🎅🎆🎇";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips content with newlines and tabs", () => {
    const plaintext = "Line 1\nLine 2\n\tTabbed\r\nWindows line ending";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips content with null bytes", () => {
    const plaintext = "before\0after\0end";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips JSON content", () => {
    const obj = { nodes: [{ id: "n1", type: "document" }], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    const plaintext = JSON.stringify(obj);
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(JSON.parse(decrypt(encrypted, PASSPHRASE))).toEqual(obj);
  });

  it("round-trips HTML content", () => {
    const plaintext = '<div class="test"><p>Hello &amp; goodbye</p></div>';
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips very long content (100KB+)", () => {
    const plaintext = "A".repeat(100_000) + " " + "B".repeat(50_000);
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips markdown content", () => {
    const plaintext = "# Title\n\n## Section\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// 2. Async round-trip tests
// ---------------------------------------------------------------------------
describe("encrypt/decrypt round-trip (async)", () => {
  it("round-trips a simple string", async () => {
    const plaintext = "Async test content";
    const encrypted = await encryptAsync(plaintext, PASSPHRASE);
    expect(await decryptAsync(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("round-trips an empty string", async () => {
    const encrypted = await encryptAsync("", PASSPHRASE);
    expect(await decryptAsync(encrypted, PASSPHRASE)).toBe("");
  });

  it("round-trips unicode content", async () => {
    const plaintext = "日本語テスト 🇯🇵";
    const encrypted = await encryptAsync(plaintext, PASSPHRASE);
    expect(await decryptAsync(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("sync encrypt works with async decrypt", async () => {
    const plaintext = "Cross-compatible test";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    expect(await decryptAsync(encrypted, PASSPHRASE)).toBe(plaintext);
  });

  it("async encrypt works with sync decrypt", async () => {
    const plaintext = "Cross-compatible reverse";
    const encrypted = await encryptAsync(plaintext, PASSPHRASE);
    expect(decrypt(encrypted, PASSPHRASE)).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// 3. Encryption properties
// ---------------------------------------------------------------------------
describe("encryption properties", () => {
  it("different inputs produce different ciphertexts", () => {
    const e1 = encrypt("input A", PASSPHRASE);
    const e2 = encrypt("input B", PASSPHRASE);
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
  });

  it("same input produces different ciphertexts (random IV)", () => {
    const e1 = encrypt("same content", PASSPHRASE);
    const e2 = encrypt("same content", PASSPHRASE);
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
    expect(e1.iv).not.toBe(e2.iv);
  });

  it("produces valid base64 output", () => {
    const encrypted = encrypt("test", PASSPHRASE);
    const b64 = /^[A-Za-z0-9+/]+=*$/;
    expect(encrypted.ciphertext).toMatch(b64);
    expect(encrypted.salt).toMatch(b64);
    expect(encrypted.iv).toMatch(b64);
  });

  it("IV is 12 bytes (96 bits) as required by AES-GCM", () => {
    const encrypted = encrypt("test", PASSPHRASE);
    const ivBuf = Buffer.from(encrypted.iv, "base64");
    expect(ivBuf.length).toBe(12);
  });

  it("ciphertext is longer than plaintext (includes auth tag)", () => {
    const plaintext = "short";
    const encrypted = encrypt(plaintext, PASSPHRASE);
    const ciphertextBuf = Buffer.from(encrypted.ciphertext, "base64");
    // AES-GCM auth tag is 16 bytes, so ciphertext should be at least plaintext + 16
    expect(ciphertextBuf.length).toBeGreaterThanOrEqual(plaintext.length + 16);
  });
});

// ---------------------------------------------------------------------------
// 4. Decryption failure cases
// ---------------------------------------------------------------------------
describe("decryption failure cases", () => {
  it("throws with wrong passphrase", () => {
    const encrypted = encrypt("secret content", PASSPHRASE);
    expect(() => decrypt(encrypted, WRONG_PASSPHRASE)).toThrow();
  });

  it("async throws with wrong passphrase", async () => {
    const encrypted = await encryptAsync("secret content", PASSPHRASE);
    await expect(decryptAsync(encrypted, WRONG_PASSPHRASE)).rejects.toThrow();
  });

  it("throws with tampered ciphertext", () => {
    const encrypted = encrypt("tamper test", PASSPHRASE);
    const buf = Buffer.from(encrypted.ciphertext, "base64");
    buf[0] ^= 0xff;
    const tampered: EncryptedPayload = { ...encrypted, ciphertext: buf.toString("base64") };
    expect(() => decrypt(tampered, PASSPHRASE)).toThrow();
  });

  it("throws with tampered IV", () => {
    const encrypted = encrypt("iv tamper test", PASSPHRASE);
    const ivBuf = Buffer.from(encrypted.iv, "base64");
    ivBuf[0] ^= 0xff;
    const tampered: EncryptedPayload = { ...encrypted, iv: ivBuf.toString("base64") };
    expect(() => decrypt(tampered, PASSPHRASE)).toThrow();
  });

  it("throws with truncated ciphertext", () => {
    const encrypted = encrypt("truncate test", PASSPHRASE);
    const buf = Buffer.from(encrypted.ciphertext, "base64");
    const truncated: EncryptedPayload = { ...encrypted, ciphertext: buf.subarray(0, 5).toString("base64") };
    expect(() => decrypt(truncated, PASSPHRASE)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. decryptFieldAsync — legacy plaintext fallback
// ---------------------------------------------------------------------------
describe("decryptFieldAsync", () => {
  it("returns decrypted value when encrypted fields present", async () => {
    const encrypted = encrypt("Encrypted Title", PASSPHRASE);
    const result = await decryptFieldAsync(
      "[encrypted]",
      encrypted.ciphertext,
      encrypted.salt,
      encrypted.iv,
      PASSPHRASE,
    );
    expect(result).toBe("Encrypted Title");
  });

  it("falls back to legacy plaintext when ciphertext is null", async () => {
    const result = await decryptFieldAsync("Legacy Title", null, null, null, PASSPHRASE);
    expect(result).toBe("Legacy Title");
  });

  it("falls back to legacy plaintext when salt is null", async () => {
    const result = await decryptFieldAsync("Legacy", "some-cipher", null, "some-iv", PASSPHRASE);
    expect(result).toBe("Legacy");
  });

  it("falls back to legacy plaintext on decrypt failure (garbage data)", async () => {
    const result = await decryptFieldAsync(
      "Fallback",
      "not-valid-ciphertext",
      "not-valid-salt",
      "not-valid-iv",
      PASSPHRASE,
    );
    expect(result).toBe("Fallback");
  });

  it("falls back to legacy plaintext when wrong passphrase", async () => {
    const encrypted = encrypt("Secret", PASSPHRASE);
    const result = await decryptFieldAsync(
      "Fallback Content",
      encrypted.ciphertext,
      encrypted.salt,
      encrypted.iv,
      WRONG_PASSPHRASE,
    );
    expect(result).toBe("Fallback Content");
  });
});

// ---------------------------------------------------------------------------
// 6. decryptFieldsBatch
// ---------------------------------------------------------------------------
describe("decryptFieldsBatch", () => {
  it("batch decrypts multiple items", async () => {
    const items = [
      { id: 1, title: "[encrypted]", ...prefixEncrypted("Title A", PASSPHRASE, "title") },
      { id: 2, title: "[encrypted]", ...prefixEncrypted("Title B", PASSPHRASE, "title") },
    ];

    const result = await decryptFieldsBatch(
      items,
      [{
        legacy: "title" as const,
        ciphertext: "title_ciphertext" as const,
        salt: "title_salt" as const,
        iv: "title_iv" as const,
        output: "decryptedTitle",
      }],
      PASSPHRASE,
    );

    expect(result[0].decryptedTitle).toBe("Title A");
    expect(result[1].decryptedTitle).toBe("Title B");
  });
});

// Helper to create encrypted field columns
function prefixEncrypted(plaintext: string, passphrase: string, prefix: string) {
  const enc = encrypt(plaintext, passphrase);
  return {
    [`${prefix}_ciphertext`]: enc.ciphertext,
    [`${prefix}_salt`]: enc.salt,
    [`${prefix}_iv`]: enc.iv,
  };
}

// ---------------------------------------------------------------------------
// 7. hashPassphrase
// ---------------------------------------------------------------------------
describe("hashPassphrase", () => {
  it("is deterministic", () => {
    expect(hashPassphrase("my-secret")).toBe(hashPassphrase("my-secret"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPassphrase("secret-a")).not.toBe(hashPassphrase("secret-b"));
  });

  it("produces valid base64", () => {
    const hash = hashPassphrase("test");
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("returns a SHA-256 hash (32 bytes = 44 base64 chars)", () => {
    const hash = hashPassphrase("test");
    expect(hash.length).toBe(44); // 32 bytes base64 = 44 chars
  });
});

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptAsync, decryptAsync, hashPassphrase, type EncryptedPayload } from '../crypto';

const PASSPHRASE = 'test-passphrase-for-unit-tests';

describe('crypto', () => {
  describe('encrypt/decrypt round-trip', () => {
    it('should round-trip basic text', () => {
      const plaintext = 'Hello, world!';
      const payload = encrypt(plaintext, PASSPHRASE);
      const result = decrypt(payload, PASSPHRASE);
      expect(result).toBe(plaintext);
    });

    it('should round-trip empty string', () => {
      const payload = encrypt('', PASSPHRASE);
      const result = decrypt(payload, PASSPHRASE);
      expect(result).toBe('');
    });

    it('should round-trip unicode content', () => {
      const plaintext = 'Hello 🌍 привет мир 你好世界 مرحبا بالعالم';
      const payload = encrypt(plaintext, PASSPHRASE);
      const result = decrypt(payload, PASSPHRASE);
      expect(result).toBe(plaintext);
    });

    it('should round-trip large content', () => {
      const plaintext = 'A'.repeat(100_000);
      const payload = encrypt(plaintext, PASSPHRASE);
      const result = decrypt(payload, PASSPHRASE);
      expect(result).toBe(plaintext);
    });

    it('should round-trip content with special characters', () => {
      const plaintext = 'Line1\nLine2\tTabbed\r\nWindows line\0Null byte';
      const payload = encrypt(plaintext, PASSPHRASE);
      const result = decrypt(payload, PASSPHRASE);
      expect(result).toBe(plaintext);
    });
  });

  describe('encryption properties', () => {
    it('should produce different ciphertexts for same plaintext (unique IV per call)', () => {
      const plaintext = 'Same text';
      const payload1 = encrypt(plaintext, PASSPHRASE);
      const payload2 = encrypt(plaintext, PASSPHRASE);
      // Ciphertexts differ because IVs are unique
      expect(payload1.ciphertext).not.toBe(payload2.ciphertext);
      // Salt is now fixed (master key caching) — same for all encryptions
      expect(payload1.salt).toBe(payload2.salt);
      // IVs are still random per call
      expect(payload1.iv).not.toBe(payload2.iv);
    });

    it('should produce valid base64 output', () => {
      const payload = encrypt('test', PASSPHRASE);
      const b64regex = /^[A-Za-z0-9+/]+=*$/;
      expect(payload.ciphertext).toMatch(b64regex);
      expect(payload.salt).toMatch(b64regex);
      expect(payload.iv).toMatch(b64regex);
    });
  });

  describe('decryption failures', () => {
    it('should throw with wrong passphrase', () => {
      const payload = encrypt('secret', PASSPHRASE);
      expect(() => decrypt(payload, 'wrong-passphrase')).toThrow();
    });

    it('should throw with tampered ciphertext', () => {
      const payload = encrypt('secret', PASSPHRASE);
      const tampered: EncryptedPayload = {
        ...payload,
        ciphertext: payload.ciphertext.slice(0, -4) + 'AAAA',
      };
      expect(() => decrypt(tampered, PASSPHRASE)).toThrow();
    });
  });

  describe('async variants', () => {
    it('should round-trip with async encrypt/decrypt', async () => {
      const plaintext = 'Async test content';
      const payload = await encryptAsync(plaintext, PASSPHRASE);
      const result = await decryptAsync(payload, PASSPHRASE);
      expect(result).toBe(plaintext);
    });

    it('sync and async should produce compatible output', async () => {
      const plaintext = 'Cross-compatible';
      const syncPayload = encrypt(plaintext, PASSPHRASE);
      const asyncResult = await decryptAsync(syncPayload, PASSPHRASE);
      expect(asyncResult).toBe(plaintext);

      const asyncPayload = await encryptAsync(plaintext, PASSPHRASE);
      const syncResult = decrypt(asyncPayload, PASSPHRASE);
      expect(syncResult).toBe(plaintext);
    });
  });

  describe('hashPassphrase', () => {
    it('should produce deterministic output', () => {
      const hash1 = hashPassphrase('my-secret');
      const hash2 = hashPassphrase('my-secret');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashPassphrase('secret-a');
      const hash2 = hashPassphrase('secret-b');
      expect(hash1).not.toBe(hash2);
    });
  });
});

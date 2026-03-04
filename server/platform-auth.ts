/**
 * Platform Auth — Token management for social media OAuth tokens.
 * Handles decryption, expiry checking, refresh, and revocation.
 */

import { storage } from "./storage";
import { encrypt, decrypt } from "./crypto";
import { PLATFORM_CONFIG, getClientCredentials, type SupportedPlatform } from "./oauth-config";

function getEncryptionKey(): string {
  return process.env.ENCRYPTION_SECRET || "dev-secret-key-change-me";
}

/**
 * Get a valid (non-expired) access token for a user+platform.
 * Auto-refreshes if expired and a refresh token is available.
 * Returns null if no credential exists or refresh fails.
 */
export async function getValidToken(userId: string, platform: SupportedPlatform): Promise<string | null> {
  const cred = await storage.getPlatformCredential(userId, platform);
  if (!cred) return null;
  if (cred.status === "revoked") return null;

  const key = getEncryptionKey();

  // Check expiry
  if (cred.expiresAt && cred.expiresAt < new Date()) {
    // Try to refresh
    const refreshed = await refreshToken(userId, platform);
    if (!refreshed) {
      await storage.updatePlatformCredentialStatus(userId, platform, "expired");
      return null;
    }
    // Re-fetch after refresh
    const updated = await storage.getPlatformCredential(userId, platform);
    if (!updated) return null;
    return decrypt({ ciphertext: updated.tokenCiphertext, salt: updated.tokenSalt, iv: updated.tokenIv }, key);
  }

  try {
    return decrypt({ ciphertext: cred.tokenCiphertext, salt: cred.tokenSalt, iv: cred.tokenIv }, key);
  } catch {
    await storage.updatePlatformCredentialStatus(userId, platform, "error");
    return null;
  }
}

/**
 * Refresh an access token using the stored refresh token.
 * Returns true if refresh succeeded, false otherwise.
 */
export async function refreshToken(userId: string, platform: SupportedPlatform): Promise<boolean> {
  const cred = await storage.getPlatformCredential(userId, platform);
  if (!cred || !cred.refreshTokenCiphertext || !cred.refreshTokenSalt || !cred.refreshTokenIv) {
    return false;
  }

  const key = getEncryptionKey();
  const credentials = getClientCredentials(platform);
  if (!credentials) return false;

  let refreshTokenPlaintext: string;
  try {
    refreshTokenPlaintext = decrypt(
      { ciphertext: cred.refreshTokenCiphertext, salt: cred.refreshTokenSalt, iv: cred.refreshTokenIv },
      key,
    );
  } catch {
    return false;
  }

  const config = PLATFORM_CONFIG[platform];
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenPlaintext,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };

    const encryptedToken = encrypt(data.access_token, key);
    const encryptedRefresh = data.refresh_token ? encrypt(data.refresh_token, key) : null;

    await storage.upsertPlatformCredential({
      userId,
      platform,
      tokenCiphertext: encryptedToken.ciphertext,
      tokenSalt: encryptedToken.salt,
      tokenIv: encryptedToken.iv,
      refreshTokenCiphertext: encryptedRefresh?.ciphertext ?? cred.refreshTokenCiphertext,
      refreshTokenSalt: encryptedRefresh?.salt ?? cred.refreshTokenSalt,
      refreshTokenIv: encryptedRefresh?.iv ?? cred.refreshTokenIv,
      accountName: cred.accountName,
      scopes: cred.scopes,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : cred.expiresAt,
      status: "active",
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke a platform token and delete the credential.
 */
export async function revokeToken(userId: string, platform: SupportedPlatform): Promise<void> {
  const cred = await storage.getPlatformCredential(userId, platform);
  if (!cred) return;

  const config = PLATFORM_CONFIG[platform];
  const credentials = getClientCredentials(platform);

  // Best-effort revoke at the platform
  if (config.revokeUrl && credentials) {
    try {
      const key = getEncryptionKey();
      const token = decrypt({ ciphertext: cred.tokenCiphertext, salt: cred.tokenSalt, iv: cred.tokenIv }, key);
      await fetch(config.revokeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }).toString(),
      });
    } catch {
      // Best effort — still delete locally
    }
  }

  await storage.deletePlatformCredential(userId, platform);
}

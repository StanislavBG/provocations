/**
 * OAuth Configuration — Platform-specific OAuth settings.
 * Each platform defines its authorization URL, token URL, scopes,
 * and the environment variable names for client ID/secret.
 */

export interface PlatformOAuthConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  /** Whether the platform uses PKCE (Proof Key for Code Exchange) */
  usesPkce?: boolean;
}

export const SUPPORTED_PLATFORMS = ["x", "linkedin", "facebook", "instagram", "reddit"] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

export const PLATFORM_CONFIG: Record<SupportedPlatform, PlatformOAuthConfig> = {
  x: {
    name: "X (Twitter)",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    revokeUrl: "https://api.twitter.com/2/oauth2/revoke",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientIdEnvVar: "OAUTH_X_CLIENT_ID",
    clientSecretEnvVar: "OAUTH_X_CLIENT_SECRET",
    usesPkce: true,
  },
  linkedin: {
    name: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    clientIdEnvVar: "OAUTH_LINKEDIN_CLIENT_ID",
    clientSecretEnvVar: "OAUTH_LINKEDIN_CLIENT_SECRET",
  },
  facebook: {
    name: "Facebook",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish"],
    clientIdEnvVar: "OAUTH_FACEBOOK_APP_ID",
    clientSecretEnvVar: "OAUTH_FACEBOOK_APP_SECRET",
  },
  instagram: {
    name: "Instagram",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    clientIdEnvVar: "OAUTH_FACEBOOK_APP_ID",
    clientSecretEnvVar: "OAUTH_FACEBOOK_APP_SECRET",
  },
  reddit: {
    name: "Reddit",
    authUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    revokeUrl: "https://www.reddit.com/api/v1/revoke_token",
    scopes: ["submit", "identity", "read"],
    clientIdEnvVar: "OAUTH_REDDIT_CLIENT_ID",
    clientSecretEnvVar: "OAUTH_REDDIT_CLIENT_SECRET",
  },
};

/**
 * Get the OAuth redirect URI for a given platform.
 * Uses OAUTH_REDIRECT_BASE_URL env var as the base.
 */
export function getRedirectUri(platform: SupportedPlatform): string {
  const base = process.env.OAUTH_REDIRECT_BASE_URL || "http://localhost:5000";
  return `${base}/api/oauth/${platform}/callback`;
}

/**
 * Check if a platform has its OAuth credentials configured.
 */
export function isPlatformConfigured(platform: SupportedPlatform): boolean {
  const config = PLATFORM_CONFIG[platform];
  return !!(process.env[config.clientIdEnvVar] && process.env[config.clientSecretEnvVar]);
}

/**
 * Get client credentials from environment variables.
 */
export function getClientCredentials(platform: SupportedPlatform): { clientId: string; clientSecret: string } | null {
  const config = PLATFORM_CONFIG[platform];
  const clientId = process.env[config.clientIdEnvVar];
  const clientSecret = process.env[config.clientSecretEnvVar];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

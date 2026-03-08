/**
 * Environment variable validation — runs at server startup.
 *
 * Required variables cause process.exit(1) if missing.
 * Optional variables log warnings so operators know what's unconfigured.
 */

export function validateEnv(): void {
  const required: string[] = [
    "DATABASE_URL",
    "ENCRYPTION_SECRET",
    "CLERK_SECRET_KEY",
  ];

  const optional: { name: string; purpose: string }[] = [
    { name: "GEMINI_API_KEY", purpose: "Gemini LLM provider" },
    { name: "YOUTUBE_API_KEY", purpose: "YouTube Data API v3" },
    { name: "ELEVENLABS_API_KEY", purpose: "ElevenLabs TTS" },
    { name: "ANTHROPIC_API_KEY", purpose: "Anthropic Claude provider" },
  ];

  const missing: string[] = [];
  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.error(
      `[env] FATAL: Missing required environment variables: ${missing.join(", ")}`
    );
    console.error("[env] Server cannot start without these. Exiting.");
    process.exit(1);
  }

  for (const { name, purpose } of optional) {
    if (!process.env[name]) {
      console.warn(`[env] WARNING: ${name} is not set — ${purpose} will be unavailable`);
    }
  }

  console.log("[env] Environment validation passed.");
}

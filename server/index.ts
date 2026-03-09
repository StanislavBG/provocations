import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import { ensureTables } from "./db";
import { discoverModels } from "./llm";
import { setupCanvasWebSocket, setSaveCanvasCallback } from "./canvas-collab";
import { validateEnv } from "./env";
import { requestLogger } from "./logger";
import { APP_VERSION } from "../client/src/lib/version";
import pg from "pg";

// Validate environment variables before anything else
validateEnv();

const app = express();
const httpServer = createServer(app);

// ── Security: disable x-powered-by header ──
app.disable("x-powered-by");

// ── Redirect legacy replit.app domain to provocations.app ──
app.use((req, res, next) => {
  const host = req.hostname;
  if (host === "provocations.replit.app" || host.endsWith(".provocations.replit.app")) {
    return res.redirect(301, `https://provocations.app${req.originalUrl}`);
  }
  next();
});

// ── Security: helmet middleware with CSP for trusted domains ──
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://*.clerk.accounts.dev",
          "https://clerk.com",
          "https://*.clerk.com",
          "https://clerk.provocations.app",
          "https://aiqastudio.com",
          "https://bglabs.app",
        ],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://*.clerk.accounts.dev",
          "https://clerk.com",
          "https://*.clerk.com",
          "https://clerk.provocations.app",
          "https://aiqastudio.com",
          "https://bglabs.app",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        mediaSrc: ["'self'", "blob:", "data:"],
        connectSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://clerk.com",
          "https://*.clerk.com",
          "https://clerk.provocations.app",
          "https://aiqastudio.com",
          "https://bglabs.app",
          "https://generativelanguage.googleapis.com",
          "https://api.anthropic.com",
          "https://api.openai.com",
          "https://api.elevenlabs.io",
          "wss://api.elevenlabs.io",
          "https://www.googleapis.com",
          "wss:",
          "ws:",
        ],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'self'", "https://*.clerk.accounts.dev", "https://clerk.com", "https://*.clerk.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

// Permissions-Policy: restrict sensitive browser APIs
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=()",
  );
  next();
});

// Structured request logging middleware
app.use(requestLogger());

// Stripe webhooks need the raw body for signature verification.
// All other routes get the usual JSON parser.
app.use((req, res, next) => {
  if (req.path === "/api/stripe/webhook") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json({ limit: "5mb" })(req, res, next);
  }
});
app.use(clerkMiddleware());

// Health check endpoint — no auth required
app.get("/api/health", async (_req, res) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Database connectivity
  try {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 3_000,
    });
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    checks.database = "ok";
  } catch {
    checks.database = "unavailable";
    healthy = false;
  }

  // LLM provider availability
  checks.llm = process.env.GEMINI_API_KEY
    ? "ok"
    : process.env.ANTHROPIC_API_KEY
      ? "ok"
      : "no_api_key";
  if (checks.llm !== "ok") healthy = false;

  const status = healthy ? 200 : 503;
  res.status(status).json({
    status: healthy ? "healthy" : "degraded",
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.get("/api/clerk-config", (_req, res) => {
  const key = process.env.CLERK_PUBLISHABLE_KEY;
  if (!key) {
    return res.status(500).json({ error: "Clerk publishable key not configured" });
  }
  res.json({ publishableKey: key });
});

app.use("/api", (req, _res, next) => {
  if (req.path === "/clerk-config" || req.path === "/stripe/webhook" || req.path === "/health" || req.path.startsWith("/webhook/")) {
    return next();
  }
  return requireAuth()(req, _res, next);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create tables if they don't exist (handles first-run / missing db:push)
  try {
    await ensureTables();
  } catch (err) {
    console.error("ensureTables failed:", err instanceof Error ? err.message : err);
    console.warn("Continuing without database.");
  }

  // Discover available models from OpenAI / Gemini APIs (non-blocking fallback on error)
  await discoverModels().catch((err) => {
    console.warn("[llm] Model discovery failed, using static fallback:", err instanceof Error ? err.message : err);
  });

  await registerRoutes(httpServer, app);

  // Set up canvas collaboration WebSocket
  setupCanvasWebSocket(httpServer);

  // Wire the save callback so collab rooms can persist state
  setSaveCanvasCallback(async (canvasId: number, content: string) => {
    // Import storage + crypto dynamically to avoid circular deps
    const { storage } = await import("./storage");
    const { encrypt } = await import("./crypto");
    const secret = process.env.ENCRYPTION_SECRET || "provocations-dev-key-change-in-production";
    const encryptedContent = encrypt(content, secret);
    // Keep existing title — just update the content
    const encryptedTitle = encrypt("Flow Canvas (auto-saved)", secret);
    await storage.updateDocument(canvasId, {
      title: "[encrypted]",
      titleCiphertext: encryptedTitle.ciphertext,
      titleSalt: encryptedTitle.salt,
      titleIv: encryptedTitle.iv,
      ciphertext: encryptedContent.ciphertext,
      salt: encryptedContent.salt,
      iv: encryptedContent.iv,
    });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

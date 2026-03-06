// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
}

export interface StreamingSession {
  send(text: string): void;
  flush(): void;
  close(): void;
  /** Audio chunks arrive as raw base64 strings (no decode/re-encode overhead) */
  onAudio: (callback: (base64Chunk: string) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  onClose: (callback: () => void) => void;
  ready: Promise<void>;
}

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

const API_BASE = "https://api.elevenlabs.io/v1";
const WS_BASE = "wss://api.elevenlabs.io/v1";

function getApiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY;
}

function getDefaultVoiceId(): string {
  // ElevenLabs "Rachel" voice as a sensible fallback
  return process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
}

function getModelId(): string {
  return process.env.ELEVENLABS_MODEL_ID ?? "eleven_turbo_v2_5";
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isAvailable(): boolean {
  return typeof getApiKey() === "string" && getApiKey()!.length > 0;
}

// ---------------------------------------------------------------------------
// Voice listing (cached 5 minutes)
// ---------------------------------------------------------------------------

let voiceCache: { voices: Voice[]; fetchedAt: number } | null = null;
const VOICE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function listVoices(): Promise<Voice[]> {
  if (voiceCache && Date.now() - voiceCache.fetchedAt < VOICE_CACHE_TTL_MS) {
    return voiceCache.voices;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const res = await fetch(`${API_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`ElevenLabs listVoices failed: ${res.status} ${body}`);
    throw new Error(`ElevenLabs API error ${res.status}`);
  }

  const data = (await res.json()) as { voices: Array<Record<string, unknown>> };

  const voices: Voice[] = (data.voices ?? []).map((v) => ({
    voice_id: v.voice_id as string,
    name: v.name as string,
    category: (v.category as string) ?? "unknown",
    preview_url: (v.preview_url as string) ?? undefined,
  }));

  voiceCache = { voices, fetchedAt: Date.now() };
  return voices;
}

// ---------------------------------------------------------------------------
// REST streaming TTS
// ---------------------------------------------------------------------------

export async function streamTTS(
  text: string,
  voiceId?: string,
): Promise<AsyncIterable<Buffer>> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const vid = voiceId ?? getDefaultVoiceId();
  const url = `${API_BASE}/text-to-speech/${vid}/stream`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: getModelId(),
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`ElevenLabs streamTTS failed: ${res.status} ${body}`);
    throw new Error(`ElevenLabs TTS error ${res.status}`);
  }

  if (!res.body) {
    throw new Error("ElevenLabs TTS response has no body");
  }

  // Convert the Web ReadableStream into an AsyncIterable<Buffer>
  const reader = res.body.getReader();

  const iterable: AsyncIterable<Buffer> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<Buffer>> {
          const { done, value } = await reader.read();
          if (done) {
            return { done: true, value: undefined };
          }
          return { done: false, value: Buffer.from(value) };
        },
      };
    },
  };

  return iterable;
}

// ---------------------------------------------------------------------------
// WebSocket streaming session
// ---------------------------------------------------------------------------

/**
 * Resolve a WebSocket constructor. Prefers the `ws` npm package.
 * Result is cached after first import to eliminate repeated dynamic import overhead.
 */
let cachedWsModule: any = null;
async function resolveWebSocket(): Promise<any> {
  if (cachedWsModule) return cachedWsModule;
  try {
    cachedWsModule = await import("ws");
    return cachedWsModule;
  } catch {
    if (typeof globalThis.WebSocket !== "undefined") {
      throw new Error(
        "The 'ws' package is not installed and the global WebSocket API " +
          "is not fully compatible with the server streaming session. " +
          "Install the 'ws' package: npm install ws",
      );
    }
    throw new Error(
      "No WebSocket implementation available. Install the 'ws' package: npm install ws",
    );
  }
}

// ---------------------------------------------------------------------------
// Pre-warmed connection pool
// ---------------------------------------------------------------------------
// ElevenLabs stream-input protocol is per-generation (BOS → text → EOS),
// so we can't reuse a live session. But we CAN pre-open a WebSocket so the
// TCP+TLS handshake is already done when the next question starts.

interface PooledConnection {
  ws: any;
  voiceId: string;
  createdAt: number;
  /** True once ws.readyState === 1 (OPEN) */
  ready: Promise<void>;
}

const connectionPool: Map<string, PooledConnection> = new Map();
const POOL_MAX_AGE_MS = 30_000; // discard pre-warmed connections older than 30s

/**
 * Pre-warm a WebSocket connection for a voiceId.
 * Called after each question finishes so the next one starts faster.
 */
export async function prewarmConnection(voiceId?: string): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const vid = voiceId ?? getDefaultVoiceId();
  // Don't pre-warm if we already have a fresh one
  const existing = connectionPool.get(vid);
  if (existing && Date.now() - existing.createdAt < POOL_MAX_AGE_MS) return;

  try {
    const WS = await resolveWebSocket();
    const WebSocketClass = WS.default ?? WS;
    const wsUrl = `${WS_BASE}/text-to-speech/${vid}/stream-input?model_id=${encodeURIComponent(getModelId())}`;

    const ws = new (WebSocketClass as any)(wsUrl, {
      headers: { "xi-api-key": apiKey },
    });

    const ready = new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err: Error) => {
        connectionPool.delete(vid);
        reject(err);
      });
    });

    connectionPool.set(vid, { ws, voiceId: vid, createdAt: Date.now(), ready });
  } catch {
    // Pre-warm is best-effort
  }
}

/**
 * Claim a pre-warmed connection if available, or return null.
 */
function claimPooledConnection(voiceId: string): { ws: any; ready: Promise<void> } | null {
  const pooled = connectionPool.get(voiceId);
  if (!pooled) return null;
  connectionPool.delete(voiceId);

  // Discard if too old
  if (Date.now() - pooled.createdAt > POOL_MAX_AGE_MS) {
    try { pooled.ws.close(); } catch {}
    return null;
  }
  return { ws: pooled.ws, ready: pooled.ready };
}

// ---------------------------------------------------------------------------
// Multi-context streaming session (for brainstorm / conversational mode)
// ---------------------------------------------------------------------------
// Uses the multi-stream-input endpoint which supports multiple concurrent
// "contexts" on one WebSocket. This enables interruption handling: close the
// current speaking context and start a new one without reconnecting.

export interface MultiContextSession {
  /** Send text to a specific context. Creates the context on first use. */
  sendToContext(contextId: string, text: string): void;
  /** Flush buffered audio in a context (end of sentence). */
  flushContext(contextId: string): void;
  /** Close a context (e.g., interrupted). */
  closeContext(contextId: string): void;
  /** Close the entire WebSocket connection. */
  close(): void;
  /** Audio chunks arrive tagged with their contextId. */
  onAudio: (callback: (base64Chunk: string, contextId: string) => void) => void;
  /** Context completed (is_final). */
  onContextDone: (callback: (contextId: string) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  onClose: (callback: () => void) => void;
  ready: Promise<void>;
}

export function createMultiContextSession(voiceId?: string): MultiContextSession {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const vid = voiceId ?? getDefaultVoiceId();
  const model = getModelId();
  // multi-stream-input uses eleven_flash_v2_5 (multi-context not available for eleven_v3)
  const safeModel = model === "eleven_v3" ? "eleven_flash_v2_5" : model;
  const wsUrl = `${WS_BASE}/text-to-speech/${vid}/multi-stream-input?model_id=${encodeURIComponent(safeModel)}&inactivity_timeout=60`;

  let audioCallback: ((base64Chunk: string, contextId: string) => void) | null = null;
  let contextDoneCallback: ((contextId: string) => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;
  let closeCallback: (() => void) | null = null;
  let ws: any = null;
  const initializedContexts = new Set<string>();

  const ready = (async () => {
    const WS = await resolveWebSocket();
    const WebSocketClass = WS.default ?? WS;
    ws = new (WebSocketClass as any)(wsUrl, {
      headers: { "xi-api-key": apiKey },
      maxPayload: 16 * 1024 * 1024,
    });

    await new Promise<void>((resolve, reject) => {
      ws!.on("open", () => resolve());
      ws!.on("error", (err: Error) => {
        console.error("ElevenLabs multi-context WS error:", err);
        if (errorCallback) errorCallback(err);
        reject(err);
      });
    });

    ws!.on("message", (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        const ctxId = msg.contextId ?? msg.context_id ?? "default";

        if (msg.audio && audioCallback) {
          audioCallback(msg.audio, ctxId);
        }
        if (msg.is_final && contextDoneCallback) {
          contextDoneCallback(ctxId);
        }
        if (msg.error) {
          console.error("ElevenLabs multi-context server error:", msg.error);
          if (errorCallback) errorCallback(new Error(msg.error));
        }
      } catch (e) {
        console.error("ElevenLabs multi-context message parse error:", e);
      }
    });

    ws!.on("close", () => {
      if (closeCallback) closeCallback();
    });
  })();

  return {
    sendToContext(contextId: string, text: string) {
      if (!ws || ws.readyState !== 1) return;
      const msg: Record<string, unknown> = {
        text,
        context_id: contextId,
      };
      // First message in a context needs voice_settings
      if (!initializedContexts.has(contextId)) {
        initializedContexts.add(contextId);
        msg.voice_settings = {
          stability: 0.5,
          similarity_boost: 0.75,
        };
      }
      ws.send(JSON.stringify(msg));
    },

    flushContext(contextId: string) {
      if (!ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ context_id: contextId, flush: true }));
    },

    closeContext(contextId: string) {
      if (!ws || ws.readyState !== 1) return;
      initializedContexts.delete(contextId);
      ws.send(JSON.stringify({ context_id: contextId, close_context: true }));
    },

    close() {
      if (!ws) return;
      try {
        ws.send(JSON.stringify({ close_socket: true }));
      } catch {
        // Socket may already be closed
      }
      ws.close();
    },

    onAudio(callback) {
      audioCallback = callback;
    },
    onContextDone(callback) {
      contextDoneCallback = callback;
    },
    onError(callback) {
      errorCallback = callback;
    },
    onClose(callback) {
      closeCallback = callback;
    },
    ready,
  };
}

export function createStreamingSession(voiceId?: string): StreamingSession {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const vid = voiceId ?? getDefaultVoiceId();
  const wsUrl = `${WS_BASE}/text-to-speech/${vid}/stream-input?model_id=${encodeURIComponent(getModelId())}`;

  let audioCallback: ((base64Chunk: string) => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;
  let closeCallback: (() => void) | null = null;
  let ws: any = null;

  const ready = (async () => {
    // Try to claim a pre-warmed connection (saves 150-500ms TCP+TLS handshake)
    const pooled = claimPooledConnection(vid);
    if (pooled) {
      ws = pooled.ws;
      await pooled.ready;
    } else {
      // No pooled connection — create fresh
      const WS = await resolveWebSocket();
      const WebSocketClass = WS.default ?? WS;
      ws = new (WebSocketClass as any)(wsUrl, {
        headers: { "xi-api-key": apiKey },
      });

      await new Promise<void>((resolve, reject) => {
        ws!.on("open", () => resolve());
        ws!.on("error", (err: Error) => {
          console.error("ElevenLabs WebSocket error:", err);
          if (errorCallback) errorCallback(err);
          reject(err);
        });
      });
    }

    // Send the initial BOS (beginning of stream) message
    ws!.send(
      JSON.stringify({
        text: " ",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        xi_api_key: apiKey,
      }),
    );

    // Wire message/error/close handlers (must be set after claiming pooled connection
    // since pooled connections don't have these handlers yet)
    ws!.on("message", (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio && audioCallback) {
          audioCallback(msg.audio); // pass base64 string directly — no decode/re-encode
        }
        if (msg.error) {
          console.error("ElevenLabs WebSocket server error:", msg.error);
          if (errorCallback) errorCallback(new Error(msg.error));
        }
      } catch (e) {
        console.error("ElevenLabs WebSocket message parse error:", e);
      }
    });

    ws!.on("close", () => {
      if (closeCallback) closeCallback();
    });
  })();

  return {
    send(text: string) {
      if (!ws || ws.readyState !== 1) {
        console.error("ElevenLabs WebSocket not open, cannot send text");
        return;
      }
      ws.send(
        JSON.stringify({
          text,
          try_trigger_generation: true,
        }),
      );
    },

    flush() {
      if (!ws || ws.readyState !== 1) {
        console.error("ElevenLabs WebSocket not open, cannot flush");
        return;
      }
      ws.send(JSON.stringify({ text: "" }));
    },

    close() {
      if (ws) {
        ws.close();
      }
    },

    onAudio(callback: (base64Chunk: string) => void) {
      audioCallback = callback;
    },

    onError(callback: (error: Error) => void) {
      errorCallback = callback;
    },

    onClose(callback: () => void) {
      closeCallback = callback;
    },

    ready,
  };
}

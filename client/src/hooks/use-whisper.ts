/**
 * useWhisperRecorder — unified voice capture hook.
 *
 * 2026 best practices:
 *   1. Uses gpt-4o-mini-transcribe (faster, more accurate than whisper-1)
 *   2. Streaming SSE transcription — deltas arrive in real time via
 *      POST /api/transcribe/stream so users see words as they appear
 *   3. Chunked recording enabled by default (3s intervals) so every
 *      voice input shows progressive text while the user speaks
 *   4. Consistent deduplication — full re-transcription per flush,
 *      accumulated text replaces (never appends) to avoid duplication
 *   5. Falls back to Web Speech API when the server endpoint is unavailable
 */
import { useState, useCallback, useRef, useEffect } from "react";

// ── Transcription availability (cached globally) ──

let transcribeAvailable: boolean | null = null;
let transcribeCheckPromise: Promise<boolean> | null = null;

async function checkTranscribeAvailable(): Promise<boolean> {
  if (transcribeAvailable !== null) return transcribeAvailable;
  if (transcribeCheckPromise) return transcribeCheckPromise;
  transcribeCheckPromise = (async () => {
    try {
      const res = await fetch("/api/transcribe/status");
      const data = await res.json();
      transcribeAvailable = !!data.available;
    } catch {
      transcribeAvailable = false;
    }
    return transcribeAvailable;
  })();
  return transcribeCheckPromise;
}

/**
 * Reset the cached availability check so the next recording attempt
 * re-probes the server. Called after a runtime failure so transient
 * outages don't permanently disable the feature.
 */
function resetTranscribeCache() {
  transcribeAvailable = null;
  transcribeCheckPromise = null;
}

// ── Types ──

/** Default chunk interval — 3 seconds gives a smooth progressive feel */
const DEFAULT_CHUNK_INTERVAL_MS = 3000;

interface UseWhisperRecorderOptions {
  /** Called with final transcript text when a recording completes */
  onTranscript: (text: string) => void;
  /** Called with interim accumulated text as the user speaks */
  onInterimTranscript?: (text: string) => void;
  /** Called when recording state changes */
  onRecordingChange?: (isRecording: boolean) => void;
  /**
   * Interval in ms to send audio chunks for progressive transcription.
   * Defaults to 3000ms. Set to 0 to disable chunked mode (batch only).
   */
  chunkIntervalMs?: number;
}

interface UseWhisperRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  /** True when using server transcription, false when using Web Speech API */
  isWhisper: boolean;
  /** True when a transcription request is in-flight */
  isTranscribing: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  toggleRecording: () => void;
}

// ── Best supported MIME type ──

function getAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

// ── Helpers ──

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) =>
    btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), "")),
  );
}

/**
 * Transcribe a blob via streaming SSE (/api/transcribe/stream).
 * Falls back to the non-streaming endpoint if SSE fails to connect.
 * Calls `onDelta` with accumulated text as deltas arrive.
 */
async function transcribeBlobStreaming(
  blob: Blob,
  mimeType: string,
  onDelta: (accumulated: string) => void,
): Promise<string> {
  const base64 = await blobToBase64(blob);
  const body = JSON.stringify({ audio: base64, mimeType: mimeType.split(";")[0] });

  const res = await fetch("/api/transcribe/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok || !res.body) {
    // Fallback to non-streaming endpoint
    return transcribeBlobBatch(blob, mimeType);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from the buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "delta" && event.accumulated) {
          fullText = event.accumulated;
          onDelta(fullText);
        } else if (event.type === "done" && event.text) {
          fullText = event.text;
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }

  return fullText;
}

/** Non-streaming batch transcription (fallback) */
async function transcribeBlobBatch(blob: Blob, mimeType: string): Promise<string> {
  const base64 = await blobToBase64(blob);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: base64, mimeType: mimeType.split(";")[0] }),
  });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
  const data = await res.json();
  return data.text || "";
}

// ── Hook ──

export function useWhisperRecorder({
  onTranscript,
  onInterimTranscript,
  onRecordingChange,
  chunkIntervalMs,
}: UseWhisperRecorderOptions): UseWhisperRecorderReturn {
  // Resolve effective chunk interval: default 3s, 0 = disabled
  const effectiveChunkMs =
    chunkIntervalMs !== undefined ? (chunkIntervalMs || undefined) : DEFAULT_CHUNK_INTERVAL_MS;

  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isWhisper, setIsWhisper] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Refs for stable callbacks
  const onTranscriptRef = useRef(onTranscript);
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  const onRecordingChangeRef = useRef(onRecordingChange);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimTranscriptRef.current = onInterimTranscript; }, [onInterimTranscript]);
  useEffect(() => { onRecordingChangeRef.current = onRecordingChange; }, [onRecordingChange]);

  // Runtime failure flag — cleared on next availability check
  const whisperFailedRef = useRef(false);

  // Whisper state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedTextRef = useRef("");
  const isRecordingRef = useRef(false);
  const mimeTypeRef = useRef(getAudioMimeType());

  // Track which chunks were already flushed
  const lastFlushedCountRef = useRef(0);
  // Guard against concurrent flush operations
  const flushingRef = useRef(false);

  // Web Speech API fallback state
  const recognitionRef = useRef<any>(null);
  const speechTranscriptRef = useRef("");
  const speechStoppingRef = useRef(false);

  // Check availability on mount
  useEffect(() => {
    checkTranscribeAvailable().then((available) => {
      setIsWhisper(available);
      if (!available) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setIsSupported(false);
        }
      }
    });
  }, []);

  // ── Flush current chunks — streaming SSE transcription ──
  const flushChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    if (chunksRef.current.length <= lastFlushedCountRef.current) return;
    if (flushingRef.current) return; // Skip if a flush is already in progress

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    lastFlushedCountRef.current = chunksRef.current.length;

    if (blob.size < 100) return;

    flushingRef.current = true;
    setIsTranscribing(true);
    try {
      const text = await transcribeBlobStreaming(
        blob,
        mimeTypeRef.current,
        (accumulated) => {
          // Deliver streaming deltas as interim transcripts
          accumulatedTextRef.current = accumulated.trim();
          onInterimTranscriptRef.current?.(accumulatedTextRef.current);
        },
      );
      if (text.trim()) {
        accumulatedTextRef.current = text.trim();
        onInterimTranscriptRef.current?.(accumulatedTextRef.current);
      }
    } catch (err) {
      console.error("Chunk transcription failed:", err);
      whisperFailedRef.current = true;
      resetTranscribeCache();
      setIsWhisper(false);
    } finally {
      flushingRef.current = false;
      setIsTranscribing(false);
    }
  }, []);

  // ── Start server-side transcription recording ──
  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      accumulatedTextRef.current = "";
      lastFlushedCountRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Final transcription with streaming deltas for immediate feedback
        const hasNewChunks = chunksRef.current.length > lastFlushedCountRef.current;
        if (chunksRef.current.length > 0 && hasNewChunks) {
          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });

          if (blob.size >= 100) {
            setIsTranscribing(true);
            try {
              const text = await transcribeBlobStreaming(
                blob,
                mimeTypeRef.current,
                (accumulated) => {
                  accumulatedTextRef.current = accumulated.trim();
                  onInterimTranscriptRef.current?.(accumulatedTextRef.current);
                },
              );
              if (text.trim()) {
                accumulatedTextRef.current = text.trim();
              }
            } catch (err) {
              console.error("Final transcription failed:", err);
              whisperFailedRef.current = true;
              resetTranscribeCache();
              setIsWhisper(false);
            } finally {
              setIsTranscribing(false);
            }
          }
        }

        chunksRef.current = [];
        lastFlushedCountRef.current = 0;

        // Deliver final transcript
        if (accumulatedTextRef.current.trim()) {
          onTranscriptRef.current(accumulatedTextRef.current.trim());
        }
        accumulatedTextRef.current = "";
      };

      // Always use chunked recording for progressive feedback
      if (effectiveChunkMs) {
        recorder.start(effectiveChunkMs);
        chunkTimerRef.current = setInterval(() => {
          if (recorder.state === "recording") {
            flushChunks();
          }
        }, effectiveChunkMs + 200);
      } else {
        recorder.start();
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      onRecordingChangeRef.current?.(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    }
  }, [effectiveChunkMs, flushChunks]);

  // ── Stop server-side transcription recording ──
  const stopWhisper = useCallback(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    onRecordingChangeRef.current?.(false);
  }, []);

  // ── Web Speech API fallback ──
  const startSpeechFallback = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let newFinal = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (newFinal) {
        speechTranscriptRef.current += newFinal + " ";
      }
      const full = speechTranscriptRef.current + interimTranscript;
      if (full) onInterimTranscriptRef.current?.(full);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
      speechStoppingRef.current = true;
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    };

    recognition.onend = () => {
      if (speechStoppingRef.current) {
        speechStoppingRef.current = false;
        if (speechTranscriptRef.current.trim()) {
          onTranscriptRef.current(speechTranscriptRef.current.trim());
        }
        speechTranscriptRef.current = "";
        isRecordingRef.current = false;
        setIsRecording(false);
        onRecordingChangeRef.current?.(false);
        return;
      }
      // Auto-restart on browser timeout
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          setTimeout(() => {
            try { recognition.start(); } catch { /* give up */ }
          }, 200);
        }
      }
    };

    recognitionRef.current = recognition;
    speechTranscriptRef.current = "";
    speechStoppingRef.current = false;

    try {
      recognition.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      onRecordingChangeRef.current?.(true);
    } catch {
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    }
  }, []);

  const stopSpeechFallback = useCallback(() => {
    if (recognitionRef.current) {
      speechStoppingRef.current = true;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // ── Public API ──
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    // Re-check availability if previously failed (handles transient outages)
    if (whisperFailedRef.current) {
      resetTranscribeCache();
      const available = await checkTranscribeAvailable();
      if (available) {
        whisperFailedRef.current = false;
        setIsWhisper(true);
      }
    }

    if (isWhisper && !whisperFailedRef.current) {
      startWhisper();
    } else {
      startSpeechFallback();
    }
  }, [isWhisper, startWhisper, startSpeechFallback]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    if (isWhisper && !whisperFailedRef.current) {
      stopWhisper();
    } else {
      stopSpeechFallback();
    }
  }, [isWhisper, stopWhisper, stopSpeechFallback]);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    isRecording,
    isSupported,
    isWhisper,
    isTranscribing,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}

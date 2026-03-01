/**
 * useWhisperRecorder — captures audio via MediaRecorder and sends it to
 * the server's Whisper endpoint for translate+transcribe to English.
 *
 * Falls back to Web Speech API when Whisper is not available.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

// ── Whisper availability (cached globally) ──

let whisperAvailable: boolean | null = null;
let whisperCheckPromise: Promise<boolean> | null = null;

async function checkWhisperAvailable(): Promise<boolean> {
  if (whisperAvailable !== null) return whisperAvailable;
  if (whisperCheckPromise) return whisperCheckPromise;
  whisperCheckPromise = (async () => {
    try {
      const res = await fetch("/api/transcribe/status");
      const data = await res.json();
      whisperAvailable = !!data.available;
    } catch {
      whisperAvailable = false;
    }
    return whisperAvailable;
  })();
  return whisperCheckPromise;
}

// ── Types ──

interface UseWhisperRecorderOptions {
  /** Called with final transcript text when a recording completes or a chunk is processed */
  onTranscript: (text: string) => void;
  /** Called with interim accumulated text (Whisper: chunk-level updates; fallback: real-time) */
  onInterimTranscript?: (text: string) => void;
  /** Called when recording state changes */
  onRecordingChange?: (isRecording: boolean) => void;
  /**
   * For streaming/continuous mode: interval in ms to send audio chunks to Whisper.
   * When set, audio is sent every N ms for progressive transcription.
   * When not set, audio is sent only when recording stops.
   */
  chunkIntervalMs?: number;
}

interface UseWhisperRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  /** True when using Whisper, false when using Web Speech API fallback */
  isWhisper: boolean;
  /** True when a Whisper transcription request is in-flight */
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

export function useWhisperRecorder({
  onTranscript,
  onInterimTranscript,
  onRecordingChange,
  chunkIntervalMs,
}: UseWhisperRecorderOptions): UseWhisperRecorderReturn {
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

  // Runtime Whisper failure → fall back to Web Speech API
  const whisperFailedRef = useRef(false);

  // Whisper state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedTextRef = useRef("");
  const isRecordingRef = useRef(false);
  const mimeTypeRef = useRef(getAudioMimeType());

  // Web Speech API fallback state
  const recognitionRef = useRef<any>(null);
  const speechTranscriptRef = useRef("");
  /** When true the user intentionally stopped — do NOT auto-restart */
  const speechStoppingRef = useRef(false);

  // Check availability on mount
  useEffect(() => {
    checkWhisperAvailable().then((available) => {
      setIsWhisper(available);
      if (!available) {
        // Check Web Speech API
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setIsSupported(false);
        }
      }
    });
  }, []);

  // ── Send audio blob to Whisper ──
  const transcribeBlob = useCallback(async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
    );

    const res = await apiRequest("POST", "/api/transcribe", {
      audio: base64,
      mimeType: mimeTypeRef.current.split(";")[0],
    });
    const data = await res.json();
    return data.text || "";
  }, []);

  // ── Flush current chunks and transcribe ──
  const flushChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    chunksRef.current = [];

    if (blob.size < 100) return; // Skip tiny/empty blobs

    setIsTranscribing(true);
    try {
      const text = await transcribeBlob(blob);
      if (text.trim()) {
        accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + text.trim();
        onInterimTranscriptRef.current?.(accumulatedTextRef.current);
      }
    } catch (err) {
      console.error("Whisper chunk transcription failed:", err);
      // Mark Whisper as failed for future recordings
      whisperFailedRef.current = true;
      whisperAvailable = false;
      setIsWhisper(false);
    } finally {
      setIsTranscribing(false);
    }
  }, [transcribeBlob]);

  // ── Start Whisper recording ──
  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      accumulatedTextRef.current = "";

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Final flush — transcribe remaining audio
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          chunksRef.current = [];

          if (blob.size >= 100) {
            setIsTranscribing(true);
            try {
              const text = await transcribeBlob(blob);
              if (text.trim()) {
                accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + text.trim();
              }
            } catch (err) {
              console.error("Whisper final transcription failed:", err);
              // Mark Whisper as failed so future recordings use Web Speech fallback
              whisperFailedRef.current = true;
              whisperAvailable = false;
              setIsWhisper(false);
            } finally {
              setIsTranscribing(false);
            }
          }
        }

        // Deliver final transcript
        if (accumulatedTextRef.current.trim()) {
          onTranscriptRef.current(accumulatedTextRef.current.trim());
        }
        accumulatedTextRef.current = "";
      };

      // Start recording — use timeslice for chunked mode
      if (chunkIntervalMs) {
        recorder.start(chunkIntervalMs);
        // Periodic flush
        chunkTimerRef.current = setInterval(() => {
          if (recorder.state === "recording") {
            // Request data, then flush
            flushChunks();
          }
        }, chunkIntervalMs + 200); // slight offset so ondataavailable fires first
      } else {
        recorder.start();
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      onRecordingChangeRef.current?.(true);
    } catch (err) {
      console.error("Failed to start Whisper recording:", err);
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    }
  }, [chunkIntervalMs, flushChunks, transcribeBlob]);

  // ── Stop Whisper recording ──
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
      // Deliver accumulated text via onInterimTranscript for live preview.
      // onTranscript fires only once when recording stops (matching Whisper
      // behavior) to avoid duplication in handlers that append.
      const full = speechTranscriptRef.current + interimTranscript;
      if (full) onInterimTranscriptRef.current?.(full);
    };

    recognition.onerror = (event: any) => {
      // "no-speech" and "aborted" are recoverable — the onend handler
      // will auto-restart. Only fatal errors should kill the session.
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
      speechStoppingRef.current = true;
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    };

    recognition.onend = () => {
      // If user intentionally stopped, deliver the final accumulated
      // transcript once (matching Whisper's single-delivery behavior)
      // and clean up.
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
      // Otherwise the browser killed the session (silence timeout, network
      // hiccup, etc.) — auto-restart to keep listening
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // start() can throw if called too quickly — retry once
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
  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    // If Whisper failed at runtime, always use Web Speech fallback
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

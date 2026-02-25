/**
 * Verbose Provider — global context that intercepts all API responses
 * and displays LLM call metadata when verbose mode is enabled.
 *
 * Wraps the app and provides a global toast/panel for verbose data.
 * Components don't need to know about verbose mode — it's automatic.
 *
 * How it works:
 * 1. Subscribes to the `onVerboseData` event bus from queryClient.ts
 * 2. apiRequest automatically emits events when responses contain _verbose data
 * 3. This provider shows a floating panel with the metadata
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { type LlmVerboseEntry, extractVerbose } from "@/lib/llm-verbose";
import { onVerboseData } from "@/lib/queryClient";
import { LlmContextPlan } from "@/components/LlmContextPlan";

interface VerboseContextValue {
  /** Feed an API response to extract and display verbose metadata */
  capture: (data: unknown) => void;
  /** Latest entries */
  entries: LlmVerboseEntry[];
}

const VerboseContext = createContext<VerboseContextValue>({
  capture: () => {},
  entries: [],
});

export function useVerboseCapture() {
  return useContext(VerboseContext);
}

const AUTO_DISMISS_MS = 15_000;

export function VerboseProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LlmVerboseEntry[]>([]);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const capture = useCallback((data: unknown) => {
    const extracted = extractVerbose(data);
    if (extracted && extracted.length > 0) {
      setEntries(extracted);
      setVisible(true);

      // Auto-dismiss after 15 seconds
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Subscribe to global verbose data events from apiRequest
  useEffect(() => {
    const unsubscribe = onVerboseData(capture);
    return unsubscribe;
  }, [capture]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <VerboseContext.Provider value={{ capture, entries }}>
      {children}
      {/* Global floating verbose panel */}
      {visible && entries.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 max-w-lg w-full animate-in slide-in-from-bottom-2 fade-in duration-300">
          <LlmContextPlan entries={entries} compact onDismiss={dismiss} />
        </div>
      )}
    </VerboseContext.Provider>
  );
}

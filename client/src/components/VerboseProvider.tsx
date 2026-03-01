/**
 * Verbose Provider — global context that intercepts all API responses
 * and stores LLM call metadata for display in the header trace button.
 *
 * Wraps the app and provides verbose capture context for components.
 * The floating yellow panel has been removed — trace data is now shown
 * via the LlmTraceButton in the header.
 *
 * How it works:
 * 1. Subscribes to the `onVerboseData` event bus from queryClient.ts
 * 2. apiRequest automatically emits events when responses contain _verbose data
 * 3. LlmTraceButton (in the header) also subscribes and shows the data
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { type LlmVerboseEntry, extractVerbose } from "@/lib/llm-verbose";
import { onVerboseData } from "@/lib/queryClient";

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

export function VerboseProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LlmVerboseEntry[]>([]);

  const capture = useCallback((data: unknown) => {
    const extracted = extractVerbose(data);
    if (extracted && extracted.length > 0) {
      setEntries(extracted);
    }
  }, []);

  // Subscribe to global verbose data events from apiRequest
  useEffect(() => {
    const unsubscribe = onVerboseData(capture);
    return unsubscribe;
  }, [capture]);

  return (
    <VerboseContext.Provider value={{ capture, entries }}>
      {children}
      {/* Floating panel removed — trace data now lives in the header LlmTraceButton */}
    </VerboseContext.Provider>
  );
}

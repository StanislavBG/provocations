/**
 * Verbose Display Hook — manages showing LLM call metadata in the UI.
 *
 * Components that make API calls can use this hook to extract and display
 * verbose metadata from API responses. The metadata is automatically
 * included by the backend when verbose mode is enabled.
 */

import { useState, useCallback } from "react";
import { type LlmVerboseEntry, extractVerbose } from "@/lib/llm-verbose";

interface VerboseState {
  entries: LlmVerboseEntry[];
  visible: boolean;
}

/**
 * Hook to manage verbose metadata display for a component.
 *
 * Usage:
 *   const verbose = useVerboseDisplay();
 *   // After any API call:
 *   verbose.capture(apiResponse);
 *   // In JSX:
 *   {verbose.visible && <LlmContextPlan entries={verbose.entries} onDismiss={verbose.dismiss} />}
 */
export function useVerboseDisplay() {
  const [state, setState] = useState<VerboseState>({ entries: [], visible: false });

  /** Extract verbose metadata from an API response and show it */
  const capture = useCallback((data: unknown) => {
    const entries = extractVerbose(data);
    if (entries) {
      setState({ entries, visible: true });
    }
  }, []);

  /** Dismiss the verbose display */
  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  /** Clear all metadata */
  const clear = useCallback(() => {
    setState({ entries: [], visible: false });
  }, []);

  return {
    entries: state.entries,
    visible: state.visible,
    capture,
    dismiss,
    clear,
  };
}

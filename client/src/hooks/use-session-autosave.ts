import { useRef, useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkspaceSessionState } from "@shared/schema";

interface UseSessionAutosaveOptions {
  /** Current template ID (e.g. "product-requirement") */
  templateId: string | null;
  /** Whether the workspace is in active editing phase (not input/landing) */
  isActive: boolean;
  /** Callback to collect the current workspace state snapshot */
  getState: () => WorkspaceSessionState | null;
  /** Session title (auto-generated from objective or template) */
  getTitle: () => string;
}

interface UseSessionAutosaveReturn {
  /** Current session ID (null if no session has been saved yet) */
  currentSessionId: number | null;
  /** Whether auto-save is currently enabled */
  autoSaveEnabled: boolean;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Force an immediate save */
  saveNow: () => Promise<number | null>;
  /** Set the current session ID (e.g. when resuming a session) */
  setCurrentSessionId: (id: number | null) => void;
}

export function useSessionAutosave({
  templateId,
  isActive,
  getState,
  getTitle,
}: UseSessionAutosaveOptions): UseSessionAutosaveReturn {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastSaveHashRef = useRef<string>("");

  // Read user preference for auto-save
  const { data: prefs } = useQuery<{ autoDictate: boolean; autoSaveSession: boolean }>({
    queryKey: ["/api/preferences"],
    staleTime: Infinity,
  });

  const autoSaveEnabled = prefs?.autoSaveSession ?? true;

  // Compute a simple hash of the state to detect changes
  const computeHash = useCallback((state: WorkspaceSessionState): string => {
    return `${state.objective.length}:${state.document.rawText.length}:${state.interviewEntries.length}:${state.versions.length}:${state.editHistory.length}`;
  }, []);

  const saveNow = useCallback(async (): Promise<number | null> => {
    if (!templateId || !isActive) return null;

    const state = getState();
    if (!state) return null;

    // Skip if nothing meaningful to save
    if (!state.document.rawText && !state.objective && state.interviewEntries.length === 0) {
      return currentSessionId;
    }

    // Skip if state hasn't changed
    const hash = computeHash(state);
    if (hash === lastSaveHashRef.current && currentSessionId) {
      return currentSessionId;
    }

    setIsSaving(true);
    try {
      const title = getTitle() || `${templateId} session`;

      if (currentSessionId) {
        await apiRequest("PUT", `/api/sessions/${currentSessionId}`, {
          title,
          templateId,
          state,
        });
        lastSaveHashRef.current = hash;
        return currentSessionId;
      } else {
        const res = await apiRequest("POST", "/api/sessions", {
          title,
          templateId,
          state,
        });
        const data = await res.json();
        const newId = data.id as number;
        setCurrentSessionId(newId);
        lastSaveHashRef.current = hash;
        return newId;
      }
    } catch (err) {
      console.error("Session autosave failed:", err);
      return currentSessionId;
    } finally {
      setIsSaving(false);
    }
  }, [templateId, isActive, getState, getTitle, currentSessionId, computeHash]);

  // Reset session when template changes
  useEffect(() => {
    setCurrentSessionId(null);
    lastSaveHashRef.current = "";
  }, [templateId]);

  return {
    currentSessionId,
    autoSaveEnabled,
    isSaving,
    saveNow,
    setCurrentSessionId,
  };
}

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MinimapState,
  MINIMAP_DEFAULTS,
  MINIMAP_MIN_WIDTH,
  MINIMAP_MIN_HEIGHT,
  MINIMAP_MAX_WIDTH,
  MINIMAP_MAX_HEIGHT,
  MINIMAP_STORAGE_KEY,
} from "./minimap-types";

function loadState(): MinimapState {
  try {
    const raw = localStorage.getItem(MINIMAP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...MINIMAP_DEFAULTS, ...parsed };
    }
  } catch {
    /* corrupt data — start fresh */
  }
  return { ...MINIMAP_DEFAULTS };
}

function saveState(state: MinimapState) {
  localStorage.setItem(MINIMAP_STORAGE_KEY, JSON.stringify(state));
}

export function useMinimapState() {
  const [state, setState] = useState<MinimapState>(loadState);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced persistence (50ms) to avoid excessive writes during drag
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveState(state), 50);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const setVisible = useCallback((visible: boolean) => {
    setState((s) => ({ ...s, visible }));
  }, []);

  const toggleVisible = useCallback(() => {
    setState((s) => ({ ...s, visible: !s.visible }));
  }, []);

  const setPosition = useCallback((x: number, y: number) => {
    setState((s) => ({ ...s, x, y }));
  }, []);

  const setSize = useCallback((width: number, height: number) => {
    setState((s) => ({
      ...s,
      width: Math.max(MINIMAP_MIN_WIDTH, Math.min(MINIMAP_MAX_WIDTH, width)),
      height: Math.max(MINIMAP_MIN_HEIGHT, Math.min(MINIMAP_MAX_HEIGHT, height)),
    }));
  }, []);

  const setMinimapZoom = useCallback((zoom: number) => {
    setState((s) => ({ ...s, minimapZoom: Math.max(0.5, Math.min(4, zoom)) }));
  }, []);

  const togglePinned = useCallback(() => {
    setState((s) => ({ ...s, pinned: !s.pinned }));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setState((s) => ({ ...s, collapsed: !s.collapsed }));
  }, []);

  return {
    state,
    setVisible,
    toggleVisible,
    setPosition,
    setSize,
    setMinimapZoom,
    togglePinned,
    toggleCollapsed,
  };
}

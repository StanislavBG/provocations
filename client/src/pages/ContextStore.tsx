import { useCallback } from "react";
import { useLocation } from "wouter";
import { StoragePanel } from "@/components/StoragePanel";

/**
 * Dedicated route page for the Private Context Store (/store).
 *
 * Renders StoragePanel as a full-page experience. When closed,
 * navigates back to the previous page (or home).
 */
export default function ContextStore() {
  const [, setLocation] = useLocation();

  const handleClose = useCallback(() => {
    // Navigate back; if no history, go home
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  }, [setLocation]);

  // Stub handlers — when opened as a standalone page, save/load
  // are not wired to a workspace document.
  const handleLoad = useCallback(() => {
    // No-op: standalone store doesn't load into a workspace
  }, []);

  const handleSave = useCallback(async () => {
    // No-op: standalone store doesn't have workspace content to save
  }, []);

  return (
    <StoragePanel
      isOpen={true}
      onClose={handleClose}
      onLoadDocument={handleLoad}
      onSave={handleSave}
      hasContent={false}
      currentDocId={null}
      currentTitle=""
    />
  );
}

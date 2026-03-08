/**
 * WelcomeOverlay — First-time user experience overlay.
 *
 * Shows once for new users. Offers three paths:
 * 1. Start Guided Tour — enters the FTUX tour mode
 * 2. Explore on My Own — closes overlay
 * 3. Load a Blueprint — opens the blueprint picker
 *
 * Persists "seen" state to localStorage so it never reappears.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Compass, Map, Layers } from "lucide-react";

const WELCOME_SEEN_KEY = "provocations-welcome-seen";

interface WelcomeOverlayProps {
  onStartTour: () => void;
  onLoadBlueprint: () => void;
}

export function WelcomeOverlay({ onStartTour, onLoadBlueprint }: WelcomeOverlayProps) {
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem(WELCOME_SEEN_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const markSeen = useCallback(() => {
    localStorage.setItem(WELCOME_SEEN_KEY, "true");
    setVisible(false);
  }, []);

  const handleStartTour = useCallback(() => {
    markSeen();
    onStartTour();
  }, [markSeen, onStartTour]);

  const handleExplore = useCallback(() => {
    markSeen();
  }, [markSeen]);

  const handleLoadBlueprint = useCallback(() => {
    markSeen();
    onLoadBlueprint();
  }, [markSeen, onLoadBlueprint]);

  // Keyboard: Escape to dismiss
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExplore();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, handleExplore]);

  // Auto-focus for screen readers
  useEffect(() => {
    if (visible) {
      modalRef.current?.focus();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Provocations"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
        onClick={handleExplore}
      />

      {/* Modal card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200 focus:outline-none"
      >
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{
            background: "hsl(var(--card) / 0.95)",
            border: "1px solid hsl(var(--border) / 0.5)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          }}
        >
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-foreground">
              Welcome to Provocations
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              An AI-augmented workspace that makes you think deeper.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Button
              variant="default"
              className="w-full h-12 text-sm gap-2.5 justify-start px-4"
              onClick={handleStartTour}
            >
              <Map className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Start Guided Tour</div>
                <div className="text-[10px] opacity-70">Learn the workspace in 5 quick steps</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-sm gap-2.5 justify-start px-4"
              onClick={handleExplore}
            >
              <Compass className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Explore on My Own</div>
                <div className="text-[10px] opacity-70">Jump right in and discover as you go</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-sm gap-2.5 justify-start px-4"
              onClick={handleLoadBlueprint}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Load a Blueprint</div>
                <div className="text-[10px] opacity-70">Start with a pre-built canvas template</div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

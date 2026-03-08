import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_VERSION, RELEASE_NOTES } from "@/lib/version";
import { Sparkles, ScrollText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LAST_SEEN_KEY = "provocations-last-seen-version";
const DONT_SHOW_KEY = "provocations-whats-new-dismissed";

/**
 * WhatsNew — badge + dialog that shows latest release notes when the app
 * version changes since the user's last visit.
 *
 * Usage: wrap the version watermark button with this component, or place it
 * alongside the watermark in FlowWorkspace.
 */
export function WhatsNew() {
  const [hasNew, setHasNew] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    const dismissed = localStorage.getItem(DONT_SHOW_KEY);

    if (lastSeen !== APP_VERSION) {
      setHasNew(true);

      // Auto-show on first visit after update (unless user opted out)
      if (dismissed !== "true" && lastSeen !== null) {
        setDialogOpen(true);
        setAutoShown(true);
      }
    }
  }, []);

  const handleOpen = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDialogOpen(false);
    setHasNew(false);
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
  }, []);

  const handleDontShowAgain = useCallback(() => {
    localStorage.setItem(DONT_SHOW_KEY, "true");
    handleClose();
  }, [handleClose]);

  // Only show recent notes (last 5 releases)
  const recentNotes = RELEASE_NOTES.slice(0, 5);

  return (
    <>
      {/* Badge indicator — rendered next to the version watermark */}
      {hasNew && (
        <button
          onClick={handleOpen}
          className="absolute bottom-2 left-[4.5rem] z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-medium hover:bg-primary/30 transition-colors animate-pulse cursor-pointer"
          title="New updates available — click to see what changed"
        >
          <Sparkles className="w-2.5 h-2.5" />
          New
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? handleOpen() : handleClose())}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              What's New in v{APP_VERSION}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4">
              {recentNotes.map((release) => (
                <div key={release.version} className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold font-mono",
                        release.version === APP_VERSION
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      v{release.version}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {release.date}
                    </span>
                    {release.version === APP_VERSION && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        Latest
                      </span>
                    )}
                  </div>
                  <ul className="space-y-0.5 ml-3">
                    {release.changes.map((change, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-primary/60 mt-0.5">•</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            {autoShown && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
                onClick={handleDontShowAgain}
              >
                <X className="w-3 h-3 mr-1" />
                Don't show automatically
              </Button>
            )}
            <a
              href="/help/getting-started"
              className="text-[11px] text-primary hover:underline ml-auto"
            >
              Help & Documentation
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

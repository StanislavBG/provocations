import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import { FTUX_TIPS, type FtuxTip } from "@/lib/ftux-tips";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, ArrowRight, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function FtuxDidYouKnow() {
  const { tipsEnabled, tipsDismissed, tipsTranslucency, tipsColor, dismissTip, setActiveTool } = useFtuxShell();
  const [hiddenThisVisit, setHiddenThisVisit] = useState(false);

  const availableTips = FTUX_TIPS.filter((t) => !tipsDismissed.includes(t.id));
  const [currentIndex, setCurrentIndex] = useState(() =>
    availableTips.length > 0 ? Math.floor(Math.random() * availableTips.length) : 0,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const currentTip = availableTips[currentIndex % Math.max(availableTips.length, 1)] as FtuxTip | undefined;

  // Rotate tips every 60s
  useEffect(() => {
    if (!tipsEnabled || availableTips.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % availableTips.length);
        setIsTransitioning(false);
      }, 200);
    }, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tipsEnabled, availableTips.length]);

  const handleDismiss = useCallback(() => {
    if (!currentTip) return;
    dismissTip(currentTip.id);
    // Advance to next tip immediately
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => prev % Math.max(availableTips.length - 1, 1));
      setIsTransitioning(false);
    }, 200);
  }, [currentTip, dismissTip, availableTips.length]);

  const handleAction = useCallback(() => {
    if (!currentTip?.toolId) return;
    setActiveTool(currentTip.toolId);
  }, [currentTip, setActiveTool]);

  if (!tipsEnabled || hiddenThisVisit || !currentTip || availableTips.length === 0) return null;

  const opacity = (tipsTranslucency ?? 90) / 100;
  const blur = Math.round(opacity * 16);
  const bgColor = tipsColor
    ? hexToRgba(tipsColor, opacity)
    : `hsl(var(--card) / ${opacity})`;

  return (
    <div
      className={cn(
        "fixed bottom-[68px] right-4 z-30 w-72 animate-in slide-in-from-bottom-2 fade-in duration-300",
        isTransitioning && "opacity-0 translate-y-2 transition-all duration-200",
      )}
    >
      <div
        className="rounded-2xl p-4 space-y-2.5"
        style={{
          background: bgColor,
          backdropFilter: `blur(${blur}px)`,
          border: "1px solid hsl(var(--border) / 0.3)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Did you know?
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 rounded text-muted-foreground/50 hover:text-muted-foreground"
            onClick={handleDismiss}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">{currentTip.title}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{currentTip.body}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 capitalize">
            {currentTip.category.replace("-", " ")}
          </Badge>
          {currentTip.toolId && currentTip.actionLabel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-[10px] text-primary gap-1 hover:bg-transparent hover:text-primary/80"
              onClick={handleAction}
            >
              {currentTip.actionLabel}
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Hide this visit link */}
        <button
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors pt-1"
          onClick={() => setHiddenThisVisit(true)}
        >
          <EyeOff className="w-3 h-3" />
          <span>Hide tips this visit</span>
        </button>
      </div>
    </div>
  );
}

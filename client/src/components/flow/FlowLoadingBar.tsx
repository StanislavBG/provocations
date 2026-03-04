interface FlowLoadingBarProps {
  active: boolean;
  progress?: number; // 0-100, undefined = indeterminate
}

export function FlowLoadingBar({ active, progress }: FlowLoadingBarProps) {
  if (!active) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] z-40 overflow-hidden bg-muted/30">
      {progress !== undefined ? (
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      ) : (
        <div
          className="h-full bg-primary/70"
          style={{
            width: "30%",
            animation: "flow-loading-bar 1.5s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

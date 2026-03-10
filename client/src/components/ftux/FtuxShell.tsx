import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFtuxConfig } from "@/lib/ftux-shell-context";

interface FtuxShellProps {
  children: ReactNode;
}

/**
 * Outer shell layout frame — positions status bar, dock, and content area.
 * Reads positions from shell context to arrange the layout dynamically.
 */
export function FtuxShell({ children }: FtuxShellProps) {
  const { statusBarPosition } = useFtuxConfig();

  return (
    <div
      className={cn(
        "h-screen w-screen overflow-hidden flex",
        statusBarPosition === "top" ? "flex-col" : "flex-col-reverse",
      )}
      style={{
        ["--ftux-status-bar-height" as string]: "44px",
        ["--ftux-dock-height" as string]: "56px",
      }}
    >
      {children}
    </div>
  );
}

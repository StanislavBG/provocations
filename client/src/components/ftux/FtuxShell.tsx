import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell } from "@/lib/ftux-shell-context";

interface FtuxShellProps {
  children: ReactNode;
}

/**
 * Outer shell layout frame — positions status bar, dock, and content area.
 * Reads positions from shell context to arrange the layout dynamically.
 */
export function FtuxShell({ children }: FtuxShellProps) {
  const { statusBarPosition } = useFtuxShell();

  return (
    <div
      className={cn(
        "h-screen w-screen overflow-hidden flex",
        statusBarPosition === "top" ? "flex-col" : "flex-col-reverse",
      )}
      style={{
        ["--ftux-status-bar-height" as string]: "36px",
        ["--ftux-dock-height" as string]: "56px",
      }}
    >
      {children}
    </div>
  );
}

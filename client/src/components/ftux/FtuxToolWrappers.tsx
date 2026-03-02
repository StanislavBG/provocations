import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WrapperProps {
  children: ReactNode;
  className?: string;
}

/** Centers document editor for prose readability */
export function FtuxDocumentWrapper({ children, className }: WrapperProps) {
  return (
    <div className={cn("h-full w-full flex justify-center overflow-auto", className)}>
      <div className="w-full max-w-4xl mx-auto px-4 py-4">
        {children}
      </div>
    </div>
  );
}

/** Wider layout for context sidebar in full-content mode */
export function FtuxContextWrapper({ children, className }: WrapperProps) {
  return (
    <div className={cn("h-full w-full max-w-6xl mx-auto px-4 py-4 overflow-auto", className)}>
      {children}
    </div>
  );
}

/** Full-width wrapper for tools that need all available space */
export function FtuxFullWidthWrapper({ children, className }: WrapperProps) {
  return (
    <div className={cn("h-full w-full overflow-auto", className)}>
      {children}
    </div>
  );
}

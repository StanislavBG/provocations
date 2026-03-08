/**
 * ErrorState — Standardized error display component.
 *
 * Centered layout with an icon, title, message, and optional retry button.
 * Consistent with the design system's muted styling.
 */

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <h3 className="text-sm font-semibold text-foreground/70 mb-1">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground/60 max-w-xs leading-relaxed mb-4">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="text-xs">
          Try Again
        </Button>
      )}
    </div>
  );
}

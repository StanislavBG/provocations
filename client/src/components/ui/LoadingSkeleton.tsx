/**
 * LoadingSkeleton — Reusable skeleton/pulse component for content loading states.
 *
 * Provides consistent loading animations aligned with the design system.
 * Wraps the base Skeleton component with common layout patterns.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  /** Number of skeleton lines to show (default: 3) */
  lines?: number;
  /** Whether to show a header skeleton (default: true) */
  showHeader?: boolean;
  /** Additional class names */
  className?: string;
}

export function LoadingSkeleton({ lines = 3, showHeader = true, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3 p-4", className)}>
      {showHeader && (
        <Skeleton className="h-5 w-2/5 rounded" />
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3.5 rounded",
            i === lines - 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

interface LoadingSkeletonCardProps {
  /** Additional class names */
  className?: string;
}

/** Card-shaped skeleton for grid/list loading states */
export function LoadingSkeletonCard({ className }: LoadingSkeletonCardProps) {
  return (
    <div className={cn("rounded-lg border border-border/50 p-4 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-4/5 rounded" />
    </div>
  );
}

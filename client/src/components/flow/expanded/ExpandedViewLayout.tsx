/**
 * ExpandedViewLayout — Shared resizable two-panel layout for expanded node views.
 *
 * Replaces the fixed-width left panel pattern (w-64/w-72/w-80) with a draggable
 * resize handle so users can widen the config panel to see full descriptions.
 */

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface ExpandedViewLayoutProps {
  /** Left config/nav panel content */
  left: React.ReactNode;
  /** Right main content panel */
  right: React.ReactNode;
  /** Default left panel size as percentage (default: 30) */
  defaultLeftSize?: number;
  /** Minimum left panel size as percentage (default: 15) */
  minLeftSize?: number;
  /** Maximum left panel size as percentage (default: 55) */
  maxLeftSize?: number;
}

export function ExpandedViewLayout({
  left,
  right,
  defaultLeftSize = 30,
  minLeftSize = 15,
  maxLeftSize = 55,
}: ExpandedViewLayoutProps) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel
        defaultSize={defaultLeftSize}
        minSize={minLeftSize}
        maxSize={maxLeftSize}
        className="bg-card/50"
      >
        {left}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel minSize={30}>
        {right}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

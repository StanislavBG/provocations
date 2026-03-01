/**
 * LlmHoverButton — HoverCard wrapper for any LLM-triggering button.
 *
 * ADR: Every button that triggers an LLM call MUST be wrapped with this
 * component (or use the LlmCallPreview directly). This ensures consistent
 * pre-call transparency across the entire application.
 *
 * Usage:
 *   <LlmHoverButton
 *     previewTitle="Generate Provocations"
 *     previewBlocks={blocks}
 *     previewSummary={summaryItems}
 *   >
 *     <Button onClick={handleGenerate}>Generate Provocations</Button>
 *   </LlmHoverButton>
 *
 * The child element becomes the HoverCard trigger. On hover, the LlmCallPreview
 * widget appears with Perf and Summary tabs.
 */

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { LlmCallPreview, type ContextBlock, type SummaryItem } from "@/components/LlmCallPreview";

export interface LlmHoverButtonProps {
  /** Display title in the preview header */
  previewTitle: string;
  /** Context blocks for the Perf tab */
  previewBlocks: ContextBlock[];
  /** Summary items for the Summary tab */
  previewSummary: SummaryItem[];
  /** The button element to wrap */
  children: React.ReactElement;
  /** HoverCard side (default: "bottom") */
  side?: "top" | "bottom" | "left" | "right";
  /** HoverCard alignment (default: "center") */
  align?: "start" | "center" | "end";
  /** Padding from viewport edges to avoid overlapping fixed UI */
  collisionPadding?: number | { top?: number; right?: number; bottom?: number; left?: number };
}

export function LlmHoverButton({
  previewTitle,
  previewBlocks,
  previewSummary,
  children,
  side = "bottom",
  align = "center",
  collisionPadding,
}: LlmHoverButtonProps) {
  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        collisionPadding={collisionPadding}
        className="w-auto p-0 border-0 bg-transparent shadow-none"
      >
        <LlmCallPreview
          title={previewTitle}
          blocks={previewBlocks}
          summaryItems={previewSummary}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

// Re-export types for convenience
export type { ContextBlock, SummaryItem } from "@/components/LlmCallPreview";
export { estimateTokens, CHARS_PER_TOKEN } from "@/components/LlmCallPreview";

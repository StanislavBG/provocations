/**
 * Verbose Mode Toggle — global button to enable/disable LLM call transparency.
 *
 * When enabled, every LLM-triggered action shows detailed metadata about
 * the model, parameters, context size, cost, and system prompt.
 *
 * Hovering the button while verbose mode is ON shows the latest LLM call
 * context summary card (LlmContextPlan).
 */

import { Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useVerboseMode } from "@/hooks/use-verbose-mode";
import { useVerboseCapture } from "@/components/VerboseProvider";
import { LlmContextPlan } from "@/components/LlmContextPlan";

export function VerboseModeToggle() {
  const { verboseMode, isLoading, toggleVerboseMode } = useVerboseMode();
  const { entries } = useVerboseCapture();

  const hasEntries = verboseMode && entries.length > 0;

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 px-2 gap-1.5 text-xs font-mono ${
        verboseMode
          ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
          : "text-gray-500 hover:text-gray-300"
      }`}
      onClick={toggleVerboseMode}
      disabled={isLoading}
    >
      <Cpu className="w-3.5 h-3.5" />
      <span>Verbose</span>
      {verboseMode && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
    </Button>
  );

  // When verbose is ON and there are LLM call entries, show HoverCard with context plan
  if (hasEntries) {
    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {button}
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="end"
          className="w-[480px] p-0 border-amber-500/30 bg-transparent shadow-xl"
        >
          <LlmContextPlan entries={entries} compact={false} />
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Default: simple tooltip when no entries or verbose is off
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-semibold">{verboseMode ? "Verbose Mode ON" : "Verbose Mode OFF"}</p>
        <p className="text-xs text-gray-400 mt-1">
          {verboseMode
            ? "Every LLM call shows model, parameters, cost, and context details. Make an LLM call to see metadata here."
            : "Enable to see detailed LLM call metadata on every AI action."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

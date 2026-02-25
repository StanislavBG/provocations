/**
 * Verbose Mode Toggle — global button to enable/disable LLM call transparency.
 *
 * When enabled, every LLM-triggered action shows detailed metadata about
 * the model, parameters, context size, cost, and system prompt.
 */

import { Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVerboseMode } from "@/hooks/use-verbose-mode";

export function VerboseModeToggle() {
  const { verboseMode, isLoading, toggleVerboseMode } = useVerboseMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-semibold">{verboseMode ? "Verbose Mode ON" : "Verbose Mode OFF"}</p>
        <p className="text-xs text-gray-400 mt-1">
          {verboseMode
            ? "Every LLM call shows model, parameters, cost, and context details."
            : "Enable to see detailed LLM call metadata on every AI action."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

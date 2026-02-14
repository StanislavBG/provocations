import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Mic, MicOff } from "lucide-react";
import { useAutoDictate } from "@/hooks/use-auto-dictate";

export function AutoDictateToggle() {
  const { autoDictate, toggleAutoDictate, isLoading } = useAutoDictate();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid="button-auto-dictate-toggle"
          size="icon"
          variant="ghost"
          onClick={toggleAutoDictate}
          disabled={isLoading}
          className={autoDictate ? "text-primary" : ""}
        >
          {autoDictate ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{autoDictate ? "Auto-dictate on — click to disable" : "Auto-dictate off — click to enable"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

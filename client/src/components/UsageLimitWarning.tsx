/**
 * UsageLimitWarning — displays usage warnings and blocking modals.
 *
 * At 80% usage: shows a warning toast.
 * At 100% usage: shows a blocking modal with upgrade CTA.
 * For node creation limits on free tier: shows an inline message.
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UsageStatus {
  plan: string;
  limits: {
    llmCallsPerDay: number;
    ttsMinsPerMonth: number;
    imagesPerDay: number;
    storageMb: number;
    canvases: number;
    nodesPerCanvas: number;
  };
  usage: {
    llmCallsToday: number;
    ttsMinutesThisMonth: number;
    imagesToday: number;
    storageMb: number;
  };
}

const resourceLabels: Record<string, string> = {
  llm_call: "LLM calls",
  tts_minute: "TTS minutes",
  image_gen: "image generations",
  storage_mb: "storage",
};

/**
 * Hook that checks usage and shows warnings/blocks as needed.
 * Call checkAndWarn() before making a resource-consuming action.
 * Returns true if the action is allowed, false if blocked.
 */
export function useUsageLimitCheck() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [blockModal, setBlockModal] = useState<{ resource: string; current: number; limit: number } | null>(null);
  const [warningsShown, setWarningsShown] = useState<Set<string>>(new Set());

  const checkAndWarn = useCallback(
    async (resource: "llm_call" | "tts_minute" | "image_gen" | "storage_mb"): Promise<boolean> => {
      try {
        const res = await apiRequest("GET", "/api/billing/status");
        const data: UsageStatus = await res.json();

        let current = 0;
        let limit = 0;

        switch (resource) {
          case "llm_call":
            current = data.usage.llmCallsToday;
            limit = data.limits.llmCallsPerDay;
            break;
          case "tts_minute":
            current = data.usage.ttsMinutesThisMonth;
            limit = data.limits.ttsMinsPerMonth;
            break;
          case "image_gen":
            current = data.usage.imagesToday;
            limit = data.limits.imagesPerDay;
            break;
          case "storage_mb":
            current = data.usage.storageMb;
            limit = data.limits.storageMb;
            break;
        }

        if (!isFinite(limit)) return true; // Unlimited

        const percentage = limit === 0 ? 100 : (current / limit) * 100;

        // 100%: block
        if (percentage >= 100) {
          setBlockModal({ resource, current, limit });
          return false;
        }

        // 80%: warning toast (once per resource per session)
        if (percentage >= 80 && !warningsShown.has(resource)) {
          setWarningsShown((prev) => new Set(prev).add(resource));
          toast({
            title: "Usage warning",
            description: `You've used ${current} of ${limit} ${resourceLabels[resource]} today. Upgrade for more.`,
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/pricing")}
              >
                Upgrade
              </Button>
            ),
          });
        }

        return true;
      } catch {
        // Fail open — allow the action if we can't check usage
        return true;
      }
    },
    [toast, setLocation, warningsShown],
  );

  const BlockModal = useCallback(() => {
    if (!blockModal) return null;

    return (
      <Dialog open onOpenChange={() => setBlockModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle className="font-serif">Usage Limit Reached</DialogTitle>
            </div>
            <DialogDescription>
              You have used {blockModal.current} of {blockModal.limit}{" "}
              {resourceLabels[blockModal.resource]} available on your current plan.
              Upgrade to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBlockModal(null)}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
            <Button onClick={() => { setBlockModal(null); setLocation("/pricing"); }}>
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [blockModal, setLocation]);

  return { checkAndWarn, BlockModal };
}

/**
 * Inline usage limit message for node creation on free tier.
 * Shows when user approaches canvas/node limits.
 */
export function NodeLimitMessage({
  currentNodes,
  maxNodes,
  currentCanvases,
  maxCanvases,
}: {
  currentNodes: number;
  maxNodes: number;
  currentCanvases?: number;
  maxCanvases?: number;
}) {
  const [, setLocation] = useLocation();

  if (!isFinite(maxNodes) && (!maxCanvases || !isFinite(maxCanvases))) return null;

  const nodeAtLimit = isFinite(maxNodes) && currentNodes >= maxNodes;
  const canvasAtLimit = maxCanvases != null && isFinite(maxCanvases) && (currentCanvases ?? 0) >= maxCanvases;

  if (!nodeAtLimit && !canvasAtLimit) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        {nodeAtLimit && `Node limit reached (${currentNodes}/${maxNodes}).`}
        {canvasAtLimit && `Canvas limit reached (${currentCanvases}/${maxCanvases}).`}
        {" "}
        <button
          onClick={() => setLocation("/pricing")}
          className="underline hover:no-underline font-medium"
        >
          Upgrade for unlimited
        </button>
      </span>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PlannerProposeResponse } from "@shared/schema";
import type { FlowProgressStep } from "bilko-flow/react";

/**
 * Maps bilko-flow domain step types to UI-friendly FlowProgressStep types.
 * The planner returns domain types like "llm.generate", "http.search", etc.
 */
function mapStepType(domainType: string): string {
  if (domainType.startsWith("llm")) return "llm";
  if (domainType.startsWith("http")) return "external-input";
  if (domainType.startsWith("transform")) return "transform";
  if (domainType.startsWith("validate")) return "validate";
  if (domainType === "user.input" || domainType === "user-input") return "user-input";
  if (domainType === "display" || domainType === "user.display") return "display";
  return domainType;
}

/**
 * Converts a PlannerProposeResponse into FlowProgressStep[] for FlowProgress rendering.
 * All steps start as 'pending' since we're showing a preview, not executing.
 */
export function proposalToFlowSteps(proposal: PlannerProposeResponse): FlowProgressStep[] {
  return proposal.steps.map((step) => ({
    id: step.id,
    label: step.name,
    status: "pending" as const,
    type: mapStepType(step.type),
    meta: {
      message: step.description,
    },
  }));
}

export interface UsePlannerResult {
  /** Trigger workflow generation from a text description */
  propose: (description: string, context?: string, userRole?: string) => void;
  /** The raw proposal from the server */
  proposal: PlannerProposeResponse | null;
  /** FlowProgressStep[] ready for FlowProgress rendering */
  flowSteps: FlowProgressStep[];
  /** Whether the planner is currently generating */
  isLoading: boolean;
  /** Error message if planner failed */
  error: string | null;
  /** Reset planner state */
  reset: () => void;
}

export function usePlanner(): UsePlannerResult {
  const [proposal, setProposal] = useState<PlannerProposeResponse | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowProgressStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      description,
      context,
      userRole,
    }: {
      description: string;
      context?: string;
      userRole?: string;
    }) => {
      const response = await apiRequest("POST", "/api/planner/propose", {
        description,
        context,
        userRole,
      });
      return (await response.json()) as PlannerProposeResponse;
    },
    onSuccess: (data) => {
      setProposal(data);
      setFlowSteps(proposalToFlowSteps(data));
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to generate workflow");
      setProposal(null);
      setFlowSteps([]);
    },
  });

  const propose = useCallback(
    (description: string, context?: string, userRole?: string) => {
      setError(null);
      mutation.mutate({ description, context, userRole });
    },
    [mutation]
  );

  const reset = useCallback(() => {
    setProposal(null);
    setFlowSteps([]);
    setError(null);
  }, []);

  return {
    propose,
    proposal,
    flowSteps,
    isLoading: mutation.isPending,
    error,
    reset,
  };
}

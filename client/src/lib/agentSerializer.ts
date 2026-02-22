/**
 * Agent ↔ API serialization.
 *
 * Converts between the agent editor form state (used by Workspace)
 * and the API payload format (AgentDefinition), plus helpers for
 * admin prompt editing via the Agent Editor.
 */

import type { AgentStep, AgentDefinition } from "@shared/schema";

/** Form state held by Workspace for the agent editor. */
export interface AgentEditorState {
  agentId?: string;
  name: string;
  description: string;
  persona: string;
  steps: AgentStep[];
}

/**
 * Serialize agent form state → API payload for create/update.
 */
export function serializeAgent(state: AgentEditorState): AgentDefinition {
  return {
    agentId: state.agentId ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: state.name,
    description: state.description,
    persona: state.persona,
    steps: state.steps,
  };
}

/**
 * Deserialize API payload → agent form state (for loading saved agents).
 */
export function deserializeAgent(definition: AgentDefinition): AgentEditorState {
  return {
    agentId: definition.agentId,
    name: definition.name,
    description: definition.description,
    persona: definition.persona,
    steps: definition.steps,
  };
}

/**
 * Build an objective string for the workspace when editing an agent.
 */
export function buildAgentEditObjective(agent: AgentDefinition): string {
  const stepCount = agent.steps.length;
  return `Design and refine the "${agent.name}" agent workflow with ${stepCount} step${stepCount !== 1 ? "s" : ""}. ` +
    `Focus on clear input/output contracts between steps and precise system prompts.`;
}

/**
 * Create a single-step AgentEditorState for editing a system prompt
 * from the admin LLM task type view.
 */
export function createAdminPromptEditorState(
  taskType: string,
  description: string,
  systemPrompt: string,
): AgentEditorState {
  return {
    name: `${taskType} — System Prompt`,
    description: `Admin editing of the "${description}" LLM task type system prompt.`,
    persona: "",
    steps: [
      {
        id: `step-admin-${taskType}`,
        name: "System Prompt",
        order: 1,
        input: {
          source: "user",
          description: "User-provided content for this task type",
          dataType: "text",
        },
        actor: {
          systemPrompt,
          maxTokens: 4000,
          temperature: 0.7,
        },
        output: {
          label: "result",
          description: "LLM output for this task type",
          dataType: "text",
        },
      },
    ],
  };
}

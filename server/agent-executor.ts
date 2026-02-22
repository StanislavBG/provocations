/**
 * Agent Execution Engine — runs multi-step agent workflows.
 *
 * Executes steps sequentially: each step's output feeds into the next.
 * Supports validation (JSON schema, regex) and fallback values.
 */

import { llm } from "./llm";
import type { AgentStep } from "@shared/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepResult {
  stepId: string;
  stepName: string;
  output: string;
  tokenUsage: { prompt: number; completion: number };
  durationMs: number;
  validationPassed: boolean;
  error?: string;
}

export interface ExecutionResult {
  steps: StepResult[];
  finalOutput: string;
  totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateOutput(
  output: string,
  step: AgentStep,
): { valid: boolean; error?: string } {
  // JSON schema validation
  if (step.output.validationSchema && step.output.dataType === "json") {
    try {
      JSON.parse(output);
    } catch {
      return { valid: false, error: "Output is not valid JSON" };
    }
  }

  // Regex validation
  if (step.output.validationRegex) {
    try {
      const regex = new RegExp(step.output.validationRegex);
      if (!regex.test(output)) {
        return {
          valid: false,
          error: `Output does not match validation pattern: ${step.output.validationRegex}`,
        };
      }
    } catch {
      // Invalid regex — skip validation
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Execute a single step
// ---------------------------------------------------------------------------

async function executeStep(
  step: AgentStep,
  input: string,
  persona: string,
): Promise<StepResult> {
  const startTime = Date.now();

  // Build system prompt: persona context + step-specific prompt
  const systemParts: string[] = [];
  if (persona) {
    systemParts.push(persona);
  }
  if (step.actor.systemPrompt) {
    systemParts.push(step.actor.systemPrompt);
  }

  // Add output format instructions
  if (step.output.dataType === "json") {
    systemParts.push(
      "\nIMPORTANT: Your output MUST be valid JSON. Output ONLY the JSON, no markdown fences or explanatory text.",
    );
  } else if (step.output.dataType === "table") {
    systemParts.push(
      "\nIMPORTANT: Format your output as a structured table using markdown table syntax.",
    );
  }

  const system = systemParts.join("\n\n");

  try {
    const response = await llm.generate({
      maxTokens: step.actor.maxTokens,
      temperature: step.actor.temperature,
      system,
      messages: [{ role: "user", content: input }],
    });

    const output = response.text.trim();
    const durationMs = Date.now() - startTime;

    // Validate output
    const validation = validateOutput(output, step);

    if (!validation.valid && step.output.fallback) {
      // Use fallback if validation fails and fallback is defined
      return {
        stepId: step.id,
        stepName: step.name,
        output: step.output.fallback,
        tokenUsage: { prompt: 0, completion: 0 },
        durationMs,
        validationPassed: false,
        error: `${validation.error}. Using fallback value.`,
      };
    }

    return {
      stepId: step.id,
      stepName: step.name,
      output,
      tokenUsage: { prompt: 0, completion: 0 },
      durationMs,
      validationPassed: validation.valid,
      error: validation.valid ? undefined : validation.error,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      stepId: step.id,
      stepName: step.name,
      output: step.output.fallback || "",
      tokenUsage: { prompt: 0, completion: 0 },
      durationMs,
      validationPassed: false,
      error: err.message || "LLM call failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Execute full agent workflow
// ---------------------------------------------------------------------------

export async function executeAgent(
  steps: AgentStep[],
  initialInput: string,
  persona: string,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  const results: StepResult[] = [];
  let currentInput = initialInput;

  for (const step of sortedSteps) {
    // Determine input for this step
    let stepInput = currentInput;
    if (step.input.source === "previous-step" && step.input.sourceStepId) {
      const prevResult = results.find((r) => r.stepId === step.input.sourceStepId);
      if (prevResult) {
        stepInput = prevResult.output;
      }
    }

    const result = await executeStep(step, stepInput, persona);
    results.push(result);

    // Stop execution if step failed without fallback
    if (!result.validationPassed && !step.output.fallback) {
      break;
    }

    // Update current input for next step
    currentInput = result.output;
  }

  const totalDurationMs = Date.now() - startTime;
  const finalOutput =
    results.length > 0 ? results[results.length - 1].output : "";

  return {
    steps: results,
    finalOutput,
    totalDurationMs,
  };
}

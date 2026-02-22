/**
 * StepEditor — center panel for agent editor.
 *
 * Structured form for editing a single agent step (Input → Actor → Output)
 * or the agent-level configuration when no step is selected.
 */

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Bot, CircleDot, FileOutput, LogIn } from "lucide-react";
import { ProvokeText } from "./ProvokeText";
import TokenCounter from "./TokenCounter";
import type { AgentStep } from "@shared/schema";

// ---------------------------------------------------------------------------
// Agent-level editor (when no step is selected)
// ---------------------------------------------------------------------------

interface AgentConfigProps {
  agentName: string;
  onAgentNameChange: (name: string) => void;
  agentDescription: string;
  onAgentDescriptionChange: (desc: string) => void;
  persona: string;
  onPersonaChange: (persona: string) => void;
}

function AgentConfigEditor({
  agentName,
  onAgentNameChange,
  agentDescription,
  onAgentDescriptionChange,
  persona,
  onPersonaChange,
}: AgentConfigProps) {
  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold mb-1">Agent Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Define your agent's identity and persona before building steps.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Agent Name</Label>
          <Input
            id="agent-name"
            value={agentName}
            onChange={(e) => onAgentNameChange(e.target.value)}
            placeholder="e.g., Financial Analysis Pipeline"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-desc">Description</Label>
          <ProvokeText
            value={agentDescription}
            onChange={onAgentDescriptionChange}
            placeholder="Describe what this agent does and when to use it..."
            chrome="container"
            variant="textarea"
            label="Description"
            showCopy
            showClear={false}
            minRows={3}
            maxRows={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-persona">Persona</Label>
          <ProvokeText
            value={persona}
            onChange={onPersonaChange}
            placeholder="Define the agent's persona and role. This context is prepended to every step's system prompt..."
            chrome="container"
            variant="textarea"
            label="Persona"
            labelIcon={Bot}
            showCopy
            showClear={false}
            minRows={5}
            maxRows={15}
          />
          <TokenCounter text={persona} compact label="Persona" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step-level editor
// ---------------------------------------------------------------------------

interface StepEditorProps {
  step: AgentStep | null;
  allSteps: AgentStep[];
  onStepChange: (updated: AgentStep) => void;
  // Agent-level props (shown when step is null)
  agentName: string;
  onAgentNameChange: (name: string) => void;
  agentDescription: string;
  onAgentDescriptionChange: (desc: string) => void;
  persona: string;
  onPersonaChange: (persona: string) => void;
}

export default function StepEditor({
  step,
  allSteps,
  onStepChange,
  agentName,
  onAgentNameChange,
  agentDescription,
  onAgentDescriptionChange,
  persona,
  onPersonaChange,
}: StepEditorProps) {
  // When no step is selected, show agent-level config
  if (!step) {
    return (
      <AgentConfigEditor
        agentName={agentName}
        onAgentNameChange={onAgentNameChange}
        agentDescription={agentDescription}
        onAgentDescriptionChange={onAgentDescriptionChange}
        persona={persona}
        onPersonaChange={onPersonaChange}
      />
    );
  }

  // Previous steps available as input sources
  const previousSteps = allSteps.filter((s) => s.order < step.order);

  const updateField = <K extends keyof AgentStep>(
    key: K,
    value: AgentStep[K],
  ) => {
    onStepChange({ ...step, [key]: value });
  };

  const updateInput = (
    field: string,
    value: string,
  ) => {
    onStepChange({
      ...step,
      input: { ...step.input, [field]: value },
    });
  };

  const updateActor = (
    field: string,
    value: string | number,
  ) => {
    onStepChange({
      ...step,
      actor: { ...step.actor, [field]: value },
    });
  };

  const updateOutput = (
    field: string,
    value: string,
  ) => {
    onStepChange({
      ...step,
      output: { ...step.output, [field]: value },
    });
  };

  return (
    <div className="space-y-4 p-6 max-w-3xl mx-auto overflow-y-auto">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <CircleDot className="w-5 h-5 text-primary shrink-0" />
        <Input
          value={step.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Step name..."
          className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
        />
        <Badge variant="outline" className="shrink-0 font-mono text-xs">
          #{step.order}
        </Badge>
      </div>

      {/* INPUT SECTION */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LogIn className="w-4 h-4 text-blue-500" />
            Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select
                value={step.input.source}
                onValueChange={(v) => updateInput("source", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User Input</SelectItem>
                  <SelectItem value="previous-step">Previous Step</SelectItem>
                  <SelectItem value="context">Context</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data Type</Label>
              <Select
                value={step.input.dataType}
                onValueChange={(v) => updateInput("dataType", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {step.input.source === "previous-step" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Source Step</Label>
              <Select
                value={step.input.sourceStepId ?? ""}
                onValueChange={(v) => updateInput("sourceStepId", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select source step..." />
                </SelectTrigger>
                <SelectContent>
                  {previousSteps.map((ps) => (
                    <SelectItem key={ps.id} value={ps.id}>
                      #{ps.order} {ps.name} → {ps.output.label || "output"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <ProvokeText
              value={step.input.description}
              onChange={(v) => updateInput("description", v)}
              placeholder="Describe what input this step expects..."
              chrome="bare"
              variant="textarea"
              showCopy
              showClear={false}
              minRows={2}
              maxRows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Flow arrow */}
      <div className="flex justify-center">
        <ArrowDown className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* ACTOR SECTION */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-500" />
            Actor (System Prompt)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProvokeText
            value={step.actor.systemPrompt}
            onChange={(v) => updateActor("systemPrompt", v)}
            placeholder="Write the system prompt that defines how this step processes the input..."
            chrome="container"
            variant="textarea"
            label="System Prompt"
            labelIcon={Bot}
            showCopy
            showClear={false}
            minRows={8}
            maxRows={25}
          />

          <div className="flex items-center justify-between">
            <TokenCounter text={step.actor.systemPrompt} compact label="Prompt" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground">Max Tokens</Label>
                <Input
                  type="number"
                  value={step.actor.maxTokens}
                  onChange={(e) =>
                    updateActor("maxTokens", Math.max(100, Math.min(16384, Number(e.target.value) || 2000)))
                  }
                  className="h-6 w-20 text-xs font-mono"
                  min={100}
                  max={16384}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground">Temp</Label>
                <Input
                  type="number"
                  value={step.actor.temperature}
                  onChange={(e) =>
                    updateActor("temperature", Math.max(0, Math.min(2, Number(e.target.value) || 0.7)))
                  }
                  className="h-6 w-16 text-xs font-mono"
                  min={0}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow arrow */}
      <div className="flex justify-center">
        <ArrowDown className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* OUTPUT SECTION */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileOutput className="w-4 h-4 text-green-500" />
            Output
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={step.output.label}
                onChange={(e) => updateOutput("label", e.target.value)}
                placeholder="e.g., opportunities_list"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data Type</Label>
              <Select
                value={step.output.dataType}
                onValueChange={(v) => updateOutput("dataType", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <ProvokeText
              value={step.output.description}
              onChange={(v) => updateOutput("description", v)}
              placeholder="Describe the expected output..."
              chrome="bare"
              variant="textarea"
              showCopy
              showClear={false}
              minRows={2}
              maxRows={4}
            />
          </div>

          {/* Validation (collapsed by default) */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              Validation &amp; Fallback (optional)
            </summary>
            <div className="mt-2 space-y-2">
              {step.output.dataType === "json" && (
                <div className="space-y-1">
                  <Label className="text-[10px]">JSON Schema</Label>
                  <ProvokeText
                    value={step.output.validationSchema ?? ""}
                    onChange={(v) => updateOutput("validationSchema", v)}
                    placeholder='{"type": "object", "properties": {...}}'
                    chrome="bare"
                    variant="textarea"
                    showCopy
                    showClear={false}
                    minRows={3}
                    maxRows={8}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[10px]">Validation Regex</Label>
                <Input
                  value={step.output.validationRegex ?? ""}
                  onChange={(e) => updateOutput("validationRegex", e.target.value)}
                  placeholder="e.g., ^[\\[{]"
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Fallback Output</Label>
                <Input
                  value={step.output.fallback ?? ""}
                  onChange={(e) => updateOutput("fallback", e.target.value)}
                  placeholder="Default value if validation fails"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCcw, Info } from "lucide-react";

// ---------------------------------------------------------------------------
// Model configuration state — exposed to parent
// ---------------------------------------------------------------------------

export interface ModelConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  model: string;
}

/** Initial default — overridden once we fetch the live default from the backend */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  model: "", // resolved from backend
};

/** Fallback when backend hasn't responded yet */
const FALLBACK_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
];

// ---------------------------------------------------------------------------
// Parameter row component
// ---------------------------------------------------------------------------

interface ParamRowProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function ParamRow({ label, description, value, min, max, step, onChange }: ParamRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium">{label}</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <Info className="w-3 h-3 text-muted-foreground/60 hover:text-primary transition-colors" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[260px]">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || min)}
          className="w-20 h-7 text-xs text-right"
        />
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ModelConfigPanelProps {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

export function ModelConfigPanel({ config, onChange }: ModelConfigPanelProps) {
  const [availableModels, setAvailableModels] = useState(FALLBACK_MODELS);
  const [defaultModel, setDefaultModel] = useState("");

  // Fetch live model catalog from backend
  useEffect(() => {
    fetch("/api/chat/models")
      .then((r) => r.json())
      .then((data: { models?: Array<{ id: string; label: string }>; defaultModel?: string }) => {
        if (data.models?.length) {
          setAvailableModels(data.models.map((m) => ({ value: m.id, label: m.label })));
        }
        if (data.defaultModel) {
          setDefaultModel(data.defaultModel);
          // If current config has no model yet (initial load), set to discovered default
          if (!config.model) {
            onChange({ ...config, model: data.defaultModel });
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(
    <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => {
      onChange({ ...config, [key]: value });
    },
    [config, onChange],
  );

  const handleReset = useCallback(() => {
    onChange({ ...DEFAULT_MODEL_CONFIG, model: defaultModel || config.model });
  }, [onChange, defaultModel, config.model]);

  const resetTarget = { ...DEFAULT_MODEL_CONFIG, model: defaultModel || config.model };
  const isDefault =
    config.temperature === resetTarget.temperature &&
    config.maxTokens === resetTarget.maxTokens &&
    config.topP === resetTarget.topP &&
    config.frequencyPenalty === resetTarget.frequencyPenalty &&
    config.presencePenalty === resetTarget.presencePenalty &&
    config.model === resetTarget.model;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Model Configuration</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fine-tune LLM behavior for image description generation
            </p>
          </div>
          {!isDefault && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={handleReset}>
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>

        {/* Model selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium">Model</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <Info className="w-3 h-3 text-muted-foreground/60 hover:text-primary transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px]">
                <p className="text-xs">The LLM model used for generating descriptions and processing content.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={config.model} onValueChange={(v) => update("model", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Temperature */}
        <ParamRow
          label="Temperature"
          description="Controls randomness. Lower values (0.1) produce focused, deterministic output. Higher values (1.5) increase creativity and variation."
          value={config.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => update("temperature", v)}
        />

        {/* Max Tokens */}
        <ParamRow
          label="Max Tokens"
          description="Maximum number of tokens in the response. Higher values allow longer, more detailed descriptions."
          value={config.maxTokens}
          min={256}
          max={16384}
          step={256}
          onChange={(v) => update("maxTokens", v)}
        />

        {/* Top P */}
        <ParamRow
          label="Top P"
          description="Nucleus sampling. Controls diversity by limiting cumulative probability. 0.1 means only the top 10% probability mass is considered."
          value={config.topP}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update("topP", v)}
        />

        {/* Frequency Penalty */}
        <ParamRow
          label="Frequency Penalty"
          description="Penalizes tokens based on frequency in the text so far. Reduces repetition. Range -2.0 to 2.0."
          value={config.frequencyPenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={(v) => update("frequencyPenalty", v)}
        />

        {/* Presence Penalty */}
        <ParamRow
          label="Presence Penalty"
          description="Penalizes tokens based on whether they appear in the text so far. Increases topic diversity. Range -2.0 to 2.0."
          value={config.presencePenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={(v) => update("presencePenalty", v)}
        />

        {/* Current config summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Configuration
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {availableModels.find((m) => m.value === config.model)?.label ?? config.model}
            </Badge>
            <Badge variant="outline" className="text-[10px]">temp {config.temperature}</Badge>
            <Badge variant="outline" className="text-[10px]">tokens {config.maxTokens}</Badge>
            <Badge variant="outline" className="text-[10px]">top_p {config.topP}</Badge>
            {config.frequencyPenalty !== 0 && (
              <Badge variant="outline" className="text-[10px]">freq {config.frequencyPenalty}</Badge>
            )}
            {config.presencePenalty !== 0 && (
              <Badge variant="outline" className="text-[10px]">pres {config.presencePenalty}</Badge>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

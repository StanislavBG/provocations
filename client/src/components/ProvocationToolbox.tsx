import { useState, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "./ProvokeText";
import { BrowserExplorer } from "./BrowserExplorer";
import {
  MessageCircleQuestion,
  Play,
  Loader2,
  Blocks,
  ShieldCheck,
  Palette,
  BookText,
  Briefcase,
  Lock,
  Rocket,
  Crosshair,
  Globe,
  Wrench,
  Info,
  UserCircle,
  Pencil,
} from "lucide-react";
import type { ProvocationType, DirectionMode } from "@shared/schema";
import { builtInPersonas, getAllPersonas } from "@shared/personas";

// ── Toolbox app type ──

export type ToolboxApp = "provoke" | "website";

// ── Persona metadata (derived from centralized persona definitions) ──

const iconMap: Record<string, typeof Blocks> = {
  Blocks, ShieldCheck, Palette, BookText, Briefcase, Lock, Rocket,
};

const personaIcons: Record<ProvocationType, typeof Blocks> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, iconMap[p.icon] || Blocks])
) as Record<ProvocationType, typeof Blocks>;

const personaColors: Record<ProvocationType, string> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, p.color.text])
) as Record<ProvocationType, string>;

const personaLabels: Record<ProvocationType, string> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, p.label])
) as Record<ProvocationType, string>;

const personaDescriptions: Record<ProvocationType, string> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, p.description])
) as Record<ProvocationType, string>;

const allPersonaTypes: ProvocationType[] = getAllPersonas().map((p) => p.id as ProvocationType);

interface ProvocationToolboxProps {
  activeApp: ToolboxApp;
  onAppChange: (app: ToolboxApp) => void;

  // Provoke app props
  isInterviewActive: boolean;
  isMerging: boolean;
  interviewEntryCount: number;
  onStartInterview: (direction: {
    mode: DirectionMode;
    personas: ProvocationType[];
    guidance?: string;
  }) => void;

  // Website app props
  websiteUrl: string;
  onUrlChange: (url: string) => void;
  showLogPanel: boolean;
  onToggleLogPanel: () => void;
  isAnalyzing: boolean;
  discoveredCount: number;
  /** Extra actions rendered in the browser header (e.g. Capture button) */
  browserHeaderActions?: ReactNode;
  /** Controlled expanded state for the browser explorer */
  browserExpanded?: boolean;
  /** Called when browser expanded state changes */
  onBrowserExpandedChange?: (expanded: boolean) => void;
}

export function ProvocationToolbox({
  activeApp,
  onAppChange,
  isInterviewActive,
  isMerging,
  interviewEntryCount,
  onStartInterview,
  websiteUrl,
  onUrlChange,
  showLogPanel,
  onToggleLogPanel,
  isAnalyzing,
  discoveredCount,
  browserHeaderActions,
  browserExpanded,
  onBrowserExpandedChange,
}: ProvocationToolboxProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Panel Header — standardized */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
        <Wrench className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Toolbox</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted/60 text-muted-foreground/70 hover:bg-primary/10 hover:text-primary transition-colors text-[10px] font-bold">
              1
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[300px]">
            <p className="text-xs font-medium mb-1">Configure Your Session</p>
            <p className="text-xs text-muted-foreground">This panel is your control center. Choose which expert personas will review your work, set the AI's tone (challenge or advise), and optionally define a custom focus area. Your selections shape the interview questions in the Discussion panel.</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex-1" />
        {/* App switcher tabs */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={activeApp === "provoke" ? "default" : "ghost"}
            className="gap-1 text-xs h-7 px-2"
            onClick={() => onAppChange("provoke")}
          >
            <MessageCircleQuestion className="w-3 h-3" />
            Provoke
          </Button>
          <Button
            size="sm"
            variant={activeApp === "website" ? "default" : "ghost"}
            className="gap-1 text-xs h-7 px-2"
            onClick={() => onAppChange("website")}
          >
            <Globe className="w-3 h-3" />
            Website
          </Button>
        </div>
      </div>

      {/* App content */}
      <div className="flex-1 overflow-hidden">
        {activeApp === "provoke" ? (
          <ProvokeConfigApp
            isInterviewActive={isInterviewActive}
            isMerging={isMerging}
            interviewEntryCount={interviewEntryCount}
            onStartInterview={onStartInterview}
          />
        ) : (
          <BrowserExplorer
            websiteUrl={websiteUrl}
            onUrlChange={onUrlChange}
            showLogPanel={showLogPanel}
            onToggleLogPanel={onToggleLogPanel}
            isAnalyzing={isAnalyzing}
            discoveredCount={discoveredCount}
            headerActions={browserHeaderActions}
            expanded={browserExpanded}
            onExpandedChange={onBrowserExpandedChange}
          />
        )}
      </div>
    </div>
  );
}

// ── Provoke Config App (extracted from InterviewPanel's setup mode) ──

interface ProvokeConfigAppProps {
  isInterviewActive: boolean;
  isMerging: boolean;
  interviewEntryCount: number;
  onStartInterview: (direction: {
    mode: DirectionMode;
    personas: ProvocationType[];
    guidance?: string;
  }) => void;
}

function ProvokeConfigApp({
  isInterviewActive,
  isMerging,
  interviewEntryCount,
  onStartInterview,
}: ProvokeConfigAppProps) {
  // Persona state — CEO is selected by default
  const [selectedPersonas, setSelectedPersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["ceo"])
  );
  const [guidance, setGuidance] = useState("");
  const [isRecordingGuidance, setIsRecordingGuidance] = useState(false);

  const togglePersona = useCallback((type: ProvocationType) => {
    setSelectedPersonas(prev => {
      const next = new Set<ProvocationType>(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleStartInterview = useCallback(() => {
    onStartInterview({
      mode: "challenge",
      personas: Array.from(selectedPersonas),
      guidance: guidance.trim() || undefined,
    });
  }, [selectedPersonas, guidance, onStartInterview]);

  // Custom persona expanded state
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Configuration setup */}
      <div className="p-4 space-y-4">
        {/* 1. Persona toggles — FIRST */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-primary" />
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Personas
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px]">
                <p className="text-xs font-medium mb-1">Choose your reviewers</p>
                <p className="text-xs text-muted-foreground">Each persona brings a distinct professional lens to challenge your thinking. Select one or more to shape the interview questions around their expertise. Leave empty for general questions.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {allPersonaTypes.map((type) => {
              const Icon = personaIcons[type];
              const isSelected = selectedPersonas.has(type);
              const isCeo = type === "ceo";
              return (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className={`gap-1 text-xs h-7 px-2 ${
                        isSelected
                          ? isCeo
                            ? "bg-orange-600 hover:bg-orange-700 text-white"
                            : ""
                          : "opacity-50"
                      } ${isCeo && !isSelected ? "border-orange-300 dark:border-orange-700" : ""}`}
                      onClick={() => togglePersona(type)}
                    >
                      <Icon className="w-3 h-3" />
                      {personaLabels[type]}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px]">
                    <p className="text-xs font-medium mb-0.5">{personaLabels[type]}</p>
                    <p className="text-xs text-muted-foreground">{personaDescriptions[type]}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Custom persona — opens guidance input */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={isCustomExpanded ? "default" : "outline"}
                  className={`gap-1 text-xs h-7 px-2 ${
                    isCustomExpanded
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "opacity-50 border-indigo-300 dark:border-indigo-700 hover:opacity-100"
                  }`}
                  onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                >
                  <Pencil className="w-3 h-3" />
                  Custom
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px]">
                <p className="text-xs font-medium mb-0.5">Custom Focus</p>
                <p className="text-xs text-muted-foreground">Define your own area of focus. Tell the AI exactly what to push you on — pricing strategy, technical debt, go-to-market, anything specific to your context.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Custom guidance — collapsed ProvokeText input */}
          {isCustomExpanded && (
            <div className="mt-2 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
              <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-3 h-3" />
                Focus Area
              </label>
              <ProvokeText
                chrome="inline"
                placeholder="e.g. 'Push me on pricing strategy and unit economics'"
                value={guidance}
                onChange={setGuidance}
                className="text-sm"
                minRows={2}
                maxRows={4}
                voice={{ mode: "replace" }}
                onVoiceTranscript={(transcript) => setGuidance(transcript)}
                onRecordingChange={setIsRecordingGuidance}
              />
              {isRecordingGuidance && (
                <p className="text-xs text-primary animate-pulse">Listening... describe what to focus on</p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {selectedPersonas.size === 0 && !isCustomExpanded
              ? "Select personas to focus the interview, or leave empty for general questions."
              : `${selectedPersonas.size} persona${selectedPersonas.size > 1 ? "s" : ""} selected${isCustomExpanded ? " + Custom focus" : ""}`}
          </p>
        </div>

      </div>

      {/* Start button area */}
      <div className="flex-1 flex items-end p-4">
        <div className="w-full space-y-3">
          {isInterviewActive && (
            <p className="text-xs text-center text-muted-foreground">
              Interview is active — check the Discussion panel.
            </p>
          )}
          {!isInterviewActive && interviewEntryCount > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              Previous session: {interviewEntryCount} questions answered
            </p>
          )}
          <Button
            onClick={handleStartInterview}
            className="gap-2 w-full"
            disabled={isMerging || isInterviewActive}
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merging into document...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {interviewEntryCount > 0 ? "Resume Interview" : "Start Interview"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

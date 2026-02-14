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
  ShieldAlert,
  Lightbulb,
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
import { thinkBigVectors } from "@shared/schema";
import type { ProvocationType, DirectionMode, ThinkBigVector } from "@shared/schema";

// ── Toolbox app type ──

export type ToolboxApp = "provoke" | "website";

// ── Persona metadata ──

const personaIcons: Record<ProvocationType, typeof Blocks> = {
  architect: Blocks,
  quality_engineer: ShieldCheck,
  ux_designer: Palette,
  tech_writer: BookText,
  product_manager: Briefcase,
  security_engineer: Lock,
  thinking_bigger: Rocket,
};

const personaColors: Record<ProvocationType, string> = {
  architect: "text-cyan-600 dark:text-cyan-400",
  quality_engineer: "text-rose-600 dark:text-rose-400",
  ux_designer: "text-fuchsia-600 dark:text-fuchsia-400",
  tech_writer: "text-amber-600 dark:text-amber-400",
  product_manager: "text-blue-600 dark:text-blue-400",
  security_engineer: "text-red-600 dark:text-red-400",
  thinking_bigger: "text-orange-600 dark:text-orange-400",
};

const personaLabels: Record<ProvocationType, string> = {
  architect: "Architect",
  quality_engineer: "QA Engineer",
  ux_designer: "UX Designer",
  tech_writer: "Tech Writer",
  product_manager: "Product Manager",
  security_engineer: "Security",
  thinking_bigger: "Think Big",
};

const personaDescriptions: Record<ProvocationType, string> = {
  architect: "Examines system design, boundaries, API contracts, and data flow. This persona ensures your architecture is sound, scalable, and well-structured before you build.",
  quality_engineer: "Probes for testing gaps, edge cases, error handling, and reliability. Catches the blind spots that break things in production.",
  ux_designer: "Evaluates user flows, discoverability, accessibility, and error states. Makes sure real people can actually use what you're building.",
  tech_writer: "Reviews documentation, naming conventions, and UI copy for clarity. If someone can't understand it, it doesn't exist.",
  product_manager: "Challenges business value, user stories, and prioritization. Asks the hard question: does this actually matter to users?",
  security_engineer: "Audits data privacy, authentication, authorization, and compliance. Finds the vulnerabilities before someone else does.",
  thinking_bigger: "Pushes you to scale impact and outcomes without changing the core idea. What if this was 10x bigger?",
};

// Think Big vector metadata
const thinkBigVectorMeta: { id: ThinkBigVector; label: string; shortLabel: string; description: string }[] = [
  {
    id: "tenancy_topology",
    label: "Tenancy Topology",
    shortLabel: "Tenancy",
    description: "Silo vs. Pool — How you isolate data across customers.",
  },
  {
    id: "api_surface",
    label: "API Surface",
    shortLabel: "API",
    description: "Utility vs. Platform — Tool or engine that other apps plug into?",
  },
  {
    id: "scaling_horizon",
    label: "Scaling Horizon",
    shortLabel: "Scale",
    description: "Vertical vs. Horizontal — 1K complex users or 1M simple users?",
  },
  {
    id: "data_residency",
    label: "Data Residency",
    shortLabel: "Residency",
    description: "Local vs. Sovereign — Where data lives matters more than what it does.",
  },
  {
    id: "integration_philosophy",
    label: "Integration Philosophy",
    shortLabel: "Integration",
    description: "Adapter vs. Native — Build integrations or provide hooks?",
  },
  {
    id: "identity_access",
    label: "Identity & Access",
    shortLabel: "Identity",
    description: "RBAC vs. ABAC — Simple roles break at scale.",
  },
  {
    id: "observability",
    label: "Observability",
    shortLabel: "Observability",
    description: "Logs vs. Traces — Debug big problems in seconds, not hours.",
  },
];

const allPersonaTypes: ProvocationType[] = [
  "thinking_bigger",
  "architect",
  "quality_engineer",
  "ux_designer",
  "tech_writer",
  "product_manager",
  "security_engineer",
];

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
    thinkBigVectors?: ThinkBigVector[];
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
    thinkBigVectors?: ThinkBigVector[];
  }) => void;
}

function ProvokeConfigApp({
  isInterviewActive,
  isMerging,
  interviewEntryCount,
  onStartInterview,
}: ProvokeConfigAppProps) {
  // Direction state
  const [directionMode, setDirectionMode] = useState<DirectionMode>("advise");
  const [selectedPersonas, setSelectedPersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["thinking_bigger"])
  );
  const [selectedVectors, setSelectedVectors] = useState<Set<ThinkBigVector>>(
    () => new Set<ThinkBigVector>(thinkBigVectors)
  );
  const [guidance, setGuidance] = useState("");
  const [isRecordingGuidance, setIsRecordingGuidance] = useState(false);

  const togglePersona = useCallback((type: ProvocationType) => {
    setSelectedPersonas(prev => {
      const next = new Set<ProvocationType>(prev);
      if (next.has(type)) {
        next.delete(type);
        if (type === "thinking_bigger") {
          setSelectedVectors(new Set<ThinkBigVector>());
        }
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const toggleVector = useCallback((vector: ThinkBigVector) => {
    setSelectedVectors(prev => {
      const next = new Set<ThinkBigVector>(prev);
      if (next.has(vector)) {
        next.delete(vector);
      } else {
        next.add(vector);
      }
      return next;
    });
  }, []);

  const handleStartInterview = useCallback(() => {
    onStartInterview({
      mode: directionMode,
      personas: Array.from(selectedPersonas),
      guidance: guidance.trim() || undefined,
      thinkBigVectors: selectedVectors.size > 0 ? Array.from(selectedVectors) : undefined,
    });
  }, [directionMode, selectedPersonas, selectedVectors, guidance, onStartInterview]);

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
              const isThinkBig = type === "thinking_bigger";
              return (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className={`gap-1 text-xs h-7 px-2 ${
                        isSelected
                          ? isThinkBig
                            ? "bg-orange-600 hover:bg-orange-700 text-white"
                            : ""
                          : "opacity-50"
                      } ${isThinkBig && !isSelected ? "border-orange-300 dark:border-orange-700" : ""}`}
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
                placeholder={
                  directionMode === "challenge"
                    ? "e.g. 'Push me on pricing strategy and unit economics'"
                    : "e.g. 'Help me strengthen my competitive analysis'"
                }
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

          {/* Think Big vectors — show when Think Big persona is selected */}
          {selectedPersonas.has("thinking_bigger") && (
            <div className="mt-2 p-3 rounded-lg border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 space-y-2">
              <label className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Rocket className="w-3 h-3" />
                Think Big Vectors
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {thinkBigVectorMeta.map((vec) => {
                  const isVecSelected = selectedVectors.has(vec.id);
                  return (
                    <Tooltip key={vec.id}>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={isVecSelected ? "default" : "outline"}
                          className={`gap-1 text-xs h-auto py-1.5 px-2 justify-start ${
                            isVecSelected
                              ? "bg-orange-600 hover:bg-orange-700 text-white"
                              : "opacity-60 hover:opacity-100 border-orange-200 dark:border-orange-800/50"
                          }`}
                          onClick={() => toggleVector(vec.id)}
                        >
                          {vec.shortLabel}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs font-medium">{vec.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{vec.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              <p className="text-xs text-orange-600/70 dark:text-orange-400/60">
                {selectedVectors.size === 0
                  ? "Select vectors to focus Think Big questions, or leave empty for general scaling."
                  : `${selectedVectors.size} vector${selectedVectors.size > 1 ? "s" : ""} selected`}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {selectedPersonas.size === 0 && !isCustomExpanded
              ? "Select personas to focus the interview, or leave empty for general questions."
              : `${selectedPersonas.size} persona${selectedPersonas.size > 1 ? "s" : ""} selected${isCustomExpanded ? " + Custom focus" : ""}`}
          </p>
        </div>

        {/* 2. Direction mode: Challenge / Advise — SECOND */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Direction
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px]">
                <p className="text-xs font-medium mb-1">Set the AI's tone</p>
                <p className="text-xs text-muted-foreground">Challenge mode pushes back hard — it questions your assumptions and demands stronger arguments. Advise mode is constructive — it suggests improvements and recommends better approaches.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={directionMode === "challenge" ? "default" : "outline"}
              className={`gap-1.5 flex-1 ${
                directionMode === "challenge"
                  ? "bg-violet-600 hover:bg-violet-700 text-white"
                  : "hover:bg-violet-50 dark:hover:bg-violet-950/20 hover:text-violet-700 dark:hover:text-violet-400 hover:border-violet-300 dark:hover:border-violet-700"
              }`}
              onClick={() => setDirectionMode("challenge")}
            >
              <ShieldAlert className="w-4 h-4" />
              Challenge
            </Button>
            <Button
              size="sm"
              variant={directionMode === "advise" ? "default" : "outline"}
              className={`gap-1.5 flex-1 ${
                directionMode === "advise"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700"
              }`}
              onClick={() => setDirectionMode("advise")}
            >
              <Lightbulb className="w-4 h-4" />
              Advise
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {directionMode === "challenge"
              ? "Push back on assumptions, probe weaknesses, demand better answers."
              : "Suggest improvements, recommend approaches, offer constructive guidance."}
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

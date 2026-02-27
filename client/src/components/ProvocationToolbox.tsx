import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InterviewPanel } from "./InterviewPanel";
import { ProvokeText } from "./ProvokeText";
import { BrowserExplorer } from "./BrowserExplorer";
import { ContextCapturePanel } from "./ContextCapturePanel";
import { AddContextModal } from "./AddContextModal";
import { ModelConfigPanel, type ModelConfig } from "./ModelConfigPanel";
import {
  MessageCircleQuestion,
  Play,
  Loader2,
  Blocks,
  ShieldCheck,
  ShieldAlert,
  Palette,
  BookText,
  Briefcase,
  Lock,
  Rocket,
  Database,
  FlaskConical,
  TrendingUp,
  Megaphone,
  PenTool,
  Crosshair,
  Globe,
  Wrench,
  Info,
  UserCircle,
  Pencil,
  Layers,
  FileText,
  Target,
  ListOrdered,
  Plus,
  ArrowRightToLine,
  Loader2 as Loader2Icon,
  MessageCircle,
} from "lucide-react";
import type { ProvocationType, DirectionMode, ContextItem, ReferenceDocument, PersonaDomain, InterviewEntry, DiscussionMessage } from "@shared/schema";
import type { LeftPanelTabConfig } from "@/lib/appWorkspaceConfig";
import { builtInPersonas, getAllPersonas, getPersonasByDomain } from "@shared/personas";
import { ChevronRight, Settings } from "lucide-react";

// ── Toolbox app type ──

export type ToolboxApp = "provoke" | "website" | "context" | "model-config" | "steps";

// ── Persona metadata (derived from centralized persona definitions) ──

const iconMap: Record<string, typeof Blocks> = {
  Blocks, ShieldCheck, ShieldAlert, Palette, BookText, Briefcase, Lock, Rocket, Database, FlaskConical, TrendingUp, Megaphone, PenTool,
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

  /** Application-specific left panel tabs from AppFlowConfig.
   *  When provided, only these tabs are rendered (in order).
   *  When omitted, falls back to legacy behavior showing all tabs. */
  availableTabs?: LeftPanelTabConfig[];

  // Provoke app props
  isInterviewActive: boolean;
  isMerging: boolean;
  interviewEntryCount: number;
  onStartInterview: (direction: {
    mode?: DirectionMode;
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

  // Context collection props (read-only preview)
  contextCollection?: {
    text: string;
    objective: string;
  } | null;
  referenceDocuments?: ReferenceDocument[];

  // Context app props (captured context items)
  capturedContext?: ContextItem[];
  onCapturedContextChange?: (items: ContextItem[]) => void;
  /** Called when user clicks a document to preview in the reading pane */
  onDocumentPreview?: (docId: number, title: string, content: string) => void;

  // Model config props
  modelConfig?: ModelConfig;
  onModelConfigChange?: (config: ModelConfig) => void;

  // Provoke mode — "suggest" for text-to-infographic (personas suggest descriptions)
  provokeMode?: "challenge" | "suggest";

  /** Custom tab content — Workspace can inject React nodes for app-specific tabs (e.g. "steps") */
  customTabContent?: Partial<Record<ToolboxApp, ReactNode>>;

  // Inline discussion — embeds InterviewPanel inside the Provoke tab
  /** When true, the Provoke tab shows personas (collapsible) + discussion inline */
  inlineDiscussion?: boolean;
  /** InterviewPanel props (required when inlineDiscussion is true) */
  discussionProps?: {
    isActive: boolean;
    entries: InterviewEntry[];
    currentQuestion: string | null;
    currentTopic: string | null;
    isLoadingQuestion: boolean;
    isMerging: boolean;
    directionMode?: DirectionMode;
    onAnswer: (answer: string) => void;
    onEnd: () => void;
    onViewAdvice?: (question: string, topic: string) => void;
    onDismissQuestion?: () => void;
    adviceText?: string | null;
    isLoadingAdvice?: boolean;
    onAskQuestion?: (question: string) => void;
    isLoadingAskResponse?: boolean;
    discussionMessages?: DiscussionMessage[];
    onAcceptResponse?: (messageId: string) => void;
    onDismissResponse?: (messageId: string) => void;
    onRespondToMessage?: (messageId: string, response: string) => void;
  };
  /** Called when "Evolve Document" button is clicked in inline discussion mode */
  onMergeToDraft?: () => void;
  isMergeToDraftPending?: boolean;
}

/** Icon lookup for left-panel tab IDs */
const LEFT_TAB_ICONS: Record<string, typeof Blocks> = {
  provoke: MessageCircleQuestion,
  website: Globe,
  context: Layers,
  "model-config": Settings,
  steps: ListOrdered,
};

export function ProvocationToolbox({
  activeApp,
  onAppChange,
  availableTabs,
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
  contextCollection,
  referenceDocuments,
  capturedContext,
  onCapturedContextChange,
  onDocumentPreview,
  modelConfig,
  onModelConfigChange,
  provokeMode = "challenge",
  customTabContent,
  inlineDiscussion,
  discussionProps,
  onMergeToDraft,
  isMergeToDraftPending,
}: ProvocationToolboxProps) {
  const hasCapturedContext = !!(capturedContext && capturedContext.length > 0);

  // Use config-driven tabs when available, otherwise fall back to all tabs
  const tabsToRender = availableTabs ?? [
    { id: "provoke" as const, label: "Provoke", description: "" },
    { id: "context" as const, label: "Context", description: "" },
    { id: "website" as const, label: "Website", description: "" },
  ];

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
        {/* App switcher tabs — driven by config */}
        <div className="flex items-center gap-1">
          {tabsToRender.map((tab) => {
            const Icon = LEFT_TAB_ICONS[tab.id] || Wrench;
            const isActive = activeApp === tab.id;
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={isActive ? "default" : "ghost"}
                    className="gap-1 text-xs h-7 px-2"
                    onClick={() => onAppChange(tab.id)}
                  >
                    <Icon className="w-3 h-3" />
                    {tab.label}
                    {tab.id === "context" && hasCapturedContext && (
                      <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                        {capturedContext!.length}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                {tab.description && (
                  <TooltipContent side="bottom" className="max-w-[260px]">
                    <p className="text-xs">{tab.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* App content */}
      <div className="flex-1 overflow-hidden">
        {customTabContent?.[activeApp] ? (
          customTabContent[activeApp]
        ) : activeApp === "provoke" ? (
          inlineDiscussion && discussionProps ? (
            <ProvokeWithDiscussion
              isInterviewActive={isInterviewActive}
              isMerging={isMerging}
              interviewEntryCount={interviewEntryCount}
              onStartInterview={onStartInterview}
              provokeMode={provokeMode}
              discussionProps={discussionProps}
              onMergeToDraft={onMergeToDraft}
              isMergeToDraftPending={isMergeToDraftPending}
            />
          ) : (
            <ProvokeConfigApp
              isInterviewActive={isInterviewActive}
              isMerging={isMerging}
              interviewEntryCount={interviewEntryCount}
              onStartInterview={onStartInterview}
              provokeMode={provokeMode}
            />
          )
        ) : activeApp === "model-config" && modelConfig && onModelConfigChange ? (
          <ModelConfigPanel config={modelConfig} onChange={onModelConfigChange} />
        ) : activeApp === "context" ? (
          <ContextTabContent
            contextCollection={contextCollection}
            referenceDocuments={referenceDocuments}
            capturedContext={capturedContext}
            onCapturedContextChange={onCapturedContextChange}
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

// ── Context Collection Preview (read-only markdown) ──

interface ContextCollectionPreviewProps {
  contextCollection?: {
    text: string;
    objective: string;
  } | null;
  referenceDocuments?: ReferenceDocument[];
}

function ContextCollectionPreview({
  contextCollection,
  referenceDocuments,
}: ContextCollectionPreviewProps) {
  if (!contextCollection) return null;

  return (
    <>
      {/* Objective */}
      {contextCollection.objective && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Objective
            </h4>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm font-serif leading-relaxed text-foreground">
              {contextCollection.objective}
            </p>
          </div>
        </div>
      )}

      {/* Source material */}
      {contextCollection.text && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Source Material
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {contextCollection.text.split(/\s+/).length} words
            </Badge>
          </div>
          <div className="rounded-lg border bg-card p-3 max-h-[400px] overflow-y-auto">
            <div className="text-sm font-serif leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {contextCollection.text}
            </div>
          </div>
        </div>
      )}

      {/* Reference documents */}
      {referenceDocuments && referenceDocuments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookText className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference Documents
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {referenceDocuments.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {referenceDocuments.map((doc) => (
              <div key={doc.id} className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{doc.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {doc.type}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                  {doc.content.slice(0, 500)}{doc.content.length > 500 ? "..." : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
        Read-only preview of context collected during the input phase.
      </p>
    </>
  );
}

// ── Domain metadata for grouping ──

const DOMAIN_META: { domain: PersonaDomain; label: string; color: string }[] = [
  { domain: "business", label: "Business", color: "text-amber-600 dark:text-amber-400" },
  { domain: "technology", label: "Technology", color: "text-cyan-600 dark:text-cyan-400" },
  { domain: "marketing", label: "Marketing", color: "text-rose-600 dark:text-rose-400" },
];

// ── Provoke Config App (extracted from InterviewPanel's setup mode) ──

interface ProvokeConfigAppProps {
  isInterviewActive: boolean;
  isMerging: boolean;
  interviewEntryCount: number;
  onStartInterview: (direction: {
    mode?: DirectionMode;
    personas: ProvocationType[];
    guidance?: string;
  }) => void;
  /** "challenge" = default provocation mode, "suggest" = personas suggest descriptions (text-to-infographic) */
  provokeMode?: "challenge" | "suggest";
}

function ProvokeConfigApp({
  isInterviewActive,
  isMerging,
  interviewEntryCount,
  onStartInterview,
  provokeMode = "challenge",
}: ProvokeConfigAppProps) {
  const isSuggestMode = provokeMode === "suggest";

  // Persona state — Think Big is selected by default
  const [selectedPersonas, setSelectedPersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["thinking_bigger"])
  );
  const [guidance, setGuidance] = useState("");
  const [isRecordingGuidance, setIsRecordingGuidance] = useState(false);

  // Domain accordion state — tracks which domains are expanded
  const [expandedDomains, setExpandedDomains] = useState<Set<PersonaDomain>>(
    () => new Set<PersonaDomain>()
  );

  const toggleDomain = useCallback((domain: PersonaDomain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const togglePersona = useCallback((type: ProvocationType) => {
    setSelectedPersonas(prev => {
      const next = new Set<ProvocationType>(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      // Auto-apply persona change to active interview
      if (isInterviewActive) {
        onStartInterview({
          mode: isSuggestMode ? "advise" : "challenge",
          personas: Array.from(next),
          guidance: guidance.trim() || undefined,
        });
      }
      return next;
    });
  }, [isInterviewActive, onStartInterview, guidance, isSuggestMode]);

  // Custom persona expanded state
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);

  // Count selected personas per domain
  const selectedCountByDomain = (domain: PersonaDomain) => {
    const domainPersonas = getPersonasByDomain(domain);
    return domainPersonas.filter(p => selectedPersonas.has(p.id as ProvocationType)).length;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-primary" />
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isSuggestMode ? "Suggest Personas" : "Personas"}
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px]">
              <p className="text-xs font-medium mb-1">
                {isSuggestMode ? "Choose experts to suggest descriptions" : "Choose your reviewers"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isSuggestMode
                  ? "Each persona suggests improvements to your infographic description from their expertise. Accept suggestions to refine your text."
                  : "Each persona brings a distinct professional lens to challenge your thinking. Select one or more to shape the interview questions around their expertise."}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Domain-grouped persona accordions */}
        <div className="space-y-1">
          {DOMAIN_META.map(({ domain, label, color }) => {
            const isExpanded = expandedDomains.has(domain);
            const domainPersonas = getPersonasByDomain(domain);
            const selectedCount = selectedCountByDomain(domain);

            return (
              <div key={domain} className="rounded-lg border bg-card overflow-hidden">
                {/* Domain header — click to expand/collapse */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => toggleDomain(domain)}
                >
                  <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {domainPersonas.length} personas
                  </span>
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="ml-auto h-4 min-w-[16px] px-1 text-[10px]">
                      {selectedCount}
                    </Badge>
                  )}
                </button>

                {/* Expanded persona list */}
                {isExpanded && (
                  <div className="px-3 pb-2 space-y-1">
                    {domainPersonas.map((persona) => {
                      const type = persona.id as ProvocationType;
                      const Icon = personaIcons[type] || Blocks;
                      const isSelected = selectedPersonas.has(type);

                      return (
                        <Tooltip key={type}>
                          <TooltipTrigger asChild>
                            <button
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                                isSelected
                                  ? "bg-primary/10 text-foreground"
                                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                              onClick={() => togglePersona(type)}
                            >
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : ""}`} />
                              <span className="font-medium">{persona.label}</span>
                              {isSelected && (
                                <Badge variant="default" className="ml-auto h-4 px-1 text-[9px]">
                                  {isSuggestMode ? "suggesting" : "active"}
                                </Badge>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs p-3 space-y-2">
                            <div className="font-semibold text-sm">{persona.label}</div>
                            <div className="text-xs text-muted-foreground">{persona.role}</div>
                            <div className="text-xs">{persona.description}</div>
                            <div className="border-t pt-2 mt-2 space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Challenges</div>
                              <div className="text-xs">{persona.summary?.challenge || "Identifies gaps and weaknesses"}</div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Advises</div>
                              <div className="text-xs">{persona.summary?.advice || "Provides actionable recommendations"}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Custom persona — opens guidance input */}
        <div className="space-y-2">
          <Button
            size="sm"
            variant={isCustomExpanded ? "default" : "outline"}
            className={`gap-1 text-xs h-7 px-2 w-full ${
              isCustomExpanded
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "opacity-70 border-indigo-300 dark:border-indigo-700 hover:opacity-100"
            }`}
            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
          >
            <Pencil className="w-3 h-3" />
            Custom Focus
          </Button>

          {isCustomExpanded && (
            <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
              <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-3 h-3" />
                Focus Area
              </label>
              <ProvokeText
                chrome="inline"
                placeholder={isSuggestMode
                  ? "e.g. 'Focus on data visualization clarity and color contrast'"
                  : "e.g. 'Push me on pricing strategy and unit economics'"}
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
        </div>

        {/* Selection summary */}
        <p className="text-xs text-muted-foreground">
          {selectedPersonas.size === 0 && !isCustomExpanded
            ? isSuggestMode
              ? "Select personas to get description suggestions from their expertise."
              : "Select personas to focus the interview, or leave empty for general questions."
            : `${selectedPersonas.size} persona${selectedPersonas.size > 1 ? "s" : ""} selected${isCustomExpanded ? " + Custom focus" : ""}`}
        </p>

        {/* Status info */}
        {isInterviewActive && (
          <p className="text-xs text-center text-muted-foreground">
            {isSuggestMode ? "Personas are suggesting — check the Discussion panel." : "Interview is active — check the Discussion panel."}
          </p>
        )}
        {!isInterviewActive && interviewEntryCount > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Previous session: {interviewEntryCount} questions answered
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

// ── Provoke + Inline Discussion (collapsible personas above InterviewPanel) ──

interface ProvokeWithDiscussionProps extends ProvokeConfigAppProps {
  discussionProps: NonNullable<ProvocationToolboxProps["discussionProps"]>;
  onMergeToDraft?: () => void;
  isMergeToDraftPending?: boolean;
}

function ProvokeWithDiscussion({
  isInterviewActive,
  isMerging,
  interviewEntryCount,
  onStartInterview,
  provokeMode = "challenge",
  discussionProps,
  onMergeToDraft,
  isMergeToDraftPending,
}: ProvokeWithDiscussionProps) {
  const isSuggestMode = provokeMode === "suggest";
  const [personasExpanded, setPersonasExpanded] = useState(true);

  // Persona state — Think Big is selected by default
  const [selectedPersonas, setSelectedPersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["thinking_bigger"])
  );
  const [guidance, setGuidance] = useState("");
  const [isRecordingGuidance, setIsRecordingGuidance] = useState(false);

  // Domain accordion state — tracks which domains are expanded
  const [expandedDomains, setExpandedDomains] = useState<Set<PersonaDomain>>(
    () => new Set<PersonaDomain>()
  );

  const toggleDomain = useCallback((domain: PersonaDomain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const togglePersona = useCallback((type: ProvocationType) => {
    setSelectedPersonas(prev => {
      const next = new Set<ProvocationType>(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      // Auto-apply persona change to active interview
      if (isInterviewActive) {
        onStartInterview({
          mode: isSuggestMode ? "advise" : "challenge",
          personas: Array.from(next),
          guidance: guidance.trim() || undefined,
        });
      }
      return next;
    });
  }, [isInterviewActive, onStartInterview, guidance, isSuggestMode]);

  // Custom persona expanded state
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);

  // Count selected personas per domain
  const selectedCountByDomain = (domain: PersonaDomain) => {
    const domainPersonas = getPersonasByDomain(domain);
    return domainPersonas.filter(p => selectedPersonas.has(p.id as ProvocationType)).length;
  };

  const hasDiscussionContent = discussionProps.entries.length > 0 || discussionProps.isActive;

  // Auto-collapse personas when the first discussion entry arrives
  const prevEntryCount = useRef(discussionProps.entries.length);
  useEffect(() => {
    if (prevEntryCount.current === 0 && discussionProps.entries.length > 0) {
      setPersonasExpanded(false);
    }
    prevEntryCount.current = discussionProps.entries.length;
  }, [discussionProps.entries.length]);

  return (
    <div className="h-full flex flex-col">
      {/* Collapsible Personas Section */}
      <div className={`shrink-0 border-b ${personasExpanded ? "" : ""}`}>
        <button
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setPersonasExpanded(!personasExpanded)}
        >
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${personasExpanded ? "rotate-90" : ""}`} />
          <UserCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isSuggestMode ? "Suggest Personas" : "Personas"}
          </span>
          {selectedPersonas.size > 0 && (
            <Badge variant="secondary" className="ml-auto h-4 min-w-[16px] px-1 text-[10px]">
              {selectedPersonas.size}
            </Badge>
          )}
        </button>

        {personasExpanded && (
          <div className="px-4 pb-3 space-y-3">
            {/* Domain-grouped persona accordions */}
            <div className="space-y-1">
              {DOMAIN_META.map(({ domain, label, color }) => {
                const isExpanded = expandedDomains.has(domain);
                const domainPersonas = getPersonasByDomain(domain);
                const selectedCount = selectedCountByDomain(domain);

                return (
                  <div key={domain} className="rounded-lg border bg-card overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => toggleDomain(domain)}
                    >
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
                        {label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {domainPersonas.length} personas
                      </span>
                      {selectedCount > 0 && (
                        <Badge variant="secondary" className="ml-auto h-4 min-w-[16px] px-1 text-[10px]">
                          {selectedCount}
                        </Badge>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 space-y-1">
                        {domainPersonas.map((persona) => {
                          const type = persona.id as ProvocationType;
                          const Icon = personaIcons[type] || Blocks;
                          const isSelected = selectedPersonas.has(type);

                          return (
                            <Tooltip key={type}>
                              <TooltipTrigger asChild>
                                <button
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-foreground"
                                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                  }`}
                                  onClick={() => togglePersona(type)}
                                >
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : ""}`} />
                                  <span className="font-medium">{persona.label}</span>
                                  {isSelected && (
                                    <Badge variant="default" className="ml-auto h-4 px-1 text-[9px]">
                                      {isSuggestMode ? "suggesting" : "active"}
                                    </Badge>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs p-3 space-y-2">
                                <div className="font-semibold text-sm">{persona.label}</div>
                                <div className="text-xs text-muted-foreground">{persona.role}</div>
                                <div className="text-xs">{persona.description}</div>
                                <div className="border-t pt-2 mt-2 space-y-1">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Challenges</div>
                                  <div className="text-xs">{persona.summary?.challenge || "Identifies gaps and weaknesses"}</div>
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Advises</div>
                                  <div className="text-xs">{persona.summary?.advice || "Provides actionable recommendations"}</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom focus */}
            <div className="space-y-2">
              <Button
                size="sm"
                variant={isCustomExpanded ? "default" : "outline"}
                className={`gap-1 text-xs h-7 px-2 w-full ${
                  isCustomExpanded
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "opacity-70 border-indigo-300 dark:border-indigo-700 hover:opacity-100"
                }`}
                onClick={() => setIsCustomExpanded(!isCustomExpanded)}
              >
                <Pencil className="w-3 h-3" />
                Custom Focus
              </Button>

              {isCustomExpanded && (
                <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                  <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Crosshair className="w-3 h-3" />
                    Focus Area
                  </label>
                  <ProvokeText
                    chrome="inline"
                    placeholder={isSuggestMode
                      ? "e.g. 'Focus on data visualization clarity and color contrast'"
                      : "e.g. 'Push me on pricing strategy and unit economics'"}
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
            </div>

            {/* Selection summary */}
            <p className="text-xs text-muted-foreground">
              {selectedPersonas.size === 0 && !isCustomExpanded
                ? "Select personas to focus the interview, or leave empty for general questions."
                : `${selectedPersonas.size} persona${selectedPersonas.size > 1 ? "s" : ""} selected${isCustomExpanded ? " + Custom focus" : ""}`}
            </p>
          </div>
        )}
      </div>

      {/* Discussion header bar */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b bg-muted/20 shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Discussion</span>
        {discussionProps.entries.length > 0 && (
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {discussionProps.entries.length}
          </Badge>
        )}
        <div className="flex-1" />
        {hasDiscussionContent && onMergeToDraft && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={onMergeToDraft}
            disabled={isMergeToDraftPending}
          >
            {isMergeToDraftPending ? (
              <>
                <Loader2Icon className="w-3 h-3 animate-spin" />
                Evolving...
              </>
            ) : (
              <>
                <ArrowRightToLine className="w-3 h-3" />
                Evolve Document
              </>
            )}
          </Button>
        )}
      </div>

      {/* Discussion content — takes remaining space */}
      <div className="flex-1 overflow-hidden">
        <InterviewPanel
          isActive={discussionProps.isActive}
          entries={discussionProps.entries}
          currentQuestion={discussionProps.currentQuestion}
          currentTopic={discussionProps.currentTopic}
          isLoadingQuestion={discussionProps.isLoadingQuestion}
          isMerging={discussionProps.isMerging}
          directionMode={discussionProps.directionMode}
          onAnswer={discussionProps.onAnswer}
          onEnd={discussionProps.onEnd}
          onViewAdvice={discussionProps.onViewAdvice}
          onDismissQuestion={discussionProps.onDismissQuestion}
          adviceText={discussionProps.adviceText}
          isLoadingAdvice={discussionProps.isLoadingAdvice}
          onAskQuestion={discussionProps.onAskQuestion}
          isLoadingAskResponse={discussionProps.isLoadingAskResponse}
          discussionMessages={discussionProps.discussionMessages}
          onAcceptResponse={discussionProps.onAcceptResponse}
          onDismissResponse={discussionProps.onDismissResponse}
          onRespondToMessage={discussionProps.onRespondToMessage}
        />
      </div>
    </div>
  );
}

// ── Combined Context Tab (collection preview + captured context items) ──

interface ContextTabContentProps {
  contextCollection?: {
    text: string;
    objective: string;
  } | null;
  referenceDocuments?: ReferenceDocument[];
  capturedContext?: ContextItem[];
  onCapturedContextChange?: (items: ContextItem[]) => void;
}

function ContextTabContent({
  contextCollection,
  referenceDocuments,
  capturedContext,
  onCapturedContextChange,
}: ContextTabContentProps) {
  const [showAddContextModal, setShowAddContextModal] = useState(false);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Add Context button — opens the global AddContextModal */}
        {capturedContext && onCapturedContextChange && (
          <>
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setShowAddContextModal(true)}
            >
              <Plus className="w-4 h-4" />
              Add Context
            </Button>

            <AddContextModal
              open={showAddContextModal}
              onOpenChange={setShowAddContextModal}
              items={capturedContext}
              onItemsChange={onCapturedContextChange}
            />
          </>
        )}

        {/* Captured context items (editable) */}
        {capturedContext && onCapturedContextChange && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Captured Context
              </h4>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]">
                  <p className="text-xs font-medium mb-1">Your supporting context</p>
                  <p className="text-xs text-muted-foreground">Text, images, and document links you captured on the landing page. They ground every AI interaction as reference material.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {capturedContext.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {capturedContext.length} item{capturedContext.length !== 1 ? "s" : ""} available as grounding context.
              </p>
            )}
            <ContextCapturePanel items={capturedContext} onItemsChange={onCapturedContextChange} onDocumentPreview={onDocumentPreview} />
          </div>
        )}

        {/* Context collection preview (read-only from input phase) */}
        {contextCollection && (
          <ContextCollectionPreview
            contextCollection={contextCollection}
            referenceDocuments={referenceDocuments}
          />
        )}

        {!contextCollection && (!capturedContext || capturedContext.length === 0) && (
          <div className="text-center space-y-2 py-8">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No context collected yet.</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

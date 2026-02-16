import { useState, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "./ProvokeText";
import { BrowserExplorer } from "./BrowserExplorer";
import { ContextCapturePanel } from "./ContextCapturePanel";
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
  Database,
  Crosshair,
  Globe,
  Wrench,
  Info,
  UserCircle,
  Pencil,
  Layers,
  FileText,
  Target,
} from "lucide-react";
import type { ProvocationType, DirectionMode, ContextItem, ReferenceDocument } from "@shared/schema";
import { builtInPersonas, getAllPersonas } from "@shared/personas";

// ── Toolbox app type ──

export type ToolboxApp = "provoke" | "website" | "context";

// ── Persona metadata (derived from centralized persona definitions) ──

const iconMap: Record<string, typeof Blocks> = {
  Blocks, ShieldCheck, Palette, BookText, Briefcase, Lock, Rocket, Database,
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

  // Context collection props (read-only preview)
  contextCollection?: {
    text: string;
    objective: string;
  } | null;
  referenceDocuments?: ReferenceDocument[];

  // Context app props (captured context items)
  capturedContext?: ContextItem[];
  onCapturedContextChange?: (items: ContextItem[]) => void;
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
  contextCollection,
  referenceDocuments,
  capturedContext,
  onCapturedContextChange,
}: ProvocationToolboxProps) {
  const hasContextCollection = !!(contextCollection?.text || contextCollection?.objective);
  const hasCapturedContext = !!(capturedContext && capturedContext.length > 0);
  const hasContext = hasContextCollection || hasCapturedContext;

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
          {hasContext && (
            <Button
              size="sm"
              variant={activeApp === "context" ? "default" : "ghost"}
              className="gap-1 text-xs h-7 px-2"
              onClick={() => onAppChange("context")}
            >
              <Layers className="w-3 h-3" />
              Context
              {hasCapturedContext && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                  {capturedContext!.length}
                </Badge>
              )}
            </Button>
          )}
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
  // Persona state — Think Big is selected by default
  const [selectedPersonas, setSelectedPersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["thinking_bigger"])
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
      // Auto-apply persona change to active interview
      if (isInterviewActive) {
        onStartInterview({
          mode: "challenge",
          personas: Array.from(next),
          guidance: guidance.trim() || undefined,
        });
      }
      return next;
    });
  }, [isInterviewActive, onStartInterview, guidance]);

  // Auto-apply persona/guidance changes to the active interview
  const applyDirection = useCallback(() => {
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
                            ? "bg-violet-600 hover:bg-violet-700 text-white"
                            : ""
                          : "opacity-50"
                      } ${isThinkBig && !isSelected ? "border-violet-300 dark:border-violet-700" : ""}`}
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

      {/* Status info */}
      <div className="px-4 pb-4">
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
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
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
            <ContextCapturePanel items={capturedContext} onItemsChange={onCapturedContextChange} />
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "./ProvokeText";
import {
  Check,
  X,
  Star,
  MessageSquareWarning,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Crosshair,
  SkipForward,
  Play,
  ChevronLeft,
  ChevronRight,
  Mic,
  Plus,
  Send,
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
  Zap,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { Provocation, ProvocationType } from "@shared/schema";
import { builtInPersonas } from "@shared/personas";

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

const personaBgColors: Record<ProvocationType, string> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, p.color.bg])
) as Record<ProvocationType, string>;

const personaLabels: Record<ProvocationType, string> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, p.label])
) as Record<ProvocationType, string>;

const personaDescriptions: Record<ProvocationType, { role: string; advice: string; challenge: string }> = Object.fromEntries(
  Object.entries(builtInPersonas).map(([id, p]) => [id, {
    role: p.role,
    advice: p.summary.advice,
    challenge: p.summary.challenge,
  }])
) as Record<ProvocationType, { role: string; advice: string; challenge: string }>;

// Re-export for TranscriptOverlay
export { personaIcons, personaColors, personaBgColors, personaLabels };

interface ProvocationsDisplayProps {
  provocations: Provocation[];
  onUpdateStatus: (id: string, status: Provocation["status"]) => void;
  onVoiceResponse?: (provocationId: string, transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onStartResponse?: (provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onAddToDocument?: (provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onSendToAuthor?: (provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onAcceptSuggestion?: (provocationId: string, suggestion: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onHoverProvocation?: (provocationId: string | null) => void;
  onRegenerateProvocations?: (guidance?: string, types?: ProvocationType[]) => void;
  isLoading?: boolean;
  isMerging?: boolean;
  isRegenerating?: boolean;
}

const scaleLabels: Record<number, string> = {
  1: "Minor",
  2: "Small",
  3: "Moderate",
  4: "Significant",
  5: "Critical",
};

const scaleColors: Record<number, string> = {
  1: "bg-slate-400/20 text-slate-600 dark:text-slate-400",
  2: "bg-blue-400/20 text-blue-600 dark:text-blue-400",
  3: "bg-amber-400/20 text-amber-600 dark:text-amber-400",
  4: "bg-orange-400/20 text-orange-600 dark:text-orange-400",
  5: "bg-red-400/20 text-red-600 dark:text-red-400",
};

function ScaleIndicator({ scale }: { scale?: number }) {
  if (!scale) return null;
  const label = scaleLabels[scale] || "Moderate";
  const colorClass = scaleColors[scale] || scaleColors[3];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`w-1 h-1 rounded-full ${i < scale ? "bg-current" : "bg-current/20"}`}
        />
      ))}
      {label}
    </span>
  );
}

function PersonaTooltip({ type, children }: { type: ProvocationType; children: React.ReactNode }) {
  const desc = personaDescriptions[type];
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs space-y-1.5 p-3">
        <p className="font-semibold text-sm">{personaLabels[type]}</p>
        <p className="text-xs text-muted-foreground">{desc.role}</p>
        <div className="text-xs space-y-0.5 pt-1 border-t">
          <p><span className="font-medium text-emerald-600 dark:text-emerald-400">Advice:</span> {desc.advice}</p>
          <p><span className="font-medium text-violet-600 dark:text-violet-400">Challenge:</span> {desc.challenge}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ProvocationCard({
  provocation,
  onUpdateStatus,
  onStartResponse,
  onAddToDocument,
  onSendToAuthor,
  onAcceptSuggestion,
  onHover,
  isMerging
}: {
  provocation: Provocation;
  onUpdateStatus: (status: Provocation["status"]) => void;
  onStartResponse?: (provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onAddToDocument?: (provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onSendToAuthor?: (provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onAcceptSuggestion?: (provocationId: string, suggestion: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onHover?: (isHovered: boolean) => void;
  isMerging?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSuggestionDismissed, setIsSuggestionDismissed] = useState(false);
  const Icon = personaIcons[provocation.type];
  const colorClass = personaColors[provocation.type];
  const bgClass = personaBgColors[provocation.type];

  const statusStyles: Record<Provocation["status"], string> = {
    pending: "",
    addressed: "opacity-60 border-emerald-300 dark:border-emerald-700",
    rejected: "opacity-40",
    highlighted: "ring-2 ring-primary",
  };

  const provData = {
    type: provocation.type,
    title: provocation.title,
    content: provocation.content,
    sourceExcerpt: provocation.sourceExcerpt,
  };

  return (
    <Card
      data-testid={`provocation-${provocation.id}`}
      className={`transition-all ${statusStyles[provocation.status]}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-start gap-2 text-base">
          <PersonaTooltip type={provocation.type}>
            <div className={`p-1.5 rounded-md ${bgClass} cursor-help`}>
              <Icon className={`w-4 h-4 ${colorClass}`} />
            </div>
          </PersonaTooltip>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PersonaTooltip type={provocation.type}>
                <Badge variant="outline" className={`text-xs ${colorClass} border-current cursor-help`}>
                  {personaLabels[provocation.type]}
                </Badge>
              </PersonaTooltip>
              <ScaleIndicator scale={provocation.scale} />
              {provocation.status !== "pending" && (
                <Badge
                  variant={provocation.status === "highlighted" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {provocation.status}
                </Badge>
              )}
            </div>
            <h4 className="font-medium mt-1.5 leading-snug">{provocation.title}</h4>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {/* Action buttons — Advice / Challenge / secondary actions */}
        {provocation.status === "pending" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-advice-${provocation.id}`}
                  size="sm"
                  variant="outline"
                  className={`gap-1 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 ${isMerging ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => onAddToDocument?.(provData)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Accept Advice
                </Button>
              </TooltipTrigger>
              <TooltipContent>Accept this persona's advice and incorporate it into your document</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-challenge-${provocation.id}`}
                  size="sm"
                  variant="outline"
                  className={`gap-1 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 ${isMerging ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => onStartResponse?.(provData)}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Challenge
                </Button>
              </TooltipTrigger>
              <TooltipContent>Push back — respond to this challenge with your own perspective</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-send-to-author-${provocation.id}`}
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => onSendToAuthor?.(provData)}
                >
                  <Send className="w-3.5 h-3.5" />
                  Note
                </Button>
              </TooltipTrigger>
              <TooltipContent>Append as a note in the document for later</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-highlight-${provocation.id}`}
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => onUpdateStatus("highlighted")}
                >
                  <Star className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Highlight as important</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-address-${provocation.id}`}
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => onUpdateStatus("addressed")}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark as addressed</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-reject-${provocation.id}`}
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={() => onUpdateStatus("rejected")}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed">
          {provocation.content}
        </p>

        {/* Auto-suggestion — AI-generated response the user can accept or dismiss */}
        {provocation.autoSuggestion && provocation.status === "pending" && !isSuggestionDismissed && (
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Suggested Response
              </span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed italic">
              "{provocation.autoSuggestion}"
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs h-7 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                onClick={() => onAcceptSuggestion?.(provocation.id, provocation.autoSuggestion!, provData)}
                disabled={isMerging}
              >
                <Check className="w-3 h-3" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs h-7 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/40"
                onClick={() => {
                  setIsSuggestionDismissed(true);
                  onStartResponse?.(provData);
                }}
                disabled={isMerging}
              >
                <Mic className="w-3 h-3" />
                Respond Instead
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs h-7 text-muted-foreground"
                onClick={() => setIsSuggestionDismissed(true)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {provocation.sourceExcerpt && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-toggle-excerpt-${provocation.id}`}
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isExpanded ? "Hide source excerpt" : "View source excerpt"}
          </button>
        )}

        {isExpanded && provocation.sourceExcerpt && (
          <div className="p-3 rounded-md bg-muted/50 border-l-2 border-muted-foreground/30">
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "{provocation.sourceExcerpt}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Focused view for resolving provocations one at a time */
function FocusMode({
  provocations,
  onStartResponse,
  onAddToDocument,
  onSendToAuthor,
  onUpdateStatus,
  onExit,
  isMerging,
}: {
  provocations: Provocation[];
  onStartResponse?: (provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onAddToDocument?: (provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onSendToAuthor?: (provocationId: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onUpdateStatus: (id: string, status: Provocation["status"]) => void;
  onExit: () => void;
  isMerging?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pending = provocations.filter(p => p.status === "pending");

  if (pending.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">All Feedback Resolved</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          You've addressed all pending feedback. Generate more challenges to keep improving.
        </p>
        <Button onClick={onExit} variant="outline" className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back to List
        </Button>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, pending.length - 1);
  const current = pending[safeIndex];
  const Icon = personaIcons[current.type];
  const colorClass = personaColors[current.type];
  const bgClass = personaBgColors[current.type];

  const goNext = () => {
    if (safeIndex < pending.length - 1) {
      setCurrentIndex(safeIndex + 1);
    }
  };

  const goPrev = () => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
    }
  };

  const provData = {
    type: current.type,
    title: current.title,
    content: current.content,
    sourceExcerpt: current.sourceExcerpt,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button onClick={onExit} variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <span className="text-sm text-muted-foreground">
            {safeIndex + 1} of {pending.length} remaining
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button onClick={goPrev} variant="ghost" size="icon" className="h-8 w-8" disabled={safeIndex === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={goNext} variant="ghost" size="icon" className="h-8 w-8" disabled={safeIndex >= pending.length - 1}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Current provocation */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <PersonaTooltip type={current.type}>
          <div className={`p-3 rounded-xl ${bgClass} mb-4 cursor-help`}>
            <Icon className={`w-8 h-8 ${colorClass}`} />
          </div>
        </PersonaTooltip>
        <div className="flex items-center gap-2 mb-3">
          <PersonaTooltip type={current.type}>
            <Badge variant="outline" className={`text-xs ${colorClass} border-current cursor-help`}>
              {personaLabels[current.type]}
            </Badge>
          </PersonaTooltip>
          <ScaleIndicator scale={current.scale} />
        </div>
        <h3 className="text-xl font-semibold text-center mb-3 max-w-md">{current.title}</h3>
        <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-lg mb-6">
          {current.content}
        </p>

        {current.sourceExcerpt && (
          <div className="p-3 rounded-md bg-muted/50 border-l-2 border-muted-foreground/30 mb-6 max-w-md">
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "{current.sourceExcerpt}"
            </p>
          </div>
        )}

        {/* Response actions — Advice / Challenge */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              size="default"
              variant="outline"
              className={`gap-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 ${isMerging ? "opacity-50 pointer-events-none" : ""}`}
              onClick={() => onAddToDocument?.(current.id, provData)}
            >
              <Plus className="w-4 h-4" />
              Accept Advice
            </Button>
            <Button
              size="default"
              variant="outline"
              className={`gap-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 ${isMerging ? "opacity-50 pointer-events-none" : ""}`}
              onClick={() => onStartResponse?.(current.id, provData)}
            >
              <Mic className="w-4 h-4" />
              Challenge
            </Button>
            <Button
              size="default"
              variant="outline"
              className="gap-2"
              onClick={() => onSendToAuthor?.(current.id, provData)}
            >
              <Send className="w-4 h-4" />
              Note
            </Button>
          </div>
        </div>

        {/* Skip / mark addressed */}
        <div className="flex items-center gap-2 mt-6">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => onUpdateStatus(current.id, "addressed")}
          >
            <Check className="w-3.5 h-3.5" />
            Mark Addressed
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-muted-foreground"
            onClick={() => onUpdateStatus(current.id, "rejected")}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-1.5">
          {pending.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx === safeIndex
                  ? "bg-primary"
                  : idx < safeIndex
                  ? "bg-primary/30"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProvocationsDisplay({ provocations, onUpdateStatus, onVoiceResponse, onStartResponse, onAddToDocument, onSendToAuthor, onAcceptSuggestion, onTranscriptUpdate, onHoverProvocation, onRegenerateProvocations, isLoading, isMerging, isRegenerating }: ProvocationsDisplayProps) {
  const [viewFilter, setViewFilter] = useState<ProvocationType | "all">("all");
  const [guidance, setGuidance] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Persona selection for which types to generate (empty by default — user opts in)
  const [selectedTypes, setSelectedTypes] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>()
  );

  const safeProvocations = provocations ?? [];

  const filteredProvocations = viewFilter === "all"
    ? safeProvocations
    : safeProvocations.filter((p) => p.type === viewFilter);

  const pendingCount = safeProvocations.filter((p) => p.status === "pending").length;
  const highlightedCount = safeProvocations.filter((p) => p.status === "highlighted").length;

  const toggleType = useCallback((type: ProvocationType) => {
    setSelectedTypes(prev => {
      const next = new Set<ProvocationType>(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const types = Array.from(selectedTypes) as ProvocationType[];
    onRegenerateProvocations?.(guidance || undefined, types);
    setGuidance("");
  }, [guidance, selectedTypes, onRegenerateProvocations]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquareWarning className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Consulting Personas...</h3>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-5 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    );
  }

  if (safeProvocations.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {onRegenerateProvocations && (
          <ChallengeInput
            guidance={guidance}
            setGuidance={setGuidance}
            isRegenerating={isRegenerating}
            selectedTypes={selectedTypes}
            toggleType={toggleType}
            onGenerate={handleGenerate}
          />
        )}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <MessageSquareWarning className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <h3 className="font-medium text-muted-foreground">No Feedback Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Select personas above and generate feedback to get expert perspectives on your document.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Focus mode: one-by-one
  if (isFocusMode) {
    const focusProvocations = safeProvocations.filter(p => selectedTypes.has(p.type));
    return (
      <FocusMode
        provocations={focusProvocations}
        onStartResponse={onStartResponse}
        onAddToDocument={onAddToDocument}
        onSendToAuthor={onSendToAuthor}
        onUpdateStatus={onUpdateStatus}
        onExit={() => setIsFocusMode(false)}
        isMerging={isMerging}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Challenge Input */}
      {onRegenerateProvocations && (
        <ChallengeInput
          guidance={guidance}
          setGuidance={setGuidance}
          isRegenerating={isRegenerating}
          selectedTypes={selectedTypes}
          toggleType={toggleType}
          onGenerate={handleGenerate}
        />
      )}

      {/* Header with counts and focus mode */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <h3 className="font-semibold text-sm">Persona Feedback</h3>
        <div className="flex items-center gap-2 ml-auto">
          {pendingCount > 0 && (
            <>
              <Badge variant="outline" className="text-xs">{pendingCount} pending</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => setIsFocusMode(true)}
                  >
                    <Play className="w-3 h-3" />
                    Resolve 1-by-1
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Address feedback one at a time</TooltipContent>
              </Tooltip>
            </>
          )}
          {highlightedCount > 0 && (
            <Badge className="text-xs">{highlightedCount} highlighted</Badge>
          )}
        </div>
      </div>

      {/* Persona filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 flex-wrap">
        <Button
          data-testid="filter-all"
          size="sm"
          variant={viewFilter === "all" ? "default" : "ghost"}
          className="text-xs h-7 px-2"
          onClick={() => setViewFilter("all")}
        >
          All
        </Button>
        {(["thinking_bigger", "ceo", "architect", "quality_engineer", "ux_designer", "tech_writer", "product_manager", "security_engineer"] as ProvocationType[]).map((type) => {
          const Icon = personaIcons[type];
          const count = safeProvocations.filter((p) => p.type === type).length;
          if (count === 0) return null;
          return (
            <PersonaTooltip key={type} type={type}>
              <Button
                data-testid={`filter-${type}`}
                size="sm"
                variant={viewFilter === type ? "default" : "ghost"}
                className="gap-1 text-xs h-7 px-2"
                onClick={() => setViewFilter(type)}
              >
                <Icon className="w-3 h-3" />
                {personaLabels[type]}
                <span className="opacity-70">({count})</span>
              </Button>
            </PersonaTooltip>
          );
        })}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredProvocations.map((provocation) => (
            <ProvocationCard
              key={provocation.id}
              provocation={provocation}
              onUpdateStatus={(status) => onUpdateStatus(provocation.id, status)}
              onStartResponse={(provocationData) => onStartResponse?.(provocation.id, provocationData)}
              onAddToDocument={(provocationData) => onAddToDocument?.(provocation.id, provocationData)}
              onSendToAuthor={(provocationData) => onSendToAuthor?.(provocation.id, provocationData)}
              onAcceptSuggestion={onAcceptSuggestion}
              onHover={(isHovered) => onHoverProvocation?.(isHovered ? provocation.id : null)}
              isMerging={isMerging}
            />
          ))}
          {filteredProvocations.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No {viewFilter === "all" ? "" : personaLabels[viewFilter as ProvocationType].toLowerCase() + " "}feedback yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Challenge input area — select personas and generate feedback */
function ChallengeInput({
  guidance,
  setGuidance,
  isRegenerating,
  selectedTypes,
  toggleType,
  onGenerate,
}: {
  guidance: string;
  setGuidance: (v: string) => void;
  isRegenerating?: boolean;
  selectedTypes: Set<ProvocationType>;
  toggleType: (type: ProvocationType) => void;
  onGenerate: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="border-b bg-muted/20 p-4 space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Challenge Me On...
          </label>
        </div>
        <ProvokeText
          chrome="inline"
          placeholder="e.g. 'Push me on pricing strategy' or 'Find gaps in my competitive analysis'"
          value={guidance}
          onChange={setGuidance}
          className="text-sm"
          minRows={2}
          maxRows={4}
          disabled={isRegenerating}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onGenerate();
            }
          }}
          voice={{ mode: "replace" }}
          onVoiceTranscript={(transcript) => setGuidance(transcript)}
          onRecordingChange={setIsRecording}
        />
        {isRecording && (
          <p className="text-xs text-primary animate-pulse">Listening... describe the direction for your challenges</p>
        )}
        {/* Persona toggles */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["thinking_bigger", "ceo", "architect", "quality_engineer", "ux_designer", "tech_writer", "product_manager", "security_engineer"] as ProvocationType[]).map((type) => {
            const Icon = personaIcons[type];
            const isSelected = selectedTypes.has(type);
            return (
              <PersonaTooltip key={type} type={type}>
                <Button
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={`gap-1 text-xs h-6 px-1.5 ${isSelected ? "" : "opacity-50"}`}
                  onClick={() => toggleType(type)}
                >
                  <Icon className="w-3 h-3" />
                  {personaLabels[type]}
                </Button>
              </PersonaTooltip>
            );
          })}
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={onGenerate}
        disabled={isRegenerating}
        size="sm"
        className="w-full gap-1.5"
      >
        {isRegenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        {isRegenerating ? "Generating..." : "Get Feedback"}
      </Button>
    </div>
  );
}

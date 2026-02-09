import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoiceRecorder } from "./VoiceRecorder";
import { Textarea } from "@/components/ui/textarea";
import {
  Lightbulb,
  AlertTriangle,
  GitBranch,
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
} from "lucide-react";
import { useState, useCallback } from "react";
import type { Provocation, ProvocationType } from "@shared/schema";

const provocationIcons: Record<ProvocationType, typeof Lightbulb> = {
  opportunity: Lightbulb,
  fallacy: AlertTriangle,
  alternative: GitBranch,
  challenge: Crosshair,
};

const provocationColors: Record<ProvocationType, string> = {
  opportunity: "text-emerald-600 dark:text-emerald-400",
  fallacy: "text-amber-600 dark:text-amber-400",
  alternative: "text-blue-600 dark:text-blue-400",
  challenge: "text-violet-600 dark:text-violet-400",
};

const provocationBgColors: Record<ProvocationType, string> = {
  opportunity: "bg-emerald-50 dark:bg-emerald-950/30",
  fallacy: "bg-amber-50 dark:bg-amber-950/30",
  alternative: "bg-blue-50 dark:bg-blue-950/30",
  challenge: "bg-violet-50 dark:bg-violet-950/30",
};

const provocationLabels: Record<ProvocationType, string> = {
  opportunity: "Opportunity",
  fallacy: "Fallacy",
  alternative: "Alternative",
  challenge: "Challenge",
};

interface ProvocationsDisplayProps {
  provocations: Provocation[];
  onUpdateStatus: (id: string, status: Provocation["status"]) => void;
  onVoiceResponse?: (provocationId: string, transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onHoverProvocation?: (provocationId: string | null) => void;
  onRegenerateProvocations?: (guidance?: string, types?: ProvocationType[]) => void;
  isLoading?: boolean;
  isMerging?: boolean;
  isRegenerating?: boolean;
}

function ProvocationCard({
  provocation,
  onUpdateStatus,
  onVoiceResponse,
  onTranscriptUpdate,
  onHover,
  isMerging
}: {
  provocation: Provocation;
  onUpdateStatus: (status: Provocation["status"]) => void;
  onVoiceResponse?: (transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onHover?: (isHovered: boolean) => void;
  isMerging?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = provocationIcons[provocation.type];
  const colorClass = provocationColors[provocation.type];
  const bgClass = provocationBgColors[provocation.type];

  const statusStyles: Record<Provocation["status"], string> = {
    pending: "",
    addressed: "opacity-60 border-emerald-300 dark:border-emerald-700",
    rejected: "opacity-40",
    highlighted: "ring-2 ring-primary",
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
          <div className={`p-1.5 rounded-md ${bgClass}`}>
            <Icon className={`w-4 h-4 ${colorClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${colorClass} border-current`}>
                {provocationLabels[provocation.type]}
              </Badge>
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
        {/* Action buttons at top - before content */}
        {provocation.status === "pending" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex">
                  <VoiceRecorder
                    onTranscript={(transcript) => {
                      onVoiceResponse?.(transcript, {
                        type: provocation.type,
                        title: provocation.title,
                        content: provocation.content,
                        sourceExcerpt: provocation.sourceExcerpt,
                      });
                    }}
                    onInterimTranscript={(interim) => onTranscriptUpdate?.(interim, true)}
                    onRecordingChange={(isRecording) => {
                      onTranscriptUpdate?.("", isRecording);
                    }}
                    size="sm"
                    variant="outline"
                    label="Respond"
                    className={`gap-1 ${isMerging ? "opacity-50 pointer-events-none" : ""}`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>Respond with your voice to integrate feedback</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={`button-highlight-${provocation.id}`}
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => onUpdateStatus("highlighted")}
                >
                  <Star className="w-3.5 h-3.5" />
                  Highlight
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark as important for your outline</TooltipContent>
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
                  Addressed
                </Button>
              </TooltipTrigger>
              <TooltipContent>You've considered this point</TooltipContent>
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
                  Dismiss
                </Button>
              </TooltipTrigger>
              <TooltipContent>This doesn't apply to your work</TooltipContent>
            </Tooltip>
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed">
          {provocation.content}
        </p>

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

/** Focused view for resolving provocations one at a time via voice */
function FocusMode({
  provocations,
  onVoiceResponse,
  onTranscriptUpdate,
  onUpdateStatus,
  onExit,
  isMerging,
}: {
  provocations: Provocation[];
  onVoiceResponse?: (provocationId: string, transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
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
        <h3 className="text-lg font-semibold mb-2">All Provocations Resolved</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          You've addressed all pending provocations. Generate more challenges to keep improving.
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
  const Icon = provocationIcons[current.type];
  const colorClass = provocationColors[current.type];
  const bgClass = provocationBgColors[current.type];

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
        <div className={`p-3 rounded-xl ${bgClass} mb-4`}>
          <Icon className={`w-8 h-8 ${colorClass}`} />
        </div>
        <Badge variant="outline" className={`text-xs mb-3 ${colorClass} border-current`}>
          {provocationLabels[current.type]}
        </Badge>
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

        {/* Voice response area */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">Respond with your voice to address this</p>
          <div className="flex items-center gap-3">
            <VoiceRecorder
              onTranscript={(transcript) => {
                onVoiceResponse?.(current.id, transcript, {
                  type: current.type,
                  title: current.title,
                  content: current.content,
                  sourceExcerpt: current.sourceExcerpt,
                });
                // Auto-advance after responding
                setTimeout(() => {
                  if (safeIndex < pending.length - 1) {
                    setCurrentIndex(safeIndex + 1);
                  }
                }, 500);
              }}
              onInterimTranscript={(interim) => onTranscriptUpdate?.(interim, true)}
              onRecordingChange={(isRecording) => {
                onTranscriptUpdate?.("", isRecording);
              }}
              size="lg"
              variant="outline"
              className={`h-14 w-14 rounded-full ${isMerging ? "opacity-50 pointer-events-none" : ""}`}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-6">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => {
              onUpdateStatus(current.id, "addressed");
              // Stay at same index (next pending will slide in)
            }}
          >
            <Check className="w-3.5 h-3.5" />
            Mark Addressed
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-muted-foreground"
            onClick={() => {
              onUpdateStatus(current.id, "rejected");
            }}
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

export function ProvocationsDisplay({ provocations, onUpdateStatus, onVoiceResponse, onTranscriptUpdate, onHoverProvocation, onRegenerateProvocations, isLoading, isMerging, isRegenerating }: ProvocationsDisplayProps) {
  const [viewFilter, setViewFilter] = useState<ProvocationType | "all">("all");
  const [guidance, setGuidance] = useState("");
  const [guidanceInterim, setGuidanceInterim] = useState("");
  const [isRecordingGuidance, setIsRecordingGuidance] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Type selection for which provocation types to generate/answer
  const [selectedTypes, setSelectedTypes] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>(["opportunity", "fallacy", "alternative", "challenge"])
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
        // Don't allow deselecting all
        if (next.size > 1) next.delete(type);
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
          <h3 className="font-semibold">Generating Provocations...</h3>
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
        {/* Challenge input even when empty */}
        {onRegenerateProvocations && (
          <ChallengeInput
            guidance={guidance}
            setGuidance={setGuidance}
            guidanceInterim={guidanceInterim}
            setGuidanceInterim={setGuidanceInterim}
            isRecordingGuidance={isRecordingGuidance}
            setIsRecordingGuidance={setIsRecordingGuidance}
            isRegenerating={isRegenerating}
            selectedTypes={selectedTypes}
            toggleType={toggleType}
            onGenerate={handleGenerate}
          />
        )}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <MessageSquareWarning className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <h3 className="font-medium text-muted-foreground">No Provocations Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Use the challenge input above to generate thought-provoking insights targeted at your document.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Focus mode: one-by-one voice interview
  if (isFocusMode) {
    // Filter to selected types for focus mode
    const focusProvocations = safeProvocations.filter(p => selectedTypes.has(p.type));
    return (
      <FocusMode
        provocations={focusProvocations}
        onVoiceResponse={onVoiceResponse}
        onTranscriptUpdate={onTranscriptUpdate}
        onUpdateStatus={onUpdateStatus}
        onExit={() => setIsFocusMode(false)}
        isMerging={isMerging}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Challenge Input - prominent at top */}
      {onRegenerateProvocations && (
        <ChallengeInput
          guidance={guidance}
          setGuidance={setGuidance}
          guidanceInterim={guidanceInterim}
          setGuidanceInterim={setGuidanceInterim}
          isRecordingGuidance={isRecordingGuidance}
          setIsRecordingGuidance={setIsRecordingGuidance}
          isRegenerating={isRegenerating}
          selectedTypes={selectedTypes}
          toggleType={toggleType}
          onGenerate={handleGenerate}
        />
      )}

      {/* Provocations header with counts and focus mode */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <h3 className="font-semibold text-sm">Provocations</h3>
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
                <TooltipContent>Address provocations one at a time via voice</TooltipContent>
              </Tooltip>
            </>
          )}
          {highlightedCount > 0 && (
            <Badge className="text-xs">{highlightedCount} highlighted</Badge>
          )}
        </div>
      </div>

      {/* View filter tabs */}
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
        {(["challenge", "fallacy", "alternative", "opportunity"] as ProvocationType[]).map((type) => {
          const Icon = provocationIcons[type];
          const count = safeProvocations.filter((p) => p.type === type).length;
          if (count === 0 && type !== "challenge") return null;
          return (
            <Button
              key={type}
              data-testid={`filter-${type}`}
              size="sm"
              variant={viewFilter === type ? "default" : "ghost"}
              className="gap-1 text-xs h-7 px-2"
              onClick={() => setViewFilter(type)}
            >
              <Icon className="w-3 h-3" />
              {provocationLabels[type]}
              {count > 0 && <span className="opacity-70">({count})</span>}
            </Button>
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
              onVoiceResponse={(transcript, provocationData) => onVoiceResponse?.(provocation.id, transcript, provocationData)}
              onTranscriptUpdate={onTranscriptUpdate}
              onHover={(isHovered) => onHoverProvocation?.(isHovered ? provocation.id : null)}
              isMerging={isMerging}
            />
          ))}
          {filteredProvocations.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No {viewFilter === "all" ? "" : provocationLabels[viewFilter as ProvocationType].toLowerCase() + " "}provocations yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Challenge input area - prominent at top of the provocations panel */
function ChallengeInput({
  guidance,
  setGuidance,
  guidanceInterim,
  setGuidanceInterim,
  isRecordingGuidance,
  setIsRecordingGuidance,
  isRegenerating,
  selectedTypes,
  toggleType,
  onGenerate,
}: {
  guidance: string;
  setGuidance: (v: string) => void;
  guidanceInterim: string;
  setGuidanceInterim: (v: string) => void;
  isRecordingGuidance: boolean;
  setIsRecordingGuidance: (v: boolean) => void;
  isRegenerating?: boolean;
  selectedTypes: Set<ProvocationType>;
  toggleType: (type: ProvocationType) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="border-b bg-muted/20 p-4 space-y-3">
      {/* Challenge input with type toggles integrated */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Challenge Me On...
            </label>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(["challenge", "fallacy", "alternative", "opportunity"] as ProvocationType[]).map((type) => {
              const Icon = provocationIcons[type];
              const isSelected = selectedTypes.has(type);
              return (
                <Button
                  key={type}
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={`gap-1 text-xs h-6 px-1.5 ${isSelected ? "" : "opacity-50"}`}
                  onClick={() => toggleType(type)}
                >
                  <Icon className="w-3 h-3" />
                  {provocationLabels[type]}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Textarea
            placeholder="e.g. 'Push me on pricing strategy' or 'Find gaps in my competitive analysis'"
            value={isRecordingGuidance ? guidanceInterim || guidance : guidance}
            onChange={(e) => setGuidance(e.target.value)}
            className="flex-1 text-sm min-h-[60px] max-h-[100px] resize-none"
            readOnly={isRecordingGuidance}
            disabled={isRegenerating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onGenerate();
              }
            }}
          />
          <VoiceRecorder
            onTranscript={(transcript) => {
              setGuidance(transcript);
              setGuidanceInterim("");
            }}
            onInterimTranscript={setGuidanceInterim}
            onRecordingChange={setIsRecordingGuidance}
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
          />
        </div>
        {isRecordingGuidance && (
          <p className="text-xs text-primary animate-pulse">Listening... describe the direction for your challenges</p>
        )}
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
        {isRegenerating ? "Generating..." : "Generate Challenges"}
      </Button>
    </div>
  );
}

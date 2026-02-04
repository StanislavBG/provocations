import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoiceRecorder } from "./VoiceRecorder";
import { 
  Lightbulb, 
  AlertTriangle, 
  GitBranch, 
  Check, 
  X, 
  Star,
  MessageSquareWarning,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState } from "react";
import type { Provocation, ProvocationType } from "@shared/schema";

const provocationIcons: Record<ProvocationType, typeof Lightbulb> = {
  opportunity: Lightbulb,
  fallacy: AlertTriangle,
  alternative: GitBranch,
};

const provocationColors: Record<ProvocationType, string> = {
  opportunity: "text-emerald-600 dark:text-emerald-400",
  fallacy: "text-amber-600 dark:text-amber-400",
  alternative: "text-blue-600 dark:text-blue-400",
};

const provocationBgColors: Record<ProvocationType, string> = {
  opportunity: "bg-emerald-50 dark:bg-emerald-950/30",
  fallacy: "bg-amber-50 dark:bg-amber-950/30",
  alternative: "bg-blue-50 dark:bg-blue-950/30",
};

const provocationLabels: Record<ProvocationType, string> = {
  opportunity: "Opportunity",
  fallacy: "Fallacy",
  alternative: "Alternative",
};

interface ProvocationsDisplayProps {
  provocations: Provocation[];
  onUpdateStatus: (id: string, status: Provocation["status"]) => void;
  onVoiceResponse?: (provocationId: string, transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
  onHoverProvocation?: (provocationId: string | null) => void;
  isLoading?: boolean;
  isMerging?: boolean;
}

function ProvocationCard({
  provocation,
  onUpdateStatus,
  onVoiceResponse,
  onHover,
  isMerging
}: {
  provocation: Provocation;
  onUpdateStatus: (status: Provocation["status"]) => void;
  onVoiceResponse?: (transcript: string, provocationData: { type: string; title: string; content: string; sourceExcerpt: string }) => void;
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

        {provocation.status === "pending" && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <VoiceRecorder
                    onTranscript={(transcript) => {
                      onVoiceResponse?.(transcript, {
                        type: provocation.type,
                        title: provocation.title,
                        content: provocation.content,
                        sourceExcerpt: provocation.sourceExcerpt,
                      });
                    }}
                    size="sm"
                    variant="outline"
                    className={isMerging ? "opacity-50 pointer-events-none" : ""}
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
      </CardContent>
    </Card>
  );
}

export function ProvocationsDisplay({ provocations, onUpdateStatus, onVoiceResponse, onHoverProvocation, isLoading, isMerging }: ProvocationsDisplayProps) {
  const [filter, setFilter] = useState<ProvocationType | "all">("all");
  
  const safeProvocations = provocations ?? [];
  
  const filteredProvocations = filter === "all" 
    ? safeProvocations 
    : safeProvocations.filter((p) => p.type === filter);

  const pendingCount = safeProvocations.filter((p) => p.status === "pending").length;
  const highlightedCount = safeProvocations.filter((p) => p.status === "highlighted").length;

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
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <MessageSquareWarning className="w-12 h-12 text-muted-foreground/50 mx-auto" />
          <h3 className="font-medium text-muted-foreground">No Provocations Yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Analyze your text to generate thought-provoking insights and challenges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b flex-wrap">
        <MessageSquareWarning className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Provocations</h3>
        <div className="flex items-center gap-2 ml-auto">
          {pendingCount > 0 && (
            <Badge variant="outline">{pendingCount} pending</Badge>
          )}
          {highlightedCount > 0 && (
            <Badge>{highlightedCount} highlighted</Badge>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-4 pb-2 flex-wrap">
        <Button
          data-testid="filter-all"
          size="sm"
          variant={filter === "all" ? "default" : "ghost"}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        {(["opportunity", "fallacy", "alternative"] as ProvocationType[]).map((type) => {
          const Icon = provocationIcons[type];
          const count = safeProvocations.filter((p) => p.type === type).length;
          return (
            <Button
              key={type}
              data-testid={`filter-${type}`}
              size="sm"
              variant={filter === type ? "default" : "ghost"}
              className="gap-1"
              onClick={() => setFilter(type)}
            >
              <Icon className="w-3.5 h-3.5" />
              {provocationLabels[type]}
              <span className="text-xs opacity-70">({count})</span>
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
              onHover={(isHovered) => onHoverProvocation?.(isHovered ? provocation.id : null)}
              isMerging={isMerging}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

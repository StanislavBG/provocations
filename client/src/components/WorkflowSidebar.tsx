import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "./ProvokeText";
import {
  Mic,
  Pencil,
  Sparkles,
  Target,
  FileText,
  Blocks,
  Palette,
  Scale,
  Compass,
  AlertTriangle,
  GitCompare,
  ArrowRight,
  User,
  ChevronRight,
} from "lucide-react";
import type { Workflow } from "@/lib/workflows";
import { getForYouWorkflows, useCaseWorkflows } from "@/lib/workflows";

// Icon map for workflow icons
const workflowIconMap: Record<string, typeof Sparkles> = {
  Sparkles,
  Target,
  FileText,
  Blocks,
  Palette,
  Scale,
  Compass,
  AlertTriangle,
  GitCompare,
};

interface WorkflowSidebarProps {
  userRole?: string;
  userName?: string;
  onWorkflowSelect: (workflow: Workflow) => void;
  onFreeformSubmit: (text: string) => void;
  activeWorkflowId?: string;
}

export function WorkflowSidebar({
  userRole,
  userName,
  onWorkflowSelect,
  onFreeformSubmit,
  activeWorkflowId,
}: WorkflowSidebarProps) {
  const [inputText, setInputText] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [isRecording, setIsRecording] = useState(false);

  const forYouWorkflows = getForYouWorkflows(userRole);

  const handleSubmit = useCallback(() => {
    if (inputText.trim()) {
      onFreeformSubmit(inputText.trim());
      setInputText("");
    }
  }, [inputText, onFreeformSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Sidebar Header */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-sidebar-foreground">Provocations</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* ── Section 1: Question Input ── */}
          <div className="space-y-3">
            <h3 className="font-serif text-base leading-snug text-sidebar-foreground">
              What are you working on today?
            </h3>
            <div className="relative">
              <ProvokeText
                chrome="inline"
                variant="textarea"
                placeholder="Describe your task, idea, or challenge..."
                value={inputText}
                onChange={setInputText}
                className="text-sm pr-16"
                minRows={2}
                maxRows={5}
                voice={{ mode: "replace" }}
                onVoiceTranscript={(transcript) => {
                  setInputText(transcript);
                  setIsRecording(false);
                }}
                onRecordingChange={setIsRecording}
              />
              {/* Action buttons inside input area */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                {inputText.trim() && (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
                    onClick={handleSubmit}
                  >
                    <ArrowRight className="w-3 h-3" />
                    Go
                  </Button>
                )}
              </div>
            </div>
            {isRecording && (
              <p className="text-xs text-primary animate-pulse">Listening...</p>
            )}
          </div>

          {/* ── Section 2: For You ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                For You
              </h3>
              {userRole && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {userRole}
                </Badge>
              )}
            </div>
            {userName && (
              <p className="text-xs text-muted-foreground">
                Suggested based on your role and recent activity.
              </p>
            )}
            <div className="space-y-1.5">
              {forYouWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  isActive={workflow.id === activeWorkflowId}
                  onSelect={onWorkflowSelect}
                />
              ))}
            </div>
          </div>

          {/* ── Section 3: Use Cases ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Use Cases
              </h3>
            </div>
            <div className="space-y-1.5">
              {useCaseWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  isActive={workflow.id === activeWorkflowId}
                  onSelect={onWorkflowSelect}
                />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Workflow Card ──

interface WorkflowCardProps {
  workflow: Workflow;
  isActive: boolean;
  onSelect: (workflow: Workflow) => void;
}

function WorkflowCard({ workflow, isActive, onSelect }: WorkflowCardProps) {
  const Icon = workflowIconMap[workflow.icon] || FileText;

  return (
    <button
      className={`w-full text-left rounded-lg border p-3 transition-all group
        ${isActive
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-sidebar-border bg-sidebar hover:border-primary/30 hover:bg-sidebar-accent/50"
        }`}
      onClick={() => onSelect(workflow)}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-md p-1.5 shrink-0 ${
          isActive ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
        } transition-colors`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {workflow.title}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform
              ${isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-primary/60"}
              group-hover:translate-x-0.5`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {workflow.description}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {workflow.steps.length} steps
            </Badge>
            {workflow.estimatedInteractions && (
              <span className="text-[10px] text-muted-foreground/60">
                ~{workflow.estimatedInteractions} interactions
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

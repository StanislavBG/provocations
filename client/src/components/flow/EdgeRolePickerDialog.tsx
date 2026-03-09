import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Target, LayoutTemplate, Link, BrainCircuit } from "lucide-react";
import type { FlowNode, EdgeRole } from "./useFlowCanvas";

interface EdgeRolePickerDialogProps {
  pendingEdge: { fromNodeId: string; toNodeId: string };
  targetNode?: FlowNode;
  onConfirm: (roles: EdgeRole[]) => void;
  onCancel: () => void;
}

interface RoleOption {
  role: EdgeRole;
  label: string;
  description: string;
  icon: typeof BookOpenCheck;
  iconClass: string;
}

/** Default roles shown when no node-specific config exists */
const DEFAULT_ROLE_OPTIONS: RoleOption[] = [
  {
    role: "context",
    label: "Context",
    description: "Background information and reference material",
    icon: BookOpenCheck,
    iconClass: "text-amber-500",
  },
  {
    role: "objective",
    label: "Objective / Starting Prompt",
    description: "Sets the topic, goal, or direction",
    icon: Target,
    iconClass: "text-blue-500",
  },
  {
    role: "output-format",
    label: "Output Format / Template",
    description: "Schema or template the output must follow",
    icon: LayoutTemplate,
    iconClass: "text-violet-500",
  },
  {
    role: "system-instruction",
    label: "System Instruction",
    description: "Becomes part of the LLM system prompt",
    icon: BrainCircuit,
    iconClass: "text-fuchsia-500",
  },
];

/** Per-node-type role configurations — only roles the node actually consumes */
const NODE_ROLE_CONFIG: Record<string, RoleOption[]> = {
  "llm-base": [
    { role: "system-instruction", label: "System Prompt", description: "Injected into the LLM system prompt", icon: BrainCircuit, iconClass: "text-fuchsia-500" },
    { role: "objective", label: "User Message", description: "Becomes the primary user message or question", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "User Context", description: "Included in the user message as reference material", icon: BookOpenCheck, iconClass: "text-amber-500" },
    { role: "output-format", label: "Output Format", description: "Schema or template the output must follow", icon: LayoutTemplate, iconClass: "text-violet-500" },
  ],
  research: [
    { role: "objective", label: "Research Topic", description: "Sets the research question or topic to investigate", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "Background Context", description: "Additional reference material for deeper analysis", icon: BookOpenCheck, iconClass: "text-amber-500" },
    { role: "output-format", label: "Output Template", description: "Structure or format the research output must follow", icon: LayoutTemplate, iconClass: "text-violet-500" },
  ],
  interview: [
    { role: "objective", label: "Interview Topic", description: "Sets the subject and direction of the interview", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "Background Context", description: "Reference material to inform interview questions", icon: BookOpenCheck, iconClass: "text-amber-500" },
  ],
  llm: [
    { role: "objective", label: "Instruction", description: "The task or instruction for the preset to execute", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "Input Content", description: "Source material to process with the selected preset", icon: BookOpenCheck, iconClass: "text-amber-500" },
  ],
  painter: [
    { role: "objective", label: "Image Prompt", description: "Description of what the image should depict", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "Style Reference", description: "Style guidance or reference material for the image", icon: BookOpenCheck, iconClass: "text-amber-500" },
  ],
  "social-post": [
    { role: "objective", label: "Source Content", description: "The content to adapt into social posts", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "Audience Context", description: "Platform, audience, or brand context", icon: BookOpenCheck, iconClass: "text-amber-500" },
  ],
  "coherence-gate": [
    { role: "objective", label: "Content to Evaluate", description: "The content to check for quality and coherence", icon: Target, iconClass: "text-blue-500" },
    { role: "context", label: "Reference Standard", description: "The original context to evaluate against", icon: BookOpenCheck, iconClass: "text-amber-500" },
  ],
};

export function EdgeRolePickerDialog({
  pendingEdge: _pendingEdge,
  targetNode,
  onConfirm,
  onCancel,
}: EdgeRolePickerDialogProps) {
  const [selected, setSelected] = useState<Set<EdgeRole>>(new Set());

  const toggle = (role: EdgeRole) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const targetLabel = targetNode?.label || targetNode?.type || "node";

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Connection Role</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-3">
          How should <span className="font-medium text-foreground">{targetLabel}</span> use this input? Select one or more roles.
        </p>
        <div className="flex flex-col gap-2">
          {(NODE_ROLE_CONFIG[targetNode?.type ?? ""] ?? DEFAULT_ROLE_OPTIONS).map(({ role, label, description, icon: Icon, iconClass }) => {
            const isSelected = selected.has(role);
            return (
              <button
                key={role}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => toggle(role)}
              >
                <div className="relative shrink-0">
                  <Icon className={`w-4 h-4 ${iconClass}`} />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{description}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onConfirm([])}
          >
            <Link className="w-3 h-3 mr-1.5" />
            Plain
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}
          >
            Connect ({selected.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

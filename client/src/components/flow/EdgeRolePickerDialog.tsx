import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Target, LayoutTemplate, MessageSquareText } from "lucide-react";
import type { FlowNode, EdgeRole } from "./useFlowCanvas";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";

interface EdgeRolePickerDialogProps {
  pendingEdge: { fromNodeId: string; toNodeId: string };
  targetNode?: FlowNode;
  onConfirm: (roles: EdgeRole[]) => void;
  onCancel: () => void;
}

const ROLE_OPTIONS: Array<{
  role: EdgeRole;
  label: string;
  description: string;
  icon: typeof BookOpenCheck;
  iconClass: string;
}> = [
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
    role: "user-prompt",
    label: "User Prompt",
    description: "Becomes the user message sent to the LLM",
    icon: MessageSquareText,
    iconClass: "text-emerald-500",
  },
];

export function EdgeRolePickerDialog({
  pendingEdge: _pendingEdge,
  targetNode,
  onConfirm,
  onCancel,
}: EdgeRolePickerDialogProps) {
  // Filter roles to only those the target node actually processes
  const visibleRoles = useMemo(() => {
    if (!targetNode) return ROLE_OPTIONS;
    const def = FLOW_NODE_REGISTRY[targetNode.type];
    if (!def || def.acceptedRoles.length === 0) return ROLE_OPTIONS;
    return ROLE_OPTIONS.filter((opt) => def.acceptedRoles.includes(opt.role));
  }, [targetNode]);

  // Pre-select "context" as default (or first visible role if context isn't available)
  const [selected, setSelected] = useState<Set<EdgeRole>>(() => {
    const defaultRole = visibleRoles.find((r) => r.role === "context")?.role ?? visibleRoles[0]?.role;
    return defaultRole ? new Set([defaultRole]) : new Set();
  });

  // Sync default selection if visibleRoles change
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const defaultRole = visibleRoles.find((r) => r.role === "context")?.role ?? visibleRoles[0]?.role;
      return defaultRole ? new Set([defaultRole]) : new Set();
    });
  }, [visibleRoles]);

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
          {visibleRoles.map(({ role, label, description, icon: Icon, iconClass }) => {
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
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
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

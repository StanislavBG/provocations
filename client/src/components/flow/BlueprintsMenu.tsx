import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutTemplate,
  ChevronDown,
  Zap,
  FileText,
  Search,
  Users,
  Save,
  Sparkles,
} from "lucide-react";

interface BlueprintSummary {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  nodeCount: number;
  edgeCount: number;
  source: "built-in" | "user" | "shared";
  documentId?: number;
  ownerId?: string;
}

const ICON_MAP: Record<string, typeof Zap> = {
  Zap,
  FileText,
  Search,
  LayoutTemplate,
  Sparkles,
};

const SOURCE_COLORS: Record<string, string> = {
  "built-in": "text-amber-500",
  user: "text-blue-500",
  shared: "text-emerald-500",
};

interface BlueprintsMenuProps {
  onLoadBlueprint: (blueprintId: string) => void;
  onSaveBlueprint: (label: string, description: string) => Promise<any>;
}

export function BlueprintsMenu({ onLoadBlueprint, onSaveBlueprint }: BlueprintsMenuProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: blueprints = [] } = useQuery<BlueprintSummary[]>({
    queryKey: ["/api/blueprints"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/blueprints");
      return await res.json();
    },
  });

  const builtIn = blueprints.filter((b) => b.source === "built-in");
  const userBps = blueprints.filter((b) => b.source === "user");
  const sharedBps = blueprints.filter((b) => b.source === "shared");

  const handleSave = async () => {
    if (!saveLabel.trim()) return;
    setSaving(true);
    try {
      await onSaveBlueprint(saveLabel.trim(), saveDescription.trim());
      setSaveDialogOpen(false);
      setSaveLabel("");
      setSaveDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints"] });
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || LayoutTemplate;
    return Icon;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
            <LayoutTemplate className="w-3 h-3" />
            Blueprints
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 max-h-[400px] overflow-auto">
          {/* Save as blueprint */}
          <DropdownMenuItem
            onClick={() => setSaveDialogOpen(true)}
            className="text-xs gap-2"
          >
            <Save className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">Save Canvas as Blueprint</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* Built-in blueprints */}
          {builtIn.length > 0 && (
            <>
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                Built-in
              </div>
              {builtIn.map((bp) => {
                const Icon = getIcon(bp.icon);
                return (
                  <DropdownMenuItem
                    key={bp.id}
                    onClick={() => onLoadBlueprint(bp.id)}
                    className="text-xs gap-2"
                  >
                    <Icon className={`w-3.5 h-3.5 ${SOURCE_COLORS["built-in"]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{bp.label}</div>
                      {bp.description && (
                        <div className="text-[10px] text-muted-foreground truncate">{bp.description}</div>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {/* User blueprints */}
          {userBps.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                My Blueprints
              </div>
              {userBps.map((bp) => {
                const Icon = getIcon(bp.icon);
                return (
                  <DropdownMenuItem
                    key={bp.id}
                    onClick={() => onLoadBlueprint(bp.id)}
                    className="text-xs gap-2"
                  >
                    <Icon className={`w-3.5 h-3.5 ${SOURCE_COLORS.user}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{bp.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {bp.nodeCount} nodes · {bp.edgeCount} edges
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {/* Shared blueprints */}
          {sharedBps.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" />
                Shared with Me
              </div>
              {sharedBps.map((bp) => {
                const Icon = getIcon(bp.icon);
                return (
                  <DropdownMenuItem
                    key={bp.id}
                    onClick={() => onLoadBlueprint(bp.id)}
                    className="text-xs gap-2"
                  >
                    <Icon className={`w-3.5 h-3.5 ${SOURCE_COLORS.shared}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{bp.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {bp.nodeCount} nodes · {bp.edgeCount} edges
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {blueprints.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              No blueprints available
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Blueprint Dialog */}
      {saveDialogOpen && (
        <Dialog open onOpenChange={() => setSaveDialogOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Save as Blueprint</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
                <input
                  className="w-full text-sm bg-muted/30 border border-border/50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  placeholder="My Blueprint"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                <textarea
                  className="w-full text-sm bg-muted/30 border border-border/50 rounded-lg px-2.5 py-2 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="What does this blueprint do?"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!saveLabel.trim() || saving}
                  onClick={handleSave}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Saving..." : "Save Blueprint"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

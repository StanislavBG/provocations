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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutTemplate,
  ChevronDown,
  Zap,
  FileText,
  Search,
  Users,
  Save,
  Sparkles,
  Share2,
  Loader2,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface Connection {
  id: number;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  status: string;
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
  /** External control to open the dropdown (e.g., from welcome overlay) */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function BlueprintsMenu({ onLoadBlueprint, onSaveBlueprint, externalOpen, onExternalOpenChange }: BlueprintsMenuProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBlueprint, setShareBlueprint] = useState<BlueprintSummary | null>(null);
  const [sharing, setSharing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: blueprints = [] } = useQuery<BlueprintSummary[]>({
    queryKey: ["/api/blueprints"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/blueprints");
      return await res.json();
    },
  });

  // Fetch connections only when share dialog is open
  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["/api/chat/connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/connections");
      return await res.json();
    },
    enabled: shareDialogOpen,
  });

  const acceptedConnections = connections?.filter((c) => c.status === "accepted") || [];

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

  const handleShareClick = (bp: BlueprintSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShareBlueprint(bp);
    setShareDialogOpen(true);
  };

  const handleShareToUser = async (recipientId: string) => {
    if (!shareBlueprint?.documentId) return;
    setSharing(true);
    try {
      await apiRequest("POST", "/api/share", {
        recipientId,
        itemType: "document",
        itemId: shareBlueprint.documentId,
        permission: "read",
        note: `Shared blueprint: ${shareBlueprint.label}`,
      });
      toast({
        title: "Blueprint shared",
        description: `"${shareBlueprint.label}" shared successfully.`,
      });
      setShareDialogOpen(false);
      setShareBlueprint(null);
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints"] });
    } catch (err) {
      toast({
        title: "Share failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteBlueprint = async (bp: BlueprintSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!bp.documentId) return;
    try {
      await apiRequest("DELETE", `/api/documents/${bp.documentId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints"] });
      toast({ title: "Blueprint deleted", description: `"${bp.label}" has been removed.` });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || LayoutTemplate;
    return Icon;
  };

  return (
    <>
      <DropdownMenu open={externalOpen} onOpenChange={onExternalOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 rounded text-muted-foreground hover:text-foreground">
                <LayoutTemplate className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs z-[60]">Blueprints</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-64 max-h-[400px] overflow-auto">
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
                    {bp.documentId && (
                      <div className="flex items-center shrink-0">
                        <button
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => handleShareClick(bp, e)}
                          title="Share blueprint"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                        <button
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={(e) => handleDeleteBlueprint(bp, e)}
                          title="Delete blueprint"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
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

      {/* Share Blueprint Dialog */}
      {shareDialogOpen && shareBlueprint && (
        <Dialog open onOpenChange={() => { setShareDialogOpen(false); setShareBlueprint(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary" />
                Share Blueprint
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="text-sm font-medium">{shareBlueprint.label}</div>
                {shareBlueprint.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{shareBlueprint.description}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {shareBlueprint.nodeCount} nodes · {shareBlueprint.edgeCount} edges
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Select a connection to share with
                </label>
                <div className="flex flex-col gap-1 max-h-[200px] overflow-auto">
                  {acceptedConnections.length === 0 && (
                    <div className="text-xs text-muted-foreground/60 py-4 text-center">
                      No connections found. Invite users first.
                    </div>
                  )}
                  {acceptedConnections.map((conn) => (
                    <button
                      key={conn.peerId}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted/50 text-left transition-colors"
                      onClick={() => handleShareToUser(conn.peerId)}
                      disabled={sharing}
                    >
                      {conn.peerAvatar ? (
                        <img src={conn.peerAvatar} className="w-6 h-6 rounded-full" alt="" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {conn.peerName?.charAt(0) || "?"}
                        </div>
                      )}
                      <span className="text-sm flex-1 truncate">{conn.peerName}</span>
                      {sharing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

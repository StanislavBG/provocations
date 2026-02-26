import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prebuiltTemplates, STATUS_LABEL_CONFIG } from "@/lib/prebuiltTemplates";
import { ProvokeText } from "@/components/ProvokeText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  ArrowRight,
  Dices,
  RotateCcw,
  Loader2,
  ChevronLeft,
  CheckCircle2,
  Lightbulb,
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Pin,
  PinOff,
  Search,
  Upload,
} from "lucide-react";
import type { DocumentListItem, FolderItem } from "@shared/schema";

type Phase = "app-select" | "configure";

interface OnboardingSplashProps {
  onStart: (templateId: string, objective: string, pinnedDocIds?: Set<number>) => void;
  onDismiss: () => void;
  onLoadSession?: () => void;
  onLoadContext?: () => void;
  recentSessions?: Array<{ id: number; title: string; templateId: string; updatedAt: string }>;
  isAutoResuming?: boolean;
}

/** Compute tree indent */
function treeIndent(depth: number): number {
  let px = 8;
  for (let i = 1; i <= depth; i++) {
    if (i <= 4) px += 14;
    else if (i <= 7) px += 8;
    else px += 5;
  }
  return px;
}

export function OnboardingSplash({
  onStart,
  onDismiss,
  onLoadSession,
  recentSessions = [],
  isAutoResuming = false,
}: OnboardingSplashProps) {
  const [phase, setPhase] = useState<Phase>("app-select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Context store state
  const [pinnedDocIds, setPinnedDocIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();

  const availableApps = prebuiltTemplates.filter(
    (t) => !t.comingSoon && !t.externalUrl,
  );

  const selectedTemplate = availableApps.find((t) => t.id === selectedId);

  // Fetch documents and folders for context picker (only in configure phase)
  const { data: docsData } = useQuery<{ documents: DocumentListItem[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    staleTime: 30_000,
    enabled: phase === "configure",
  });

  const { data: foldersData } = useQuery<FolderItem[]>({
    queryKey: ["/api/folders/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return data.folders ?? data;
    },
    staleTime: 30_000,
    enabled: phase === "configure",
  });

  const docs = docsData?.documents ?? [];
  const folders = foldersData ?? [];

  // File upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const res = await apiRequest("POST", "/api/documents", {
        title: file.name,
        content: text,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const handleFileUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.csv,.json,.xml,.yaml,.toml,.html";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadMutation.mutate(file);
    };
    input.click();
  }, [uploadMutation]);

  // Filter & tree helpers
  const q = searchQuery.toLowerCase();
  const filteredDocs = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
  const filteredFolders = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
  const rootFolders = filteredFolders.filter((f) => f.parentFolderId === null);
  const getChildren = (parentId: number) => filteredFolders.filter((f) => f.parentFolderId === parentId);
  const getDocsInFolder = (folderId: number | null) =>
    filteredDocs.filter((d) => (folderId === null ? !d.folderId : d.folderId === folderId));
  const rootDocs = getDocsInFolder(null);
  const pinnedDocs = docs.filter((d) => pinnedDocIds.has(d.id));

  const toggleFolder = (id: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectApp = (id: string) => {
    setSelectedId(id);
    setPhase("configure");
  };

  const handleBack = () => {
    setPhase("app-select");
  };

  const handleStart = () => {
    if (selectedId && objective.trim()) {
      onStart(selectedId, objective.trim(), pinnedDocIds.size > 0 ? pinnedDocIds : undefined);
    }
  };

  const handleSurpriseMe = async () => {
    if (!selectedTemplate || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/generate-sample-objective", {
        appTitle: selectedTemplate.title,
      });
      const data = await res.json();
      if (data.objective) setObjective(data.objective);
    } catch {
      // silently ignore
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state while auto-resuming
  if (isAutoResuming) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-serif text-muted-foreground">Resuming your last session...</p>
        </div>
      </div>
    );
  }

  // ── Doc row renderer for context picker ──
  const renderDocRow = (doc: DocumentListItem, indent: number) => {
    const isPinned = pinnedDocIds.has(doc.id);
    return (
      <div
        key={`d-${doc.id}`}
        className="flex items-center gap-1 group hover:bg-muted/50 rounded-md transition-colors"
        style={{ paddingLeft: `${indent}px` }}
      >
        <button
          className="flex-1 flex items-center gap-1.5 py-1.5 px-1 text-left min-w-0"
          onClick={() => {
            setPinnedDocIds((prev) => {
              const next = new Set(prev);
              if (next.has(doc.id)) next.delete(doc.id);
              else next.add(doc.id);
              return next;
            });
          }}
          title={doc.title}
        >
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs truncate">{doc.title}</span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 shrink-0 ${
            isPinned ? "text-primary" : "opacity-0 group-hover:opacity-100 text-muted-foreground"
          }`}
          onClick={() => {
            setPinnedDocIds((prev) => {
              const next = new Set(prev);
              if (next.has(doc.id)) next.delete(doc.id);
              else next.add(doc.id);
              return next;
            });
          }}
        >
          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </Button>
      </div>
    );
  };

  // ── Folder tree renderer ──
  const renderFolder = (folder: FolderItem, depth: number): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id);
    const children = getChildren(folder.id);
    const folderDocs = getDocsInFolder(folder.id);
    const hasContent = children.length > 0 || folderDocs.length > 0;
    const indent = treeIndent(depth);

    return (
      <div key={`f-${folder.id}`}>
        <button
          onClick={() => hasContent && toggleFolder(folder.id)}
          className={`w-full text-left py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
            hasContent ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-default"
          }`}
          style={{ paddingLeft: `${indent}px` }}
        >
          {hasContent ? (
            isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
          ) : (
            <span className="w-3" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="truncate font-medium">{folder.name}</span>
        </button>
        {isExpanded && (
          <div>
            {children.map((child) => renderFolder(child, depth + 1))}
            {folderDocs.map((doc) => renderDocRow(doc, treeIndent(depth + 1)))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ─── Phase 1: App Selection ─── */}
      {phase === "app-select" && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="py-8 text-center shrink-0">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-7 h-7 text-primary" />
              <h1 className="text-3xl font-serif font-bold">What are you working on?</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Pick an application to get started. AI personas will challenge your thinking
              to help you build something better.
            </p>
          </div>

          {/* App grid */}
          <ScrollArea className="flex-1 px-8 pb-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {availableApps.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectApp(template.id)}
                    className="flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{template.shortLabel}</span>
                        {template.statusLabel && (
                          <Badge
                            variant="outline"
                            className={`text-[8px] h-3.5 shrink-0 ${STATUS_LABEL_CONFIG[template.statusLabel].className}`}
                          >
                            {STATUS_LABEL_CONFIG[template.statusLabel].text}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                        {template.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-8 py-4 border-t flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Skip
              </Button>
              {onLoadSession && recentSessions.length > 0 && (
                <Button variant="outline" size="sm" onClick={onLoadSession} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resume Session
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {availableApps.length} applications available
            </p>
          </div>
        </div>
      )}

      {/* ─── Phase 2: Configure ─── */}
      {phase === "configure" && selectedTemplate && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top bar: back + app identity */}
          <div className="px-6 py-3 border-b flex items-center gap-3 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 -ml-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground">
                <selectedTemplate.icon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">{selectedTemplate.title}</h2>
                <p className="text-[11px] text-muted-foreground">{selectedTemplate.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Main content: 2-column layout */}
          <div className="flex-1 flex min-h-0">
            {/* Left column: Context Store picker */}
            <div className="w-72 border-r flex flex-col shrink-0 bg-card/50">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Context Sources
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleFileUpload}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="h-7 text-xs pl-7"
                  />
                </div>
              </div>

              {/* Pinned context */}
              {pinnedDocs.length > 0 && (
                <div className="p-2 border-b bg-primary/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Pin className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Selected Context
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 min-w-[16px] justify-center ml-auto">
                      {pinnedDocs.length}
                    </Badge>
                  </div>
                  {pinnedDocs.map((doc) => (
                    <div key={`pinned-${doc.id}`} className="flex items-center gap-1.5 py-1 px-1 group">
                      <FileText className="w-3 h-3 text-primary/60 shrink-0" />
                      <span className="text-xs truncate flex-1">{doc.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={() => setPinnedDocIds((prev) => {
                          const next = new Set(prev);
                          next.delete(doc.id);
                          return next;
                        })}
                      >
                        <PinOff className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {rootFolders.map((folder) => renderFolder(folder, 0))}
                  {rootFolders.length > 0 && rootDocs.length > 0 && <div className="border-t my-1" />}
                  {rootDocs.map((doc) => renderDocRow(doc, 8))}

                  {docs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
                      <FileText className="w-6 h-6" />
                      <p className="text-xs text-center">
                        No documents yet.
                        <br />
                        Upload files or save from workspace.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-2 border-t">
                <p className="text-[10px] text-muted-foreground text-center">
                  Click <Pin className="inline w-2.5 h-2.5" /> to add documents as context
                </p>
              </div>
            </div>

            {/* Right column: App details + Objective */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* App description + use cases */}
              <div className="px-8 py-5 border-b bg-muted/20">
                <div className="max-w-3xl">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {selectedTemplate.description}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Use Cases
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.useCases?.map((uc, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground bg-background rounded-lg px-3 py-2 border"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
                          <span>{uc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Objective input — takes remaining space */}
              <div className="flex-1 flex flex-col px-8 py-5">
                <ProvokeText
                  chrome="container"
                  variant="editor"
                  value={objective}
                  onChange={setObjective}
                  placeholder={
                    selectedTemplate.objective ||
                    "Describe what you want to create or explore..."
                  }
                  label="Your Objective"
                  headerActions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSurpriseMe}
                      disabled={isGenerating}
                      className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Dices className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                      {isGenerating ? "Thinking..." : "Surprise me"}
                    </Button>
                  }
                  className="text-sm font-serif flex-1"
                  showCopy={false}
                />
              </div>

              {/* Start button */}
              <div className="px-8 py-4 border-t flex items-center justify-between shrink-0">
                <p className="text-xs text-muted-foreground">
                  {pinnedDocIds.size > 0 && (
                    <span className="text-primary font-medium">{pinnedDocIds.size} document{pinnedDocIds.size > 1 ? "s" : ""} selected as context · </span>
                  )}
                  A draft will be generated based on your objective
                </p>
                <Button
                  onClick={handleStart}
                  disabled={!objective.trim()}
                  size="lg"
                  className="gap-2"
                >
                  Start Working
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

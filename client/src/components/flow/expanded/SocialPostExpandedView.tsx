/**
 * SocialPostExpandedView — Full expanded view for Social Post nodes.
 *
 * Left panel: platform toggles, intent/tone selectors, generate button.
 * Right panel: tabbed preview of generated posts per platform.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { Play, Loader2, Check, RefreshCw, Share2, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { SOCIAL_PLATFORMS, type PlatformId } from "@/lib/social-platforms";
import { lifecycleLogStore } from "@/lib/lifecycleLog";
import { ImageCustomizer } from "@/components/ImageCustomizer";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface SocialPostExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

const INTENT_OPTIONS = [
  { value: "marketing", label: "Marketing" },
  { value: "blog", label: "Blog" },
  { value: "announcement", label: "Announcement" },
  { value: "thought-leadership", label: "Thought Leadership" },
  { value: "product-launch", label: "Product Launch" },
  { value: "event", label: "Event" },
] as const;

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "witty", label: "Witty" },
  { value: "inspirational", label: "Inspirational" },
  { value: "informative", label: "Informative" },
] as const;

export function SocialPostExpandedView({ node, nodes, edges, onUpdateNode, onPlayNode }: SocialPostExpandedViewProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { connected: boolean; status: string }>>({});
  const [imageCustomizerOpen, setImageCustomizerOpen] = useState(false);

  const platforms = node.socialPlatforms || {};
  const intent = node.socialIntent || "marketing";
  const tone = node.socialTone || "professional";
  const generatedPosts = node.socialGeneratedPosts || {};

  // Gather input content and images from connected nodes
  const { inputContent, upstreamImages } = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === node.id);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    const text = inputNodes
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter((s) => s.trim())
      .join("\n\n---\n\n");
    // Collect image URLs from upstream painter or image-bearing nodes
    const images = inputNodes
      .map((n) => n.imageUrl)
      .filter((url): url is string => !!url);
    return { inputContent: text, upstreamImages: images };
  }, [node.id, nodes, edges]);

  const enabledPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);

  // Fetch connection status on mount
  useMemo(() => {
    fetch("/api/platform-credentials")
      .then((r) => r.json())
      .then((data: { platforms?: Array<{ platform: string; connected: boolean; status: string }> }) => {
        if (data.platforms) {
          const status: Record<string, { connected: boolean; status: string }> = {};
          for (const p of data.platforms) {
            status[p.platform] = { connected: p.connected, status: p.status };
          }
          setConnectionStatus(status);
        }
      })
      .catch(() => {});
  }, []);

  const togglePlatform = useCallback((platformId: string) => {
    const updated = { ...platforms, [platformId]: !platforms[platformId] };
    onUpdateNode(node.id, { socialPlatforms: updated });
    if (!activeTab && !platforms[platformId]) {
      setActiveTab(platformId);
    }
  }, [platforms, node.id, onUpdateNode, activeTab]);

  // Reset customizer when switching platforms
  useEffect(() => {
    setImageCustomizerOpen(false);
  }, [activeTab]);

  const lcLog = useCallback(
    (phase: "pre-process" | "process" | "post-process", status: "start" | "success" | "error", message: string, extra?: { durationMs?: number; error?: string }) => {
      lifecycleLogStore.push({ phase, status, nodeId: node.id, nodeType: node.type, nodeLabel: node.label || "Social Post", message, ...extra });
    },
    [node.id, node.type, node.label],
  );

  const handleGenerate = useCallback(async () => {
    const t0 = performance.now();
    if (enabledPlatforms.length === 0) {
      lcLog("pre-process", "error", "No platforms enabled", { error: "No platforms" });
      toast({ title: "No platforms enabled", description: "Toggle at least one platform" });
      return;
    }
    if (!inputContent.trim()) {
      lcLog("pre-process", "error", "No input content", { error: "Empty input" });
      toast({ title: "No input content", description: "Connect content nodes first" });
      return;
    }

    lcLog("pre-process", "success", `${enabledPlatforms.length} platform(s), ${inputContent.length} chars`);
    setIsGenerating(true);
    onUpdateNode(node.id, { socialGenStatus: "generating" });
    lcLog("process", "start", `Generating for: ${enabledPlatforms.join(", ")}`);

    try {
      const res = await apiRequest("POST", "/api/social/generate", {
        content: inputContent,
        platforms: enabledPlatforms,
        intent,
        tone,
      });
      const data = (await res.json()) as { posts: Record<string, { text: string; hashtags?: string[]; characterCount: number }> };

      const posts: Record<string, { text: string; imageUrl?: string; charCount: number; status: string }> = {};

      // When generateImages is ON, try to generate an image for each platform
      // When OFF but upstream images exist, attach the first upstream image
      let generatedImageUrl: string | undefined;
      if (node.socialGenerateImages) {
        try {
          const imgRes = await apiRequest("POST", "/api/generate-image", {
            prompt: `Social media image for: ${inputContent.slice(0, 500)}`,
          });
          const imgData = (await imgRes.json()) as { imageUrl?: string };
          generatedImageUrl = imgData.imageUrl;
        } catch {
          // Image generation is best-effort
        }
      }

      const imageToAttach = generatedImageUrl || (upstreamImages.length > 0 ? upstreamImages[0] : undefined);

      for (const [platform, post] of Object.entries(data.posts)) {
        posts[platform] = {
          text: post.text,
          imageUrl: imageToAttach,
          charCount: post.characterCount,
          status: "draft",
        };
      }

      const elapsed = Math.round(performance.now() - t0);
      lcLog("process", "success", `Generated ${Object.keys(posts).length} posts`, { durationMs: elapsed });

      onUpdateNode(node.id, {
        socialGeneratedPosts: posts,
        socialGenStatus: "done",
        snippet: `Generated ${Object.keys(posts).length} posts`,
      });

      if (!activeTab && Object.keys(posts).length > 0) {
        setActiveTab(Object.keys(posts)[0]);
      }

      lcLog("post-process", "success", "Posts saved to node");
      toast({ title: "Posts generated" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Generation failed";
      lcLog("process", "error", errMsg, { error: errMsg, durationMs: Math.round(performance.now() - t0) });
      onUpdateNode(node.id, { socialGenStatus: "error" });
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [enabledPlatforms, inputContent, upstreamImages, intent, tone, node.id, node.socialGenerateImages, onUpdateNode, toast, activeTab, lcLog]);

  const currentPost = activeTab ? generatedPosts[activeTab] : null;
  const currentPlatform = activeTab ? SOCIAL_PLATFORMS[activeTab] : null;

  return (
    <ExpandedViewLayout
      defaultLeftSize={35}
      left={
        <div className="flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Platform toggles */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Platforms
              </h3>
              <div className="space-y-2">
                {Object.entries(SOCIAL_PLATFORMS).map(([id, meta]) => {
                  const conn = connectionStatus[id];
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: conn?.connected ? "#22c55e" : meta.brandColor + "60" }}
                        />
                        <span className="text-sm font-medium">{meta.name}</span>
                        {conn && !conn.connected && conn.status !== "none" && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {conn.status}
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={!!platforms[id]}
                        onCheckedChange={() => togglePlatform(id)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Intent selector */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Intent
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {INTENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      intent === opt.value
                        ? "bg-pink-500/20 border-pink-500/50 text-pink-400"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    }`}
                    onClick={() => onUpdateNode(node.id, { socialIntent: opt.value as any })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone selector */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Tone
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      tone === opt.value
                        ? "bg-pink-500/20 border-pink-500/50 text-pink-400"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    }`}
                    onClick={() => onUpdateNode(node.id, { socialTone: opt.value as any })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Images toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Generate Images</span>
              <Switch
                checked={!!node.socialGenerateImages}
                onCheckedChange={(v) => onUpdateNode(node.id, { socialGenerateImages: v })}
              />
            </div>

            {/* Input summary */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Connected Input
              </h3>
              {inputContent ? (
                <p className="text-[11px] text-muted-foreground line-clamp-4">
                  {inputContent.slice(0, 300)}{inputContent.length > 300 ? "..." : ""}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground/60 italic">
                  No connected inputs. Drag edges from content nodes.
                </p>
              )}
            </div>

            {/* Generate button */}
            <Button
              className="w-full gap-2"
              disabled={isGenerating || enabledPlatforms.length === 0 || !inputContent.trim()}
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Generate All
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
        </div>
      }
      right={
        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Platform tabs */}
        {enabledPlatforms.length > 0 && (
          <div className="border-b flex gap-0.5 px-3 py-1.5 overflow-x-auto shrink-0">
            {enabledPlatforms.map((pid) => {
              const meta = SOCIAL_PLATFORMS[pid];
              const post = generatedPosts[pid];
              return (
                <button
                  key={pid}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === pid
                      ? "bg-pink-500/15 text-pink-400"
                      : "text-muted-foreground hover:bg-muted/30"
                  }`}
                  onClick={() => setActiveTab(pid)}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.brandColor }} />
                  {meta?.name || pid}
                  {post && (
                    <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0">
                      {post.status === "draft" ? "Draft" : post.status}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4">
          {!activeTab || !currentPost ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/50">
              <div className="text-center">
                <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {enabledPlatforms.length === 0
                    ? "Enable platforms and connect content, then click Generate"
                    : Object.keys(generatedPosts).length === 0
                    ? "Click Generate All to create platform-specific posts"
                    : "Select a platform tab to preview"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              {/* Character count bar */}
              {currentPlatform && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        currentPost.charCount / currentPlatform.charLimit > 0.9
                          ? "bg-red-500"
                          : currentPost.charCount / currentPlatform.charLimit > 0.7
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, (currentPost.charCount / currentPlatform.charLimit) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {currentPost.charCount} / {currentPlatform.charLimit}
                  </span>
                </div>
              )}

              {/* Post content editor */}
              <ProvokeText
                value={currentPost.text}
                onChange={(val) => {
                  const updated = { ...generatedPosts };
                  updated[activeTab] = { ...currentPost, text: val, charCount: val.length };
                  onUpdateNode(node.id, { socialGeneratedPosts: updated });
                }}
                chrome="container"
                variant="textarea"
                label={`${currentPlatform?.name || activeTab} Post`}
                showCopy
                showClear={false}
              />

              {/* Image preview */}
              {currentPost.imageUrl && (
                <div className="space-y-2">
                  {imageCustomizerOpen ? (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30 border-b">
                        <span className="text-xs font-medium">Post Image</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setImageCustomizerOpen(false)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <ImageCustomizer
                        src={currentPost.imageUrl}
                        showMeta={false}
                        showCrop
                        showUpload={false}
                        showGenerate={false}
                        compact
                        readOnly
                      />
                    </div>
                  ) : (
                    <div
                      className="border rounded-lg overflow-hidden cursor-pointer group relative"
                      onClick={() => setImageCustomizerOpen(true)}
                    >
                      <img
                        src={currentPost.imageUrl}
                        alt="Post thumbnail"
                        className="w-full max-h-64 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded">
                          Click to customize
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    const updated = { ...generatedPosts };
                    updated[activeTab] = { ...currentPost, status: "approved" };
                    onUpdateNode(node.id, { socialGeneratedPosts: updated });
                    toast({ title: `${currentPlatform?.name || activeTab} post approved` });
                  }}
                  disabled={currentPost.status === "approved"}
                >
                  <Check className="w-3.5 h-3.5" />
                  {currentPost.status === "approved" ? "Approved" : "Approve"}
                </Button>
              </div>
            </div>
          )}
        </div>
        </div>
      }
    />
  );
}

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  extractVideoTranscript,
  runPipeline,
  buildMultiVideoInfographicBrief,
  type PipelineResult,
} from "@/lib/infographicPipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Youtube, Search, Play, Loader2, CheckCircle2 } from "lucide-react";
import type { YouTubeVideo, YouTubeChannelResponse } from "@shared/schema";

/** Full result for a processed video (transcript + shared pipeline output) */
export interface VideoInfographicResult extends PipelineResult {
  videoId: string;
  videoTitle: string;
  thumbnailUrl?: string;
}

interface YouTubeChannelInputProps {
  onVideosLoaded: (videos: YouTubeVideo[], channelTitle: string) => void;
  onVideoProcessed: (result: VideoInfographicResult) => void;
  onDocumentUpdate: (markdown: string) => void;
  /** Current processing stage label for status display */
  onStageChange?: (stage: string | null) => void;
}

export function YouTubeChannelInput({
  onVideosLoaded,
  onVideoProcessed,
  onDocumentUpdate,
  onStageChange,
}: YouTubeChannelInputProps) {
  const { toast } = useToast();
  const [channelUrl, setChannelUrl] = useState("");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [channelTitle, setChannelTitle] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [processingVideoId, setProcessingVideoId] = useState<string | null>(null);
  const [processedVideoIds, setProcessedVideoIds] = useState<Set<string>>(new Set());
  const [processedResults, setProcessedResults] = useState<VideoInfographicResult[]>([]);

  // Fetch videos from channel
  const fetchChannelMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/youtube/channel", {
        channelUrl: url,
        maxResults: 10,
      });
      return (await response.json()) as YouTubeChannelResponse;
    },
    onSuccess: (data) => {
      setVideos(data.videos);
      setChannelTitle(data.channelTitle);
      setSelectedVideoIds(new Set());
      setProcessedVideoIds(new Set());
      setProcessedResults([]);
      onVideosLoaded(data.videos, data.channelTitle);
      toast({
        title: "Channel Loaded",
        description: `Found ${data.videos.length} videos from ${data.channelTitle}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Load Channel",
        description: error instanceof Error ? error.message : "Could not fetch videos",
        variant: "destructive",
      });
    },
  });

  // Process a single video through the shared pipeline:
  // 1. Extract transcript (YouTube-specific)
  // 2. Summarize transcript (shared)
  // 3. Generate infographic spec (shared)
  const processVideoMutation = useMutation({
    mutationFn: async (video: YouTubeVideo): Promise<VideoInfographicResult> => {
      setProcessingVideoId(video.videoId);

      // Step 1: Extract transcript
      onStageChange?.("Extracting transcript...");
      const extracted = await extractVideoTranscript({
        videoId: video.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        videoTitle: video.title,
        thumbnailUrl: video.thumbnailUrl,
      });

      // Steps 2 + 3: Shared pipeline (summarize → infographic)
      onStageChange?.("Summarizing & generating infographic...");
      const pipelineResult = await runPipeline(
        extracted.transcript,
        "youtube",
        video.title,
      );

      return {
        ...pipelineResult,
        videoId: video.videoId,
        videoTitle: video.title,
        thumbnailUrl: video.thumbnailUrl,
      };
    },
    onSuccess: (result) => {
      setProcessingVideoId(null);
      onStageChange?.(null);
      setProcessedVideoIds((prev) => new Set([...Array.from(prev), result.videoId]));
      setProcessedResults((prev) => [...prev, result]);
      onVideoProcessed(result);

      // Build document markdown from all processed results using shared builder
      const allResults = [...processedResults, result];
      const markdown = buildMultiVideoInfographicBrief(allResults, channelTitle);
      onDocumentUpdate(markdown);

      toast({
        title: "Video Processed",
        description: `"${result.videoTitle}" → infographic spec generated`,
      });
    },
    onError: (error) => {
      setProcessingVideoId(null);
      onStageChange?.(null);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Video processing failed",
        variant: "destructive",
      });
    },
  });

  const handleFetchChannel = () => {
    if (!channelUrl.trim()) return;
    fetchChannelMutation.mutate(channelUrl.trim());
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const handleProcessSelected = async () => {
    const selected = videos.filter((v) => selectedVideoIds.has(v.videoId) && !processedVideoIds.has(v.videoId));
    for (const video of selected) {
      await processVideoMutation.mutateAsync(video);
    }
  };

  return (
    <div className="space-y-4">
      {/* Channel URL Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          YouTube Channel URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://www.youtube.com/@channel or channel URL..."
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleFetchChannel()}
            />
          </div>
          <Button
            onClick={handleFetchChannel}
            disabled={!channelUrl.trim() || fetchChannelMutation.isPending}
            className="gap-1.5"
          >
            {fetchChannelMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Fetch
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {fetchChannelMutation.isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-start">
              <Skeleton className="w-5 h-5 rounded mt-1" />
              <Skeleton className="w-24 h-16 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video List */}
      {videos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {channelTitle}
              <Badge variant="secondary" className="ml-2">
                {videos.length} videos
              </Badge>
            </h3>
            {selectedVideoIds.size > 0 && (
              <Button
                size="sm"
                onClick={handleProcessSelected}
                disabled={processVideoMutation.isPending}
                className="gap-1.5"
              >
                {processVideoMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Process {selectedVideoIds.size - processedVideoIds.size > 0
                  ? `${selectedVideoIds.size - processedVideoIds.size} video${selectedVideoIds.size - processedVideoIds.size > 1 ? "s" : ""}`
                  : "selected"}
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {videos.map((video) => {
              const isSelected = selectedVideoIds.has(video.videoId);
              const isProcessing = processingVideoId === video.videoId;
              const isProcessed = processedVideoIds.has(video.videoId);

              return (
                <Card
                  key={video.videoId}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"
                  } ${isProcessed ? "border-green-500/30 bg-green-500/5" : ""}`}
                  onClick={() => !isProcessing && toggleVideoSelection(video.videoId)}
                >
                  <CardContent className="p-3 flex gap-3 items-start">
                    <Checkbox
                      checked={isSelected}
                      disabled={isProcessing}
                      className="mt-1"
                    />
                    <div className="w-24 h-16 bg-muted rounded overflow-hidden shrink-0 flex items-center justify-center">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Youtube className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                        {isProcessed && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(video.publishedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Processing progress */}
      {processedResults.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Processed ({processedResults.length})
          </h3>
          <div className="space-y-1">
            {processedResults.map((r) => (
              <div key={r.videoId} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {r.infographic.sections.length} sections
                </Badge>
                {r.videoTitle}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

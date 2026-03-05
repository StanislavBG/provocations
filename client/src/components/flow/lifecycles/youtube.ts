/**
 * YouTube node lifecycle handlers.
 * When triggered via chain execution, auto-detects whether upstream input
 * is a URL or search keywords, then fetches transcripts accordingly.
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

/** Check if text looks like a YouTube URL */
function isYoutubeUrl(text: string): boolean {
  return /(?:youtube\.com|youtu\.be)\//.test(text.trim());
}

/** Extract video ID from a YouTube URL */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function createYoutubeHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      // Can process if there's upstream input OR the node already has a URL/content
      return (
        ctx.combinedInputContent.trim().length > 0 ||
        !!ctx.node.youtubeUrl ||
        (ctx.node.content?.trim()?.length ?? 0) > 0
      );
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const input = ctx.combinedInputContent.trim();

      // If the node already has a transcript, return it
      if (!input && ctx.node.content?.trim()) {
        return ctx.node.content;
      }

      // Determine mode: URL or search
      if (isYoutubeUrl(input)) {
        // URL mode — fetch transcript directly
        const videoId = extractVideoId(input);
        if (!videoId) throw new Error("Invalid YouTube URL");

        const res = await fetch("/api/youtube/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ videoId, videoUrl: input, videoTitle: "" }),
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error("Transcript fetch failed");
        const data = (await res.json()) as { transcript: string; videoTitle: string };
        return data.transcript || "";
      } else if (input) {
        // Search mode — search, take top result, fetch transcript
        const searchRes = await fetch("/api/youtube/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query: input, maxResults: 3 }),
          signal: ctx.signal,
        });
        if (!searchRes.ok) throw new Error("YouTube search failed");
        const searchData = (await searchRes.json()) as { results: { videoId: string; title: string }[] };

        if (!searchData.results || searchData.results.length === 0) {
          throw new Error(`No YouTube results for: ${input}`);
        }

        // Fetch transcript from top result
        const top = searchData.results[0];
        const res = await fetch("/api/youtube/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ videoId: top.videoId, videoUrl: `https://youtube.com/watch?v=${top.videoId}`, videoTitle: top.title }),
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error("Transcript fetch failed");
        const data = (await res.json()) as { transcript: string; videoTitle: string };
        return data.transcript || "";
      }

      return ctx.node.content || "";
    },
  };
}

/**
 * Shared pipeline utilities for the transcript → summary → infographic flow.
 *
 * Used by both "YouTube to Infographic" and "Text to Infographic" templates.
 * The pipeline is identical — the only difference is how the transcript is obtained:
 *   - YouTube: extracted from video via /api/youtube/process-video
 *   - Voice:   pasted/uploaded by the user
 *
 * Once a transcript exists, both paths call:
 *   1. /api/pipeline/summarize  → GenerateSummaryResponse
 *   2. /api/pipeline/infographic → InfographicSpec
 *   3. buildInfographicBrief()  → markdown document
 */

import { apiRequest } from "@/lib/queryClient";
import type {
  GenerateSummaryResponse,
  InfographicSpec,
  ArtifactSourceType,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Pipeline API calls
// ---------------------------------------------------------------------------

/** Step 1 (YouTube only): extract transcript from a video */
export async function extractVideoTranscript(video: {
  videoId: string;
  videoUrl: string;
  videoTitle?: string;
  thumbnailUrl?: string;
}): Promise<{
  videoId: string;
  videoTitle: string;
  thumbnailUrl?: string;
  transcript: string;
}> {
  const response = await apiRequest("POST", "/api/youtube/process-video", {
    videoId: video.videoId,
    videoUrl: video.videoUrl,
    videoTitle: video.videoTitle,
    thumbnailUrl: video.thumbnailUrl,
  });
  return await response.json();
}

/** Step 2: summarize a transcript (shared by YouTube and Voice pipelines) */
export async function summarizeTranscript(
  transcript: string,
  sourceType: ArtifactSourceType,
  title?: string,
  objective?: string,
): Promise<GenerateSummaryResponse> {
  const response = await apiRequest("POST", "/api/pipeline/summarize", {
    transcript,
    title,
    objective,
    sourceType,
  });
  return await response.json();
}

/** Step 3: generate infographic spec from a summary (shared by both pipelines) */
export async function generateInfographic(
  summary: GenerateSummaryResponse,
  sourceType: ArtifactSourceType,
  title?: string,
): Promise<InfographicSpec> {
  const response = await apiRequest("POST", "/api/pipeline/infographic", {
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    tips: summary.tips,
    title,
    sourceType,
  });
  return await response.json();
}

// ---------------------------------------------------------------------------
// Full pipeline runner (transcript → summary → infographic)
// ---------------------------------------------------------------------------

export interface PipelineResult {
  transcript: string;
  summary: GenerateSummaryResponse;
  infographic: InfographicSpec;
}

/**
 * Run the full shared pipeline: summarize transcript → generate infographic.
 * The transcript must already be available (extracted from video or uploaded).
 */
export async function runPipeline(
  transcript: string,
  sourceType: ArtifactSourceType,
  title?: string,
  objective?: string,
): Promise<PipelineResult> {
  const summary = await summarizeTranscript(transcript, sourceType, title, objective);
  const infographic = await generateInfographic(summary, sourceType, title);
  return { transcript, summary, infographic };
}

// ---------------------------------------------------------------------------
// Document builder — shared markdown output
// ---------------------------------------------------------------------------

/**
 * Build a markdown infographic brief document from pipeline results.
 * Used identically by YouTube and Voice templates to produce the
 * document shown in the ReadingPane.
 */
export function buildInfographicBrief(
  result: PipelineResult,
  meta: {
    sourceLabel?: string;
    title?: string;
    sourceType: ArtifactSourceType;
  },
): string {
  const { summary, infographic } = result;
  const lines: string[] = [];

  lines.push(`# ${infographic.title}`);
  lines.push(`*${infographic.subtitle}*`);
  lines.push("");
  lines.push(`> Source: ${infographic.sourceLabel || meta.sourceLabel || (meta.sourceType === "youtube" ? "YouTube" : "Voice Capture")}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push(summary.summary);
  lines.push("");

  // Key Points
  lines.push("## Key Points");
  for (const kp of summary.keyPoints) {
    lines.push(`- ${kp}`);
  }
  lines.push("");

  // Tips & Advice
  if (summary.tips.length > 0) {
    lines.push("## Tips & Advice");
    for (const tip of summary.tips) {
      lines.push(`- ${tip}`);
    }
    lines.push("");
  }

  // Infographic Specification
  lines.push("## Infographic Specification");
  lines.push("");
  for (const section of infographic.sections) {
    lines.push(`### ${section.heading}`);
    lines.push(section.content);
    if (section.dataPoints && section.dataPoints.length > 0) {
      for (const dp of section.dataPoints) {
        lines.push(`- ${dp}`);
      }
    }
    lines.push("");
  }

  // Color Palette
  lines.push("## Color Palette");
  lines.push(infographic.colorPalette.map((c) => `\`${c}\``).join("  "));
  lines.push("");

  return lines.join("\n");
}

/**
 * Build a multi-video infographic document (YouTube channel mode).
 * Wraps multiple pipeline results into a single document.
 */
export function buildMultiVideoInfographicBrief(
  results: Array<PipelineResult & { videoTitle: string }>,
  channelTitle: string,
): string {
  const lines: string[] = [];
  lines.push(`# Infographic Brief — ${channelTitle}`);
  lines.push("");

  for (const result of results) {
    const brief = buildInfographicBrief(result, {
      sourceType: "youtube",
      title: result.videoTitle,
      sourceLabel: `YouTube: ${channelTitle} — ${result.videoTitle}`,
    });
    // Demote top-level heading to ## (since we have a channel-level #)
    lines.push(brief.replace(/^# /m, "## "));
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

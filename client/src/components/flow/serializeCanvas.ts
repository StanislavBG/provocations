/**
 * Canvas serialization utilities.
 *
 * Both Canvas save and Blueprint save use these functions so that node data
 * is serialized through an explicit whitelist rather than dumping the entire
 * FlowNode object (which can include heavy runtime state like base64 images,
 * unbounded conversation arrays, and transient status flags).
 */

import type { FlowNode, FlowEdge, FlowViewport, FlowNodeType } from "./useFlowCanvas";

/**
 * Serialize a single FlowNode for persistence.
 *
 * Picks structural + per-type configuration properties.  Excludes transient
 * runtime state (execution status, recording flags, pulse counters, search
 * results, post logs, etc.) that should not survive a save/load round-trip.
 */
export function serializeNodeForSave(node: FlowNode): Partial<FlowNode> {
  // ── Structural properties (every node type) ──
  const base: Partial<FlowNode> = {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    label: node.label,
    zIndex: node.zIndex,
    locked: node.locked,
    lockMode: node.lockMode,
    screenX: node.screenX,
    screenY: node.screenY,
    paused: node.paused,
    autoTriggerNext: node.autoTriggerNext,
    inputMode: node.inputMode,
    preProcess: node.preProcess,
    postProcess: node.postProcess,
    outputConfig: node.outputConfig,
    outputReplaceMode: node.outputReplaceMode,
  };

  // ── Per-type config & user content (varies by node type) ──
  // Runtime/transient fields are intentionally omitted:
  //   llmStatus, llmError, llmBaseStatus, llmBaseError,
  //   audioRecording, autoStartRecording, youtubeFetchStatus, youtubeError,
  //   youtubeSearchResults, youtubeUpstreamInput, timerRunning, timerPulseCount,
  //   timerLastPulse, gateOpen, socialGenStatus, apiAuthStatus, apiLastResult,
  //   apiPostLog, coherenceLastScore, coherenceLastVerdict, coherenceFailCount,
  //   coherenceLogOnPersistentFail, coherencePersistentFailThreshold,
  //   pulseSpeed, pulseOpacity, statusColorRunning, statusColorSuccess,
  //   statusColorFailure, failureAcknowledged, uploadStatus,
  //   notifyLastSent, notifyStatus, approvalResponderId, approvalResponderName,
  //   approvalRespondedAt

  const typeSerializers: Record<string, () => Partial<FlowNode>> = {
    "context-doc": () => ({ documentId: node.documentId, snippet: node.snippet, content: node.content }),
    research: () => ({ researchQuery: node.researchQuery, researchMessages: node.researchMessages }),
    llm: () => ({ llmPresetId: node.llmPresetId, llmObjective: node.llmObjective, content: node.content, llmOutput: node.llmOutput }),
    "llm-base": () => ({
      llmBaseModel: node.llmBaseModel,
      llmBaseTemperature: node.llmBaseTemperature,
      llmBaseTopP: node.llmBaseTopP,
      llmBaseTopK: node.llmBaseTopK,
      llmBaseMaxTokens: node.llmBaseMaxTokens,
      llmBaseSafety: node.llmBaseSafety,
      llmBaseEnableSearch: node.llmBaseEnableSearch,
      llmBaseSystemPrompt: node.llmBaseSystemPrompt,
      llmBaseUserPrompt: node.llmBaseUserPrompt,
      llmBaseOutput: node.llmBaseOutput,
      llmBaseStreaming: node.llmBaseStreaming,
    }),
    document: () => ({ documentContent: node.documentContent, documentObjective: node.documentObjective, content: node.content }),
    zone: () => ({ zoneColor: node.zoneColor, zoneLabel: node.zoneLabel }),
    label: () => ({ labelFontSize: node.labelFontSize, labelBold: node.labelBold, labelItalic: node.labelItalic, labelColor: node.labelColor }),
    audio: () => ({ audioTranscript: node.audioTranscript }),
    youtube: () => ({
      youtubeUrl: node.youtubeUrl,
      youtubeTitle: node.youtubeTitle,
      youtubeMode: node.youtubeMode,
      youtubeTopN: node.youtubeTopN,
      youtubeChapters: node.youtubeChapters,
      youtubeThumbnailUrl: node.youtubeThumbnailUrl,
      youtubeMetadata: node.youtubeMetadata,
      youtubeSelectedVideos: node.youtubeSelectedVideos,
      content: node.content,
    }),
    "timer-event": () => ({ triggerMode: node.triggerMode, timerInterval: node.timerInterval }),
    filter: () => ({ logicRule: node.logicRule }),
    gate: () => ({ logicRule: node.logicRule }),
    router: () => ({ routerOutputs: node.routerOutputs }),
    merge: () => ({}),
    interview: () => ({ interviewObjective: node.interviewObjective, interviewConfig: node.interviewConfig, interviewEntries: node.interviewEntries }),
    painter: () => ({ content: node.content, imageUrl: node.imageUrl }),
    timeline: () => ({ content: node.content }),
    "social-post": () => ({
      socialPlatforms: node.socialPlatforms,
      socialIntent: node.socialIntent,
      socialTone: node.socialTone,
      socialGenerateImages: node.socialGenerateImages,
      socialGeneratedPosts: node.socialGeneratedPosts,
    }),
    "api-connection": () => ({ apiService: node.apiService, apiWebhookUrl: node.apiWebhookUrl, apiCustomHeaders: node.apiCustomHeaders }),
    "coherence-gate": () => ({
      coherenceThreshold: node.coherenceThreshold,
      coherenceChecks: node.coherenceChecks,
      coherencePrompt: node.coherencePrompt,
      coherenceRetryCount: node.coherenceRetryCount,
      coherenceStrictness: node.coherenceStrictness,
    }),
    notification: () => ({
      notifyMessage: node.notifyMessage,
      notifyUserIds: node.notifyUserIds,
      notifyChannels: node.notifyChannels,
      notifyIncludeLink: node.notifyIncludeLink,
    }),
    upload: () => ({
      // Preserve file metadata but strip base64 dataUrl for files already
      // saved to the Context Store (identified by having a savedDocId).
      uploadFiles: node.uploadFiles?.map((f) => ({
        ...f,
        dataUrl: f.savedDocId ? "" : f.dataUrl,
      })),
    }),
    approval: () => ({ approvalMessage: node.approvalMessage, approvalUserIds: node.approvalUserIds, approvalStatus: node.approvalStatus }),
    webpage: () => ({
      htmlOutput: node.htmlOutput,
      webpageStylePreference: node.webpageStylePreference,
      webpageInstructions: node.webpageInstructions,
    }),
    "event-bus": () => ({
      eventBusMode: node.eventBusMode,
      eventBusChannel: node.eventBusChannel,
    }),
    store: () => ({
      storeFolderId: node.storeFolderId,
      storeFolderName: node.storeFolderName,
      storeFolderPath: node.storeFolderPath,
      storeName: node.storeName,
      storeAutoSave: node.storeAutoSave,
    }),
  };

  const typeConfig = typeSerializers[node.type]?.() ?? {};

  // Merge and strip undefined keys so JSON.stringify produces a clean payload.
  const merged = { ...base, ...typeConfig };
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return cleaned as Partial<FlowNode>;
}

/**
 * Serialize an entire canvas (nodes + edges + viewport) to a JSON string
 * suitable for storage via the document save API.
 *
 * @param excludeTypes  Node types to omit (default: ["store"])
 */
export function serializeCanvas(
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport: FlowViewport,
  opts?: { excludeTypes?: FlowNodeType[] },
): string {
  const exclude = new Set<FlowNodeType>(opts?.excludeTypes ?? ["store"]);
  const serializedNodes = nodes
    .filter((n) => !exclude.has(n.type))
    .map(serializeNodeForSave);
  return JSON.stringify({ nodes: serializedNodes, edges, viewport });
}

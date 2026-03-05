/**
 * Lifecycle handler factory index.
 *
 * Maps lifecycle presets to their handler constructors.
 */

import type { NodeLifecycleHandlers } from "../useNodeLifecycle";
import type { LifecyclePreset } from "../FlowNodeRegistry";
import { createResearchHandlers } from "./research";
import { createLlmHandlers } from "./llm";
import { createPainterHandlers } from "./painter";
import { createGenericHandlers } from "./generic";
import { createTimerHandlers } from "./timer";
import { createSocialPostHandlers } from "./social-post";
import { createApiConnectionHandlers } from "./api-connection";
import { createLogicHandlers } from "./logic";
import { createInterviewHandlers } from "./interview";

/** No-op handlers for passive nodes (document, context-doc, store, audio, label, zone) */
function createPassiveHandlers(): NodeLifecycleHandlers {
  return {
    onProcess: async () => "",
  };
}

const LIFECYCLE_FACTORIES: Record<LifecyclePreset, () => NodeLifecycleHandlers> = {
  stream: createResearchHandlers,
  llm: createLlmHandlers,
  media: createPainterHandlers,
  timer: createTimerHandlers,
  passive: createPassiveHandlers,
  social: createSocialPostHandlers,
  api: createApiConnectionHandlers,
  logic: createLogicHandlers,
  interview: createInterviewHandlers,
};

/** Get lifecycle handlers for a given lifecycle preset */
export function getLifecycleHandlers(preset: LifecyclePreset): NodeLifecycleHandlers {
  const factory = LIFECYCLE_FACTORIES[preset];
  return factory ? factory() : createPassiveHandlers();
}

export { createResearchHandlers } from "./research";
export { createLlmHandlers } from "./llm";
export { createPainterHandlers, parsePainterOutput } from "./painter";
export { createGenericHandlers } from "./generic";
export { createTimerHandlers } from "./timer";
export { createSocialPostHandlers } from "./social-post";
export { createApiConnectionHandlers } from "./api-connection";
export { createLogicHandlers } from "./logic";
export { createInterviewHandlers } from "./interview";

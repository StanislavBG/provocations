/**
 * Lazy-loaded expanded view registry (E5 optimization).
 *
 * Expanded views are only loaded when a user double-clicks a node to open its
 * full interactive overlay. This avoids bundling all 13+ expanded view components
 * in the initial FlowWorkspace chunk.
 *
 * Usage:
 *   const LazyLlmView = lazyExpandedViews["llm"];
 *   <Suspense fallback={<ExpandedViewSkeleton />}>
 *     <LazyLlmView {...props} />
 *   </Suspense>
 */

import { lazy } from "react";

export const lazyExpandedViews = {
  llm: lazy(() => import("./LlmExpandedView").then((m) => ({ default: m.LlmExpandedView }))),
  "llm-base": lazy(() => import("./LlmBaseExpandedView").then((m) => ({ default: m.LlmBaseExpandedView }))),
  audio: lazy(() => import("./AudioExpandedView").then((m) => ({ default: m.AudioExpandedView }))),
  youtube: lazy(() => import("./YoutubeExpandedView").then((m) => ({ default: m.YoutubeExpandedView }))),
  "timer-event": lazy(() => import("./TimerExpandedView").then((m) => ({ default: m.TimerExpandedView }))),
  filter: lazy(() => import("./LogicExpandedView").then((m) => ({ default: m.LogicExpandedView }))),
  gate: lazy(() => import("./LogicExpandedView").then((m) => ({ default: m.LogicExpandedView }))),
  router: lazy(() => import("./LogicExpandedView").then((m) => ({ default: m.LogicExpandedView }))),
  merge: lazy(() => import("./LogicExpandedView").then((m) => ({ default: m.LogicExpandedView }))),
  "social-post": lazy(() => import("./SocialPostExpandedView").then((m) => ({ default: m.SocialPostExpandedView }))),
  "api-connection": lazy(() => import("./ApiConnectionExpandedView").then((m) => ({ default: m.ApiConnectionExpandedView }))),
  "coherence-gate": lazy(() => import("./CoherenceGateExpandedView").then((m) => ({ default: m.CoherenceGateExpandedView }))),
  notification: lazy(() => import("./NotificationExpandedView").then((m) => ({ default: m.NotificationExpandedView }))),
  approval: lazy(() => import("./ApprovalExpandedView").then((m) => ({ default: m.ApprovalExpandedView }))),
  store: lazy(() => import("./StoreExpandedView").then((m) => ({ default: m.StoreExpandedView }))),
  upload: lazy(() => import("./UploadExpandedView").then((m) => ({ default: m.UploadExpandedView }))),
  webpage: lazy(() => import("./WebpageExpandedView").then((m) => ({ default: m.WebpageExpandedView }))),
  "event-bus": lazy(() => import("./EventBusExpandedView").then((m) => ({ default: m.EventBusExpandedView }))),
} as const;

export type LazyExpandedViewType = keyof typeof lazyExpandedViews;

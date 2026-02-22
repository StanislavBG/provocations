/**
 * URL-based App Launch Protocol — cross-app navigation via query parameters.
 *
 * Pattern:  /?app={templateId}&intent={action}&entityType={type}&entityId={id}&step={stepId}&source={callerApp}
 *
 * Example:  /?app=persona-definition&intent=edit&entityType=persona&entityId=architect&step=draft&source=admin
 */

import type { AppLaunchParams } from "@shared/schema";

const KNOWN_KEYS: (keyof AppLaunchParams)[] = ["app", "intent", "entityType", "entityId", "step", "source"];

/**
 * Parse URL query string into AppLaunchParams.
 * Returns params if either `app` or `intent` is present.
 * With path-based routing (/app/:templateId), `app` may be absent from the
 * query string while intent params are still present.
 */
export function parseAppLaunchParams(search: string): AppLaunchParams | null {
  const params = new URLSearchParams(search);
  const app = params.get("app");
  const intent = (params.get("intent") as AppLaunchParams["intent"]) ?? undefined;

  // Need either an app or an intent to have actionable params
  if (!app && !intent) return null;

  return {
    app: app ?? undefined,
    intent,
    entityType: params.get("entityType") ?? undefined,
    entityId: params.get("entityId") ?? undefined,
    step: params.get("step") ?? undefined,
    source: params.get("source") ?? undefined,
  };
}

/**
 * Build a URL path from AppLaunchParams.
 * Uses path-based routing: /app/{templateId}?intent=...&entityType=...
 * Falls back to query-string for backwards compat if no app is specified.
 */
export function buildAppLaunchUrl(params: AppLaunchParams): string {
  const extra = new URLSearchParams();
  for (const key of KNOWN_KEYS) {
    if (key === "app") continue; // app goes into the path
    const val = params[key];
    if (val !== undefined && val !== null) {
      extra.set(key, String(val));
    }
  }
  const qs = extra.toString();
  if (params.app) {
    return `/app/${params.app}${qs ? `?${qs}` : ""}`;
  }
  return `/?${qs}`;
}

/**
 * Clear launch params (query string only) from the browser URL without
 * triggering navigation. The path-based /app/:templateId is kept because
 * the Workspace component manages it via setSelectedTemplateId.
 */
export function clearLaunchParams(): void {
  if (typeof window !== "undefined" && window.location.search) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

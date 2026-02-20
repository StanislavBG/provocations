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
 * Returns null if the `app` param is missing (minimum required).
 */
export function parseAppLaunchParams(search: string): AppLaunchParams | null {
  const params = new URLSearchParams(search);
  const app = params.get("app");
  if (!app) return null;

  return {
    app,
    intent: (params.get("intent") as AppLaunchParams["intent"]) ?? undefined,
    entityType: params.get("entityType") ?? undefined,
    entityId: params.get("entityId") ?? undefined,
    step: params.get("step") ?? undefined,
    source: params.get("source") ?? undefined,
  };
}

/**
 * Build a URL path + query string from AppLaunchParams.
 * Only includes non-undefined values.
 */
export function buildAppLaunchUrl(params: AppLaunchParams): string {
  const searchParams = new URLSearchParams();
  for (const key of KNOWN_KEYS) {
    const val = params[key];
    if (val !== undefined && val !== null) {
      searchParams.set(key, String(val));
    }
  }
  return `/?${searchParams.toString()}`;
}

/**
 * Clear launch params from the browser URL without triggering navigation.
 * Called after Workspace consumes the params.
 */
export function clearLaunchParams(): void {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", "/");
  }
}

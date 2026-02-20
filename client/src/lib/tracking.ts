import type { TrackingEventType } from "@shared/schema";

/**
 * Lightweight client-side tracking — fires-and-forgets to /api/tracking/event.
 * Never blocks the UI, never stores user-inputted text.
 */

// Generate a stable session ID for the current browser session
const SESSION_ID =
  sessionStorage.getItem("prov-session-id") ??
  (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem("prov-session-id", id);
    return id;
  })();

export function trackEvent(
  eventType: TrackingEventType,
  opts?: {
    personaId?: string;
    templateId?: string;
    appSection?: string;
    metadata?: Record<string, string>;
  }
): void {
  try {
    const body = {
      eventType,
      personaId: opts?.personaId,
      templateId: opts?.templateId,
      appSection: opts?.appSection,
      metadata: opts?.metadata,
    };

    // Fire-and-forget — tracking must never block the user
    fetch("/api/tracking/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": SESSION_ID,
      },
      body: JSON.stringify(body),
      // Use keepalive so the request survives page transitions
      keepalive: true,
    }).catch(() => {
      // silently ignore — tracking is non-critical
    });
  } catch {
    // silently ignore
  }
}

/**
 * Per-app workspace configuration.
 *
 * Maps the first template selection (e.g. "write-a-prompt", "streaming")
 * to workspace-level behaviors: which toolbox tab opens by default,
 * whether the interview auto-starts, etc.
 *
 * Add new entries here when a template needs distinct workspace behavior.
 */

import type { ProvocationType } from "@shared/schema";

export interface AppWorkspaceConfig {
  /** Which toolbox tab to activate when entering the workspace */
  defaultToolboxTab: "provoke" | "website" | "context";
  /** Whether to auto-start the interview (Provoke) on workspace entry */
  autoStartInterview: boolean;
  /** Personas to auto-start with when autoStartInterview is true */
  autoStartPersonas?: ProvocationType[];
}

/**
 * Template-specific overrides. Only templates that differ from the default
 * need an entry here.
 */
const overrides: Partial<Record<string, Partial<AppWorkspaceConfig>>> = {
  streaming: {
    defaultToolboxTab: "website",
    autoStartInterview: false,
  },
};

const DEFAULT_CONFIG: AppWorkspaceConfig = {
  defaultToolboxTab: "provoke",
  autoStartInterview: true,
  autoStartPersonas: ["thinking_bigger"],
};

/**
 * Look up the workspace config for a given template.
 * Falls back to DEFAULT_CONFIG for unknown or null IDs.
 */
export function getAppWorkspaceConfig(
  templateId: string | null | undefined,
): AppWorkspaceConfig {
  if (!templateId) return DEFAULT_CONFIG;
  const override = overrides[templateId];
  if (!override) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...override };
}

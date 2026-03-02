import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolId =
  | "research"
  | "document"
  | "provo"
  | "notes"
  | "writer"
  | "painter"
  | "context"
  | "interview"
  | "chart"
  | "timeline";

export type DockPosition = "top" | "bottom" | "left" | "right";
export type StatusBarPosition = "top" | "bottom";

export interface DockItem {
  toolId: ToolId;
  label: string;
  icon: string; // Lucide icon name
}

export const DEFAULT_DOCK_ITEMS: DockItem[] = [
  { toolId: "research", label: "Research", icon: "Sparkles" },
  { toolId: "document", label: "Document", icon: "FileText" },
  { toolId: "provo", label: "Provo", icon: "Users" },
  { toolId: "notes", label: "Notes", icon: "ClipboardList" },
  { toolId: "writer", label: "Writer", icon: "Wand2" },
  { toolId: "painter", label: "Painter", icon: "Paintbrush" },
];

export interface FtuxShellConfig {
  dockPosition: DockPosition;
  dockItems: DockItem[];
  dockTranslucency: number; // 0-100
  dockAutoHide: boolean;
  statusBarPosition: StatusBarPosition;
  statusBarPinnedItems: string[];
  tipsEnabled: boolean;
  tipsDismissed: string[];
}

export const DEFAULT_SHELL_CONFIG: FtuxShellConfig = {
  dockPosition: "bottom",
  dockItems: DEFAULT_DOCK_ITEMS,
  dockTranslucency: 75,
  dockAutoHide: false,
  statusBarPosition: "top",
  statusBarPinnedItems: [],
  tipsEnabled: true,
  tipsDismissed: [],
};

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export interface FtuxShellContextValue extends FtuxShellConfig {
  // Active tool
  activeTool: ToolId | null;
  previousTool: ToolId | null;

  // Workflow
  activeStep: number;

  // Actions
  setActiveTool: (tool: ToolId | null) => void;
  setActiveStep: (step: number) => void;
  setDockPosition: (pos: DockPosition) => void;
  setDockItems: (items: DockItem[]) => void;
  reorderDockItems: (fromIndex: number, toIndex: number) => void;
  setDockTranslucency: (val: number) => void;
  setDockAutoHide: (val: boolean) => void;
  setStatusBarPosition: (pos: StatusBarPosition) => void;
  addStatusBarPinnedItem: (toolId: string) => void;
  removeStatusBarPinnedItem: (toolId: string) => void;
  addDockItem: (item: DockItem) => void;
  removeDockItem: (toolId: ToolId) => void;
  setTipsEnabled: (val: boolean) => void;
  dismissTip: (tipId: string) => void;
  resetTips: () => void;
  resetDock: () => void;

  // Persistence callback
  persistConfig: (config: FtuxShellConfig) => void;
}

const FtuxShellContext = createContext<FtuxShellContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface FtuxShellProviderProps {
  children: ReactNode;
  initialConfig?: FtuxShellConfig;
  onConfigChange?: (config: FtuxShellConfig) => void;
}

export function FtuxShellProvider({ children, initialConfig, onConfigChange }: FtuxShellProviderProps) {
  const [config, setConfig] = useState<FtuxShellConfig>(initialConfig ?? DEFAULT_SHELL_CONFIG);
  const [activeTool, setActiveToolState] = useState<ToolId | null>("research");
  const [previousTool, setPreviousTool] = useState<ToolId | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const persistConfig = useCallback(
    (next: FtuxShellConfig) => {
      setConfig(next);
      onConfigChange?.(next);
    },
    [onConfigChange],
  );

  const updateConfig = useCallback(
    (updater: (prev: FtuxShellConfig) => FtuxShellConfig) => {
      setConfig((prev) => {
        const next = updater(prev);
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange],
  );

  const setActiveTool = useCallback(
    (tool: ToolId | null) => {
      setActiveToolState((prev) => {
        setPreviousTool(prev);
        return tool;
      });
    },
    [],
  );

  const setDockPosition = useCallback(
    (pos: DockPosition) => updateConfig((c) => ({ ...c, dockPosition: pos })),
    [updateConfig],
  );

  const setDockItems = useCallback(
    (items: DockItem[]) => updateConfig((c) => ({ ...c, dockItems: items })),
    [updateConfig],
  );

  const reorderDockItems = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateConfig((c) => {
        const items = [...c.dockItems];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        return { ...c, dockItems: items };
      });
    },
    [updateConfig],
  );

  const setDockTranslucency = useCallback(
    (val: number) => updateConfig((c) => ({ ...c, dockTranslucency: val })),
    [updateConfig],
  );

  const setDockAutoHide = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, dockAutoHide: val })),
    [updateConfig],
  );

  const setStatusBarPosition = useCallback(
    (pos: StatusBarPosition) => updateConfig((c) => ({ ...c, statusBarPosition: pos })),
    [updateConfig],
  );

  const addStatusBarPinnedItem = useCallback(
    (toolId: string) =>
      updateConfig((c) => ({
        ...c,
        statusBarPinnedItems: c.statusBarPinnedItems.includes(toolId)
          ? c.statusBarPinnedItems
          : [...c.statusBarPinnedItems, toolId],
      })),
    [updateConfig],
  );

  const removeStatusBarPinnedItem = useCallback(
    (toolId: string) =>
      updateConfig((c) => ({
        ...c,
        statusBarPinnedItems: c.statusBarPinnedItems.filter((id) => id !== toolId),
      })),
    [updateConfig],
  );

  const addDockItem = useCallback(
    (item: DockItem) =>
      updateConfig((c) => ({
        ...c,
        dockItems: c.dockItems.some((d) => d.toolId === item.toolId)
          ? c.dockItems
          : [...c.dockItems, item],
      })),
    [updateConfig],
  );

  const removeDockItem = useCallback(
    (toolId: ToolId) =>
      updateConfig((c) => ({
        ...c,
        dockItems: c.dockItems.filter((d) => d.toolId !== toolId),
      })),
    [updateConfig],
  );

  const setTipsEnabled = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, tipsEnabled: val })),
    [updateConfig],
  );

  const dismissTip = useCallback(
    (tipId: string) =>
      updateConfig((c) => ({
        ...c,
        tipsDismissed: c.tipsDismissed.includes(tipId)
          ? c.tipsDismissed
          : [...c.tipsDismissed, tipId],
      })),
    [updateConfig],
  );

  const resetTips = useCallback(
    () => updateConfig((c) => ({ ...c, tipsDismissed: [], tipsEnabled: true })),
    [updateConfig],
  );

  const resetDock = useCallback(
    () =>
      updateConfig((c) => ({
        ...c,
        dockPosition: DEFAULT_SHELL_CONFIG.dockPosition,
        dockItems: DEFAULT_SHELL_CONFIG.dockItems,
        dockTranslucency: DEFAULT_SHELL_CONFIG.dockTranslucency,
        dockAutoHide: DEFAULT_SHELL_CONFIG.dockAutoHide,
      })),
    [updateConfig],
  );

  const value: FtuxShellContextValue = {
    ...config,
    activeTool,
    previousTool,
    activeStep,
    setActiveTool,
    setActiveStep,
    setDockPosition,
    setDockItems,
    reorderDockItems,
    setDockTranslucency,
    setDockAutoHide,
    setStatusBarPosition,
    addStatusBarPinnedItem,
    removeStatusBarPinnedItem,
    addDockItem,
    removeDockItem,
    setTipsEnabled,
    dismissTip,
    resetTips,
    resetDock,
    persistConfig,
  };

  return <FtuxShellContext.Provider value={value}>{children}</FtuxShellContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFtuxShell(): FtuxShellContextValue {
  const ctx = useContext(FtuxShellContext);
  if (!ctx) throw new Error("useFtuxShell must be used within a FtuxShellProvider");
  return ctx;
}

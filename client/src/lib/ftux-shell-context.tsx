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
  | "timeline"
  | "llm";

export type DockPosition = "top" | "bottom" | "left" | "right";
export type StatusBarPosition = "top" | "bottom";
export type DockGroup = "gather" | "workshop" | "build";

export type OutputType = "blog-post" | "infographic" | "prd" | "timeline" | "research-paper";

export interface ActiveWorkflow {
  outputType: OutputType;
  currentStep: number; // 0=Gather, 1=Workshop, 2=Build
  buildTool: ToolId;   // Which Build tool this workflow targets
}

export interface DockItem {
  toolId: ToolId;
  label: string;
  icon: string; // Lucide icon name
  group?: DockGroup;
}

export const DEFAULT_DOCK_ITEMS: DockItem[] = [
  { toolId: "context", label: "Context Store", icon: "BookOpen", group: "gather" },
  { toolId: "document", label: "Document", icon: "FileText", group: "gather" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop" },
  { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", group: "workshop" },
  { toolId: "provo", label: "Provocations", icon: "Users", group: "workshop" },
];

export interface FtuxShellConfig {
  dockPosition: DockPosition;
  dockItems: DockItem[];
  dockTranslucency: number; // 0-100
  dockAutoHide: boolean;
  dockColor: string | null;        // null = theme default, or hex color
  dockShowLabels: boolean;
  dockShowGroupLabels: boolean;
  statusBarPosition: StatusBarPosition;
  statusBarPinnedItems: string[];
  statusBarTranslucency: number;   // 0-100
  statusBarColor: string | null;
  tipsEnabled: boolean;
  tipsDismissed: string[];
  tipsTranslucency: number;        // 0-100
  tipsColor: string | null;
  tourCompleted: boolean;
}

export const DEFAULT_SHELL_CONFIG: FtuxShellConfig = {
  dockPosition: "bottom",
  dockItems: DEFAULT_DOCK_ITEMS,
  dockTranslucency: 75,
  dockAutoHide: false,
  dockColor: null,
  dockShowLabels: false,
  dockShowGroupLabels: false,
  statusBarPosition: "top",
  statusBarPinnedItems: [],
  statusBarTranslucency: 85,
  statusBarColor: null,
  tipsEnabled: true,
  tipsDismissed: [],
  tipsTranslucency: 90,
  tipsColor: null,
  tourCompleted: false,
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
  activeWorkflow: ActiveWorkflow | null;

  // Actions
  setActiveTool: (tool: ToolId | null) => void;
  setActiveStep: (step: number) => void;
  setDockPosition: (pos: DockPosition) => void;
  setDockItems: (items: DockItem[]) => void;
  reorderDockItems: (fromIndex: number, toIndex: number) => void;
  setDockTranslucency: (val: number) => void;
  setDockAutoHide: (val: boolean) => void;
  setDockColor: (val: string | null) => void;
  setDockShowLabels: (val: boolean) => void;
  setDockShowGroupLabels: (val: boolean) => void;
  setStatusBarPosition: (pos: StatusBarPosition) => void;
  setStatusBarTranslucency: (val: number) => void;
  setStatusBarColor: (val: string | null) => void;
  addStatusBarPinnedItem: (toolId: string) => void;
  removeStatusBarPinnedItem: (toolId: string) => void;
  addDockItem: (item: DockItem) => void;
  removeDockItem: (toolId: ToolId) => void;
  setTipsEnabled: (val: boolean) => void;
  setTipsTranslucency: (val: number) => void;
  setTipsColor: (val: string | null) => void;
  dismissTip: (tipId: string) => void;
  resetTips: () => void;
  resetDock: () => void;
  setTourCompleted: (val: boolean) => void;

  // Workflow actions
  startWorkflow: (outputType: OutputType, buildTool: ToolId) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitWorkflow: () => void;

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
  const [activeTool, setActiveToolState] = useState<ToolId | null>(null);
  const [previousTool, setPreviousTool] = useState<ToolId | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null);

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

  const setDockColor = useCallback(
    (val: string | null) => updateConfig((c) => ({ ...c, dockColor: val })),
    [updateConfig],
  );

  const setDockShowLabels = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, dockShowLabels: val })),
    [updateConfig],
  );

  const setDockShowGroupLabels = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, dockShowGroupLabels: val })),
    [updateConfig],
  );

  const setStatusBarPosition = useCallback(
    (pos: StatusBarPosition) => updateConfig((c) => ({ ...c, statusBarPosition: pos })),
    [updateConfig],
  );

  const setStatusBarTranslucency = useCallback(
    (val: number) => updateConfig((c) => ({ ...c, statusBarTranslucency: val })),
    [updateConfig],
  );

  const setStatusBarColor = useCallback(
    (val: string | null) => updateConfig((c) => ({ ...c, statusBarColor: val })),
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

  const setTipsTranslucency = useCallback(
    (val: number) => updateConfig((c) => ({ ...c, tipsTranslucency: val })),
    [updateConfig],
  );

  const setTipsColor = useCallback(
    (val: string | null) => updateConfig((c) => ({ ...c, tipsColor: val })),
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
        dockColor: DEFAULT_SHELL_CONFIG.dockColor,
        dockShowLabels: DEFAULT_SHELL_CONFIG.dockShowLabels,
        dockShowGroupLabels: DEFAULT_SHELL_CONFIG.dockShowGroupLabels,
      })),
    [updateConfig],
  );

  const setTourCompleted = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, tourCompleted: val })),
    [updateConfig],
  );

  // Workflow actions
  const startWorkflow = useCallback(
    (outputType: OutputType, buildTool: ToolId) => {
      setActiveWorkflow({ outputType, currentStep: 0, buildTool });
      setActiveStep(0);
      setActiveToolState("context");
    },
    [],
  );

  const nextStep = useCallback(() => {
    setActiveWorkflow((prev) => {
      if (!prev || prev.currentStep >= 2) return prev;
      const next = { ...prev, currentStep: prev.currentStep + 1 };
      setActiveStep(next.currentStep);
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setActiveWorkflow((prev) => {
      if (!prev || prev.currentStep <= 0) return prev;
      const next = { ...prev, currentStep: prev.currentStep - 1 };
      setActiveStep(next.currentStep);
      return next;
    });
  }, []);

  const exitWorkflow = useCallback(() => {
    setActiveWorkflow(null);
    setActiveStep(0);
    setActiveToolState(null);
  }, []);

  const value: FtuxShellContextValue = {
    ...config,
    activeTool,
    previousTool,
    activeStep,
    activeWorkflow,
    setActiveTool,
    setActiveStep,
    setDockPosition,
    setDockItems,
    reorderDockItems,
    setDockTranslucency,
    setDockAutoHide,
    setDockColor,
    setDockShowLabels,
    setDockShowGroupLabels,
    setStatusBarPosition,
    setStatusBarTranslucency,
    setStatusBarColor,
    addStatusBarPinnedItem,
    removeStatusBarPinnedItem,
    addDockItem,
    removeDockItem,
    setTipsEnabled,
    setTipsTranslucency,
    setTipsColor,
    dismissTip,
    resetTips,
    resetDock,
    setTourCompleted,
    startWorkflow,
    nextStep,
    prevStep,
    exitWorkflow,
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

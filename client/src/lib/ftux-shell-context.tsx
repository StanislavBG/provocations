import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { type ThemePreference, type PaletteId, applyThemeToDOM, applyPaletteToDOM } from "./theme-utils";

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
  | "llm"
  | "zone"
  | "audio"
  | "youtube"
  | "timer-event"
  | "logic"
  | "label"
  | "social-post"
  | "api-connection";

export type DockPosition = "top" | "bottom" | "left" | "right";
export type StatusBarPosition = "top" | "bottom";
export type DockGroup = "gather" | "workshop" | "build";

export type OutputType = "blog-post" | "infographic" | "prd" | "timeline" | "research-paper" | "slide-deck";

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

export type DockButtonSize = "small" | "medium" | "large";

export interface FtuxShellConfig {
  dockPosition: DockPosition;
  dockItems: DockItem[];
  dockTranslucency: number; // 0-100
  dockAutoHide: boolean;
  dockHidden: boolean;              // completely hide dock
  dockColor: string | null;        // null = theme default, or hex color
  dockShowLabels: boolean;
  dockShowGroupLabels: boolean;
  dockButtonSize: DockButtonSize;
  dockSnapped: boolean;            // snap to edge, full-width bar
  canvasFontSize: number;          // px (default 14)
  canvasFontColor: string | null;  // hex override or null for theme default
  canvasBgColor: string | null;    // hex override or null for theme default
  canvasTheme: string;             // canvas theme key (default "aurora")
  statusBarPosition: StatusBarPosition;
  statusBarPinnedItems: string[];
  statusBarTranslucency: number;   // 0-100
  statusBarColor: string | null;
  tipsEnabled: boolean;
  tipsDismissed: string[];
  tipsTranslucency: number;        // 0-100
  tipsColor: string | null;
  tourCompleted: boolean;
  theme: ThemePreference;
  palette: PaletteId;
}

export const DEFAULT_SHELL_CONFIG: FtuxShellConfig = {
  dockPosition: "bottom",
  dockItems: DEFAULT_DOCK_ITEMS,
  dockTranslucency: 75,
  dockAutoHide: false,
  dockHidden: false,
  dockColor: null,
  dockShowLabels: false,
  dockShowGroupLabels: false,
  dockButtonSize: "medium",
  dockSnapped: false,
  canvasFontSize: 14,
  canvasFontColor: null,
  canvasBgColor: null,
  canvasTheme: "aurora",
  statusBarPosition: "top",
  statusBarPinnedItems: [],
  statusBarTranslucency: 85,
  statusBarColor: null,
  tipsEnabled: true,
  tipsDismissed: [],
  tipsTranslucency: 90,
  tipsColor: null,
  tourCompleted: false,
  theme: "system",
  palette: "ember",
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
  setDockHidden: (val: boolean) => void;
  setDockColor: (val: string | null) => void;
  setDockShowLabels: (val: boolean) => void;
  setDockShowGroupLabels: (val: boolean) => void;
  setDockButtonSize: (val: DockButtonSize) => void;
  setDockSnapped: (val: boolean) => void;
  setCanvasFontSize: (val: number) => void;
  setCanvasFontColor: (val: string | null) => void;
  setCanvasBgColor: (val: string | null) => void;
  setCanvasTheme: (val: string) => void;
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
  setTheme: (val: ThemePreference) => void;
  setPalette: (val: PaletteId) => void;

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

  const setDockHidden = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, dockHidden: val })),
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

  const setDockButtonSize = useCallback(
    (val: DockButtonSize) => updateConfig((c) => ({ ...c, dockButtonSize: val })),
    [updateConfig],
  );

  const setDockSnapped = useCallback(
    (val: boolean) => updateConfig((c) => ({ ...c, dockSnapped: val })),
    [updateConfig],
  );

  const setCanvasFontSize = useCallback(
    (val: number) => updateConfig((c) => ({ ...c, canvasFontSize: val })),
    [updateConfig],
  );

  const setCanvasFontColor = useCallback(
    (val: string | null) => updateConfig((c) => ({ ...c, canvasFontColor: val })),
    [updateConfig],
  );

  const setCanvasBgColor = useCallback(
    (val: string | null) => updateConfig((c) => ({ ...c, canvasBgColor: val })),
    [updateConfig],
  );

  const setCanvasTheme = useCallback(
    (val: string) => updateConfig((c) => ({ ...c, canvasTheme: val })),
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
        dockHidden: DEFAULT_SHELL_CONFIG.dockHidden,
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

  const setTheme = useCallback(
    (val: ThemePreference) => updateConfig((c) => ({ ...c, theme: val })),
    [updateConfig],
  );

  const setPalette = useCallback(
    (val: PaletteId) => updateConfig((c) => ({ ...c, palette: val })),
    [updateConfig],
  );

  // Apply theme/palette to DOM whenever config changes
  useEffect(() => {
    applyThemeToDOM(config.theme);
  }, [config.theme]);

  useEffect(() => {
    applyPaletteToDOM(config.palette);
  }, [config.palette]);

  // Sync initialConfig prop into state when API data arrives after mount
  const initialConfigRef = useRef(initialConfig);
  useEffect(() => {
    if (initialConfig && initialConfig !== initialConfigRef.current) {
      initialConfigRef.current = initialConfig;
      setConfig(initialConfig);
    }
  }, [initialConfig]);

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
    setDockHidden,
    setDockColor,
    setDockShowLabels,
    setDockShowGroupLabels,
    setDockButtonSize,
    setDockSnapped,
    setCanvasFontSize,
    setCanvasFontColor,
    setCanvasBgColor,
    setCanvasTheme,
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
    setTheme,
    setPalette,
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

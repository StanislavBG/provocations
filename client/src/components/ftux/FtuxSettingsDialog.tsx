import { useState, useEffect } from "react";
import { useFtuxShell, type DockPosition } from "@/lib/ftux-shell-context";
import {
  KEYBIND_ACTIONS,
  getEffectiveKeys,
  formatCombo,
  eventToCombo,
  type KeyBindActionId,
  type KeyBindAction,
} from "@/lib/keybind-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FTUX_TIPS } from "@/lib/ftux-tips";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  RotateCcw,
  Play,
  Keyboard,
  Sparkles,
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  Brain,
  AudioLines,
  Youtube,
  Timer,
  CircuitBoard,
  SquareDashedBottom,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, FileText, Users, ClipboardList, Wand2,
  Paintbrush, BookOpen, MessageCircleQuestion, BarChart3, Clock,
  Brain, AudioLines, Youtube, Timer, CircuitBoard, SquareDashedBottom, Type: TypeIcon,
};

const COLOR_PRESETS = [
  { label: "Default", value: null },
  { label: "Dark", value: "#1a1a2e" },
  { label: "Warm", value: "#2d1b0e" },
  { label: "Cool", value: "#0e1b2d" },
  { label: "Forest", value: "#0e2d1b" },
  { label: "Plum", value: "#2d0e2a" },
];

const FONT_SIZE_PRESETS = [12, 14, 16, 18, 20];



interface FtuxSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FtuxSettingsDialog({ open, onOpenChange }: FtuxSettingsDialogProps) {
  const shell = useFtuxShell();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-serif">Shell Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dock" className="mt-2">
          <TabsList className="w-full flex-wrap h-auto gap-0.5 p-0.5">
            <TabsTrigger value="dock" className="flex-1 text-[11px] sm:text-xs min-w-[60px]">Dock</TabsTrigger>
            <TabsTrigger value="statusbar" className="flex-1 text-[11px] sm:text-xs min-w-[70px]">Status Bar</TabsTrigger>
            <TabsTrigger value="tips" className="flex-1 text-[11px] sm:text-xs min-w-[40px]">Tips</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1 text-[11px] sm:text-xs min-w-[50px]">Theme</TabsTrigger>
            <TabsTrigger value="keybinds" className="flex-1 text-[11px] sm:text-xs min-w-[70px]">Key Binds</TabsTrigger>
          </TabsList>

          {/* Dock settings */}
          <TabsContent value="dock" className="space-y-4 mt-4">
            {/* Show/hide dock */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Dock</Label>
              <Switch
                checked={!shell.dockHidden}
                onCheckedChange={(val) => shell.setDockHidden(!val)}
              />
            </div>

            <Separator />

            {/* Position */}
            <div className="space-y-2">
              <Label className="text-xs">Position</Label>
              <div className="flex items-center justify-center gap-1">
                <div className="grid grid-cols-3 grid-rows-3 gap-1 w-24 h-24">
                  <div />
                  <PositionButton
                    position="top"
                    current={shell.dockPosition}
                    onSelect={shell.setDockPosition}
                    icon={<ArrowUp className="w-3 h-3" />}
                  />
                  <div />
                  <PositionButton
                    position="left"
                    current={shell.dockPosition}
                    onSelect={shell.setDockPosition}
                    icon={<ArrowLeft className="w-3 h-3" />}
                  />
                  <div className="flex items-center justify-center rounded bg-muted/50 text-[9px] text-muted-foreground">
                    Dock
                  </div>
                  <PositionButton
                    position="right"
                    current={shell.dockPosition}
                    onSelect={shell.setDockPosition}
                    icon={<ArrowRight className="w-3 h-3" />}
                  />
                  <div />
                  <PositionButton
                    position="bottom"
                    current={shell.dockPosition}
                    onSelect={shell.setDockPosition}
                    icon={<ArrowDown className="w-3 h-3" />}
                  />
                  <div />
                </div>
              </div>
            </div>

            {/* Translucency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Translucency</Label>
                <span className="text-[10px] text-muted-foreground">{shell.dockTranslucency}%</span>
              </div>
              <Slider
                value={[shell.dockTranslucency]}
                onValueChange={([val]) => shell.setDockTranslucency(val)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              {/* Preview */}
              <div
                className="h-8 rounded-lg border"
                style={{
                  background: shell.dockColor
                    ? hexToRgba(shell.dockColor, shell.dockTranslucency / 100)
                    : `hsl(var(--card) / ${shell.dockTranslucency / 100})`,
                  backdropFilter: `blur(${Math.round((shell.dockTranslucency / 100) * 24)}px)`,
                }}
              />
            </div>

            {/* Color presets */}
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => shell.setDockColor(preset.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      shell.dockColor === preset.value
                        ? "border-primary scale-110"
                        : "border-border/50 hover:border-border",
                    )}
                    style={{
                      background: preset.value ?? "hsl(var(--card))",
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            {/* Labels */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Item Labels</Label>
              <Switch
                checked={shell.dockShowLabels}
                onCheckedChange={shell.setDockShowLabels}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Group Labels</Label>
              <Switch
                checked={shell.dockShowGroupLabels}
                onCheckedChange={shell.setDockShowGroupLabels}
              />
            </div>

            {/* Auto-hide */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-hide</Label>
              <Switch
                checked={shell.dockAutoHide}
                onCheckedChange={shell.setDockAutoHide}
              />
            </div>

            {/* Snap to edge */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Snap to Edge</Label>
              <Switch
                checked={shell.dockSnapped ?? false}
                onCheckedChange={shell.setDockSnapped}
              />
            </div>

            {/* Button size */}
            <div className="space-y-1">
              <Label className="text-xs">Button Size</Label>
              <div className="flex gap-1">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                      (shell.dockButtonSize ?? "medium") === size
                        ? "bg-primary/15 border-primary/40 text-primary font-medium"
                        : "border-border/40 text-muted-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => shell.setDockButtonSize(size)}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={shell.resetDock}
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              Reset Dock
            </Button>
          </TabsContent>

          {/* Status Bar settings */}
          <TabsContent value="statusbar" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs">Position</Label>
              <div className="flex gap-2">
                <Button
                  variant={shell.statusBarPosition === "top" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => shell.setStatusBarPosition("top")}
                >
                  <ArrowUp className="w-3 h-3 mr-1" />
                  Top
                </Button>
                <Button
                  variant={shell.statusBarPosition === "bottom" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => shell.setStatusBarPosition("bottom")}
                >
                  <ArrowDown className="w-3 h-3 mr-1" />
                  Bottom
                </Button>
              </div>
            </div>

            {/* Translucency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Translucency</Label>
                <span className="text-[10px] text-muted-foreground">{shell.statusBarTranslucency ?? 85}%</span>
              </div>
              <Slider
                value={[shell.statusBarTranslucency ?? 85]}
                onValueChange={([val]) => shell.setStatusBarTranslucency(val)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <div
                className="h-6 rounded-lg border"
                style={{
                  background: shell.statusBarColor
                    ? hexToRgba(shell.statusBarColor, (shell.statusBarTranslucency ?? 85) / 100)
                    : `hsl(var(--card) / ${(shell.statusBarTranslucency ?? 85) / 100})`,
                  backdropFilter: `blur(${Math.round(((shell.statusBarTranslucency ?? 85) / 100) * 24)}px)`,
                }}
              />
            </div>

            {/* Color presets */}
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => shell.setStatusBarColor(preset.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      shell.statusBarColor === preset.value
                        ? "border-primary scale-110"
                        : "border-border/50 hover:border-border",
                    )}
                    style={{
                      background: preset.value ?? "hsl(var(--card))",
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Pinned Items</Label>
              <p className="text-[10px] text-muted-foreground/60">
                Toggle tools to pin/unpin them from the status bar.
              </p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {shell.dockItems.map((item) => {
                  const isPinned = shell.statusBarPinnedItems.includes(item.toolId);
                  const IconComp = ICON_MAP[item.icon] ?? Sparkles;
                  return (
                    <div
                      key={item.toolId}
                      className="flex items-center justify-between rounded-lg border px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <IconComp className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs">{item.label}</span>
                      </div>
                      <Switch
                        checked={isPinned}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            shell.addStatusBarPinnedItem(item.toolId);
                          } else {
                            shell.removeStatusBarPinnedItem(item.toolId);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Tips settings */}
          <TabsContent value="tips" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Tips</Label>
              <Switch
                checked={shell.tipsEnabled}
                onCheckedChange={shell.setTipsEnabled}
              />
            </div>

            {/* Translucency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Translucency</Label>
                <span className="text-[10px] text-muted-foreground">{shell.tipsTranslucency ?? 90}%</span>
              </div>
              <Slider
                value={[shell.tipsTranslucency ?? 90]}
                onValueChange={([val]) => shell.setTipsTranslucency(val)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Color presets */}
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => shell.setTipsColor(preset.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      shell.tipsColor === preset.value
                        ? "border-primary scale-110"
                        : "border-border/50 hover:border-border",
                    )}
                    style={{
                      background: preset.value ?? "hsl(var(--card))",
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs">Dismissed Tips</p>
                <p className="text-[10px] text-muted-foreground">
                  {shell.tipsDismissed.length} of {FTUX_TIPS.length} dismissed
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={shell.resetTips}
                disabled={shell.tipsDismissed.length === 0}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {FTUX_TIPS.length - shell.tipsDismissed.length} remaining
              </Badge>
            </div>

            <Separator />

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => shell.setTourCompleted(false)}
            >
              <Play className="w-3 h-3 mr-1.5" />
              Replay Tour
            </Button>
          </TabsContent>

          {/* Appearance settings */}
          <TabsContent value="appearance" className="space-y-4 mt-4 max-h-[400px] overflow-y-auto pr-1">
            <div className="text-[10px] text-muted-foreground">
              Canvas style (theme, palette, dark/light) is controlled via the paintbrush button in the status bar.
            </div>

            {/* Canvas Font Size */}
            <div className="space-y-1">
              <Label className="text-xs">Canvas Font Size</Label>
              <div className="flex gap-1">
                {FONT_SIZE_PRESETS.map((size) => (
                  <button
                    key={size}
                    className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                      (shell.canvasFontSize ?? 14) === size
                        ? "bg-primary/15 border-primary/40 text-primary font-medium"
                        : "border-border/40 text-muted-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => shell.setCanvasFontSize(size)}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Key Binds */}
          <TabsContent value="keybinds" className="mt-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {(["Canvas", "Selection", "Edit"] as const).map((group) => (
                <KeybindGroup key={group} title={group}>
                  {KEYBIND_ACTIONS
                    .filter((a) => a.group === group)
                    .map((action) => (
                      <EditableKeybindRow
                        key={action.id}
                        action={action}
                        currentKeys={getEffectiveKeys(action.id, shell.keyBinds)}
                        isCustomized={!!shell.keyBinds?.[action.id]}
                        onSave={(keys) => shell.setKeyBind(action.id, keys)}
                        onReset={() => shell.resetKeyBind(action.id)}
                      />
                    ))}
                </KeybindGroup>
              ))}

              {/* Non-customizable (mouse-based) */}
              <KeybindGroup title="Mouse">
                <KeybindRow keys={["Scroll"]} description="Zoom in / out" />
                <KeybindRow keys={["Space", "Drag"]} description="Pan canvas" />
                <KeybindRow keys={["Shift", "Drag"]} description="Marquee select" />
                <KeybindRow keys={["Shift", "Click"]} description="Toggle select node" />
              </KeybindGroup>
              <KeybindGroup title="Dock">
                <KeybindRow keys={["1-9"]} description="Place dock item at cursor" />
              </KeybindGroup>

              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => shell.resetAllKeyBinds()}
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Reset All Key Binds
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function PositionButton({
  position,
  current,
  onSelect,
  icon,
}: {
  position: DockPosition;
  current: DockPosition;
  onSelect: (pos: DockPosition) => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onSelect(position)}
      className={cn(
        "flex items-center justify-center rounded-md border transition-colors",
        current === position
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60",
      )}
    >
      {icon}
    </button>
  );
}

// ── Key Binds helpers ──

function KeybindGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** Static read-only keybind row (for mouse-based / non-customizable shortcuts). */
function KeybindRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/30">
      <span className="text-xs text-muted-foreground">{description}</span>
      <div className="flex items-center gap-0.5">
        {keys.map((k, i) => (
          <span key={i}>
            {i > 0 && <span className="text-[10px] text-muted-foreground/40 mx-0.5">+</span>}
            <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-mono font-medium rounded border bg-muted/50 text-muted-foreground">
              {k}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Interactive keybind row: click to record a new key, with reset support. */
function EditableKeybindRow({
  action,
  currentKeys,
  isCustomized,
  onSave,
  onReset,
}: {
  action: KeyBindAction;
  currentKeys: string[];
  isCustomized: boolean;
  onSave: (keys: string[]) => void;
  onReset: () => void;
}) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setRecording(false);
      }
    };

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const combo = eventToCombo(e);
      if (!combo) return; // bare modifier press, keep listening
      onSave([combo]);
      setRecording(false);
    };

    // Escape listener immediately; key listener after a brief delay
    // so the click that started recording doesn't bleed through.
    window.addEventListener("keydown", escHandler, { capture: true });
    const timer = setTimeout(() => {
      window.addEventListener("keydown", handler, { capture: true });
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler, { capture: true });
      window.removeEventListener("keydown", escHandler, { capture: true });
    };
  }, [recording, onSave]);

  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/30 group">
      <span className="text-xs text-muted-foreground">{action.label}</span>
      <div className="flex items-center gap-1">
        {recording ? (
          <kbd className="inline-flex items-center justify-center min-w-[60px] h-5 px-2 text-[10px] font-mono rounded border border-primary bg-primary/10 text-primary animate-pulse">
            Press key…
          </kbd>
        ) : (
          <button
            onClick={() => setRecording(true)}
            className="flex items-center gap-0.5"
            title="Click to change"
          >
            {currentKeys.map((k, i) => (
              <span key={i}>
                {i > 0 && <span className="text-[10px] text-muted-foreground/40 mx-0.5">or</span>}
                <kbd
                  className={cn(
                    "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-mono font-medium rounded border bg-muted/50 text-muted-foreground hover:border-primary/50 cursor-pointer transition-colors",
                    isCustomized && "border-primary/30 text-primary",
                  )}
                >
                  {formatCombo(k)}
                </kbd>
              </span>
            ))}
          </button>
        )}
        {isCustomized && !recording && (
          <button
            onClick={onReset}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            title="Reset to default"
          >
            <RotateCcw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

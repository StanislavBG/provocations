import { useFtuxShell, type DockPosition } from "@/lib/ftux-shell-context";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";
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

const FONT_COLOR_PRESETS: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "White", value: "#ffffff" },
  { label: "Light Gray", value: "#c8c8c8" },
  { label: "Warm", value: "#e8d5b7" },
  { label: "Cool", value: "#b7d5e8" },
  { label: "Dark", value: "#3a3a3a" },
];

const BG_COLOR_PRESETS: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Dark", value: "#111118" },
  { label: "Warm Dark", value: "#1a1510" },
  { label: "Cool Dark", value: "#10151a" },
  { label: "Midnight", value: "#0d0d1a" },
  { label: "Forest", value: "#0d1a12" },
];

const BG_TEXTURE_PRESETS: { key: string | null; label: string; css: string }[] = [
  { key: null, label: "None", css: "" },
  {
    key: "void",
    label: "Void",
    css: "radial-gradient(ellipse at 50% 50%, #16161e 0%, #0a0a0f 70%, #050508 100%)",
  },
  {
    key: "cosmos",
    label: "Cosmos",
    css: `radial-gradient(ellipse at 50% 50%, #0d0d18 0%, #06060c 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Ccircle cx='23' cy='67' r='0.5' fill='%23ffffff18'/%3E%3Ccircle cx='187' cy='23' r='0.4' fill='%23ffffff12'/%3E%3Ccircle cx='321' cy='89' r='0.6' fill='%23ffffff15'/%3E%3Ccircle cx='67' cy='234' r='0.3' fill='%23ffffff10'/%3E%3Ccircle cx='289' cy='178' r='0.5' fill='%23ffffff14'/%3E%3Ccircle cx='134' cy='312' r='0.4' fill='%23ffffff11'/%3E%3Ccircle cx='356' cy='267' r='0.5' fill='%23ffffff13'/%3E%3Ccircle cx='78' cy='378' r='0.3' fill='%23ffffff10'/%3E%3Ccircle cx='234' cy='345' r='0.6' fill='%23ffffff16'/%3E%3Ccircle cx='167' cy='145' r='0.4' fill='%23ffffff12'/%3E%3Ccircle cx='390' cy='390' r='0.3' fill='%23ffffff10'/%3E%3Ccircle cx='45' cy='156' r='0.5' fill='%23ffffff14'/%3E%3C/svg%3E")`,
  },
  {
    key: "blueprint",
    label: "Blueprint",
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%230a1628'/%3E%3Cpath d='M80 0L0 0 0 80' fill='none' stroke='%23ffffff06' stroke-width='0.5'/%3E%3C/svg%3E")`,
  },
  {
    key: "parchment",
    label: "Parchment",
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' fill='%23140f0a'/%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
  },
  {
    key: "mist",
    label: "Mist",
    css: "radial-gradient(ellipse at 0% 0%, #0f1a2208 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, #0f1a2208 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, #0e1117 0%, #080a0f 100%)",
  },
  {
    key: "graphite",
    label: "Graphite",
    css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100' height='100' fill='%23121215'/%3E%3Crect width='100' height='100' filter='url(%23g)' opacity='0.04'/%3E%3C/svg%3E")`,
  },
];

interface FtuxSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FtuxSettingsDialog({ open, onOpenChange }: FtuxSettingsDialogProps) {
  const shell = useFtuxShell();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-serif">Shell Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dock" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="dock" className="flex-1 text-xs">Dock</TabsTrigger>
            <TabsTrigger value="statusbar" className="flex-1 text-xs">Status Bar</TabsTrigger>
            <TabsTrigger value="tips" className="flex-1 text-xs">Tips</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1 text-xs">Theme</TabsTrigger>
            <TabsTrigger value="keybinds" className="flex-1 text-xs">Key Binds</TabsTrigger>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">Theme</Label>
              <ThemeToggle value={shell.theme} onChange={shell.setTheme} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Color Palette</Label>
              <PaletteToggle value={shell.palette} onChange={shell.setPalette} />
            </div>

            <Separator />

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

            {/* Canvas Font Color */}
            <div className="space-y-2">
              <Label className="text-xs">Canvas Font Color</Label>
              <div className="flex items-center gap-2">
                {FONT_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => shell.setCanvasFontColor(preset.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      shell.canvasFontColor === preset.value
                        ? "border-primary scale-110"
                        : "border-border/50 hover:border-border",
                    )}
                    style={{
                      background: preset.value ?? "hsl(var(--foreground))",
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            {/* Canvas Background Color */}
            <div className="space-y-2">
              <Label className="text-xs">Canvas Background</Label>
              <div className="flex items-center gap-2">
                {BG_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => shell.setCanvasBgColor(preset.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      shell.canvasBgColor === preset.value
                        ? "border-primary scale-110"
                        : "border-border/50 hover:border-border",
                    )}
                    style={{
                      background: preset.value ?? "hsl(var(--background))",
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            {/* Canvas Texture */}
            <div className="space-y-2">
              <Label className="text-xs">Canvas Texture</Label>
              <div className="flex items-center gap-2">
                {BG_TEXTURE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => shell.setCanvasBgTexture(preset.key)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all overflow-hidden",
                      shell.canvasBgTexture === preset.key
                        ? "border-primary scale-110"
                        : "border-border/50 hover:border-border",
                    )}
                    style={{
                      background: preset.css || "hsl(var(--background))",
                      backgroundSize: preset.key === "cosmos" ? "cover, 400px 400px" : undefined,
                    }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Key Binds */}
          <TabsContent value="keybinds" className="mt-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              <KeybindGroup title="Canvas">
                <KeybindRow keys={["Scroll"]} description="Zoom in / out" />
                <KeybindRow keys={["+"]} description="Zoom in (hold to accelerate)" />
                <KeybindRow keys={["-"]} description="Zoom out (hold to accelerate)" />
                <KeybindRow keys={["Space", "Drag"]} description="Pan canvas" />
                <KeybindRow keys={["W", "A", "S", "D"]} description="Glide camera" />
                <KeybindRow keys={["M"]} description="Toggle minimap" />
              </KeybindGroup>
              <KeybindGroup title="Selection">
                <KeybindRow keys={[MOD, "A"]} description="Select all nodes" />
                <KeybindRow keys={["Shift", "Drag"]} description="Marquee select" />
                <KeybindRow keys={["Shift", "Click"]} description="Toggle select node" />
                <KeybindRow keys={["Esc"]} description="Deselect all" />
              </KeybindGroup>
              <KeybindGroup title="Edit">
                <KeybindRow keys={[MOD, "C"]} description="Copy selected nodes" />
                <KeybindRow keys={[MOD, "V"]} description="Paste at cursor" />
                <KeybindRow keys={[MOD, "Z"]} description="Undo" />
                <KeybindRow keys={[MOD, "Shift", "Z"]} description="Redo" />
                <KeybindRow keys={["Del"]} description="Delete selected" />
              </KeybindGroup>
              <KeybindGroup title="Dock">
                <KeybindRow keys={["1-9"]} description="Place dock item at cursor" />
              </KeybindGroup>
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

const MOD = navigator.platform.includes("Mac") ? "\u2318" : "Ctrl";

function KeybindGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

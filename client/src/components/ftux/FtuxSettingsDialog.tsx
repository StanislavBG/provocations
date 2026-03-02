import { useFtuxShell, type DockPosition, type StatusBarPosition } from "@/lib/ftux-shell-context";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FtuxSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FtuxSettingsDialog({ open, onOpenChange }: FtuxSettingsDialogProps) {
  const shell = useFtuxShell();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-serif">Shell Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dock" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="dock" className="flex-1 text-xs">Dock</TabsTrigger>
            <TabsTrigger value="statusbar" className="flex-1 text-xs">Status Bar</TabsTrigger>
            <TabsTrigger value="tips" className="flex-1 text-xs">Tips</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1 text-xs">Theme</TabsTrigger>
          </TabsList>

          {/* Dock settings */}
          <TabsContent value="dock" className="space-y-4 mt-4">
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
                  background: `hsl(var(--card) / ${shell.dockTranslucency / 100})`,
                  backdropFilter: `blur(${Math.round((shell.dockTranslucency / 100) * 24)}px)`,
                }}
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

            <div className="space-y-2">
              <Label className="text-xs">Pinned Items</Label>
              {shell.statusBarPinnedItems.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60">
                  No pinned items. Use the hamburger menu to pin tools to the status bar.
                </p>
              ) : (
                <div className="space-y-1">
                  {shell.statusBarPinnedItems.map((itemId) => (
                    <div
                      key={itemId}
                      className="flex items-center justify-between rounded-lg border px-3 py-1.5"
                    >
                      <span className="text-xs capitalize">{itemId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 rounded text-muted-foreground hover:text-destructive"
                        onClick={() => shell.removeStatusBarPinnedItem(itemId)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
          </TabsContent>

          {/* Appearance settings */}
          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Theme</Label>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Color Palette</Label>
              <PaletteToggle />
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

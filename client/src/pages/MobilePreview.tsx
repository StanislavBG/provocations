import { useState } from "react";
import { MobileCapture } from "@/components/notebook/MobileCapture";
import { Button } from "@/components/ui/button";
import { Smartphone, Tablet, Maximize2, RotateCcw } from "lucide-react";

type DeviceFrame = "iphone" | "ipad" | "full";

const FRAMES: Record<DeviceFrame, { w: number; h: number; label: string }> = {
  iphone: { w: 390, h: 844, label: "iPhone 14" },
  ipad: { w: 430, h: 932, label: "iPhone 15 Pro Max" },
  full: { w: 0, h: 0, label: "Full width" },
};

/**
 * MobilePreview — Desktop route that renders the MobileCapture component
 * inside a phone-sized frame so you can see and iterate on the mobile
 * layout without needing a real device or resizing the browser.
 *
 * Route: /mobile
 */
export default function MobilePreview() {
  const [frame, setFrame] = useState<DeviceFrame>("iphone");
  const [key, setKey] = useState(0);

  const spec = FRAMES[frame];

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold font-serif">Mobile Preview</span>
          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {spec.label}{spec.w > 0 ? ` (${spec.w}×${spec.h})` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={frame === "iphone" ? "default" : "outline"}
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setFrame("iphone")}
          >
            <Smartphone className="w-3 h-3" />
            Phone
          </Button>
          <Button
            size="sm"
            variant={frame === "ipad" ? "default" : "outline"}
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setFrame("ipad")}
          >
            <Tablet className="w-3 h-3" />
            Large
          </Button>
          <Button
            size="sm"
            variant={frame === "full" ? "default" : "outline"}
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setFrame("full")}
          >
            <Maximize2 className="w-3 h-3" />
            Full
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setKey((k) => k + 1)}
            title="Reset component state"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        </div>
      </div>

      {/* Frame container */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {frame === "full" ? (
          <div key={key} className="w-full max-w-md h-full border rounded-xl bg-background shadow-2xl overflow-hidden">
            <MobileCapture />
          </div>
        ) : (
          <div
            key={key}
            style={{ width: spec.w, height: spec.h }}
            className="border-[3px] border-foreground/20 rounded-[2.5rem] bg-background shadow-2xl overflow-hidden relative"
          >
            {/* Notch / Dynamic Island */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[90px] h-[25px] bg-foreground/90 rounded-full z-10" />
            {/* Home indicator */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-foreground/20 rounded-full z-10" />
            {/* App content */}
            <div className="h-full overflow-hidden">
              <MobileCapture />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";
import { AutoDictateToggle } from "@/components/AutoDictateToggle";

import { DebugButton } from "@/components/DebugButton";
import { LlmTraceButton } from "@/components/LlmTraceButton";
import { PanelLayoutDialog } from "./PanelLayoutDialog";
import { UserButton } from "@clerk/clerk-react";
import { Link } from "wouter";
import {
  GitCompare,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { ProvoIcon } from "@/components/ProvoIcon";
import type { PanelLayoutConfig } from "@/hooks/use-panel-layout";

interface NotebookTopBarProps {
  isAdmin: boolean;
  /** Version count for diff view toggle */
  versionCount?: number;
  showVersions?: boolean;
  onToggleVersions?: () => void;
  /** Panel layout configuration */
  panelLayout?: PanelLayoutConfig;
  onPanelLayoutChange?: (layout: PanelLayoutConfig) => void;
}

export function NotebookTopBar({
  isAdmin,
  versionCount = 0,
  showVersions,
  onToggleVersions,
  panelLayout,
  onPanelLayoutChange,
}: NotebookTopBarProps) {
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);

  return (
    <header className="border-b bg-card shrink-0">
      {/* Main bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        {/* Left: Logo + Brand */}
        <Link href="/" className="flex items-center gap-2 min-w-0 no-underline">
          <ProvoIcon className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold font-serif tracking-tight text-foreground">
            Provocations
          </span>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Versions */}
          {versionCount > 0 && onToggleVersions && (
            <Button
              variant={showVersions ? "default" : "ghost"}
              size="sm"
              onClick={onToggleVersions}
              className="gap-1 h-7"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span className="text-xs">{versionCount}</span>
            </Button>
          )}

          <div className="w-px h-4 bg-border mx-0.5" />

          <AutoDictateToggle />
          {panelLayout && onPanelLayoutChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setLayoutDialogOpen(true)}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Configure panel layout</TooltipContent>
            </Tooltip>
          )}
          <PaletteToggle />
          <ThemeToggle />

          {isAdmin && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-7">
                <Shield className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}

          <LlmTraceButton />
          <DebugButton />
          <UserButton />
        </div>
      </div>

      {panelLayout && onPanelLayoutChange && (
        <PanelLayoutDialog
          open={layoutDialogOpen}
          onOpenChange={setLayoutDialogOpen}
          panelLayout={panelLayout}
          onSave={onPanelLayoutChange}
        />
      )}
    </header>
  );
}

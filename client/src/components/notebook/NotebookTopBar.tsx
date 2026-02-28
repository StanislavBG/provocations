import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";
import { AutoDictateToggle } from "@/components/AutoDictateToggle";
import { VerboseModeToggle } from "@/components/VerboseModeToggle";
import { DebugButton } from "@/components/DebugButton";
import { UserButton } from "@clerk/clerk-react";
import { Link } from "wouter";
import {
  FilePlus2,
  GitCompare,
  Shield,
} from "lucide-react";
import { ProvoIcon } from "@/components/ProvoIcon";

interface NotebookTopBarProps {
  onNew: () => void;
  isAdmin: boolean;
  /** Version count for diff view toggle */
  versionCount?: number;
  showVersions?: boolean;
  onToggleVersions?: () => void;
}

export function NotebookTopBar({
  onNew,
  isAdmin,
  versionCount = 0,
  showVersions,
  onToggleVersions,
}: NotebookTopBarProps) {
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
          {/* New */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNew}
                className="gap-1.5 h-7"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">New</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start new workspace</TooltipContent>
          </Tooltip>

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
          <VerboseModeToggle />
          <PaletteToggle />
          <ThemeToggle />

          {isAdmin && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-7">
                <Shield className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}

          <DebugButton />
          <UserButton />
        </div>
      </div>

    </header>
  );
}

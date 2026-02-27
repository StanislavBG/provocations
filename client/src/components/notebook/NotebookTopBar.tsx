import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
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

interface NotebookTopBarProps {
  sessionName: string;
  onSessionNameChange: (name: string) => void;
  onNew: () => void;
  isAdmin: boolean;
  /** Version count for diff view toggle */
  versionCount?: number;
  showVersions?: boolean;
  onToggleVersions?: () => void;
}

export function NotebookTopBar({
  sessionName,
  onSessionNameChange,
  onNew,
  isAdmin,
  versionCount = 0,
  showVersions,
  onToggleVersions,
}: NotebookTopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(sessionName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== sessionName) {
      onSessionNameChange(trimmed);
    } else {
      setEditValue(sessionName);
    }
    setIsEditing(false);
  };

  return (
    <header className="border-b bg-card shrink-0">
      {/* Main bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        {/* Left: App picker + Session name */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Session name */}
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") {
                  setEditValue(sessionName);
                  setIsEditing(false);
                }
              }}
              className="bg-transparent border-b border-primary text-sm font-semibold font-serif outline-none min-w-[120px] max-w-[300px] py-0.5"
            />
          ) : (
            <button
              onClick={() => {
                setEditValue(sessionName);
                setIsEditing(true);
              }}
              className="text-sm font-semibold font-serif text-foreground hover:text-primary transition-colors truncate max-w-[300px]"
              title="Click to rename"
            >
              {sessionName || "Untitled Session"}
            </button>
          )}
        </div>

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
            <TooltipContent>Start a new session</TooltipContent>
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

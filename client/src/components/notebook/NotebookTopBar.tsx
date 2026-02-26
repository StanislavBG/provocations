import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AutoDictateToggle } from "@/components/AutoDictateToggle";
import { VerboseModeToggle } from "@/components/VerboseModeToggle";
import { DebugButton } from "@/components/DebugButton";
import { UserButton } from "@clerk/clerk-react";
import { Link } from "wouter";
import { prebuiltTemplates, STATUS_LABEL_CONFIG } from "@/lib/prebuiltTemplates";
import {
  Save,
  FilePlus2,
  GitCompare,
  Shield,
  Loader2,
  Sparkles,
  ChevronDown,
} from "lucide-react";

interface NotebookTopBarProps {
  sessionName: string;
  onSessionNameChange: (name: string) => void;
  onSave: () => void;
  onNew: () => void;
  isSaving: boolean;
  isAdmin: boolean;
  /** Currently selected template ID */
  selectedTemplateId: string | null;
  /** Callback when user picks a different app from the picker */
  onSelectTemplate: (id: string) => void;
  /** Version count for diff view toggle */
  versionCount?: number;
  showVersions?: boolean;
  onToggleVersions?: () => void;
}

export function NotebookTopBar({
  sessionName,
  onSessionNameChange,
  onSave,
  onNew,
  isSaving,
  isAdmin,
  selectedTemplateId,
  onSelectTemplate,
  versionCount = 0,
  showVersions,
  onToggleVersions,
}: NotebookTopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(sessionName);
  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableApps = prebuiltTemplates.filter(
    (t) => !t.comingSoon && !t.externalUrl,
  );
  const selectedTemplate = availableApps.find((t) => t.id === selectedTemplateId);

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
          {/* App Picker Dropdown */}
          <Popover open={appPickerOpen} onOpenChange={setAppPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-7 px-2 shrink-0"
              >
                {selectedTemplate ? (
                  <>
                    <selectedTemplate.icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold hidden sm:inline">
                      {selectedTemplate.shortLabel}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold hidden sm:inline">Apps</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] p-0">
              <div className="px-3 py-2 border-b">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Switch Application
                </span>
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="grid grid-cols-3 gap-1.5 p-2">
                  {availableApps.map((template) => {
                    const Icon = template.icon;
                    const isActive = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        onClick={() => {
                          onSelectTemplate(template.id);
                          setAppPickerOpen(false);
                        }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center
                          ${
                            isActive
                              ? "bg-primary/10 ring-1 ring-primary"
                              : "hover:bg-muted/50"
                          }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] leading-tight truncate w-full">
                          {template.shortLabel}
                        </span>
                        {template.statusLabel && (
                          <span
                            className={`text-[8px] ${
                              STATUS_LABEL_CONFIG[template.statusLabel].className
                            }`}
                          >
                            {STATUS_LABEL_CONFIG[template.statusLabel].text}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Separator */}
          <div className="w-px h-4 bg-border shrink-0" />

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
          {/* Save */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="gap-1.5 h-7"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline text-xs">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save session</TooltipContent>
          </Tooltip>

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

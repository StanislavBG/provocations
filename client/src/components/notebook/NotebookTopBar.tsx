import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";

import { ChatDrawer, type ChatSessionContext } from "@/components/ChatDrawer";
import { MailboxDrawer } from "@/components/MailboxDrawer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { DebugButton } from "@/components/DebugButton";
import { LlmTraceButton } from "@/components/LlmTraceButton";
import { MessageLogButton } from "@/components/MessageLogButton";
import { PanelLayoutDialog } from "./PanelLayoutDialog";
import { UserButton, useUser } from "@clerk/clerk-react";
import { Link } from "wouter";
import {
  GitCompare,
  Shield,
  LayoutDashboard,
  MessageSquare,
  Video,
  Bell,
} from "lucide-react";
import { ProvoIcon } from "@/components/ProvoIcon";
import type { PanelLayoutConfig } from "@/hooks/use-panel-layout";

// ── PeerChat configuration ──
const PEERCHAT_SERVER = "https://peerchat.app";
const PEERCHAT_ROOM = "provocations";
const PEERCHAT_BRAND_COLOR = "%23B35C1E"; // URL-encoded #B35C1E (Provocations primary amber)

interface NotebookTopBarProps {
  isAdmin: boolean;
  /** Version count for diff view toggle */
  versionCount?: number;
  showVersions?: boolean;
  onToggleVersions?: () => void;
  /** Panel layout configuration */
  panelLayout?: PanelLayoutConfig;
  onPanelLayoutChange?: (layout: PanelLayoutConfig) => void;
  /** Chat props */
  chatSessionContext?: ChatSessionContext;
  activeChatConversationId?: number | null;
  onActiveChatConversationChange?: (id: number | null) => void;
}

export function NotebookTopBar({
  isAdmin,
  versionCount = 0,
  showVersions,
  onToggleVersions,
  panelLayout,
  onPanelLayoutChange,
  chatSessionContext,
  activeChatConversationId = null,
  onActiveChatConversationChange,
}: NotebookTopBarProps) {
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);

  // User info for PeerChat display name
  const { user } = useUser();
  const peerChatUrl = useMemo(() => {
    const name = user?.firstName || user?.username || "Guest";
    const params = new URLSearchParams({
      embed: "1",
      name,
      tab: "chat",
      transcribe: "1",
      brandTitle: "Provocations",
      brandColor: PEERCHAT_BRAND_COLOR,
      hideBranding: "1",
      layout: "auto",
    });
    return `${PEERCHAT_SERVER}/room/${PEERCHAT_ROOM}?${params.toString()}`;
  }, [user?.firstName, user?.username]);

  // Unread notification count for badge
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/mailbox/unread-count"],
    refetchInterval: 15000,
  });
  const unreadCount = unreadData?.count ?? 0;

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

          {/* Mailbox, Chat & Video */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mailboxOpen ? "default" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0 relative"
                onClick={() => setMailboxOpen(true)}
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 text-[8px] px-1 py-0 min-w-[14px] h-[14px] flex items-center justify-center"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mailbox</TooltipContent>
          </Tooltip>
          {chatSessionContext && onActiveChatConversationChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={chatOpen ? "default" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={videoOpen ? "default" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setVideoOpen(true)}
              >
                <Video className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>PeerChat Video</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-0.5" />

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
          <MessageLogButton />
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

      {/* Chat drawer (Sheet) */}
      {chatSessionContext && onActiveChatConversationChange && (
        <ChatDrawer
          open={chatOpen}
          onOpenChange={setChatOpen}
          sessionContext={chatSessionContext}
          activeConversationId={activeChatConversationId}
          onActiveConversationChange={onActiveChatConversationChange}
        />
      )}

      {/* Mailbox drawer */}
      <MailboxDrawer open={mailboxOpen} onOpenChange={setMailboxOpen} />

      {/* PeerChat video room (Sheet) — only mount iframe when open to save resources */}
      <Sheet open={videoOpen} onOpenChange={setVideoOpen}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <Video className="w-4 h-4 text-primary" />
            <SheetTitle className="text-sm font-semibold">PeerChat Video</SheetTitle>
          </div>
          <div className="flex-1 min-h-0">
            {videoOpen && (
              <iframe
                src={peerChatUrl}
                className="w-full h-full border-0 rounded-b-lg"
                allow="camera; microphone; display-capture; autoplay"
                title="PeerChat Video Room"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

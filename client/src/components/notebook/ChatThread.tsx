import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { builtInPersonas } from "@shared/personas";
import {
  Check,
  X,
  Reply,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Loader2,
} from "lucide-react";
import type { DiscussionMessage, PersonaPerspective } from "@shared/schema";

/** Unified chat message — adapter over DiscussionMessage for rendering */
export interface ChatMessageItem {
  id: string;
  role: "user" | "persona-response" | "system";
  content: string;
  timestamp: number;
  topic?: string;
  perspectives?: PersonaPerspective[];
  status?: "pending" | "accepted" | "dismissed";
}

interface ChatThreadProps {
  messages: DiscussionMessage[];
  onSendMessage: (text: string) => void;
  onAcceptResponse: (messageId: string) => void;
  onDismissResponse: (messageId: string) => void;
  onRespondToMessage: (messageId: string, text: string) => void;
  isLoading: boolean;
}

/** Normalize DiscussionMessage[] into ChatMessageItem[] for rendering */
function toChatMessages(messages: DiscussionMessage[]): ChatMessageItem[] {
  return messages.map((m) => ({
    id: m.id,
    role:
      m.role === "user-question" || m.role === "user-answer"
        ? "user"
        : m.role === "persona-response"
          ? "persona-response"
          : "system",
    content: m.content,
    timestamp: m.timestamp,
    topic: m.topic,
    perspectives: m.perspectives,
    status: m.status,
  }));
}

function PersonaResponseBubble({
  msg,
  onAccept,
  onDismiss,
  onRespond,
}: {
  msg: ChatMessageItem;
  onAccept: () => void;
  onDismiss: () => void;
  onRespond: (text: string) => void;
}) {
  const [showPerspectives, setShowPerspectives] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const statusColor =
    msg.status === "accepted"
      ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/20"
      : msg.status === "dismissed"
        ? "border-muted/30 bg-muted/10 opacity-60"
        : "border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20";

  return (
    <div className={`rounded-lg border p-3 ${statusColor} max-w-[85%]`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <Badge variant="secondary" className="text-[10px] h-4">
          Team Response
        </Badge>
        {msg.topic && (
          <Badge variant="outline" className="text-[10px] h-4">
            {msg.topic}
          </Badge>
        )}
        {msg.status === "accepted" && (
          <Badge className="text-[10px] h-4 bg-green-600">Merged</Badge>
        )}
        {msg.status === "dismissed" && (
          <Badge variant="secondary" className="text-[10px] h-4">
            Dismissed
          </Badge>
        )}
      </div>

      {/* Synthesized content */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

      {/* Individual perspectives toggle */}
      {msg.perspectives && msg.perspectives.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowPerspectives(!showPerspectives)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {showPerspectives ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {msg.perspectives.length} individual perspective
            {msg.perspectives.length > 1 ? "s" : ""}
          </button>
          {showPerspectives && (
            <div className="mt-2 space-y-2">
              {msg.perspectives.map((p, i) => {
                const persona = builtInPersonas[p.personaId as keyof typeof builtInPersonas];
                return (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded border-l-2 ${
                      persona
                        ? `${persona.color.bg} border-l-current`
                        : "bg-muted/30"
                    }`}
                    style={
                      persona
                        ? { borderLeftColor: persona.color.accent }
                        : undefined
                    }
                  >
                    <span className="font-semibold">
                      {p.personaLabel}:
                    </span>{" "}
                    {p.content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action buttons (only for pending) */}
      {msg.status === "pending" && (
        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-dashed">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={onAccept}
          >
            <Check className="w-3 h-3" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-destructive hover:text-destructive"
            onClick={onDismiss}
          >
            <X className="w-3 h-3" />
            Dismiss
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setShowReply(!showReply)}
          >
            <Reply className="w-3 h-3" />
            Reply
          </Button>
        </div>
      )}

      {/* Inline reply */}
      {showReply && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1">
            <ProvokeText
              chrome="bare"
              variant="input"
              value={replyText}
              onChange={setReplyText}
              placeholder="Type a follow-up..."
              className="text-xs"
              showCopy={false}
              showClear={false}
            />
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-6 text-xs"
            disabled={!replyText.trim()}
            onClick={() => {
              onRespond(replyText.trim());
              setReplyText("");
              setShowReply(false);
            }}
          >
            Send
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              setShowReply(false);
              setReplyText("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export function ChatThread({
  messages,
  onSendMessage,
  onAcceptResponse,
  onDismissResponse,
  onRespondToMessage,
  isLoading,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  const chatMessages = toChatMessages(messages);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    onSendMessage(text);
    setInputValue("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Message list */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50 py-16">
            <Users className="w-10 h-10" />
            <p className="text-sm text-center max-w-[280px]">
              Ask your persona team anything about your document. They'll
              challenge your thinking and provide multi-perspective feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[75%] bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <User className="w-3 h-3" />
                      <span className="text-[10px] opacity-70">You</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : msg.role === "persona-response" ? (
                  <PersonaResponseBubble
                    msg={msg}
                    onAccept={() => onAcceptResponse(msg.id)}
                    onDismiss={() => onDismissResponse(msg.id)}
                    onRespond={(text) => onRespondToMessage(msg.id, text)}
                  />
                ) : (
                  <div className="max-w-[85%] bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span className="text-xs text-muted-foreground">
                    Consulting the team...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input bar */}
      <div className="border-t p-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ProvokeText
              chrome="bare"
              variant="textarea"
              value={inputValue}
              onChange={setInputValue}
              placeholder="Ask your team..."
              className="text-sm"
              minRows={1}
              maxRows={4}
              showCopy={false}
              showClear={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="h-8 shrink-0"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

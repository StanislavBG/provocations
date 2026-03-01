import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorLogStore } from "@/lib/errorLog";
import { PersonaAvatarRow } from "./PersonaAvatarRow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";
import {
  Flame,
  Loader2,
  Lightbulb,
  MessageSquare,
  Check,
  BookmarkPlus,
  Quote,
  Send,
  X,
  FileText,
  Target,
  Users,
} from "lucide-react";
import type { ProvocationType, Challenge, Advice } from "@shared/schema";

interface ProvoThreadProps {
  documentText: string;
  objective: string;
  activePersonas: Set<ProvocationType>;
  onTogglePersona: (id: ProvocationType) => void;
  onCaptureToContext: (text: string, label: string) => void;
  hasDocument: boolean;
  pinnedDocContents?: Record<number, { title: string; content: string }>;
}

interface AdviceState {
  content: string;
  loading: boolean;
  accepted: boolean;
}

export function ProvoThread({
  documentText,
  objective,
  activePersonas,
  onTogglePersona,
  onCaptureToContext,
  hasDocument,
  pinnedDocContents,
}: ProvoThreadProps) {
  const { toast } = useToast();

  // ── Challenge state ──
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [adviceStates, setAdviceStates] = useState<Record<string, AdviceState>>(
    {},
  );
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // ── Generate provocations ──
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Build effective document: main doc + pinned context when main doc is sparse
      let effectiveDoc = documentText;
      if (pinnedDocContents && Object.keys(pinnedDocContents).length > 0) {
        const contextSnippets = Object.values(pinnedDocContents)
          .map((doc) => `[${doc.title}]\n${doc.content.slice(0, 2000)}`)
          .join("\n\n---\n\n");
        effectiveDoc = effectiveDoc.trim()
          ? `${effectiveDoc}\n\n--- ACTIVE CONTEXT ---\n\n${contextSnippets}`
          : contextSnippets;
      }
      const res = await apiRequest("POST", "/api/generate-challenges", {
        document: effectiveDoc,
        objective: objective.trim() || undefined,
        personaIds: Array.from(activePersonas),
      });
      return res.json() as Promise<{ challenges: Challenge[] }>;
    },
    onSuccess: (data) => {
      setChallenges(data.challenges);
      setAdviceStates({});
      setResponses({});
      setDismissedIds(new Set());
      toast({
        title: "Provocations generated",
        description: `${data.challenges.length} challenge${data.challenges.length !== 1 ? "s" : ""} from your team`,
      });
    },
    onError: (error) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to generate provocations";
      errorLogStore.push({
        step: "Generate Challenges",
        endpoint: "/api/generate-challenges",
        message: msg,
      });
      toast({
        title: "Generation failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ── Request advice for a specific challenge ──
  const handleRequestAdvice = useCallback(
    async (challenge: Challenge) => {
      const cid = challenge.id;
      setAdviceStates((prev) => ({
        ...prev,
        [cid]: { content: "", loading: true, accepted: false },
      }));

      try {
        const res = await apiRequest("POST", "/api/generate-advice", {
          document: documentText,
          objective,
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeContent: challenge.content,
          personaId: challenge.persona.id,
        });
        const data = (await res.json()) as { advice: Advice };
        setAdviceStates((prev) => ({
          ...prev,
          [cid]: { content: data.advice.content, loading: false, accepted: false },
        }));
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Failed to get advice";
        errorLogStore.push({
          step: "Generate Advice",
          endpoint: "/api/generate-advice",
          message: msg,
        });
        setAdviceStates((prev) => {
          const next = { ...prev };
          delete next[cid];
          return next;
        });
        toast({
          title: "Advice failed",
          description: msg,
          variant: "destructive",
        });
      }
    },
    [documentText, objective, toast],
  );

  // ── Accept advice → transcript ──
  const handleAcceptAdvice = useCallback(
    (challenge: Challenge) => {
      const advice = adviceStates[challenge.id];
      if (!advice?.content) return;

      onCaptureToContext(
        `**${challenge.persona.label} — Advice on "${challenge.title}"**\n\n${advice.content}`,
        `${challenge.persona.label}: ${challenge.title}`,
      );
      setAdviceStates((prev) => ({
        ...prev,
        [challenge.id]: { ...prev[challenge.id], accepted: true },
      }));
      toast({
        title: "Sent to Notes",
        description: "Advice added to your notes",
      });
    },
    [adviceStates, onCaptureToContext, toast],
  );

  // ── Submit response to a challenge ──
  const handleSubmitResponse = useCallback(
    (challengeId: string) => {
      const text = responseText.trim();
      if (!text) return;
      setResponses((prev) => ({ ...prev, [challengeId]: text }));
      setResponseText("");
      setRespondingTo(null);
    },
    [responseText],
  );

  // ── Send user response to transcript ──
  const handleResponseToTranscript = useCallback(
    (challenge: Challenge) => {
      const text = responses[challenge.id];
      if (!text) return;
      onCaptureToContext(
        `**Response to ${challenge.persona.label} — "${challenge.title}"**\n\n${text}`,
        `Response: ${challenge.title}`,
      );
      toast({
        title: "Sent to Notes",
        description: "Your response added to transcript",
      });
    },
    [responses, onCaptureToContext, toast],
  );

  const handleDismiss = useCallback((challengeId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(challengeId);
      return next;
    });
  }, []);

  const visibleChallenges = challenges.filter((c) => !dismissedIds.has(c.id));
  const canGenerate =
    hasDocument && activePersonas.size > 0 && !generateMutation.isPending;

  // ── LLM preview data for Generate Provocations ──
  const provoBlocks: ContextBlock[] = useMemo(() => [
    { label: "System Prompt", chars: 1200, color: "text-purple-400" },
    { label: "Document", chars: documentText.length, color: "text-blue-400" },
    { label: "Objective", chars: objective.length, color: "text-amber-400" },
    { label: "Persona IDs", chars: activePersonas.size * 20, color: "text-emerald-400" },
  ], [documentText, objective, activePersonas]);

  const provoSummary: SummaryItem[] = useMemo(() => [
    { icon: <Users className="w-3 h-3 text-emerald-400" />, label: "Active Personas", count: activePersonas.size, detail: `${activePersonas.size} selected` },
    { icon: <FileText className="w-3 h-3 text-blue-400" />, label: "Document", count: documentText.trim() ? 1 : 0, detail: documentText.trim() ? `${documentText.split(/\s+/).filter(Boolean).length} words` : undefined },
    { icon: <Target className="w-3 h-3 text-amber-400" />, label: "Objective", count: objective.trim() ? 1 : 0, detail: objective.trim() ? objective.slice(0, 60) + (objective.length > 60 ? "..." : "") : undefined },
  ], [activePersonas, documentText, objective]);

  return (
    <div className="h-full flex flex-col">
      {/* ─── Persona selector + Generate button ─── */}
      <div className="px-3 py-2 border-b bg-muted/20 space-y-2 shrink-0">
        <PersonaAvatarRow
          activePersonas={activePersonas}
          onToggle={onTogglePersona}
          compact
        />
        <LlmHoverButton
          previewTitle="Generate Provocations"
          previewBlocks={provoBlocks}
          previewSummary={provoSummary}
          align="start"
        >
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!canGenerate}
            className="w-full gap-2 h-9 text-xs font-semibold"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating provocations...
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5" />
                Generate Provocations
                {activePersonas.size > 0 && (
                  <span className="text-[10px] opacity-70 font-normal">
                    ({activePersonas.size} persona
                    {activePersonas.size !== 1 ? "s" : ""})
                  </span>
                )}
              </>
            )}
          </Button>
        </LlmHoverButton>
      </div>

      {/* ─── Challenges list ─── */}
      <ScrollArea className="flex-1">
        {visibleChallenges.length === 0 && !generateMutation.isPending ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground/50 py-12 px-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary/60" />
            </div>
            <div className="text-center space-y-1.5 max-w-[260px]">
              <p className="text-sm font-medium text-foreground/60">
                Provoke your thinking
              </p>
              <p className="text-xs leading-relaxed">
                Select personas above and hit{" "}
                <strong>Generate Provocations</strong> to get targeted
                challenges on your document from multiple expert perspectives.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {visibleChallenges.map((challenge) => (
              <SmartBubble
                key={challenge.id}
                challenge={challenge}
                advice={adviceStates[challenge.id]}
                response={responses[challenge.id]}
                isResponding={respondingTo === challenge.id}
                responseText={respondingTo === challenge.id ? responseText : ""}
                onResponseTextChange={setResponseText}
                onToggleRespond={() => {
                  setRespondingTo(
                    respondingTo === challenge.id ? null : challenge.id,
                  );
                  setResponseText("");
                }}
                onSubmitResponse={() =>
                  handleSubmitResponse(challenge.id)
                }
                onRequestAdvice={() => handleRequestAdvice(challenge)}
                onAcceptAdvice={() => handleAcceptAdvice(challenge)}
                onResponseToTranscript={() =>
                  handleResponseToTranscript(challenge)
                }
                onDismiss={() => handleDismiss(challenge.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Smart Bubble — single provocation card with inline actions
// ─────────────────────────────────────────────────────────────

interface SmartBubbleProps {
  challenge: Challenge;
  advice?: AdviceState;
  response?: string;
  isResponding: boolean;
  responseText: string;
  onResponseTextChange: (text: string) => void;
  onToggleRespond: () => void;
  onSubmitResponse: () => void;
  onRequestAdvice: () => void;
  onAcceptAdvice: () => void;
  onResponseToTranscript: () => void;
  onDismiss: () => void;
}

function SmartBubble({
  challenge,
  advice,
  response,
  isResponding,
  responseText,
  onResponseTextChange,
  onToggleRespond,
  onSubmitResponse,
  onRequestAdvice,
  onAcceptAdvice,
  onResponseToTranscript,
  onDismiss,
}: SmartBubbleProps) {
  const persona = challenge.persona;
  const accent = persona.color?.accent || "#888";

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      {/* Persona header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ backgroundColor: `${accent}08` }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {persona.label}
        </span>
        {challenge.scale && (
          <div className="flex items-center gap-0.5 ml-auto">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < challenge.scale! ? "" : "bg-muted-foreground/20"
                }`}
                style={
                  i < challenge.scale!
                    ? { backgroundColor: accent }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Challenge content */}
      <div className="px-3 py-2">
        <p className="text-xs font-semibold mb-1">{challenge.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {challenge.content}
        </p>

        {/* Source excerpt */}
        {challenge.sourceExcerpt && (
          <div className="mt-2 flex items-start gap-1.5 bg-muted/30 rounded px-2 py-1.5">
            <Quote className="w-3 h-3 text-muted-foreground/50 shrink-0 mt-0.5" />
            <span className="text-[10px] text-muted-foreground italic leading-relaxed">
              {challenge.sourceExcerpt}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={onToggleRespond}
        >
          <MessageSquare className="w-3 h-3" />
          Respond
        </Button>
        {!advice && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 text-amber-600 hover:text-amber-700"
            onClick={onRequestAdvice}
          >
            <Lightbulb className="w-3 h-3" />
            Show Advice
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 text-muted-foreground/50 hover:text-destructive ml-auto"
          onClick={onDismiss}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Inline respond area */}
      {isResponding && (
        <div className="px-3 pb-2 border-t bg-muted/10">
          <div className="flex items-end gap-1.5 pt-2">
            <div className="flex-1">
              <ProvokeText
                chrome="bare"
                variant="textarea"
                value={responseText}
                onChange={onResponseTextChange}
                placeholder="Your response..."
                className="text-xs"
                minRows={1}
                maxRows={4}
                showCopy={false}
                showClear={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmitResponse();
                  }
                }}
              />
            </div>
            <VoiceRecorder
              onTranscript={(t) =>
                onResponseTextChange(responseText ? `${responseText} ${t}` : t)
              }
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-muted-foreground"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              disabled={!responseText.trim()}
              onClick={onSubmitResponse}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* User's submitted response */}
      {response && (
        <div className="px-3 pb-2 border-t">
          <div className="mt-2 bg-primary/5 rounded-md px-2.5 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-semibold text-primary/70 uppercase tracking-wider">
                Your response
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[9px] gap-1 text-muted-foreground hover:text-primary"
                onClick={onResponseToTranscript}
              >
                <BookmarkPlus className="w-2.5 h-2.5" />
                Notes
              </Button>
            </div>
            <p className="text-xs leading-relaxed">{response}</p>
          </div>
        </div>
      )}

      {/* Advice section */}
      {advice && (
        <div className="px-3 pb-2 border-t">
          <div
            className="mt-2 rounded-md px-2.5 py-2"
            style={{ backgroundColor: `${accent}08` }}
          >
            {advice.loading ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2
                  className="w-3 h-3 animate-spin"
                  style={{ color: accent }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {persona.label} is thinking...
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: accent }}
                  >
                    Advice from {persona.label}
                  </span>
                  {advice.accepted && (
                    <Badge className="text-[8px] h-3.5 px-1 bg-green-600">
                      Accepted
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed mb-2">
                  {advice.content}
                </p>
                {!advice.accepted && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-green-600 border-green-500/30 hover:bg-green-50 hover:text-green-700"
                    onClick={onAcceptAdvice}
                  >
                    <Check className="w-3 h-3" />
                    Accept → Notes
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

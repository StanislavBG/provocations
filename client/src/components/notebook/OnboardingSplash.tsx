import { useState } from "react";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { STATUS_LABEL_CONFIG } from "@/lib/prebuiltTemplates";
import { ProvokeText } from "@/components/ProvokeText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, ArrowRight, Dices, Library, RotateCcw, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingSplashProps {
  onStart: (templateId: string, objective: string) => void;
  onDismiss: () => void;
  /** Open the Session Store to pick a session to resume */
  onLoadSession?: () => void;
  /** Navigate to Context Store */
  onLoadContext?: () => void;
  /** Recent sessions (for showing resume hint) */
  recentSessions?: Array<{ id: number; title: string; templateId: string; updatedAt: string }>;
  /** Whether we're in the process of auto-resuming a session */
  isAutoResuming?: boolean;
}

export function OnboardingSplash({
  onStart,
  onDismiss,
  onLoadSession,
  onLoadContext,
  recentSessions = [],
  isAutoResuming = false,
}: OnboardingSplashProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const availableApps = prebuiltTemplates.filter(
    (t) => !t.comingSoon && !t.externalUrl,
  );

  const selectedTemplate = availableApps.find((t) => t.id === selectedId);

  const handleStart = () => {
    if (selectedId && objective.trim()) {
      onStart(selectedId, objective.trim());
    }
  };

  const handleSurpriseMe = async () => {
    if (!selectedTemplate || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/generate-sample-objective", {
        appTitle: selectedTemplate.title,
      });
      const data = await res.json();
      if (data.objective) setObjective(data.objective);
    } catch {
      // silently ignore — user can just type
    } finally {
      setIsGenerating(false);
    }
  };

  // Show a loading state while auto-resuming
  if (isAutoResuming) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-serif text-muted-foreground">Resuming your last session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 text-center shrink-0">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-serif font-bold">
              What are you working on?
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Pick an application and describe your objective. AI personas will
            challenge your thinking to help you build something better.
          </p>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          {/* App grid — larger cards with title + subtitle */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableApps.map((template) => {
                const Icon = template.icon;
                const isSelected = selectedId === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedId(template.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl transition-all text-left
                      ${
                        isSelected
                          ? "bg-primary/10 ring-2 ring-primary shadow-sm"
                          : "hover:bg-muted/50 border border-transparent hover:border-border"
                      }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">
                          {template.shortLabel}
                        </span>
                        {template.statusLabel && (
                          <Badge
                            variant="outline"
                            className={`text-[8px] h-3.5 shrink-0 ${
                              STATUS_LABEL_CONFIG[template.statusLabel].className
                            }`}
                          >
                            {STATUS_LABEL_CONFIG[template.statusLabel].text}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                        {template.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected app info + objective */}
          {selectedTemplate && (
            <div className="px-6 pb-4 space-y-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold">{selectedTemplate.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedTemplate.subtitle}
                </p>
              </div>

              <ProvokeText
                chrome="container"
                variant="textarea"
                value={objective}
                onChange={setObjective}
                placeholder={
                  selectedTemplate.objective ||
                  "Describe what you want to create or explore..."
                }
                label="Your Objective"
                headerActions={
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLoadContext}
                      className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Library className="w-3.5 h-3.5" />
                      Load Context
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSurpriseMe}
                      disabled={isGenerating}
                      className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Dices className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                      {isGenerating ? "Thinking..." : "Surprise me"}
                    </Button>
                  </div>
                }
                className="text-sm font-serif"
                minRows={2}
                maxRows={5}
                showCopy={false}
              />
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Skip
            </Button>
            {onLoadSession && recentSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadSession}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resume Session
              </Button>
            )}
          </div>
          <Button
            onClick={handleStart}
            disabled={!selectedId || !objective.trim()}
            className="gap-1.5"
          >
            Start Working
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

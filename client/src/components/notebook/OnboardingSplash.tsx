import { useState } from "react";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { STATUS_LABEL_CONFIG } from "@/lib/prebuiltTemplates";
import { ProvokeText } from "@/components/ProvokeText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Dices } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingSplashProps {
  onStart: (templateId: string, objective: string) => void;
  onDismiss: () => void;
}

export function OnboardingSplash({ onStart, onDismiss }: OnboardingSplashProps) {
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

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-serif font-bold">
              What are you working on?
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pick an application and describe your objective. AI personas will
            challenge your thinking to help you build something better.
          </p>
        </div>

        {/* App grid */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {availableApps.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedId === template.id;

              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all
                    ${
                      isSelected
                        ? "bg-primary/10 ring-2 ring-primary shadow-sm"
                        : "hover:bg-muted/50"
                    }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] leading-tight text-center">
                    {template.shortLabel}
                  </span>
                  {template.statusLabel && (
                    <Badge
                      variant="outline"
                      className={`text-[8px] h-3.5 ${
                        STATUS_LABEL_CONFIG[template.statusLabel].className
                      }`}
                    >
                      {STATUS_LABEL_CONFIG[template.statusLabel].text}
                    </Badge>
                  )}
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
              }
              className="text-sm font-serif"
              minRows={2}
              maxRows={5}
              showCopy={false}
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Skip
          </Button>
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

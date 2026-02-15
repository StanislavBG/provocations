import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Info,
  Settings2,
  ChevronRight,
  Check,
  ListChecks,
  Lightbulb,
  MessageCircleQuestion,
  PanelRightClose,
} from "lucide-react";
import type { WorkflowStep } from "@/lib/workflows";

interface StepDetailsPanelProps {
  step: WorkflowStep;
  stepIndex: number;
  totalSteps: number;
  isCompleted: boolean;
  onComplete: () => void;
  onCollapse: () => void;
}

export function StepDetailsPanel({
  step,
  stepIndex,
  totalSteps,
  isCompleted,
  onComplete,
  onCollapse,
}: StepDetailsPanelProps) {
  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
        <Settings2 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm flex-1 truncate">Step Details</h3>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
          {stepIndex + 1} of {totalSteps}
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onCollapse}
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Collapse panel</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Step info */}
          <div className="space-y-2">
            <h4 className="font-serif text-base text-foreground">{step.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
            {step.optional && (
              <Badge variant="secondary" className="text-[10px]">
                Optional
              </Badge>
            )}
          </div>

          {/* Step-specific content based on component type */}
          <StepContent step={step} />

          {/* Detail hint (if available) */}
          {step.detailHint && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Insight</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {step.detailHint}
              </p>
            </div>
          )}

          {/* Completion action */}
          <div className="pt-2">
            <Button
              className="w-full gap-2"
              variant={isCompleted ? "outline" : "default"}
              onClick={onComplete}
              disabled={isCompleted}
            >
              {isCompleted ? (
                <>
                  <Check className="w-4 h-4" />
                  Completed
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Mark Complete & Continue
                </>
              )}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Step-specific content renderers ──

function StepContent({ step }: { step: WorkflowStep }) {
  switch (step.component) {
    case "text-input":
      return <TextInputStepContent />;
    case "persona-select":
      return <PersonaSelectStepContent />;
    case "interview":
      return <InterviewStepContent />;
    case "document-review":
      return <DocumentReviewStepContent />;
    case "capture":
      return <CaptureStepContent />;
    case "export":
      return <ExportStepContent />;
    default:
      return null;
  }
}

function TextInputStepContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tips
        </span>
      </div>
      <ul className="space-y-2">
        {[
          "Start with the problem you're solving, not the solution",
          "Include constraints and non-negotiables",
          "Mention your target audience",
          "You can use voice input for faster capture",
        ].map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] font-medium">{i + 1}</span>
            </span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonaSelectStepContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Persona Guide
        </span>
      </div>
      <div className="space-y-2">
        {[
          { label: "Think Big", desc: "Scale impact and outcomes" },
          { label: "Architect", desc: "System design and boundaries" },
          { label: "QA Engineer", desc: "Testing and reliability" },
          { label: "Product Manager", desc: "Business value and priorities" },
        ].map((persona) => (
          <div key={persona.label} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40">
            <div className="w-2 h-2 rounded-full bg-primary/60" />
            <span className="text-xs font-medium flex-1">{persona.label}</span>
            <span className="text-[10px] text-muted-foreground">{persona.desc}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        Select personas in the main area. Each brings a unique challenge perspective.
      </p>
    </div>
  );
}

function InterviewStepContent() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    { q: "How long does the interview take?", a: "Typically 5-15 minutes depending on depth. You control the pace." },
    { q: "Can I skip questions?", a: "Yes, skip any question. The AI will adjust and move to the next topic." },
    { q: "How do I use voice?", a: "Click the microphone icon on any question to respond with voice." },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Interview Guide
        </span>
      </div>
      <div className="space-y-1.5">
        {faqs.map((faq, i) => (
          <button
            key={i}
            className="w-full text-left p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
            onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
          >
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${
                expandedFaq === i ? "rotate-90" : ""
              }`} />
              <span className="text-xs font-medium">{faq.q}</span>
            </div>
            {expandedFaq === i && (
              <p className="text-xs text-muted-foreground mt-1.5 ml-5 leading-relaxed">
                {faq.a}
              </p>
            )}
          </button>
        ))}
      </div>
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your answers are used to strengthen and expand the document.
          Use "Merge to Draft" at any time to integrate responses.
        </p>
      </div>
    </div>
  );
}

function DocumentReviewStepContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Review Checklist
        </span>
      </div>
      <div className="space-y-2">
        {[
          "Check overall structure and flow",
          "Verify key arguments are supported",
          "Review for tone consistency",
          "Ensure all sections are complete",
          "Look for contradictions or gaps",
        ].map((item, i) => (
          <label key={i} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer group">
            <input type="checkbox" className="rounded border-muted-foreground/30 text-primary focus:ring-primary/30" />
            <span className="group-hover:text-foreground transition-colors">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CaptureStepContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Capture Options
        </span>
      </div>
      <div className="space-y-2">
        {[
          { label: "Screenshot", desc: "Capture and annotate screen content" },
          { label: "Text Clip", desc: "Paste or type reference text" },
          { label: "URL Reference", desc: "Add a link to external content" },
        ].map((option) => (
          <div key={option.label} className="flex items-center gap-3 p-2 rounded-md border border-dashed border-muted-foreground/20 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">+</span>
            </div>
            <div>
              <p className="text-xs font-medium">{option.label}</p>
              <p className="text-[10px] text-muted-foreground">{option.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportStepContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Export Formats
        </span>
      </div>
      <div className="space-y-2">
        {[
          { label: "Markdown", desc: ".md file" },
          { label: "Plain Text", desc: ".txt file" },
          { label: "Copy to Clipboard", desc: "Paste anywhere" },
        ].map((format) => (
          <Button
            key={format.label}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-9 text-xs"
          >
            <span className="font-medium">{format.label}</span>
            <span className="text-muted-foreground ml-auto">{format.desc}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

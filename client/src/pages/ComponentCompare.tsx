import { useLocation } from "wouter";
import { ArrowLeft, Brain, BrainCircuit, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROWS: {
  label: string;
  llm: string;
  llmBase: string;
  research: string;
}[] = [
  {
    label: "Purpose",
    llm: "Preset-based text transformer (Summarize, Clean, Expand, Custom)",
    llmBase: "Direct LLM prompt with full model parameter control; outputs a document",
    research: "Conversational AI research assistant with multi-turn history",
  },
  {
    label: "Dock Group",
    llm: "build",
    llmBase: "build",
    research: "workshop",
  },
  {
    label: "Default Size",
    llm: "260 \u00d7 240",
    llmBase: "280 \u00d7 260",
    research: "240 \u00d7 300",
  },
  {
    label: "Min Size",
    llm: "180 \u00d7 140",
    llmBase: "200 \u00d7 160",
    research: "200 \u00d7 200",
  },
  {
    label: "Ports",
    llm: "Input (left), Output (right)",
    llmBase: "Input (left), Output (right)",
    research: "Input (left), Output (right)",
  },
  {
    label: "Playable",
    llm: "Yes",
    llmBase: "Yes",
    research: "Yes",
  },
  {
    label: "Chain Execution",
    llm: "Yes",
    llmBase: "Yes",
    research: "Yes",
  },
  {
    label: "Lifecycle Preset",
    llm: "llm",
    llmBase: "llm-base",
    research: "stream",
  },
  {
    label: "Edge Roles",
    llm: "None (generic input)",
    llmBase: "system-instruction, context",
    research: "objective, context, output-format",
  },
  {
    label: "Streaming",
    llm: "No (single-shot request/response)",
    llmBase: "Toggle (on by default, SSE)",
    research: "Yes (SSE streaming)",
  },
  {
    label: "Presets / Modes",
    llm: "4 presets: Summarize, Clean Up, Expand, Custom",
    llmBase: "None \u2014 freeform system + user prompt",
    research: "7 focus modes: explore, verify, gather, analyze, synthesize, reason, deep-research",
  },
  {
    label: "Model Selection",
    llm: "Server default",
    llmBase: "User-selectable (default: gemini-2.5-flash)",
    research: "User-selectable via /api/chat/models",
  },
  {
    label: "Temperature / Top P / Top K",
    llm: "N/A",
    llmBase: "Full control: temp 0\u20132, topP 0\u20131, topK 0\u2013100",
    research: "N/A",
  },
  {
    label: "Max Tokens",
    llm: "N/A",
    llmBase: "256 \u2013 65,536 (default 8,192)",
    research: "N/A",
  },
  {
    label: "Safety Level",
    llm: "N/A",
    llmBase: "none / low / medium / high",
    research: "N/A",
  },
  {
    label: "Response Config",
    llm: "Preset-driven",
    llmBase: "N/A",
    research: "Detail level, format, audience, tone (auto-set per focus mode)",
  },
  {
    label: "Voice Input",
    llm: "No",
    llmBase: "No",
    research: "Yes (VoiceRecorder / Web Speech API)",
  },
  {
    label: "Conversation History",
    llm: "No \u2014 each run overwrites output",
    llmBase: "No \u2014 single call, replaces output",
    research: "Yes \u2014 messages accumulate (last 50 sent to API)",
  },
  {
    label: "API Endpoints",
    llm: "/api/summarize-intent, /api/write",
    llmBase: "/api/llm-base/stream, /api/llm-base/generate",
    research: "/api/chat/stream, /api/chat/research-plan, /api/chat/models",
  },
  {
    label: "State Fields",
    llm: "llmPresetId, llmObjective, llmStatus, llmOutput, llmError",
    llmBase: "llmBaseModel, llmBaseTemperature, llmBaseTopP, llmBaseTopK, llmBaseMaxTokens, llmBaseSafety, llmBaseStreaming, llmBaseSystemPrompt, llmBaseUserPrompt, llmBaseOutput, llmBaseStatus",
    research: "researchMessages[], researchQuery, researchTopic, researchFocus, responseConfig, researchPlan",
  },
  {
    label: "Expanded View",
    llm: "LlmExpandedView \u2014 preset grid + instruction + I/O panels",
    llmBase: "LlmBaseExpandedView \u2014 model config + system/user prompts + output",
    research: "NotebookResearchChat \u2014 full chat UI with modes, voice, bookmarks",
  },
  {
    label: "Output Behavior",
    llm: "Replaces llmOutput on each run",
    llmBase: "Replaces llmBaseOutput; represents a single Gemini call that publishes a document",
    research: "Appends to researchMessages[]; supports consolidated or split (N docs) output mode",
  },
  {
    label: "Follow-up Questions",
    llm: "No",
    llmBase: "No",
    research: "Yes \u2014 AI generates 3 follow-up questions per response",
  },
  {
    label: "Deep Research Plan",
    llm: "No",
    llmBase: "No",
    research: "Yes \u2014 generates structured plan with areas & questions",
  },
  {
    label: "Best For",
    llm: "Quick text transformations (summarize, clean, expand)",
    llmBase: "Precise single-call LLM usage with full parameter control; publishing documents",
    research: "Deep exploration, investigation, iterative research",
  },
];

const COL_HEADER = [
  {
    label: "Text Mods",
    icon: Brain,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  {
    label: "LLM",
    icon: BrainCircuit,
    color: "text-fuchsia-500",
    bg: "bg-fuchsia-500/10",
    border: "border-fuchsia-500/30",
  },
  {
    label: "Research",
    icon: Sparkles,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
];

export default function ComponentCompare() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Canvas
          </Button>
          <h1 className="text-lg font-serif font-bold">
            Node Comparison: LLM Nodes vs Research
          </h1>
        </div>
      </header>

      {/* Table */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px] font-semibold">Aspect</TableHead>
              {COL_HEADER.map((col) => (
                <TableHead key={col.label} className={`${col.bg} ${col.border} border-b-2`}>
                  <div className="flex items-center gap-1.5">
                    <col.icon className={`w-4 h-4 ${col.color}`} />
                    <span className={`font-semibold ${col.color}`}>{col.label}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                  {row.label}
                </TableCell>
                <TableCell className="text-sm">{row.llm}</TableCell>
                <TableCell className="text-sm">{row.llmBase}</TableCell>
                <TableCell className="text-sm">{row.research}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </main>
    </div>
  );
}

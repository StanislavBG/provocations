import type { ToolId } from "./ftux-shell-context";

export interface FtuxTip {
  id: string;
  title: string;
  body: string;
  toolId?: ToolId;
  actionLabel?: string;
  category: "getting-started" | "power-user" | "workflow" | "features";
}

export const FTUX_TIPS: FtuxTip[] = [
  // Getting started
  {
    id: "gs-research",
    title: "Start with Research",
    body: "The Research tool lets you have an AI-powered conversation to explore topics. Responses can be captured as notes for your document.",
    toolId: "research",
    actionLabel: "Open Research",
    category: "getting-started",
  },
  {
    id: "gs-voice",
    title: "Think Out Loud",
    body: "Use voice input in any text area to speak your thoughts. The browser transcribes in real-time — no API calls needed.",
    category: "getting-started",
  },
  {
    id: "gs-templates",
    title: "Try Different Templates",
    body: "Each template (Product Requirement, Research Paper, etc.) customizes the AI's behavior, workflow steps, and document format.",
    category: "getting-started",
  },
  {
    id: "gs-personas",
    title: "14 Expert Perspectives",
    body: "Provocations include personas from CEO to Security Engineer. Each challenges a different dimension of your thinking.",
    toolId: "provo",
    actionLabel: "Open Provocations",
    category: "getting-started",
  },
  {
    id: "gs-context",
    title: "Pin Documents as Context",
    body: "Open the Context Store and pin documents. Pinned docs are automatically included in all AI interactions for richer responses.",
    toolId: "context",
    actionLabel: "Open Context",
    category: "getting-started",
  },

  // Power user
  {
    id: "pu-dock-customize",
    title: "Customize Your Dock",
    body: "Drag dock items to reorder them. Right-click the dock for position, translucency, and auto-hide options.",
    category: "power-user",
  },
  {
    id: "pu-pin-tools",
    title: "Pin Tools Anywhere",
    body: "In the hamburger menu, hover over any tool to reveal pin icons. Pin tools to the Dock or Status Bar for quick access.",
    category: "power-user",
  },
  {
    id: "pu-dock-position",
    title: "Move the Dock",
    body: "The dock can be positioned on any edge — bottom, top, left, or right. Open Settings to change it.",
    category: "power-user",
  },
  {
    id: "pu-keyboard",
    title: "Quick Navigation",
    body: "Use the breadcrumb stepper in the status bar to jump between workflow steps. Click any step to navigate directly.",
    category: "power-user",
  },
  {
    id: "pu-translucency",
    title: "Glass Effect",
    body: "Adjust dock translucency in Settings. Higher values create a frosted glass effect that lets the content behind shine through.",
    category: "power-user",
  },

  // Workflow
  {
    id: "wf-challenges",
    title: "Generate Challenges",
    body: "Select personas and click 'Generate Provocations'. Each persona challenges a different aspect — architecture, security, UX, and more.",
    toolId: "provo",
    actionLabel: "Open Provocations",
    category: "workflow",
  },
  {
    id: "wf-evolve",
    title: "Evolve Your Document",
    body: "The Writer tool can expand, condense, restructure, clarify, or correct your document. Combine multiple operations in one pass.",
    toolId: "writer",
    actionLabel: "Open Writer",
    category: "workflow",
  },
  {
    id: "wf-notes-apply",
    title: "Apply Notes Individually",
    body: "Each note card has an 'Apply' button that evolves the document using just that note. Use 'Insert' to append as-is instead.",
    toolId: "notes",
    actionLabel: "Open Notes",
    category: "workflow",
  },
  {
    id: "wf-auto-evolve",
    title: "Auto-Evolve Mode",
    body: "Toggle auto-evolve in the Notes panel. New notes automatically integrate into your document after a 5-second countdown.",
    toolId: "notes",
    actionLabel: "Open Notes",
    category: "workflow",
  },
  {
    id: "wf-context-pinning",
    title: "Context Is Key",
    body: "Pinned documents provide background knowledge to all AI tools. Pin research papers, specs, or reference docs for better results.",
    toolId: "context",
    actionLabel: "Open Context",
    category: "workflow",
  },

  // Features
  {
    id: "ft-painter",
    title: "Generate Images",
    body: "The Painter tool creates images and infographics from text descriptions. Infographic mode uses your pinned context for data-rich visuals.",
    toolId: "painter",
    actionLabel: "Open Painter",
    category: "features",
  },
  {
    id: "ft-chart",
    title: "Visual Diagrams",
    body: "The Chart tool provides an infinite canvas for ERD, flowcharts, and architecture diagrams. Use voice commands to create nodes hands-free.",
    toolId: "chart",
    actionLabel: "Open Chart",
    category: "features",
  },
  {
    id: "ft-timeline",
    title: "Timeline Visualization",
    body: "Map notes to a timeline to visualize events, milestones, and phases. Tag entries with people, places, and themes for filtering.",
    toolId: "timeline",
    actionLabel: "Open Timeline",
    category: "features",
  },
  {
    id: "ft-interview",
    title: "Guided Interviews",
    body: "The Interview tool asks sequential clarifying questions to discover requirements. Great for product specs and research contexts.",
    toolId: "interview",
    actionLabel: "Open Interview",
    category: "features",
  },
  {
    id: "ft-palettes",
    title: "Color Palettes",
    body: "Click the palette icon in the status bar to cycle through 5 color themes: Ember, Ocean, Forest, Dusk, and Slate.",
    category: "features",
  },
  {
    id: "ft-dark-mode",
    title: "Dark Mode",
    body: "Toggle dark mode via the theme icon in the status bar. It works with all color palettes for a personalized experience.",
    category: "features",
  },
  {
    id: "ft-save-context",
    title: "Save to Context Store",
    body: "Save your document to the Context Store for future reference. Saved documents can be pinned as context in any session.",
    toolId: "document",
    actionLabel: "Open Document",
    category: "features",
  },
  {
    id: "ft-multi-tab",
    title: "Multi-Tab Editor",
    body: "The document editor supports multiple tabs — documents, images, charts, and timelines. Switch between them using the tab bar.",
    toolId: "document",
    actionLabel: "Open Document",
    category: "features",
  },
  {
    id: "ft-writer-feedback",
    title: "Writer Feedback",
    body: "Select text in the editor and use voice to give feedback. The Writer interprets your intent and remixes the selected passage.",
    toolId: "writer",
    actionLabel: "Open Writer",
    category: "features",
  },
  {
    id: "ft-desktop-shell",
    title: "Desktop Shell",
    body: "This workspace uses a desktop shell metaphor inspired by Pop!_OS. One tool at a time, focused and spacious — configure it your way.",
    category: "features",
  },
];

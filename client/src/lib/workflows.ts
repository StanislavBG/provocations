/**
 * Workflow types and mock data for the redesigned workspace.
 *
 * A Workflow is a multi-step guided experience. Each step renders
 * a specific display component in the main area and may have
 * additional configuration/detail options in the step-details panel.
 */

// ── Types ──

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  /** Which component to render in the main area */
  component: "text-input" | "persona-select" | "interview" | "document-review" | "capture" | "export";
  /** Optional detail panel configuration */
  detailHint?: string;
  /** Whether this step is optional */
  optional?: boolean;
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  category: "for-you" | "use-case";
  steps: WorkflowStep[];
  /** Estimated number of interactions */
  estimatedInteractions?: number;
  /** Tags for filtering */
  tags?: string[];
}

export interface WorkflowState {
  workflow: Workflow;
  currentStepIndex: number;
  completedSteps: Set<string>;
  stepData: Record<string, unknown>;
}

// ── Mock "For You" workflows (personalized based on user role) ──

export function getForYouWorkflows(userRole?: string): Workflow[] {
  const roleWorkflows: Record<string, Workflow[]> = {
    "Product Manager": [
      {
        id: "fy-product-brief",
        title: "Write a Product Brief",
        description: "Craft a compelling product brief with AI-powered challenges from multiple perspectives.",
        icon: "FileText",
        category: "for-you",
        steps: [
          { id: "s1", title: "Describe Your Idea", description: "Share your product concept, target audience, and goals.", component: "text-input" },
          { id: "s2", title: "Choose Your Challengers", description: "Select personas to review your brief.", component: "persona-select" },
          { id: "s3", title: "Deep Dive Interview", description: "Answer probing questions to strengthen your brief.", component: "interview", detailHint: "View challenge themes and progress" },
          { id: "s4", title: "Review & Refine", description: "Polish your document with suggested improvements.", component: "document-review" },
          { id: "s5", title: "Export", description: "Download or share your completed brief.", component: "export", optional: true },
        ],
        estimatedInteractions: 8,
        tags: ["product", "strategy", "brief"],
      },
      {
        id: "fy-competitive-analysis",
        title: "Competitive Analysis",
        description: "Build a thorough competitive landscape analysis with expert-level scrutiny.",
        icon: "Target",
        category: "for-you",
        steps: [
          { id: "s1", title: "Define Your Market", description: "Describe your product and competitive landscape.", component: "text-input" },
          { id: "s2", title: "Capture Competitor Data", description: "Add screenshots, links, and notes about competitors.", component: "capture", detailHint: "Manage captured assets" },
          { id: "s3", title: "Strategic Interview", description: "Answer questions that sharpen your competitive positioning.", component: "interview" },
          { id: "s4", title: "Review Analysis", description: "Review the synthesized competitive analysis.", component: "document-review" },
        ],
        estimatedInteractions: 10,
        tags: ["competitive", "strategy", "market"],
      },
    ],
    "Engineer": [
      {
        id: "fy-design-doc",
        title: "Write a Design Document",
        description: "Create a well-structured technical design document with architecture review.",
        icon: "Blocks",
        category: "for-you",
        steps: [
          { id: "s1", title: "Describe the Problem", description: "Explain the technical challenge and constraints.", component: "text-input" },
          { id: "s2", title: "Choose Reviewers", description: "Select technical personas for architecture review.", component: "persona-select" },
          { id: "s3", title: "Architecture Interview", description: "Answer design questions from your review team.", component: "interview", detailHint: "Architecture decision log" },
          { id: "s4", title: "Review Design Doc", description: "Polish the generated design document.", component: "document-review" },
        ],
        estimatedInteractions: 12,
        tags: ["engineering", "architecture", "design"],
      },
    ],
    "Designer": [
      {
        id: "fy-ux-review",
        title: "UX Review Session",
        description: "Get your design reviewed from multiple user-centered perspectives.",
        icon: "Palette",
        category: "for-you",
        steps: [
          { id: "s1", title: "Upload Your Design", description: "Share screenshots or describe your design.", component: "capture" },
          { id: "s2", title: "Set Review Context", description: "Describe users, goals, and constraints.", component: "text-input" },
          { id: "s3", title: "Expert Review", description: "Answer UX-focused interview questions.", component: "interview" },
          { id: "s4", title: "Review Findings", description: "Examine and address UX findings.", component: "document-review" },
        ],
        estimatedInteractions: 6,
        tags: ["design", "ux", "review"],
      },
    ],
  };

  // Default workflows if no specific role match
  const defaultWorkflows: Workflow[] = [
    {
      id: "fy-brainstorm",
      title: "Brainstorm & Refine",
      description: "Turn rough ideas into a structured document through guided provocation.",
      icon: "Sparkles",
      category: "for-you",
      steps: [
        { id: "s1", title: "Share Your Ideas", description: "Dump your rough thoughts, notes, or ideas.", component: "text-input" },
        { id: "s2", title: "Choose Perspectives", description: "Select which lenses to examine your ideas through.", component: "persona-select" },
        { id: "s3", title: "Provoked Interview", description: "Answer challenging questions that deepen your thinking.", component: "interview" },
        { id: "s4", title: "Review Document", description: "Review and refine the shaped document.", component: "document-review" },
      ],
      estimatedInteractions: 6,
      tags: ["brainstorm", "ideation", "general"],
    },
    {
      id: "fy-decision-doc",
      title: "Decision Document",
      description: "Make better decisions by examining options from multiple expert perspectives.",
      icon: "GitCompare",
      category: "for-you",
      steps: [
        { id: "s1", title: "Frame the Decision", description: "Describe the decision, options, and stakes.", component: "text-input" },
        { id: "s2", title: "Select Advisory Team", description: "Choose who should challenge your thinking.", component: "persona-select" },
        { id: "s3", title: "Advisory Interview", description: "Defend your options against expert scrutiny.", component: "interview", detailHint: "Decision matrix" },
        { id: "s4", title: "Review Recommendation", description: "Review the decision document with rationale.", component: "document-review" },
      ],
      estimatedInteractions: 8,
      tags: ["decision", "strategy"],
    },
  ];

  const roleSpecific = roleWorkflows[userRole || ""] || [];
  return [...roleSpecific, ...defaultWorkflows];
}

// ── Static "Use Cases" workflows ──

export const useCaseWorkflows: Workflow[] = [
  {
    id: "uc-hearing-prep",
    title: "Hearing Preparation",
    description: "Prepare testimony and supporting materials for a regulatory or legislative hearing.",
    icon: "Scale",
    category: "use-case",
    steps: [
      { id: "s1", title: "Define the Hearing", description: "Describe the hearing context, audience, and your position.", component: "text-input" },
      { id: "s2", title: "Gather Evidence", description: "Capture supporting documents, data, and references.", component: "capture", detailHint: "Evidence inventory" },
      { id: "s3", title: "Select Challenge Personas", description: "Choose who will challenge your testimony.", component: "persona-select" },
      { id: "s4", title: "Mock Cross-Examination", description: "Defend your position under rigorous questioning.", component: "interview", detailHint: "Challenge themes tracker" },
      { id: "s5", title: "Review Testimony", description: "Polish and finalize your prepared testimony.", component: "document-review" },
    ],
    estimatedInteractions: 15,
    tags: ["hearing", "testimony", "preparation"],
  },
  {
    id: "uc-proposal-writing",
    title: "Proposal Writing",
    description: "Write a persuasive proposal with built-in stakeholder challenge perspectives.",
    icon: "FileText",
    category: "use-case",
    steps: [
      { id: "s1", title: "Outline Your Proposal", description: "Describe what you're proposing, to whom, and why.", component: "text-input" },
      { id: "s2", title: "Stakeholder Perspectives", description: "Choose personas representing key stakeholders.", component: "persona-select" },
      { id: "s3", title: "Stakeholder Interview", description: "Address concerns from each stakeholder perspective.", component: "interview" },
      { id: "s4", title: "Review Proposal", description: "Review and strengthen the final proposal.", component: "document-review" },
      { id: "s5", title: "Export", description: "Download or share your proposal.", component: "export", optional: true },
    ],
    estimatedInteractions: 10,
    tags: ["proposal", "persuasion", "stakeholder"],
  },
  {
    id: "uc-strategy-doc",
    title: "Strategy Document",
    description: "Develop a comprehensive strategy document stress-tested by diverse expert perspectives.",
    icon: "Compass",
    category: "use-case",
    steps: [
      { id: "s1", title: "Set Strategic Context", description: "Describe the landscape, challenges, and your vision.", component: "text-input" },
      { id: "s2", title: "Assemble Your Board", description: "Select expert personas to challenge your strategy.", component: "persona-select" },
      { id: "s3", title: "Board Review", description: "Defend and refine your strategy under expert questioning.", component: "interview", detailHint: "Strategic themes" },
      { id: "s4", title: "Review Strategy", description: "Polish the strategy document.", component: "document-review" },
    ],
    estimatedInteractions: 12,
    tags: ["strategy", "planning", "vision"],
  },
  {
    id: "uc-incident-review",
    title: "Incident Post-Mortem",
    description: "Conduct a thorough incident review with systematic root cause analysis.",
    icon: "AlertTriangle",
    category: "use-case",
    steps: [
      { id: "s1", title: "Describe the Incident", description: "What happened, when, and what was the impact?", component: "text-input" },
      { id: "s2", title: "Select Review Team", description: "Choose perspectives for root cause analysis.", component: "persona-select" },
      { id: "s3", title: "Root Cause Interview", description: "Answer probing questions to uncover root causes.", component: "interview", detailHint: "Contributing factors" },
      { id: "s4", title: "Review Post-Mortem", description: "Review findings, timeline, and action items.", component: "document-review" },
    ],
    estimatedInteractions: 10,
    tags: ["incident", "post-mortem", "analysis"],
  },
];

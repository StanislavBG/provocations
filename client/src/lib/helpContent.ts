/**
 * Help content — comprehensive markdown pages for the help system.
 *
 * Each page is keyed by a URL-friendly slug and contains a title, category,
 * and full markdown body. The content is rendered by the Help page and
 * HelpButton dialog.
 */

export interface HelpPage {
  title: string;
  category: string;
  content: string;
}

export const HELP_CATEGORIES = ["Basics", "Canvas", "Features", "Reference"] as const;

export const HELP_PAGES: Record<string, HelpPage> = {
  "getting-started": {
    title: "Getting Started",
    category: "Basics",
    content: `# Getting Started with Provocations

Provocations is an AI-augmented thinking workspace. Unlike tools that write *for* you, Provocations deploys 14 expert AI personas that challenge your ideas from different angles — an Architect questions your system design, a CEO questions your strategy, a Security Engineer probes your threat model. You respond to each challenge, and your responses become the document.

The core idea is simple: when AI writes a paragraph for you, you learn nothing. When AI points out that your product requirement has no error handling strategy and you have to address the gap yourself, the resulting document is better — and so are you.

## Your First Canvas

1. **Add a Research node** — click it in the dock on the left, or drag it onto the canvas.
2. **Double-click to open** — the expanded view gives you a chat interface to explore a topic with AI.
3. **Add a Document node** — this is where your final output lives.
4. **Connect them** — drag from the Research node's output port (right side) to the Document node's input port (left side).
5. **Run the chain** — click the Play button on the Research node. The AI processes your research and flows the result into the Document.

## Core Concepts

- **Canvas** — Your infinite workspace for building processing flows. Pan with WASD, zoom with scroll wheel.
- **Nodes** — Building blocks you place on the canvas. Each type does something different: Research chats with AI, Document holds your output, LLM transforms text, and so on.
- **Edges** — Connections that carry data between nodes. Drag from an output port to an input port to connect two nodes.
- **Chain Execution** — Running a flow from start to finish. Click Play on any node to execute it and everything downstream.
- **Personas** — 14 AI experts across Business, Technology, and Marketing domains that challenge your thinking from different angles.
- **Context Store** — Your persistent document library. Save research, notes, and files for reuse across canvases.
`,
  },

  "canvas-basics": {
    title: "The Canvas",
    category: "Basics",
    content: `# The Canvas

The canvas is your infinite workspace. Everything you build lives here — nodes, connections, and the flows between them.

## Navigation

| Action | How |
|--------|-----|
| Pan | **WASD** keys (glide camera), or **middle-click drag** |
| Zoom in | **Scroll up**, or press **+** / **=** (hold to accelerate) |
| Zoom out | **Scroll down**, or press **-** (hold to accelerate) |
| Fit to view | Press **F** to zoom and center on all nodes |
| Minimap | Press **M** to toggle the minimap overlay |

## Adding Nodes

- **Click** a tool in the dock on the left side of the screen to place it at the center of the canvas.
- **Drag** a tool from the dock onto the canvas to place it at a specific location.
- **Hotkeys 1-9** correspond to dock slot positions — press the number key for quick placement.

## Selecting Nodes

| Action | How |
|--------|-----|
| Select one | Click on a node |
| Multi-select | Hold **Shift** and click additional nodes |
| Select all | **Ctrl+A** (or Cmd+A on Mac) |
| Deselect all | Press **Escape** |
| Marquee select | Click and drag on empty canvas to draw a selection rectangle |

## Working with Nodes

- **Double-click** any node to open its expanded view — a full-screen overlay with the node's complete interface.
- **Drag** nodes to reposition them. Multi-selected nodes move together.
- **Delete** selected nodes with the **Delete** or **Backspace** key.
- **Copy/Paste** selected nodes with **Ctrl+C** / **Ctrl+V**.

## Canvas Management

- Canvases **auto-save** every time you make a change (2-second debounce).
- **Rename** your canvas in the status bar at the top.
- **Open** saved canvases from the Canvas menu in the status bar.
- Each canvas gets a unique URL you can share with collaborators.

## Canvas Styles

Choose a visual theme for your canvas from the Settings menu. The Aurora style adds an animated background with glassmorphism node cards.
`,
  },

  "connecting-nodes": {
    title: "Connecting Nodes",
    category: "Canvas",
    content: `# Connecting Nodes

Connections (edges) carry data between nodes. They define how information flows through your canvas.

## Creating a Connection

1. Hover over a node to reveal its **port dots** — small circles on the left (input) and right (output) sides.
2. **Click and drag** from an output port to an input port on another node.
3. If the target node accepts multiple connection roles, a **role picker dialog** appears asking how to use the incoming data.

## Connection Roles

When you connect to a role-aware node (like Research, LLM, or Interview), you choose how the connection is used:

| Role | What It Does | Example |
|------|-------------|---------|
| **Context** | Background material that informs the AI's thinking | Connect research findings as context to an LLM node |
| **Objective** | The goal or task description | Connect a document describing what you want the Research node to investigate |
| **User Prompt** | The direct instruction or question | Connect a document as the user message to an LLM node |
| **Output Format** | Template or structure for the response | Connect a formatting guide to shape how a Research node responds |

## Role Badges

Connected edges display abbreviated role badges:
- **OBJ** — Objective
- **CTX** — Context
- **FMT** — Output Format
- **USR** — User Prompt

Multi-role edges stack badges horizontally.

## Tips

- Not all nodes use roles. Simple nodes (like Painter or Social Post) skip the role picker and treat all incoming data as general input.
- You can connect multiple nodes to the same input — the receiving node merges all incoming content.
- Double-click an edge to change its role assignment.
`,
  },

  "chain-execution": {
    title: "Chain Execution",
    category: "Canvas",
    content: `# Chain Execution

Chain execution is how data flows through your canvas. When you run a node, it processes its inputs and passes the result downstream to connected nodes.

## Running a Chain

- Click the **Play** button on any playable node to execute it.
- The node processes its own content plus any upstream inputs.
- When it finishes, all **downstream** connected nodes automatically execute in sequence.
- Nodes pulse with an animation while they are processing.

## Execution Order

Chains follow the connection graph from left to right (upstream to downstream):

\`\`\`
[Research] → [LLM: Summarize] → [Document]
    ↓
[LLM: Expand] → [Social Post]
\`\`\`

In this example, clicking Play on Research would:
1. Run the Research node
2. Run both "Summarize" and "Expand" LLM nodes (they receive the research output)
3. Run Document and Social Post (they receive their respective LLM outputs)

## Input Modes

Each playable node has an input mode toggle:

- **Wait All** (default) — Waits for every upstream input to complete before running. Use this when you need all inputs combined.
- **Fire Each** — Runs immediately each time any single upstream input arrives. Use this when inputs should be processed independently.

## Logic Nodes

Logic nodes control how data flows through your chain:

| Node | Purpose |
|------|---------|
| **Filter** | Passes data through only if it meets criteria |
| **Gate** | Blocks or allows data based on a condition |
| **Router** | Sends data to different downstream paths based on rules |
| **Merge** | Combines multiple inputs into one output |
| **Coherence Gate** | AI quality check — passes data only if it meets a quality threshold |

## Tips

- Chains are **acyclic** — you cannot create loops. The system detects and prevents circular connections.
- If a chain step fails, downstream nodes will not execute.
- Use the **Activity Log** (accessible from the status bar) to see detailed execution history for every node.
`,
  },

  "edge-roles": {
    title: "Edge Roles",
    category: "Canvas",
    content: `# Edge Roles

Edge roles tell the receiving node *how* to use incoming data. Different roles affect different parts of the AI prompt.

## The Four Roles

### Objective
The goal or task. This tells the node what to accomplish.
- In a **Research** node: becomes the research question
- In an **Interview** node: becomes what the AI interviews you about
- In an **LLM** node: becomes the primary task instruction

### Context
Background material that provides supporting information.
- Included as reference material in the AI's system context
- Does not directly instruct the AI — it informs
- Example: connecting meeting notes as context to a Document node so the AI understands the background

### User Prompt
A direct instruction or question sent as the user message.
- In an **LLM** node: becomes the user-facing part of the prompt
- Best for specific requests like "Summarize this in 3 bullet points"

### Output Format
A template or structure that shapes the response.
- In a **Research** node: guides how findings are structured
- Example: connecting a template document that says "Use H2 headings, bullet points, and include a summary section"

## Which Nodes Accept Which Roles

| Node Type | Accepted Roles |
|-----------|---------------|
| Research | Objective, Context, Output Format |
| Interview | Objective, Context |
| LLM / LLM Base | Context, User Prompt |
| Coherence Gate | Context |
| Others | General input (no role distinction) |

## Choosing the Right Role

- If you want the node to **do something specific**, use Objective or User Prompt.
- If you want the node to **know about something**, use Context.
- If you want the node to **format its output a certain way**, use Output Format.
`,
  },

  "personas": {
    title: "Personas & Provocations",
    category: "Features",
    content: `# Personas & Provocations

The provocation system is the heart of Provocations. Instead of AI writing your document, expert personas challenge your thinking so *you* write a better document.

## 14 Expert Personas

Personas are organized across three domains:

### Business Domain
- **Think Bigger** — Challenges you to scale impact: retention, reach, accessibility
- **CEO** — Mission-first perspective: clarity, accountability, trust
- **Product Manager** — Business value lens: user stories, success metrics, prioritization

### Technology Domain
- **Architect** — System design: boundaries, APIs, data flow, scalability
- **Data Architect** — Data modeling, storage decisions, identifier design
- **QA Engineer** — Testing strategy: edge cases, error handling, reliability
- **UX Designer** — User flows: discoverability, accessibility, interaction patterns
- **Tech Writer** — Documentation quality: clarity, naming, context, completeness
- **Security Engineer** — Auth, data privacy, compliance, encryption
- **Cybersecurity** — Threat modeling, attack surface, incident response

### Marketing Domain
- **Growth Strategist** — Acquisition, activation, retention, funnel economics
- **Brand Strategist** — Positioning, differentiation, voice consistency
- **Content Strategist** — Audience-channel fit, distribution, SEO, measurement

## How Provocations Work

1. **Select personas** — Choose which experts should review your document (default: Think Bigger + Architect + one random).
2. **Generate challenges** — Click "Generate" and each selected persona reads your document and produces a pointed challenge.
3. **Challenges, not advice** — Challenges surface problems *without offering solutions*. This forces you to think through the answer yourself.
4. **Respond** — Type or speak your response to each challenge.
5. **Show advice** (optional) — After responding, you can ask for the persona's advice on your response.
6. **Evolve document** — Click "Evolve Document" to merge all your responses and accepted advice into the document.

## Adversarial by Design

Challenge generation and advice generation use completely separate AI calls with different system prompts. You can never accidentally get advice when you asked for a challenge. This separation ensures the AI genuinely pushes back on your thinking rather than offering easy agreement.

## Using Personas in Flow Canvas

Open the **Provo tab** in any Document node's expanded view to access the provocation workflow. The tab shows your selected personas, their challenges, and the response interface.
`,
  },

  "blueprints": {
    title: "Blueprints",
    category: "Features",
    content: `# Blueprints

Blueprints are reusable canvas templates. Instead of building the same flow from scratch every time, save it as a blueprint and instantiate it with one click.

## Built-in Blueprints

Provocations ships with several pre-built blueprints for common workflows:

- **PRD to Reddit Post** — 6-node chain that researches subreddit rules, drafts a Reddit-native post from a PRD, validates rule compliance, and outputs to a social post node.
- More blueprints are added regularly. Check the Blueprints menu in the status bar.

## Using a Blueprint

1. Click the **Blueprints** icon in the status bar (or find it in the Canvas menu).
2. Browse built-in blueprints and your saved blueprints.
3. Click a blueprint to load it onto a new canvas.
4. Customize the nodes — fill in your content, adjust settings, and run the chain.

## Creating Your Own Blueprints

1. Build a flow on your canvas that you want to reuse.
2. Open the Canvas menu and choose **Save as Blueprint**.
3. Give it a name and description.
4. Your blueprint appears in the **My Blueprints** section.

## Sharing Blueprints

- Click the **Share** button on any blueprint you created.
- Choose a connection to share it with.
- Shared blueprints appear in the recipient's blueprint menu.
- You can delete your own blueprints from the My Blueprints section.
`,
  },

  "context-store": {
    title: "Context Store",
    category: "Features",
    content: `# Context Store

The Context Store is your persistent document library. It stores research, notes, files, and any content you want to reuse across canvases.

## Opening the Context Store

- Click the **gear icon** in the status bar, then select **Context Store**.
- Or use a **Store** node on the canvas to browse and save documents.

## Organization

- **Folders** — Create folders to organize your documents. Nest folders for deeper hierarchy.
- **Document types** — The store supports text documents, images, video, PDFs, and other media.
- **Sort** — Sort files by name or date.
- **Views** — Switch between list and grid view.

## Using Context on the Canvas

### Context Nodes
Place a **Context** node on the canvas and select a document from the store. The node's content becomes available as input to connected nodes.

### Store Nodes
**Store** nodes let you save chain output back to the Context Store. Connect a Document or LLM node's output to a Store node, and the processed content is automatically saved.

### Pinning Context
Pin frequently used documents to a canvas so they are always available as reference material.

## Uploading Files

1. Place an **Upload** node on the canvas or use the upload button in the Context Store Manager.
2. Drag and drop files — images, PDFs, text files (up to 50MB).
3. Uploaded files are encrypted and stored in your Context Store.

## Privacy

All documents in the Context Store are encrypted at rest with AES-256-GCM. Each field uses independent salt and IV. The server cannot read your content.
`,
  },

  "voice-input": {
    title: "Voice Input",
    category: "Features",
    content: `# Voice Input

Provocations is a voice-first tool. You can speak your ideas and the AI structures them — no typing required for initial capture.

## How It Works

Voice capture uses the **browser-native Web Speech API** — no server-side transcription, no LLM cost for converting speech to text. The LLM is only called *after* you have a transcript, for post-processing.

## Voice on the Canvas

### Audio Capture Node
Place an **Audio Capture** node on the canvas. Click the mic icon to start recording. Your speech is transcribed in real time and the text becomes available to downstream nodes.

### Interview Node
The **Interview** node uses voice for a structured Q&A:
- AI asks you questions about your topic
- You answer by speaking (or typing)
- AI captures and organizes your responses
- **Brainstorm mode**: fluid, interruptible conversation — just start talking to interrupt the AI
- **One at a Time mode**: structured question-and-answer format

### Document Node — Voice Tools
In a Document's expanded view, you have:
- **Direct Voice** — Speak and your words are inserted at the cursor position, as-is
- **Voice Remix** — Highlight text, speak your thoughts, and AI merges your spoken input with the selected text

## Tips for Best Results

- Speak in complete thoughts — the speech-to-text works best with full sentences.
- Use a quiet environment when possible, especially for brainstorm mode's always-listening mic.
- If voice recognition seems stuck, check that your browser has microphone permission.
- Voice works on both desktop and mobile browsers.
- ElevenLabs integration is available for higher-quality AI voice responses in Interview nodes.
`,
  },

  "node-types": {
    title: "Node Types Reference",
    category: "Reference",
    content: `# Node Types Reference

Provocations has 25 node types organized into functional groups.

## Gather — Input and Source Nodes

| Node | Description |
|------|-------------|
| **Context** | Load saved documents from your Context Store to use as input |
| **Label** | Place a text label on the canvas for organization and notes |
| **Zone** | Draw a colored boundary box to visually group related nodes |
| **Audio Capture** | Record voice with automatic real-time text transcription |
| **YouTube** | Pull transcripts from YouTube videos, search videos, or process playlists |
| **Upload** | Drag-and-drop images, PDFs, or text files onto the canvas |

## Workshop — AI Conversation Nodes

| Node | Description |
|------|-------------|
| **Research** | Chat with AI to explore a topic — ask questions, get insights, save findings |
| **Interview** | AI asks structured questions to draw out and organize your ideas |

## Build — Processing and Output Nodes

| Node | Description |
|------|-------------|
| **Text Mods (LLM)** | Transform text with presets: summarize, expand, clean up, or custom instruction |
| **LLM (Base)** | Direct AI access with full model configuration — temperature, safety, streaming |
| **Painter** | Describe what you want and AI generates an image |
| **Timeline** | Turn dates and events into a visual timeline |
| **Trigger** | Set a timer or schedule to automatically run connected nodes |
| **Social Post** | Turn content into platform-ready social media updates |
| **API Post** | Send finished content to external services via webhook |
| **Notify** | Get notified when a chain of tools finishes processing |
| **Approval** | Pause the chain until you review and approve the output |
| **Store** | Save chain output back to the Context Store |
| **Document** | The primary output node — your final document with rich editing tools |

## Logic — Flow Control Nodes

| Node | Description |
|------|-------------|
| **Filter** | Pass data through only if it meets specified criteria |
| **Gate** | Block or allow data based on a condition |
| **Router** | Send data to different paths based on rules |
| **Merge** | Combine multiple inputs into one output |
| **Coherence Gate** | AI quality check — passes data only if it meets a quality threshold |

## Visual — Non-Processing Nodes

| Node | Description |
|------|-------------|
| **Label** | Text annotation on the canvas (non-functional) |
| **Zone** | Visual grouping boundary (non-functional) |
`,
  },

  "keyboard-shortcuts": {
    title: "Keyboard Shortcuts",
    category: "Reference",
    content: `# Keyboard Shortcuts

All keyboard shortcuts are customizable. Open **Settings** from the status bar to remap keys.

## Canvas Navigation

| Shortcut | Action |
|----------|--------|
| **W** | Glide camera up |
| **A** | Glide camera left |
| **S** | Glide camera down |
| **D** | Glide camera right |
| **+** or **=** | Zoom in (hold to accelerate) |
| **-** | Zoom out (hold to accelerate) |
| **M** | Toggle minimap |
| **F** | Fit all nodes to view |

## Selection

| Shortcut | Action |
|----------|--------|
| **Ctrl+A** / **Cmd+A** | Select all nodes |
| **Escape** | Deselect all |
| **Shift+Click** | Add/remove node from selection |

## Editing

| Shortcut | Action |
|----------|--------|
| **Ctrl+Z** / **Cmd+Z** | Undo |
| **Ctrl+Shift+Z** / **Cmd+Shift+Z** | Redo |
| **Ctrl+Y** / **Cmd+Y** | Redo (alternate) |
| **Ctrl+C** / **Cmd+C** | Copy selected nodes |
| **Ctrl+V** / **Cmd+V** | Paste at cursor |
| **Delete** or **Backspace** | Delete selected nodes/edges |

## Dock

| Shortcut | Action |
|----------|--------|
| **1-9** | Place the tool in dock slot 1-9 |

## Expanded Views

When a node's expanded view is open, canvas shortcuts are disabled. Press **Escape** to close the expanded view (unless you are editing a text field, in which case Escape exits the text field first).

## Customization

1. Open **Settings** from the gear icon in the status bar.
2. Find the **Keyboard Shortcuts** section.
3. Click any shortcut to start recording a new key combination.
4. Press the new key(s) and click confirm.
5. Your overrides persist across sessions.
`,
  },
};

/** Get all unique categories in display order. */
export function getHelpCategories(): string[] {
  return [...HELP_CATEGORIES];
}

/** Get all pages within a category. */
export function getPagesByCategory(category: string): Array<{ slug: string } & HelpPage> {
  return Object.entries(HELP_PAGES)
    .filter(([, page]) => page.category === category)
    .map(([slug, page]) => ({ slug, ...page }));
}

/** Simple text search across all help pages (title + content). */
export function searchHelpPages(query: string): Array<{ slug: string } & HelpPage> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return Object.entries(HELP_PAGES)
    .filter(
      ([, page]) =>
        page.title.toLowerCase().includes(q) ||
        page.content.toLowerCase().includes(q),
    )
    .map(([slug, page]) => ({ slug, ...page }));
}

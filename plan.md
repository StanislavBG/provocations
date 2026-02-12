# ProvokeText — Unified Text Component Plan

## Problem

13 text input surfaces across 8 files, using 3 different base components (`BilkoTextForm`, raw `<textarea>`, shadcn `<Input>`). Buttons are inconsistent, voice handling is duplicated, and AI actions are wired up ad-hoc in each consumer.

## Design: ProvokeText

One component with 3 **variants** and 2 **chrome** modes:

### Variants (what kind of input)

| Variant | Replaces | Behavior |
|---------|----------|----------|
| `"input"` | shadcn `<Input>` | Single-line, Enter to submit, no auto-expand |
| `"textarea"` | `BilkoTextForm` / `AutoExpandTextarea` | Multi-line, auto-expand between minRows/maxRows |
| `"editor"` | Raw `<textarea>` in ReadingPane | Full-height document canvas, word count, reading time |

### Chrome (how it's wrapped)

| Chrome | Used For | Appearance |
|--------|----------|------------|
| `"container"` | Objective input, Draft input | Bordered card with header (icon + label), actions row, footer |
| `"inline"` | Outline sections, guidance input, answers | Bare textarea with floating toolbar (top-right) |
| `"bare"` | Document editor, header objective | No chrome at all, just the input |

### Unified Props

```tsx
interface ProvokeTextProps {
  // Core
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;

  // Variant & chrome
  variant?: "input" | "textarea" | "editor";   // default: "textarea"
  chrome?: "container" | "inline" | "bare";     // default: "inline"

  // Sizing (textarea/editor only)
  minRows?: number;
  maxRows?: number;

  // Container chrome header
  label?: string;
  labelIcon?: LucideIcon;
  description?: string;

  // Toolbar buttons (shown in header for container, floating for inline)
  showCopy?: boolean;     // default: true
  showClear?: boolean;    // default: true

  // Voice
  voice?: {
    mode: "append" | "replace";
    inline?: boolean;        // show interim in textarea (default: true)
  };
  onVoiceTranscript?: (transcript: string) => void;
  onRecordingChange?: (recording: boolean) => void;

  // Smart buttons (AI actions)
  actions?: ProvokeAction[];

  // Submit behavior
  onSubmit?: () => void;          // Enter key (input variant) or explicit button
  submitLabel?: string;           // Text on submit button (if provided, shows button)
  submitIcon?: LucideIcon;
  submitDisabled?: boolean;
  submitLoading?: boolean;

  // Metrics
  showCharCount?: boolean;
  showWordCount?: boolean;
  showReadingTime?: boolean;

  // Keyboard
  onKeyDown?: (e: React.KeyboardEvent) => void;

  // Escape hatch slots
  headerExtra?: React.ReactNode;
  footerExtra?: React.ReactNode;
  children?: React.ReactNode;     // below textarea, above footer
}

interface ProvokeAction {
  key: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick: () => void;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  visible?: boolean;
  variant?: "ghost" | "outline" | "default";
}
```

## Migration Map

Each current surface → its ProvokeText configuration:

### 1. TextInputForm — Objective (container BilkoTextForm)
```tsx
<ProvokeText
  variant="textarea" chrome="container"
  label="Your objective" labelIcon={Target}
  minRows={3} maxRows={6}
  voice={{ mode: "replace" }}
  actions={[cleanupAction, showOriginalAction, restoreAction]}
  showCharCount
/>
```

### 2. TextInputForm — Draft (container BilkoTextForm)
```tsx
<ProvokeText
  variant="textarea" chrome="container"
  label="Your draft" labelIcon={PenLine}
  minRows={12} maxRows={40}
  voice={{ mode: "append" }}
  actions={[cleanupAction, showOriginalAction, restoreAction]}
  showCharCount autoFocus
  onSubmit={handleSubmit} submitLabel="Begin Analysis"
/>
```

### 3. Workspace — Header Objective (raw Input)
```tsx
<ProvokeText
  variant="input" chrome="bare"
  voice={{ mode: "replace" }}
  showCopy={false} showClear={false}
/>
```

### 4. ReadingPane — Document Editor (raw textarea)
```tsx
<ProvokeText
  variant="editor" chrome="bare"
  showWordCount showReadingTime
  voice={{ mode: "append", inline: false }}
  showCopy
/>
```

### 5. ReadingPane — Edit Instruction (Input in floating toolbar)
```tsx
<ProvokeText
  variant="input" chrome="bare"
  voice={{ mode: "replace" }}
  onSubmit={handleEdit}
  submitIcon={Send}
/>
```

### 6. OutlineBuilder — New Heading (Input)
```tsx
<ProvokeText
  variant="input" chrome="bare"
  onSubmit={handleAddItem}
  submitIcon={Plus}
  showCopy={false} showClear={false}
/>
```

### 7. OutlineBuilder — Section Content (inline BilkoTextForm)
```tsx
<ProvokeText
  variant="textarea" chrome="inline"
  minRows={4} maxRows={20}
  voice={{ mode: "append", inline: false }}
  actions={[generateAction]}
  showWordCount
/>
```

### 8. OutlineBuilder — Section Instruction (Input)
```tsx
<ProvokeText
  variant="input" chrome="bare"
  voice={{ mode: "replace" }}
  onSubmit={handleInstruction}
  submitIcon={Send}
/>
```

### 9. ProvocationsDisplay — Challenge Guidance (inline BilkoTextForm)
```tsx
<ProvokeText
  variant="textarea" chrome="inline"
  minRows={2} maxRows={4}
  voice={{ mode: "replace" }}
  onSubmit={handleGenerate}
  submitLabel="Get Feedback" submitIcon={RefreshCw}
/>
```

### 10. InterviewPanel — Answer (inline BilkoTextForm)
```tsx
<ProvokeText
  variant="textarea" chrome="inline"
  minRows={2} maxRows={8}
  voice={{ mode: "replace" }}
  onSubmit={handleSubmitAnswer}
  submitIcon={Send}
/>
```

### 11. DraftQuestionsPanel — Response (inline BilkoTextForm)
```tsx
<ProvokeText
  variant="textarea" chrome="inline"
  minRows={2} maxRows={6}
  voice={{ mode: "replace" }}
  onSubmit={handleResponse}
  submitIcon={Send}
  showCopy={false}
/>
```

## Implementation Steps

### Step 1: Create ProvokeText component
- File: `client/src/components/ProvokeText.tsx`
- Build on top of `AutoExpandTextarea` for textarea/editor variants
- Use shadcn `Input` for input variant
- Implement container/inline/bare chrome
- Integrate VoiceRecorder directly
- Implement actions row with consistent styling
- Implement metrics (char count, word count, reading time)

### Step 2: Migrate BilkoTextForm consumers (6 surfaces)
- TextInputForm.tsx: Objective + Draft → ProvokeText (container)
- OutlineBuilder.tsx: Section Content → ProvokeText (inline)
- ProvocationsDisplay.tsx: Challenge Guidance → ProvokeText (inline)
- InterviewPanel.tsx: Answer → ProvokeText (inline)
- DraftQuestionsPanel.tsx: Response → ProvokeText (inline)

### Step 3: Migrate raw Input consumers (5 surfaces)
- Workspace.tsx: Header Objective → ProvokeText (bare input)
- OutlineBuilder.tsx: New Heading + Edit Heading + Instruction → ProvokeText (bare input)
- ReadingPane.tsx: Edit Instruction → ProvokeText (bare input)

### Step 4: Migrate ReadingPane document editor (1 surface)
- ReadingPane.tsx: Main textarea → ProvokeText (bare editor)

### Step 5: Delete BilkoTextForm.tsx
- Remove the old component once all consumers are migrated

### Step 6: Build verification
- `npm run check` + `npm run build`

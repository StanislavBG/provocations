# Component Patterns

## Design System

### Theme
- **Primary**: Warm amber (#B35C1E)
- **Accent**: Thoughtful blue (200, 60%, 45%)
- **Aesthetic**: Aged paper/ink, intellectual warmth
- **Mode**: Dark mode supported

### Fonts
- **Body**: Source Serif 4
- **Headings**: Libre Baskerville
- **Code**: JetBrains Mono

## ProvokeText — Universal Text Component

**ADR**: All text panels in the application MUST use `ProvokeText`. See `docs/adrs.md` → ADR 2 and ADR 3 for full rules.

### Quick Usage

```tsx
// Read-only display
<ProvokeText readOnly showCopy chrome="container" value={content} />

// Editable text area
<ProvokeText chrome="container" variant="textarea" value={text} onChange={setText} />

// Document editor
<ProvokeText chrome="container" variant="editor" value={doc} onChange={setDoc} />

// Streaming content
<ProvokeText readOnly chrome="container" value={streamingText} />
```

### Self-Contained Voice
When no explicit `voice` or `onVoiceTranscript` props are provided and the panel is editable and substantial (`chrome !== "bare"`, `variant !== "input"`), ProvokeText auto-enables an "append" voice mode that appends transcripts directly into the value via `onChange`. The mic button always appears.

### Built-in Text Processor
When no explicit `textProcessor` is provided and the panel is a container chrome, editable, and not an input variant, ProvokeText provides a default processor that calls `/api/summarize-intent` for Clean and Summarize actions.

### Built-in Save / Load
Pass `onSave` (and optionally `isSaving`) or `onLoad` callbacks to show Save and Load action buttons. The parent owns the handler logic; ProvokeText owns the button rendering.

## LlmHoverButton — Pre-Call Transparency

**ADR**: Every LLM-triggering button must be wrapped with `LlmHoverButton`. See `docs/adrs.md` → ADR 4 for full rules.

### Quick Usage

```tsx
<LlmHoverButton
  previewTitle="Generate Challenges"
  previewBlocks={contextBlocks}
  previewSummary={summaryItems}
>
  <Button onClick={handleGenerate}>Generate</Button>
</LlmHoverButton>
```

### Exported Utilities
From `LlmCallPreview`: `LLM_COST_TABLE`, `CHARS_PER_TOKEN`, `estimateTokens()`, `estimateInputCost()`, `useActiveModel()`, `ContextBlock`, `SummaryItem`.

From `LlmHoverButton`: Re-exports `ContextBlock`, `SummaryItem`, `estimateTokens`, `CHARS_PER_TOKEN`.

## Component Wiki

The app has an in-app **Component Wiki** at `/components` (library) and `/components/:componentId` (individual pages). All component metadata lives in `client/src/lib/componentRegistry.ts`.

**When creating or significantly changing a component**, update `COMPONENT_REGISTRY`:
1. **New component**: Add a `ComponentEntry` with id, name, filePath, category, description, props, hooks, capabilities, dependencies, apiEndpoints.
2. **Modified component**: Update the existing entry.
3. **Deleted component**: Remove its entry.
4. **Cross-references**: Update `dependencies` arrays if import relationships changed.

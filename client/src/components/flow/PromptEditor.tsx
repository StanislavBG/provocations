/**
 * PromptEditor — ContentEditable prompt editor with inline context block pill chips.
 *
 * Used in LLM node overlays. Supports @-triggered autocomplete to insert
 * references to connected context blocks. References are stored as `@[label]`
 * markers and rendered as styled inline pill chips.
 */

import { useRef, useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PromptEditorAutocomplete } from "./PromptEditorAutocomplete";

export interface ContextBlock {
  label: string;
  content: string;
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  contextBlocks: ContextBlock[];
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Called on mouseup when text is selected (for selection popovers) */
  onSelect?: () => void;
  /** Additional label shown above the editor */
  label?: string;
  /** Show copy button */
  showCopy?: boolean;
}

// ── Marker format: @[Label Text] ──

const REF_PATTERN = /@\[([^\]]+)\]/g;

/** Parse a marker string into segments of text and refs */
function parseMarkers(text: string): Array<{ type: "text"; value: string } | { type: "ref"; label: string }> {
  const segments: Array<{ type: "text"; value: string } | { type: "ref"; label: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(REF_PATTERN.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "ref", label: match[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

/** Build HTML from marker-format string */
function markersToHtml(text: string, knownLabels: Set<string>): string {
  const segments = parseMarkers(text);
  return segments
    .map((seg) => {
      if (seg.type === "text") return escapeHtml(seg.value).replace(/\n/g, "<br>");
      const isValid = knownLabels.has(seg.label.trim().toLowerCase());
      const cls = isValid
        ? "prompt-pill"
        : "prompt-pill prompt-pill--broken";
      return `<span contenteditable="false" data-ref="${escapeAttr(seg.label)}" class="${cls}">@${escapeHtml(seg.label)}</span>`;
    })
    .join("");
}

/** Extract marker-format string from contentEditable DOM */
function htmlToMarkers(container: HTMLElement): string {
  let result = "";
  const children = Array.from(container.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const ref = el.getAttribute("data-ref");
      if (ref) {
        result += `@[${ref}]`;
      } else if (el.tagName === "BR") {
        result += "\n";
      } else if (el.tagName === "DIV") {
        // ContentEditable wraps new lines in <div> blocks
        if (i > 0) result += "\n";
        result += htmlToMarkers(el);
      } else {
        // Recurse for nested elements (e.g. from paste)
        result += htmlToMarkers(el);
      }
    }
  }
  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Expand @[label] markers to actual block content */
export function expandContextRefs(text: string, blocks: ContextBlock[]): string {
  return text.replace(/@\[([^\]]+)\]/g, (_match, label: string) => {
    const block = blocks.find((b) => b.label.trim().toLowerCase() === label.trim().toLowerCase());
    return block ? block.content : _match;
  });
}

/** Get set of referenced label names (lowercase) from marker text */
export function getReferencedLabels(text: string): Set<string> {
  const labels = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(REF_PATTERN.source, "g");
  while ((match = re.exec(text)) !== null) {
    labels.add(match[1].trim().toLowerCase());
  }
  return labels;
}

// ── Component ──

export function PromptEditor({
  value,
  onChange,
  contextBlocks,
  placeholder,
  className,
  readOnly = false,
  onSelect,
  showCopy = false,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const suppressInput = useRef(false);

  // Autocomplete state
  const [acOpen, setAcOpen] = useState(false);
  const [acQuery, setAcQuery] = useState("");
  const [acPosition, setAcPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // Track the text node and offset where @ was typed
  const atAnchor = useRef<{ node: Node; offset: number } | null>(null);

  const knownLabels = useRef(new Set<string>());
  useEffect(() => {
    knownLabels.current = new Set(contextBlocks.map((b) => b.label.trim().toLowerCase()));
  }, [contextBlocks]);

  // Sync value → DOM when value changes externally
  const lastEmitted = useRef(value);
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Only update DOM if the value changed externally (not from our own onChange)
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      const html = markersToHtml(value, knownLabels.current);
      el.innerHTML = html || "";
    }
  }, [value]);

  // Initial render
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = markersToHtml(value, knownLabels.current);
    el.innerHTML = html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render pills when contextBlocks change (labels may have changed)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const current = htmlToMarkers(el);
    const html = markersToHtml(current, knownLabels.current);
    // Save and restore cursor position
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    el.innerHTML = html || "";
    if (savedRange) {
      try {
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
      } catch {
        // Cursor restoration may fail if DOM changed significantly
      }
    }
  }, [contextBlocks]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const markers = htmlToMarkers(el);
    lastEmitted.current = markers;
    onChange(markers);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (isComposing.current || suppressInput.current) return;

    // If autocomplete is open, update query
    if (acOpen && atAnchor.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // Get text from @ anchor to current cursor
        const anchorNode = atAnchor.current.node;
        const anchorOffset = atAnchor.current.offset;
        if (range.startContainer === anchorNode || range.startContainer.parentNode === editorRef.current) {
          const text = (anchorNode.textContent || "").slice(anchorOffset);
          // Text after @ up to cursor
          const cursorOffset = range.startContainer === anchorNode ? range.startOffset : (range.startContainer.textContent || "").length;
          const query = (range.startContainer === anchorNode)
            ? (anchorNode.textContent || "").slice(anchorOffset, cursorOffset)
            : text;
          setAcQuery(query);
        }
      }
    }

    // Fallback @ detection: if autocomplete isn't open, check if the character
    // just before the cursor is '@'. This handles keyboards/input methods where
    // e.key !== "@" in keyDown (e.g. AltGr combos, dead keys, mobile keyboards).
    if (!acOpen && contextBlocks.length > 0) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const textNode = range.startContainer;
        const offset = range.startOffset;
        if (textNode.nodeType === Node.TEXT_NODE && offset > 0) {
          const char = (textNode.textContent || "")[offset - 1];
          if (char === "@") {
            atAnchor.current = { node: textNode, offset };
            const caretRect = range.getBoundingClientRect();
            const editorRect = editorRef.current?.getBoundingClientRect();
            if (editorRect) {
              setAcPosition({
                top: caretRect.bottom - editorRect.top + 4,
                left: caretRect.left - editorRect.left,
              });
            }
            setAcQuery("");
            setAcOpen(true);
          }
        }
      }
    }

    emitChange();
  }, [acOpen, contextBlocks.length, emitChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) {
        e.preventDefault();
        return;
      }

      // @ trigger
      if (e.key === "@" && contextBlocks.length > 0 && !acOpen) {
        // Don't prevent default — let the @ character be typed
        // We'll capture position after the character is inserted
        requestAnimationFrame(() => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            atAnchor.current = {
              node: range.startContainer,
              offset: range.startOffset,
            };
            // Get caret position for popover
            const rect = range.getBoundingClientRect();
            const editorRect = editorRef.current?.getBoundingClientRect();
            if (editorRect) {
              setAcPosition({
                top: rect.bottom - editorRect.top + 4,
                left: rect.left - editorRect.left,
              });
            }
            setAcQuery("");
            setAcOpen(true);
          }
        });
        return;
      }

      // If autocomplete is open, let it handle arrow keys, enter, escape
      if (acOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setAcOpen(false);
          atAnchor.current = null;
          return;
        }
        // ArrowUp/Down/Enter handled by autocomplete via ref
        if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter" || e.key === "Tab") {
          // These are handled by the autocomplete component
          return;
        }
        // Space or other non-query chars close autocomplete
        if (e.key === " ") {
          setAcOpen(false);
          atAnchor.current = null;
        }
      }

      // Enter without shift → newline (default behavior in contentEditable)
    },
    [readOnly, contextBlocks.length, acOpen],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      // Insert plain text (preserving marker format if pasted from another editor)
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      // Parse for markers and insert appropriately
      const segments = parseMarkers(text);
      for (const seg of segments) {
        if (seg.type === "text") {
          range.insertNode(document.createTextNode(seg.value));
          range.collapse(false);
        } else {
          const pill = createPillElement(seg.label, knownLabels.current.has(seg.label.trim().toLowerCase()));
          range.insertNode(pill);
          range.setStartAfter(pill);
          range.collapse(true);
        }
      }
      sel.removeAllRanges();
      sel.addRange(range);
      emitChange();
    },
    [emitChange],
  );

  // Insert a context block reference at current position
  const insertRef = useCallback(
    (label: string) => {
      const el = editorRef.current;
      if (!el) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      // Delete the @query text
      if (atAnchor.current) {
        const range = sel.getRangeAt(0);
        const anchorNode = atAnchor.current.node;
        const anchorOffset = atAnchor.current.offset;

        // Delete from @ (one char before anchor offset) to current cursor
        try {
          const deleteRange = document.createRange();
          deleteRange.setStart(anchorNode, Math.max(0, anchorOffset - 1)); // -1 for the @ char
          deleteRange.setEnd(range.startContainer, range.startOffset);
          deleteRange.deleteContents();
        } catch {
          // If range manipulation fails, just insert at cursor
        }
      }

      // Insert pill
      const range = sel.getRangeAt(0);
      const pill = createPillElement(label, true);
      range.insertNode(pill);
      // Add a space after the pill
      const space = document.createTextNode("\u00A0");
      pill.after(space);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      setAcOpen(false);
      atAnchor.current = null;
      suppressInput.current = true;
      emitChange();
      requestAnimationFrame(() => {
        suppressInput.current = false;
      });
      el.focus();
    },
    [emitChange],
  );

  const isEmpty = !value.trim();
  const [copied, setCopied] = useState(false);

  const handleMouseUp = useCallback(() => {
    if (onSelect) onSelect();
  }, [onSelect]);

  const handleCopy = useCallback(() => {
    // Copy plain text (with markers expanded to labels for readability)
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <div className="relative">
      {showCopy && value.trim() && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-1 right-1 z-10 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Copy"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onMouseUp={handleMouseUp}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
        className={cn(
          "prompt-editor min-h-[60px] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
          "focus:outline-none",
          readOnly && "opacity-60 cursor-not-allowed",
          className,
        )}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
      />
      {/* Placeholder overlay */}
      {isEmpty && placeholder && (
        <div
          className="absolute top-0 left-0 px-3 py-2 text-sm text-muted-foreground/40 pointer-events-none select-none"
          aria-hidden
        >
          {placeholder}
        </div>
      )}
      {/* Autocomplete dropdown */}
      {acOpen && (
        <PromptEditorAutocomplete
          blocks={contextBlocks}
          query={acQuery}
          position={acPosition}
          onSelect={insertRef}
          onClose={() => { setAcOpen(false); atAnchor.current = null; }}
        />
      )}
    </div>
  );
}

/** Create a pill DOM element */
function createPillElement(label: string, isValid: boolean): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-ref", label);
  span.className = isValid ? "prompt-pill" : "prompt-pill prompt-pill--broken";
  span.textContent = `@${label}`;
  return span;
}

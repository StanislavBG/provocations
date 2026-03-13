/**
 * JsonProcessorExpandedView — Full overlay for JSON Processor nodes.
 *
 * Left panel: output path configuration (name, JSONPath, flatten toggle).
 * Right panel: input preview and output preview.
 */

import { useState, useCallback } from "react";
import { Braces, Plus, Trash2, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { FlowNode } from "../useFlowCanvas";
import { ExpandedViewLayout } from "./ExpandedViewLayout";
import { resolveJsonPath } from "../lifecycles/json-processor";
import { generateId } from "@/lib/utils";

interface JsonProcessorExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function JsonProcessorExpandedView({
  node,
  onUpdateNode,
  onPlayNode,
}: JsonProcessorExpandedViewProps) {
  const paths = node.jsonOutputPaths || [];
  const passThrough = node.jsonPassThrough ?? false;
  const lastInput = node.jsonLastInput || node.content || "";
  const lastError = node.jsonLastError || "";
  const [previewResults, setPreviewResults] = useState<Array<{ name: string; path: string; value: string }>>([]);

  const addOutputPath = useCallback(() => {
    const newPath = {
      id: generateId("jp"),
      name: `Output ${paths.length + 1}`,
      path: "$.",
      flatten: false,
    };
    onUpdateNode(node.id, { jsonOutputPaths: [...paths, newPath] });
  }, [node.id, paths, onUpdateNode]);

  const removeOutputPath = useCallback((pathId: string) => {
    onUpdateNode(node.id, { jsonOutputPaths: paths.filter((p) => p.id !== pathId) });
  }, [node.id, paths, onUpdateNode]);

  const updateOutputPath = useCallback((pathId: string, patch: Partial<typeof paths[0]>) => {
    onUpdateNode(node.id, {
      jsonOutputPaths: paths.map((p) => (p.id === pathId ? { ...p, ...patch } : p)),
    });
  }, [node.id, paths, onUpdateNode]);

  const handlePreview = useCallback(() => {
    if (!lastInput.trim()) return;
    try {
      const parsed = JSON.parse(lastInput);
      const results = paths.map((p) => {
        const value = resolveJsonPath(parsed, p.path);
        return {
          name: p.name,
          path: p.path,
          value: JSON.stringify(value, null, 2) ?? "undefined",
        };
      });
      setPreviewResults(results);
      onUpdateNode(node.id, { jsonLastError: "" });
    } catch (err) {
      onUpdateNode(node.id, { jsonLastError: err instanceof Error ? err.message : "Invalid JSON" });
      setPreviewResults([]);
    }
  }, [lastInput, paths, node.id, onUpdateNode]);

  return (
    <ExpandedViewLayout
      defaultLeftSize={35}
      left={
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Braces className="w-4 h-4 text-indigo-500" />
              JSON Processor
            </h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Node label */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</p>
                <input
                  type="text"
                  value={node.label || ""}
                  onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              {/* Output Paths */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Output Paths</p>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={addOutputPath}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {paths.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 italic">
                    No output paths configured. Add one to extract data from JSON input.
                  </p>
                )}

                {paths.map((op) => (
                  <div key={op.id} className="border rounded-lg p-2.5 space-y-2 bg-muted/10">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={op.name}
                        onChange={(e) => updateOutputPath(op.id, { name: e.target.value })}
                        placeholder="Output name"
                        className="flex-1 px-2 py-1 text-xs bg-muted/30 border rounded outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                      <button
                        onClick={() => removeOutputPath(op.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={op.path}
                      onChange={(e) => updateOutputPath(op.id, { path: e.target.value })}
                      placeholder="$.path.to.data"
                      className="w-full px-2 py-1 text-xs font-mono bg-muted/30 border rounded outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={op.flatten ?? false}
                        onChange={(e) => updateOutputPath(op.id, { flatten: e.target.checked })}
                        className="rounded border-border"
                      />
                      Flatten arrays into individual items
                    </label>
                  </div>
                ))}
              </div>

              {/* Pass-through toggle */}
              <div className="space-y-1.5 border-t pt-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={passThrough}
                    onChange={(e) => onUpdateNode(node.id, { jsonPassThrough: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-muted-foreground">Also output original JSON unchanged</span>
                </label>
              </div>
            </div>
          </ScrollArea>

          {/* Process button */}
          {onPlayNode && (
            <div className="p-4 border-t border-border/50 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handlePreview}
                disabled={!lastInput.trim()}
              >
                Preview Extraction
              </Button>
              <Button
                size="sm"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={() => onPlayNode(node.id)}
                disabled={node.jsonProcessingStatus === "running" || node.llmStatus === "running"}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                {node.jsonProcessingStatus === "running" || node.llmStatus === "running" ? "Processing..." : "Process"}
              </Button>
            </div>
          )}
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold">Input & Output Preview</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Error display */}
              {lastError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{lastError}</p>
                </div>
              )}

              {/* Input preview */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Input JSON</p>
                {lastInput.trim() ? (
                  <pre className="text-[11px] bg-muted/30 rounded-lg p-3 whitespace-pre-wrap break-words text-foreground max-h-60 overflow-auto border font-mono">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(lastInput), null, 2);
                      } catch {
                        return lastInput;
                      }
                    })()}
                  </pre>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Braces className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No input yet</p>
                    <p className="text-[11px] mt-1">Connect upstream nodes with JSON content.</p>
                  </div>
                )}
              </div>

              {/* Output preview */}
              {previewResults.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Extraction Results</p>
                  <div className="space-y-2">
                    {previewResults.map((r, i) => (
                      <div key={i} className="border rounded-lg p-2.5 bg-muted/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[9px]">{r.name}</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{r.path}</span>
                        </div>
                        <pre className="text-[10px] bg-background/50 rounded p-2 whitespace-pre-wrap break-words text-muted-foreground max-h-32 overflow-auto font-mono">
                          {r.value}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for output */}
              {previewResults.length === 0 && lastInput.trim() && !lastError && (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">Configure output paths and click Preview</p>
                  <p className="text-[11px] mt-1">Each path extracts a portion of the input JSON.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      }
    />
  );
}

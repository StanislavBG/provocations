import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Lock, Unlock } from "lucide-react";
import type { BSNode, BSConnector, BSNodeStyle, BSLineStyle, BSArrowHead } from "./types";
import { NODE_BOUNDS, CHART_LIMITS } from "./types";

interface BSChartPropertiesProps {
  selectedNodes: BSNode[];
  selectedConnectors: BSConnector[];
  onUpdateNode: (nodeId: string, updates: Partial<BSNode>) => void;
  onUpdateNodeStyle: (nodeId: string, style: Partial<BSNodeStyle>) => void;
  onUpdateConnector: (connectorId: string, updates: Partial<BSConnector>) => void;
  onAddTableRow?: (nodeId: string) => void;
  onAddTableColumn?: (nodeId: string, label: string) => void;
}

export function BSChartProperties({
  selectedNodes,
  selectedConnectors,
  onUpdateNode,
  onUpdateNodeStyle,
  onUpdateConnector,
  onAddTableRow,
  onAddTableColumn,
}: BSChartPropertiesProps) {
  const node = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const connector = selectedConnectors.length === 1 ? selectedConnectors[0] : null;

  if (!node && !connector) {
    return (
      <div className="h-full flex flex-col bg-card border-l">
        <div className="px-3 py-2 border-b shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">Properties</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground/50 text-center">
            Select a node or connector to edit its properties
          </p>
        </div>
      </div>
    );
  }

  if (connector) {
    return (
      <div className="h-full flex flex-col bg-card border-l">
        <div className="px-3 py-2 border-b shrink-0">
          <span className="text-xs font-semibold">Connector</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Label */}
            <div className="space-y-1">
              <Label className="text-[10px]">Label</Label>
              <Input
                value={connector.label}
                onChange={(e) =>
                  onUpdateConnector(connector.id, { label: e.target.value.slice(0, CHART_LIMITS.MAX_LABEL_LENGTH) })
                }
                className="h-7 text-xs"
                placeholder="Connector label"
                maxLength={CHART_LIMITS.MAX_LABEL_LENGTH}
              />
            </div>

            {/* Line style */}
            <div className="space-y-1">
              <Label className="text-[10px]">Line Style</Label>
              <Select
                value={connector.lineStyle}
                onValueChange={(v) =>
                  onUpdateConnector(connector.id, { lineStyle: v as BSLineStyle })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-1">
              <Label className="text-[10px]">Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={connector.color}
                  onChange={(e) =>
                    onUpdateConnector(connector.id, { color: e.target.value })
                  }
                  className="w-7 h-7 rounded border cursor-pointer"
                />
                <Input
                  value={connector.color}
                  onChange={(e) =>
                    onUpdateConnector(connector.id, { color: e.target.value })
                  }
                  className="h-7 text-xs flex-1"
                />
              </div>
            </div>

            {/* Stroke width */}
            <div className="space-y-1">
              <Label className="text-[10px]">Width</Label>
              <Input
                type="number"
                min={NODE_BOUNDS.MIN_STROKE_WIDTH}
                max={NODE_BOUNDS.MAX_STROKE_WIDTH}
                value={connector.strokeWidth}
                onChange={(e) =>
                  onUpdateConnector(connector.id, {
                    strokeWidth: Math.min(NODE_BOUNDS.MAX_STROKE_WIDTH, Math.max(NODE_BOUNDS.MIN_STROKE_WIDTH, parseInt(e.target.value) || 2)),
                  })
                }
                className="h-7 text-xs"
              />
            </div>

            {/* End arrow */}
            <div className="space-y-1">
              <Label className="text-[10px]">End Arrow</Label>
              <Select
                value={connector.endArrow}
                onValueChange={(v) =>
                  onUpdateConnector(connector.id, { endArrow: v as BSArrowHead })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="arrow">Arrow</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start arrow */}
            <div className="space-y-1">
              <Label className="text-[10px]">Start Arrow</Label>
              <Select
                value={connector.startArrow}
                onValueChange={(v) =>
                  onUpdateConnector(connector.id, { startArrow: v as BSArrowHead })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="arrow">Arrow</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!node) return null;

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <div className="px-3 py-2 border-b shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold capitalize">{node.type}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onUpdateNode(node.id, { locked: !node.locked })}
        >
          {node.locked ? (
            <Lock className="w-3 h-3 text-destructive" />
          ) : (
            <Unlock className="w-3 h-3 text-muted-foreground" />
          )}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Label */}
          <div className="space-y-1">
            <Label className="text-[10px]">Label</Label>
            <Input
              value={node.label}
              onChange={(e) => onUpdateNode(node.id, { label: e.target.value.slice(0, CHART_LIMITS.MAX_LABEL_LENGTH) })}
              className="h-7 text-xs"
              maxLength={CHART_LIMITS.MAX_LABEL_LENGTH}
            />
          </div>

          <Separator />

          {/* Position & size */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">X</Label>
              <Input
                type="number"
                value={Math.round(node.x)}
                onChange={(e) =>
                  onUpdateNode(node.id, { x: parseInt(e.target.value) || 0 })
                }
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Y</Label>
              <Input
                type="number"
                value={Math.round(node.y)}
                onChange={(e) =>
                  onUpdateNode(node.id, { y: parseInt(e.target.value) || 0 })
                }
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Width</Label>
              <Input
                type="number"
                min={NODE_BOUNDS.MIN_WIDTH}
                max={NODE_BOUNDS.MAX_WIDTH}
                value={Math.round(node.width)}
                onChange={(e) =>
                  onUpdateNode(node.id, {
                    width: Math.min(NODE_BOUNDS.MAX_WIDTH, Math.max(NODE_BOUNDS.MIN_WIDTH, parseInt(e.target.value) || NODE_BOUNDS.MIN_WIDTH)),
                  })
                }
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Height</Label>
              <Input
                type="number"
                min={NODE_BOUNDS.MIN_HEIGHT}
                max={NODE_BOUNDS.MAX_HEIGHT}
                value={Math.round(node.height)}
                onChange={(e) =>
                  onUpdateNode(node.id, {
                    height: Math.min(NODE_BOUNDS.MAX_HEIGHT, Math.max(NODE_BOUNDS.MIN_HEIGHT, parseInt(e.target.value) || NODE_BOUNDS.MIN_HEIGHT)),
                  })
                }
                className="h-7 text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Style */}
          <div className="space-y-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Style
            </span>

            {/* Fill color */}
            <div className="space-y-1">
              <Label className="text-[10px]">Fill</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={node.style.fillColor === "transparent" ? "#ffffff" : node.style.fillColor}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, { fillColor: e.target.value })
                  }
                  className="w-7 h-7 rounded border cursor-pointer"
                />
                <Input
                  value={node.style.fillColor}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, { fillColor: e.target.value })
                  }
                  className="h-7 text-xs flex-1"
                />
              </div>
            </div>

            {/* Stroke color */}
            <div className="space-y-1">
              <Label className="text-[10px]">Stroke</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={node.style.strokeColor === "transparent" ? "#000000" : node.style.strokeColor}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, { strokeColor: e.target.value })
                  }
                  className="w-7 h-7 rounded border cursor-pointer"
                />
                <Input
                  value={node.style.strokeColor}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, { strokeColor: e.target.value })
                  }
                  className="h-7 text-xs flex-1"
                />
              </div>
            </div>

            {/* Text color */}
            <div className="space-y-1">
              <Label className="text-[10px]">Text Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={node.style.textColor}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, { textColor: e.target.value })
                  }
                  className="w-7 h-7 rounded border cursor-pointer"
                />
                <Input
                  value={node.style.textColor}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, { textColor: e.target.value })
                  }
                  className="h-7 text-xs flex-1"
                />
              </div>
            </div>

            {/* Font size */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Font Size</Label>
                <Input
                  type="number"
                  min={NODE_BOUNDS.MIN_FONT_SIZE}
                  max={NODE_BOUNDS.MAX_FONT_SIZE}
                  value={node.style.fontSize}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, {
                      fontSize: Math.min(NODE_BOUNDS.MAX_FONT_SIZE, Math.max(NODE_BOUNDS.MIN_FONT_SIZE, parseInt(e.target.value) || 12)),
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Border Radius</Label>
                <Input
                  type="number"
                  min={0}
                  max={NODE_BOUNDS.MAX_BORDER_RADIUS}
                  value={node.style.borderRadius}
                  onChange={(e) =>
                    onUpdateNodeStyle(node.id, {
                      borderRadius: Math.min(NODE_BOUNDS.MAX_BORDER_RADIUS, Math.max(0, parseInt(e.target.value) || 0)),
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Font weight */}
            <div className="space-y-1">
              <Label className="text-[10px]">Font Weight</Label>
              <Select
                value={node.style.fontWeight}
                onValueChange={(v) =>
                  onUpdateNodeStyle(node.id, {
                    fontWeight: v as "normal" | "bold",
                  })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <Label className="text-[10px]">Opacity</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={node.style.opacity}
                onChange={(e) =>
                  onUpdateNodeStyle(node.id, {
                    opacity: Math.min(1, Math.max(0, parseFloat(e.target.value) || 1)),
                  })
                }
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Table-specific controls */}
          {node.type === "table" && node.tableData && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Table
                </span>
                <div className="text-[10px] text-muted-foreground">
                  {node.tableData.rows.length} rows, {node.tableData.columns.length} columns
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => onAddTableRow?.(node.id)}
                    disabled={node.tableData.rows.length >= CHART_LIMITS.MAX_TABLE_ROWS}
                  >
                    <Plus className="w-3 h-3" />
                    Row
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => {
                      const label = prompt("Column name:");
                      if (label) onAddTableColumn?.(node.id, label.slice(0, CHART_LIMITS.MAX_LABEL_LENGTH));
                    }}
                    disabled={node.tableData.columns.length >= CHART_LIMITS.MAX_TABLE_COLUMNS}
                  >
                    <Plus className="w-3 h-3" />
                    Column
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Header Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={node.tableData.headerBgColor}
                      onChange={(e) =>
                        onUpdateNode(node.id, {
                          tableData: {
                            ...node.tableData!,
                            headerBgColor: e.target.value,
                          },
                        })
                      }
                      className="w-7 h-7 rounded border cursor-pointer"
                    />
                    <Input
                      value={node.tableData.headerBgColor}
                      onChange={(e) =>
                        onUpdateNode(node.id, {
                          tableData: {
                            ...node.tableData!,
                            headerBgColor: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs flex-1"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Text-specific controls */}
          {node.type === "text" && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Text
                </span>
                <div className="space-y-1">
                  <Label className="text-[10px]">Alignment</Label>
                  <Select
                    value={node.textAlign || "left"}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        textAlign: v as "left" | "center" | "right",
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

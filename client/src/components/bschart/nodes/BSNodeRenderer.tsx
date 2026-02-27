import { useState, useCallback, useRef, useEffect } from "react";
import type { BSNode, BSPortSide } from "../types";

interface BSNodeRendererProps {
  node: BSNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseUp: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (nodeId: string) => void;
  onLabelChange: (nodeId: string, label: string) => void;
  onTableCellChange?: (nodeId: string, rowId: string, colId: string, value: string) => void;
  showPorts: boolean;
}

export function BSNodeRenderer({
  node,
  isSelected,
  onMouseDown,
  onMouseUp,
  onDoubleClick,
  onLabelChange,
  onTableCellChange,
  showPorts,
}: BSNodeRendererProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(node.label);
      setEditing(true);
      onDoubleClick(node.id);
    },
    [node.id, node.label, onDoubleClick],
  );

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== node.label) {
      onLabelChange(node.id, trimmed);
    }
    setEditing(false);
  }, [editValue, node.id, node.label, onLabelChange]);

  const { style } = node;

  // ── Port indicators ──
  const ports: BSPortSide[] = ["top", "right", "bottom", "left"];
  const portPositions: Record<BSPortSide, { left: string; top: string }> = {
    top: { left: "50%", top: "0%" },
    right: { left: "100%", top: "50%" },
    bottom: { left: "50%", top: "100%" },
    left: { left: "0%", top: "50%" },
  };

  const renderPorts = () =>
    showPorts &&
    ports.map((port) => (
      <div
        key={port}
        className="absolute w-2.5 h-2.5 rounded-full bg-primary border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{
          left: portPositions[port].left,
          top: portPositions[port].top,
        }}
      />
    ));

  // ── Shape-specific rendering ──

  if (node.type === "diamond") {
    return (
      <div
        className="group absolute cursor-move"
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          opacity: style.opacity,
        }}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onMouseUp={(e) => onMouseUp(e, node.id)}
        onDoubleClick={handleDoubleClick}
      >
        <svg
          viewBox={`0 0 ${node.width} ${node.height}`}
          className="absolute inset-0 w-full h-full"
        >
          <polygon
            points={`${node.width / 2},2 ${node.width - 2},${node.height / 2} ${node.width / 2},${node.height - 2} 2,${node.height / 2}`}
            fill={style.fillColor}
            stroke={isSelected ? "hsl(var(--primary))" : style.strokeColor}
            strokeWidth={isSelected ? style.strokeWidth + 1 : style.strokeWidth}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-4">
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="bg-transparent text-center outline-none w-full"
              style={{
                color: style.textColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
              }}
            />
          ) : (
            <span
              className="text-center truncate select-none"
              style={{
                color: style.textColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
              }}
            >
              {node.label}
            </span>
          )}
        </div>
        {renderPorts()}
      </div>
    );
  }

  if (node.type === "table") {
    return (
      <div
        className="group absolute cursor-move"
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          opacity: style.opacity,
        }}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onMouseUp={(e) => onMouseUp(e, node.id)}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="border overflow-hidden shadow-sm"
          style={{
            borderColor: isSelected ? "hsl(var(--primary))" : style.strokeColor,
            borderWidth: isSelected ? style.strokeWidth + 1 : style.strokeWidth,
            borderRadius: style.borderRadius,
            backgroundColor: style.fillColor,
          }}
        >
          {/* Header */}
          <div
            className="px-2 py-1.5 flex items-center justify-between"
            style={{ backgroundColor: node.tableData?.headerBgColor || "#334155" }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="bg-transparent text-white text-xs font-bold outline-none w-full"
              />
            ) : (
              <span className="text-white text-xs font-bold truncate select-none">
                {node.label}
              </span>
            )}
          </div>

          {/* Column headers */}
          {node.tableData && (
            <div className="border-b" style={{ borderColor: style.strokeColor + "40" }}>
              <div className="flex">
                {node.tableData.columns.map((col) => (
                  <div
                    key={col.id}
                    className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-r last:border-r-0 truncate"
                    style={{ width: col.width, borderColor: style.strokeColor + "20" }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rows */}
          {node.tableData?.rows.map((row, idx) => (
            <div
              key={row.id}
              className="flex"
              style={{
                backgroundColor:
                  node.tableData?.stripedRows && idx % 2 === 1
                    ? style.strokeColor + "08"
                    : "transparent",
              }}
            >
              {node.tableData!.columns.map((col) => (
                <div
                  key={col.id}
                  className="px-2 py-1 text-[11px] border-r last:border-r-0 truncate"
                  style={{ width: col.width, borderColor: style.strokeColor + "20" }}
                >
                  {onTableCellChange ? (
                    <input
                      value={row.cells[col.id] || ""}
                      onChange={(e) =>
                        onTableCellChange(node.id, row.id, col.id, e.target.value)
                      }
                      className="bg-transparent outline-none w-full text-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span>{row.cells[col.id] || ""}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        {renderPorts()}
      </div>
    );
  }

  if (node.type === "text") {
    return (
      <div
        className="group absolute cursor-move"
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          minHeight: node.height,
          opacity: style.opacity,
        }}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onMouseUp={(e) => onMouseUp(e, node.id)}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="w-full h-full px-2 py-1"
          style={{
            borderRadius: style.borderRadius,
            backgroundColor: isSelected ? "hsl(var(--primary) / 0.05)" : "transparent",
            border: isSelected ? "1px dashed hsl(var(--primary))" : "1px dashed transparent",
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="bg-transparent outline-none w-full"
              style={{
                color: style.textColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                textAlign: node.textAlign || "left",
              }}
            />
          ) : (
            <span
              className="block select-none"
              style={{
                color: style.textColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                textAlign: node.textAlign || "left",
              }}
            >
              {node.textContent || node.label}
            </span>
          )}
        </div>
        {renderPorts()}
      </div>
    );
  }

  if (node.type === "badge") {
    return (
      <div
        className="group absolute cursor-move"
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          opacity: style.opacity,
        }}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onMouseUp={(e) => onMouseUp(e, node.id)}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="w-full h-full flex items-center justify-center px-2"
          style={{
            backgroundColor: style.fillColor,
            borderRadius: style.borderRadius,
            border: isSelected
              ? `${style.strokeWidth + 1}px solid hsl(var(--primary))`
              : `${style.strokeWidth}px solid ${style.strokeColor}`,
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="bg-transparent text-center outline-none w-full"
              style={{
                color: style.textColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
              }}
            />
          ) : (
            <span
              className="text-center truncate select-none"
              style={{
                color: style.textColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
              }}
            >
              {node.label}
            </span>
          )}
        </div>
        {renderPorts()}
      </div>
    );
  }

  // ── Default: rectangle / rounded-rect ──
  return (
    <div
      className="group absolute cursor-move"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        opacity: style.opacity,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseUp={(e) => onMouseUp(e, node.id)}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="w-full h-full flex items-center justify-center px-3"
        style={{
          backgroundColor: style.fillColor,
          borderRadius: style.borderRadius,
          border: isSelected
            ? `${style.strokeWidth + 1}px solid hsl(var(--primary))`
            : `${style.strokeWidth}px solid ${style.strokeColor}`,
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="bg-transparent text-center outline-none w-full"
            style={{
              color: style.textColor,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
            }}
          />
        ) : (
          <span
            className="text-center truncate select-none"
            style={{
              color: style.textColor,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
            }}
          >
            {node.label}
          </span>
        )}
      </div>
      {renderPorts()}
    </div>
  );
}

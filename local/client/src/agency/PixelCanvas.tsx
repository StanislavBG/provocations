/**
 * PixelCanvas — Full-screen Agency View
 *
 * Split layout:
 *   LEFT:  Pixel art canvas (SSE-driven animations)
 *   RIGHT: Live terminal output + visual audit trail
 *
 * The pixel art is the fun layer. The terminal panel is the real layer.
 * Both are driven by the same SSE events but show different views:
 *   - Canvas: Bilko walks to terminal, hands off to Scout, etc.
 *   - Terminal: Raw stdout from `claude -p`, run status, timing.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyEngine, type AuditEntry, type SSEPayload } from "./engine";
import { CANVAS_W, CANVAS_H } from "./sprites";
import { apiFetch, apiPost, fmtTime, fmtDateTime } from "../api";
import {
  Play,
  Square,
  Terminal as TerminalIcon,
  Eye,
  Activity,
  Zap,
  Circle,
} from "lucide-react";

interface RunData {
  id: number;
  agent_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  trigger: string;
}

interface AgentStatus {
  id: string;
  label: string;
  enabled: boolean;
  running: boolean;
  pid: number | null;
}

function CanvasContainer({
  canvasRef,
  onClick,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}) {
  return (
    <div className="flex-1 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        onClick={onClick}
        className="cursor-pointer absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

export default function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AgencyEngine | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const qc = useQueryClient();

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [tab, setTab] = useState<"audit" | "terminal">("audit");

  // Fetch latest runs for terminal panel
  const { data: activeRuns } = useQuery({
    queryKey: ["runs-active"],
    queryFn: () => apiFetch<RunData[]>("/runs/active"),
    refetchInterval: 3000,
  });

  const { data: recentRuns } = useQuery({
    queryKey: ["runs-recent-5"],
    queryFn: () => apiFetch<RunData[]>("/runs?limit=5"),
    refetchInterval: 5000,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-status"],
    queryFn: () =>
      apiFetch<{ agents: AgentStatus[] }>("/status").then((s) => s.agents),
    refetchInterval: 5000,
  });

  // Audit log callback
  const onAudit = useCallback((entry: AuditEntry) => {
    setAuditLog((prev) => [...prev.slice(-200), entry]);
  }, []);

  // Initialize engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new AgencyEngine(canvasRef.current, onAudit);
    engineRef.current = engine;
    engine.start();
    return () => engine.stop();
  }, [onAudit]);

  // Sync engine with actual server state when agents data loads
  useEffect(() => {
    if (engineRef.current && agents && agents.length > 0) {
      engineRef.current.syncFromServer(agents);
    }
  }, [agents]);

  // SSE connection
  useEffect(() => {
    const source = new EventSource("/api/events");
    sseRef.current = source;

    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEPayload;
        engineRef.current?.handleSSE(event);
        // Refetch queries on run events
        if (
          event.type === "run:started" ||
          event.type === "run:completed"
        ) {
          qc.invalidateQueries({ queryKey: ["runs-active"] });
          qc.invalidateQueries({ queryKey: ["runs-recent-5"] });
          qc.invalidateQueries({ queryKey: ["agents-status"] });
        }
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => {
      setConnected(false);
      source.close();
      // Reconnect after 3s
      setTimeout(() => {
        sseRef.current = new EventSource("/api/events");
      }, 3000);
    };

    return () => source.close();
  }, [qc]);

  // Click handler
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!engineRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const char = engineRef.current.getCharacterAt(x, y);
      setSelectedChar(char ? char.id : null);
    },
    []
  );

  // Manual trigger
  const triggerRun = async (agentId: string) => {
    try {
      await apiPost(`/agents/${agentId}/run`);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const triggerDemo = () => {
    engineRef.current?.triggerDemo();
  };

  const formatTime = (ms: number) => fmtTime(ms);

  const auditLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (auditLogRef.current) {
      auditLogRef.current.scrollTop = auditLogRef.current.scrollHeight;
    }
  }, [auditLog]);

  return (
    <div className="flex h-full">
      {/* ── LEFT: Pixel Art Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Canvas toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-agency-surface border-b border-agency-border">
          <div className="flex items-center gap-3">
            <Eye size={14} className="text-agency-accent" />
            <span className="text-xs font-medium text-agency-text">
              AGENCY VIEW
            </span>
            <span className="text-xs text-agency-muted">
              {connected ? "LIVE" : "OFFLINE"}
            </span>
            <Circle
              size={6}
              className={
                connected
                  ? "fill-agency-success text-agency-success"
                  : "fill-agency-danger text-agency-danger"
              }
            />
          </div>
          <div className="flex items-center gap-2">
            {agents?.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                  a.running
                    ? "bg-agency-accent/20 text-agency-accent"
                    : "bg-agency-border text-agency-muted"
                }`}
              >
                <Circle
                  size={6}
                  className={
                    a.running
                      ? "fill-agency-success text-agency-success animate-pulse"
                      : "fill-agency-muted/30 text-agency-muted/30"
                  }
                />
                <span className="font-semibold uppercase">{a.id}</span>
                <span className="text-[9px] opacity-70">
                  {a.running && a.pid ? `PID ${a.pid}` : "OFF"}
                </span>
              </div>
            ))}
            <button
              onClick={() => triggerRun("bilko")}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-agency-accent/20 text-agency-accent hover:bg-agency-accent/30 transition-colors"
              title="Run Bilko"
            >
              <Zap size={8} />
              RUN
            </button>
            <button
              onClick={triggerDemo}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-agency-border text-agency-muted hover:text-agency-text transition-colors"
              title="Demo animation"
            >
              <Play size={8} />
              DEMO
            </button>
          </div>
        </div>

        {/* Canvas container — fills all available space, maintains aspect ratio */}
        <CanvasContainer canvasRef={canvasRef} onClick={handleCanvasClick} />

        {/* Character info bar */}
        {selectedChar && (
          <div className="px-3 py-1.5 bg-agency-surface border-t border-agency-border flex items-center gap-4 text-xs">
            <span className="font-medium text-agency-accent">
              {selectedChar.toUpperCase()}
            </span>
            {engineRef.current?.getCharacterStates().filter((c) => c.id === selectedChar).map((c) => (
              <span key={c.id} className="text-agency-muted">
                State: {c.state} · Pos: ({c.x},{c.y}) · Queue:{" "}
                {c.queueLength}
              </span>
            ))}
            <button
              onClick={() => setSelectedChar(null)}
              className="text-agency-muted hover:text-agency-text ml-auto"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Terminal + Audit Trail ── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-agency-surface border-l border-agency-border">
        {/* Tabs */}
        <div className="flex border-b border-agency-border">
          <button
            onClick={() => setTab("audit")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              tab === "audit"
                ? "text-agency-accent border-b-2 border-agency-accent"
                : "text-agency-muted hover:text-agency-text"
            }`}
          >
            <Activity size={12} />
            AUDIT TRAIL
          </button>
          <button
            onClick={() => setTab("terminal")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              tab === "terminal"
                ? "text-agency-accent border-b-2 border-agency-accent"
                : "text-agency-muted hover:text-agency-text"
            }`}
          >
            <TerminalIcon size={12} />
            LIVE TERMINAL
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === "audit" ? (
            /* ── Audit Trail ── */
            <div
              ref={auditLogRef}
              className="flex-1 overflow-y-auto p-3 space-y-0.5"
            >
              {auditLog.length === 0 ? (
                <div className="text-xs text-agency-muted p-4 text-center">
                  Waiting for events...
                  <br />
                  <span className="text-[10px]">
                    Click RUN or DEMO to see agents in action
                  </span>
                </div>
              ) : (
                auditLog.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 text-[11px] leading-relaxed ${
                      entry.isVisual ? "text-agency-muted" : "text-agency-text"
                    }`}
                  >
                    <span className="text-agency-muted/60 flex-shrink-0 w-[52px] tabular-nums">
                      {formatTime(entry.time)}
                    </span>
                    <span
                      className={`flex-shrink-0 w-[48px] font-medium ${
                        ({bilko:"text-green-400",sable:"text-blue-400",scout:"text-amber-400",picca:"text-fuchsia-400",reely:"text-red-400",vox:"text-orange-400",lurker:"text-slate-400",wordsmith:"text-rose-400",sentinel:"text-yellow-400"} as Record<string,string>)[entry.agent] || "text-amber-400"
                      }`}
                    >
                      {entry.agent.toUpperCase()}
                    </span>
                    <span className="flex-1">
                      {!entry.isVisual && (
                        <span className="text-agency-accent mr-1">●</span>
                      )}
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* ── Live Terminal ── */
            <div className="flex-1 overflow-y-auto">
              {/* Active runs */}
              {activeRuns && activeRuns.length > 0 && (
                <div className="p-3 border-b border-agency-border">
                  <div className="text-[10px] font-medium text-agency-accent mb-2 flex items-center gap-1">
                    <Circle
                      size={6}
                      className="fill-agency-accent text-agency-accent animate-pulse"
                    />
                    RUNNING NOW
                  </div>
                  {activeRuns.map((run) => (
                    <div
                      key={run.id}
                      className="bg-black/30 rounded p-2 mb-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">
                          {run.agent_id} #{run.id}
                        </span>
                        <button
                          onClick={() =>
                            apiPost(`/agents/${run.agent_id}/cancel`)
                          }
                          className="p-0.5 rounded bg-agency-danger/20 text-agency-danger"
                        >
                          <Square size={10} />
                        </button>
                      </div>
                      <div className="text-[10px] text-agency-muted">
                        Started:{" "}
                        {fmtTime(run.started_at)}
                        <br />
                        Trigger: {run.trigger}
                        <br />
                        PID: <span className="font-mono text-agency-accent">{agents?.find(a => a.id === run.agent_id)?.pid ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent runs with stdout */}
              <div className="p-3">
                <div className="text-[10px] font-medium text-agency-muted mb-2">
                  RECENT RUNS
                </div>
                {!recentRuns?.length ? (
                  <div className="text-xs text-agency-muted">
                    No runs yet
                  </div>
                ) : (
                  recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="mb-3 border border-agency-border rounded overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-2 py-1 bg-black/20">
                        <span className="text-[10px] font-medium">
                          <span
                            className={
                              ({bilko:"text-green-400",sable:"text-blue-400",scout:"text-amber-400",picca:"text-fuchsia-400",reely:"text-red-400",vox:"text-orange-400",lurker:"text-slate-400",wordsmith:"text-rose-400",sentinel:"text-yellow-400"} as Record<string,string>)[run.agent_id] || "text-amber-400"
                            }
                          >
                            {run.agent_id}
                          </span>{" "}
                          <span className="text-agency-muted">
                            #{run.id}
                          </span>
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                            run.status === "completed"
                              ? "bg-agency-success/20 text-agency-success"
                              : run.status === "running"
                                ? "bg-agency-accent/20 text-agency-accent"
                                : "bg-agency-danger/20 text-agency-danger"
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      {run.stdout_tail && (
                        <pre className="p-2 text-[10px] leading-relaxed text-agency-text/80 max-h-32 overflow-y-auto whitespace-pre-wrap bg-black/10">
                          {run.stdout_tail.slice(-500)}
                        </pre>
                      )}
                      {run.stderr_tail && (
                        <pre className="p-2 text-[10px] leading-relaxed text-agency-danger/80 max-h-20 overflow-y-auto whitespace-pre-wrap bg-black/10">
                          {run.stderr_tail.slice(-200)}
                        </pre>
                      )}
                      <div className="px-2 py-1 text-[9px] text-agency-muted bg-black/5">
                        {run.duration_ms
                          ? `${(run.duration_ms / 1000).toFixed(1)}s`
                          : "running"}{" "}
                        · {run.trigger} ·{" "}
                        {fmtTime(run.started_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom status bar */}
        <div className="px-3 py-1.5 border-t border-agency-border flex items-center justify-between text-[10px] text-agency-muted">
          <span>
            PROVOCATIONS AGENCY v0.2.0
          </span>
          <span>
            {auditLog.length} events
          </span>
        </div>
      </div>
    </div>
  );
}

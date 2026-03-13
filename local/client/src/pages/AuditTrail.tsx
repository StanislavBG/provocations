import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, useSSE, fmtDateTime } from "../api";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Run {
  id: number;
  agent_id: string;
  task_description: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  errors: string | null;
  trigger: string;
}

export default function AuditTrail() {
  const qc = useQueryClient();
  const { lastEvent } = useSSE();
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Instant refresh on SSE run events
  useEffect(() => {
    if (lastEvent?.type === "run:started" || lastEvent?.type === "run:completed") {
      qc.invalidateQueries({ queryKey: ["runs"] });
    }
  }, [lastEvent, qc]);

  const { data: runs } = useQuery({
    queryKey: ["runs", agentFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (agentFilter) params.set("agent_id", agentFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");
      return apiFetch<Run[]>(`/runs?${params}`);
    },
    refetchInterval: 10000,
  });

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Audit Trail</h1>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-agency-surface border border-agency-border rounded px-3 py-1.5 text-sm text-agency-text"
        >
          <option value="">All agents</option>
          <option value="bilko">Bilko</option>
          <option value="scout">Scout</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-agency-surface border border-agency-border rounded px-3 py-1.5 text-sm text-agency-text"
        >
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-agency-surface border border-agency-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-agency-border text-agency-muted text-xs">
              <th className="w-8 px-2"></th>
              <th className="text-left px-4 py-2 font-medium">ID</th>
              <th className="text-left px-4 py-2 font-medium">Agent</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Trigger</th>
              <th className="text-left px-4 py-2 font-medium">Started</th>
              <th className="text-left px-4 py-2 font-medium">Duration</th>
              <th className="text-left px-4 py-2 font-medium">Exit</th>
            </tr>
          </thead>
          <tbody>
            {runs?.map((run) => (
              <>
                <tr
                  key={run.id}
                  className="border-b border-agency-border/50 hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => toggle(run.id)}
                >
                  <td className="px-2 text-agency-muted">
                    {expanded.has(run.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="px-4 py-2 text-agency-muted">#{run.id}</td>
                  <td className="px-4 py-2 font-medium">{run.agent_id}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        run.status === "completed"
                          ? "bg-agency-success/20 text-agency-success"
                          : run.status === "running"
                            ? "bg-agency-accent/20 text-agency-accent"
                            : run.status === "failed"
                              ? "bg-agency-danger/20 text-agency-danger"
                              : "bg-agency-border text-agency-muted"
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-agency-muted">{run.trigger}</td>
                  <td className="px-4 py-2 text-agency-muted">
                    {fmtDateTime(run.started_at)}
                  </td>
                  <td className="px-4 py-2 text-agency-muted">
                    {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-2 text-agency-muted">{run.exit_code ?? "—"}</td>
                </tr>
                {expanded.has(run.id) && (
                  <tr key={`${run.id}-detail`} className="border-b border-agency-border/50">
                    <td colSpan={8} className="px-4 py-3 bg-black/20">
                      {run.stdout_tail && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-agency-muted mb-1">stdout (tail)</div>
                          <pre className="text-xs bg-black/30 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-48">
                            {run.stdout_tail}
                          </pre>
                        </div>
                      )}
                      {run.stderr_tail && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-agency-danger mb-1">stderr (tail)</div>
                          <pre className="text-xs bg-black/30 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-48 text-agency-danger/80">
                            {run.stderr_tail}
                          </pre>
                        </div>
                      )}
                      {run.errors && (
                        <div>
                          <div className="text-xs font-medium text-agency-danger mb-1">Errors</div>
                          <pre className="text-xs bg-black/30 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                            {run.errors}
                          </pre>
                        </div>
                      )}
                      {!run.stdout_tail && !run.stderr_tail && !run.errors && (
                        <div className="text-xs text-agency-muted">No output captured</div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {!runs?.length && (
          <div className="p-4 text-sm text-agency-muted">No runs found</div>
        )}
      </div>
    </div>
  );
}

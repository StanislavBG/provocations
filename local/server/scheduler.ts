import { execSync } from "child_process";
import { getAllAgents, getAgent, getActiveRuns, insertRun, completeRun, type AgentConfig } from "./store.js";
import { spawnAgent, type RunHandle } from "./agent-runner.js";
import { bus } from "./events.js";

interface ScheduledAgent {
  agentId: string;
  timer: ReturnType<typeof setInterval> | null;
  nextRunAt: number;
  handle: RunHandle | null;
}

const scheduled = new Map<string, ScheduledAgent>();
const dispatchLocks = new Set<string>();
let paused = false;

export function initScheduler(): void {
  const agents = getAllAgents();
  for (const agent of agents) {
    registerAgent(agent);
  }
  console.log(`  Scheduler initialized: ${agents.length} agents registered`);
}

function registerAgent(agent: AgentConfig): void {
  // Clean up existing timer if re-registering
  const existing = scheduled.get(agent.id);
  if (existing?.timer) clearInterval(existing.timer);

  const entry: ScheduledAgent = {
    agentId: agent.id,
    timer: null,
    nextRunAt: 0,
    handle: null,
  };

  if (agent.enabled && agent.poll_interval_ms > 0) {
    entry.nextRunAt = Date.now() + agent.poll_interval_ms;
    entry.timer = setInterval(() => {
      if (!paused) {
        dispatch(agent.id, "scheduled").catch((err) =>
          console.error(`Scheduler error for ${agent.id}:`, err.message)
        );
      }
      // Update next run time
      const e = scheduled.get(agent.id);
      if (e) e.nextRunAt = Date.now() + agent.poll_interval_ms;
    }, agent.poll_interval_ms);
  }

  scheduled.set(agent.id, entry);
}

export async function dispatch(agentId: string, trigger: "scheduled" | "manual" | "canvas_task"): Promise<number> {
  if (dispatchLocks.has(agentId)) {
    throw new Error(`Agent ${agentId} dispatch already in progress`);
  }
  dispatchLocks.add(agentId);
  try {
    const agent = getAgent(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    // Check no instance already running
    const entry = scheduled.get(agentId);
    if (entry?.handle) {
      throw new Error(`Agent ${agentId} is already running`);
    }

    // Also check DB for orphaned running rows
    const active = getActiveRuns().filter((r) => r.agent_id === agentId);
    if (active.length > 0) {
      // Mark orphans as failed
      for (const r of active) {
        completeRun(r.id, { status: "failed", errors: JSON.stringify(["Orphaned run cleaned up"]) });
      }
    }

    const runId = insertRun(agentId, trigger, `${trigger} run`);

    const handle = spawnAgent(agent);
    if (entry) entry.handle = handle;

    bus.broadcast("run:started", { agentId, runId, trigger, pid: handle.pid });
    bus.broadcast("agent:status", { agentId, status: "working", pid: handle.pid });

    // Await completion in background
    handle.promise.then((result) => {
      const status = result.exitCode === 0 ? "completed" : "failed";
      completeRun(runId, {
        status: status as "completed" | "failed",
        exit_code: result.exitCode ?? undefined,
        stdout_tail: result.stdout,
        stderr_tail: result.stderr,
        duration_ms: result.durationMs,
      });

      if (entry) entry.handle = null;

      bus.broadcast("run:completed", {
        agentId,
        runId,
        status,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });
      bus.broadcast("agent:status", { agentId, status: "idle" });
    }).catch((err) => {
      console.error(`[scheduler] Unhandled error in dispatch promise for ${agentId}:`, err);
      if (entry) entry.handle = null;
      bus.broadcast("agent:status", { agentId, status: "idle" });
    });

    return runId;
  } finally {
    dispatchLocks.delete(agentId);
  }
}

export function cancelAgent(agentId: string): void {
  const entry = scheduled.get(agentId);
  if (!entry?.handle) throw new Error(`Agent ${agentId} is not running`);
  entry.handle.kill();
  entry.handle = null;
  bus.broadcast("agent:status", { agentId, status: "idle" });
}

export function pauseAll(): void {
  paused = true;
  bus.broadcast("scheduler:tick", { paused: true });
}

export function resumeAll(): void {
  paused = false;
  bus.broadcast("scheduler:tick", { paused: false });
}

export function reloadAgent(agentId: string): void {
  const agent = getAgent(agentId);
  if (!agent) return;
  registerAgent(agent);
}

export function getSchedulerStatus(): {
  paused: boolean;
  agents: { id: string; running: boolean; nextRunAt: number | null; pollIntervalMs: number }[];
} {
  const agents: { id: string; running: boolean; nextRunAt: number | null; pollIntervalMs: number }[] = [];
  for (const [id, entry] of scheduled) {
    const agent = getAgent(id);
    agents.push({
      id,
      running: !!entry.handle,
      nextRunAt: entry.timer ? entry.nextRunAt : null,
      pollIntervalMs: agent?.poll_interval_ms || 0,
    });
  }
  return { paused, agents };
}

export function isAgentRunning(agentId: string): boolean {
  return !!scheduled.get(agentId)?.handle;
}

export function getAgentPid(agentId: string): number | null {
  const entry = scheduled.get(agentId);
  if (entry?.handle?.pid) return entry.handle.pid;

  // Scout is spawned by Bilko as a nested `claude -p` child process.
  // Detect by finding any descendant `claude` process under Bilko's PID.
  if (agentId === "scout") {
    const bilkoPid = scheduled.get("bilko")?.handle?.pid;
    if (!bilkoPid) return null;
    try {
      // pstree -p shows all descendants with PIDs; find nested claude processes
      const tree = execSync(
        `pstree -p ${bilkoPid} 2>/dev/null || true`,
        { encoding: "utf-8", timeout: 2000 }
      );
      // Extract all PIDs from pstree output: "process(PID)"
      const pidMatches = [...tree.matchAll(/claude\((\d+)\)/g)];
      // Skip the first match (that's Bilko itself), return the second (Scout)
      if (pidMatches.length > 1) {
        return Number(pidMatches[1][1]);
      }
    } catch { /* ignore */ }
  }

  return null;
}

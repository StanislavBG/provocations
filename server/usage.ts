/**
 * Usage metering system — tracks resource consumption per user and enforces plan limits.
 *
 * Plan tiers: free, pro, team
 * Resources: llm_call, tts_minute, image_gen, storage_mb
 */

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { storage } from "./storage";

// ── Plan tier limits ──────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "team";

export interface PlanLimits {
  llmCallsPerDay: number;
  ttsMinsPerMonth: number;
  imagesPerDay: number;
  storageMb: number;
  canvases: number;
  nodesPerCanvas: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    llmCallsPerDay: 25,
    ttsMinsPerMonth: 0,
    imagesPerDay: 5,
    storageMb: 100,
    canvases: 3,
    nodesPerCanvas: 15,
  },
  pro: {
    llmCallsPerDay: 200,
    ttsMinsPerMonth: 50,
    imagesPerDay: 50,
    storageMb: 5120,
    canvases: Infinity,
    nodesPerCanvas: Infinity,
  },
  team: {
    llmCallsPerDay: 500,
    ttsMinsPerMonth: 200,
    imagesPerDay: 200,
    storageMb: 25600,
    canvases: Infinity,
    nodesPerCanvas: Infinity,
  },
};

export type UsageResource = "llm_call" | "tts_minute" | "image_gen" | "storage_mb";

// ── Core functions ────────────────────────────────────────────────────

/**
 * Get the user's current plan tier. Defaults to 'free' if no subscription exists.
 */
export async function getUserPlan(userId: string): Promise<PlanTier> {
  const sub = await storage.getSubscriptionByUserId(userId);
  if (!sub || sub.status === "cancelled") return "free";
  return (sub.planTier as PlanTier) || "free";
}

/**
 * Get current usage for a resource. Daily resources use today's date;
 * monthly resources (tts_minute) use the current month.
 */
export async function getCurrentUsage(userId: string, resource: UsageResource): Promise<number> {
  if (resource === "tts_minute") {
    const yearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    return storage.getUsageForMonth(userId, resource, yearMonth);
  }
  const today = new Date().toISOString().split("T")[0];
  return storage.getUsageForDate(userId, resource, today);
}

/**
 * Check if the user has remaining quota for a resource.
 * Returns true if the user can still use the resource.
 */
export async function checkUsage(userId: string, resource: UsageResource): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const current = await getCurrentUsage(userId, resource);

  switch (resource) {
    case "llm_call":
      return current < limits.llmCallsPerDay;
    case "tts_minute":
      return current < limits.ttsMinsPerMonth;
    case "image_gen":
      return current < limits.imagesPerDay;
    case "storage_mb":
      return current < limits.storageMb;
    default:
      return true;
  }
}

/**
 * Get the limit for a resource on the user's plan.
 */
export function getLimit(plan: PlanTier, resource: UsageResource): number {
  const limits = PLAN_LIMITS[plan];
  switch (resource) {
    case "llm_call":
      return limits.llmCallsPerDay;
    case "tts_minute":
      return limits.ttsMinsPerMonth;
    case "image_gen":
      return limits.imagesPerDay;
    case "storage_mb":
      return limits.storageMb;
    default:
      return 0;
  }
}

/**
 * Record usage of a resource. Inserts a usage record for today.
 */
export async function recordUsage(userId: string, resource: UsageResource, count: number = 1): Promise<void> {
  await storage.recordUsage(userId, resource, count);
}

/**
 * Get a full usage summary for a user — plan, limits, and current counts.
 */
export async function getUsageSummary(userId: string) {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  const [llmCalls, ttsMins, images, storageMb] = await Promise.all([
    getCurrentUsage(userId, "llm_call"),
    getCurrentUsage(userId, "tts_minute"),
    getCurrentUsage(userId, "image_gen"),
    getCurrentUsage(userId, "storage_mb"),
  ]);

  return {
    plan,
    limits,
    usage: {
      llmCallsToday: llmCalls,
      ttsMinutesThisMonth: ttsMins,
      imagesToday: images,
      storageMb,
    },
  };
}

// ── Express middleware ────────────────────────────────────────────────

/**
 * Express middleware factory that checks usage before allowing the request.
 * Returns 429 Too Many Requests if the user has exceeded their quota.
 * Records one unit of usage when the check passes (pre-decrement pattern).
 *
 * Usage: app.post("/api/challenge", requireUsage("llm_call"), handler);
 */
export function requireUsage(resource: UsageResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const allowed = await checkUsage(userId, resource);
      if (!allowed) {
        const plan = await getUserPlan(userId);
        const limit = getLimit(plan, resource);
        const current = await getCurrentUsage(userId, resource);
        return res.status(429).json({
          error: "Usage limit exceeded",
          resource,
          current,
          limit,
          plan,
          upgradeUrl: "/pricing",
        });
      }

      // Record usage pre-decrement (count the call even if downstream fails)
      await recordUsage(userId, resource);

      next();
    } catch (err) {
      console.error("Usage check failed:", err);
      // Fail open — don't block requests if usage check errors
      next();
    }
  };
}

/**
 * Express middleware that checks usage quota WITHOUT recording it.
 * Use this for endpoints where usage should only be recorded after a successful
 * result (post-decrement pattern). Call recordUsage() manually in the handler.
 *
 * Usage: app.post("/api/generate-imagen", requireUsageCheck("image_gen"), handler);
 */
export function requireUsageCheck(resource: UsageResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const allowed = await checkUsage(userId, resource);
      if (!allowed) {
        const plan = await getUserPlan(userId);
        const limit = getLimit(plan, resource);
        const current = await getCurrentUsage(userId, resource);
        return res.status(429).json({
          error: "Usage limit exceeded",
          resource,
          current,
          limit,
          plan,
          upgradeUrl: "/pricing",
        });
      }

      next();
    } catch (err) {
      console.error("Usage check failed:", err);
      // Fail open — don't block requests if usage check errors
      next();
    }
  };
}

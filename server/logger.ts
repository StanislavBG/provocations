/**
 * Structured logging middleware and utilities.
 *
 * - JSON output in production, pretty-printed in development.
 * - Assigns x-request-id (from header or generates with randomUUID).
 * - Logs on response finish: method, path, status, duration, userId.
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

const isDev = process.env.NODE_ENV !== "production";

function formatEntry(entry: LogEntry): string {
  if (isDev) {
    const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const level = entry.level.toUpperCase().padEnd(5);
    const reqId = entry.requestId ? ` [${entry.requestId.slice(0, 8)}]` : "";
    const user = entry.userId ? ` user=${entry.userId.slice(0, 12)}` : "";
    const dur = entry.duration !== undefined ? ` ${entry.duration}ms` : "";
    const err = entry.error ? ` ERROR: ${entry.error}` : "";
    return `${time} ${level}${reqId} ${entry.message}${user}${dur}${err}`;
  }
  return JSON.stringify(entry);
}

export function log(entry: LogEntry): void {
  const output = formatEntry(entry);
  switch (entry.level) {
    case LogLevel.ERROR:
      console.error(output);
      break;
    case LogLevel.WARN:
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Express middleware: assigns request ID, logs on response finish.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId =
      (req.headers["x-request-id"] as string | undefined) || randomUUID();
    res.setHeader("x-request-id", requestId);

    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;

      // Only log API requests to avoid noise from static files
      if (!req.path.startsWith("/api")) return;

      let level: LogLevel;
      if (status >= 500) {
        level = LogLevel.ERROR;
      } else if (status >= 400) {
        level = LogLevel.WARN;
      } else {
        level = LogLevel.INFO;
      }

      let userId: string | undefined;
      try {
        const auth = getAuth(req);
        userId = auth?.userId ?? undefined;
      } catch {
        // Auth may not be available on all routes (e.g., /api/health)
      }

      log({
        level,
        message: `${req.method} ${req.path} ${status}`,
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        duration,
      });
    });

    next();
  };
}

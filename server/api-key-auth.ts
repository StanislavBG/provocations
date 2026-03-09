/**
 * API key authentication middleware for machine-to-machine webhook endpoints.
 *
 * Validates X-API-Key header and binds the request to a specific Clerk user ID
 * via PROVOCATIONS_USER_ID. This ensures webhook/MCP callers have the same
 * ownership constraints as browser users authenticated via Clerk.
 */

import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      /** Clerk user ID bound to the API key. Set by requireApiKey middleware. */
      apiUserId?: string;
    }
  }
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"];
  const expected = process.env.PROVOCATIONS_API_KEY;
  const userId = process.env.PROVOCATIONS_USER_ID;

  if (!expected || !userId) {
    return res.status(503).json({ error: "PROVOCATIONS_API_KEY and PROVOCATIONS_USER_ID must both be configured" });
  }

  if (!key || key !== expected) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  // Bind the authenticated user ID to the request
  req.apiUserId = userId;
  next();
}

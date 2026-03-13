/**
 * JSON Processor node lifecycle handler.
 *
 * Receives JSON input, extracts values at configured paths,
 * and returns a structured result for post-processing into
 * document nodes.
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

// ── Simple JSONPath resolver ──

/**
 * Resolve a JSONPath-like expression against a parsed JSON value.
 * Supported patterns:
 *   $.key          — direct key access
 *   $.key.nested   — nested access
 *   $.key[0]       — array index
 *   $.key[*]       — all array items
 *   $.key.*.subkey — wildcard object traversal
 */
export function resolveJsonPath(obj: unknown, path: string): unknown {
  if (!path.startsWith("$")) return undefined;

  // Tokenize: split on '.' but handle [N] and [*] as separate tokens
  const raw = path.slice(1); // remove leading $
  if (!raw || raw === ".") return obj;

  const tokens: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === ".") {
      i++;
      continue;
    }
    if (raw[i] === "[") {
      const end = raw.indexOf("]", i);
      if (end === -1) break;
      tokens.push(raw.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    // Read key until . or [
    let end = i;
    while (end < raw.length && raw[end] !== "." && raw[end] !== "[") end++;
    tokens.push(raw.slice(i, end));
    i = end;
  }

  return resolveTokens(obj, tokens);
}

function resolveTokens(current: unknown, tokens: string[]): unknown {
  if (tokens.length === 0) return current;
  if (current === null || current === undefined) return undefined;

  const [token, ...rest] = tokens;

  // Array index: [N]
  const indexMatch = token.match(/^\[(\d+)\]$/);
  if (indexMatch) {
    if (!Array.isArray(current)) return undefined;
    const idx = parseInt(indexMatch[1], 10);
    return resolveTokens(current[idx], rest);
  }

  // Array wildcard: [*]
  if (token === "[*]") {
    if (!Array.isArray(current)) return undefined;
    if (rest.length === 0) return current;
    return current.map((item) => resolveTokens(item, rest)).filter((v) => v !== undefined);
  }

  // Object wildcard: *
  if (token === "*") {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    const values = Object.values(current as Record<string, unknown>);
    if (rest.length === 0) return values;
    return values.map((v) => resolveTokens(v, rest)).filter((v) => v !== undefined);
  }

  // Regular key
  if (typeof current === "object" && current !== null && !Array.isArray(current)) {
    return resolveTokens((current as Record<string, unknown>)[token], rest);
  }

  return undefined;
}

export function createJsonProcessorHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const input = ctx.combinedInputContent.trim();
      if (!input) return false;

      // Validate it's parseable JSON
      try {
        JSON.parse(input);
        return true;
      } catch {
        // Store the error for display
        return false;
      }
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const input = ctx.combinedInputContent.trim();
      const parsed = JSON.parse(input);

      const outputPaths = ctx.node.jsonOutputPaths || [];
      const passThrough = ctx.node.jsonPassThrough ?? false;

      const results: Array<{
        id: string;
        name: string;
        path: string;
        flatten: boolean;
        value: unknown;
        items?: unknown[]; // flattened items
      }> = [];

      for (const op of outputPaths) {
        const value = resolveJsonPath(parsed, op.path);
        const entry: typeof results[0] = {
          id: op.id,
          name: op.name,
          path: op.path,
          flatten: op.flatten ?? false,
          value,
        };

        if (op.flatten && Array.isArray(value)) {
          entry.items = value;
        }

        results.push(entry);
      }

      // Return as JSON for the post-process handler
      return JSON.stringify({
        results,
        passThrough,
        originalInput: passThrough ? input : undefined,
      });
    },
  };
}

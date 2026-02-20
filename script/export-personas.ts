/**
 * Export Personas — DB → Code sync pipeline.
 *
 * Reads all persona_overrides from the database, merges with the
 * current built-in defaults, and outputs the merged definitions
 * as JSON to stdout.
 *
 * Usage:
 *   npx tsx script/export-personas.ts              # print merged JSON
 *   npx tsx script/export-personas.ts --diff        # show only overridden personas
 *   npx tsx script/export-personas.ts > export.json # save to file for review
 *
 * Workflow:
 *   1. Admin curates personas in the app (DB overrides)
 *   2. Run this script to export merged definitions
 *   3. Review the output and update shared/personas.ts
 *   4. Commit, review, deploy
 */

import { db } from "../server/db";
import { personaOverrides } from "../shared/models/chat";
import { builtInPersonas } from "../shared/personas";
import type { Persona, ProvocationType } from "../shared/schema";

async function main() {
  const isDiff = process.argv.includes("--diff");

  console.error("Fetching persona overrides from database...");

  const overrides = await db.select().from(personaOverrides);
  console.error(`Found ${overrides.length} override(s) in database.`);

  if (overrides.length === 0) {
    console.error("No overrides found. All personas match code defaults.");
    process.exit(0);
  }

  // Merge: code defaults + DB overrides
  const merged: Record<string, Persona> = {};
  for (const [id, persona] of Object.entries(builtInPersonas)) {
    merged[id] = { ...persona };
  }

  const overriddenIds: string[] = [];
  for (const override of overrides) {
    try {
      const parsed = JSON.parse(override.definition) as Persona;
      parsed.humanCurated = override.humanCurated;
      parsed.curatedBy = override.curatedBy ?? null;
      parsed.curatedAt = override.curatedAt?.toISOString() ?? null;
      merged[parsed.id] = parsed;
      overriddenIds.push(parsed.id);
      console.error(`  [override] ${parsed.id} (${parsed.label}) — humanCurated: ${override.humanCurated}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to parse override for ${override.personaId}:`, err);
    }
  }

  if (isDiff) {
    // Only output overridden personas
    const diffOutput: Record<string, Persona> = {};
    for (const id of overriddenIds) {
      diffOutput[id] = merged[id];
    }
    console.log(JSON.stringify(diffOutput, null, 2));
  } else {
    // Output all merged personas
    console.log(JSON.stringify(merged, null, 2));
  }

  console.error("\nDone. Review the output and update shared/personas.ts as needed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});

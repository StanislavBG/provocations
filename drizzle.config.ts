import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/models/chat.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Only manage tables that are declared in the schema.
  // Prevents drizzle-kit push from dropping legacy tables that still hold data.
  tablesFilter: [
    "folders",
    "key_versions",
    "documents",
    "user_preferences",
    "persona_versions",
    "tracking_events",
    "usage_metrics",
    "pipeline_artifacts",
    "persona_overrides",
    "agent_definitions",
    "agent_prompt_overrides",
    "error_logs",
    "llm_call_logs",
  ],
});

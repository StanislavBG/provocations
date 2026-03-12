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
  // ⚠️  CRITICAL: Every pgTable() in shared/models/chat.ts MUST have a matching entry here.
  //     Missing a table causes drizzle-kit to generate DROP TABLE CASCADE on deploy,
  //     which DESTROYS PRODUCTION DATA. See docs/adrs.md ADR 1 for full rules.
  //     When adding a new table: 1) shared/models/chat.ts  2) server/db.ts  3) HERE
  tablesFilter: [
    "folders",
    "key_versions",
    "documents",
    "user_preferences",
    "active_context",
    "persona_versions",
    "tracking_events",
    "usage_metrics",
    "pipeline_artifacts",
    "persona_overrides",
    "agent_definitions",
    "agent_prompt_overrides",
    "error_logs",
    "payments",
    "llm_call_logs",
    "workspace_sessions",
    "connections",
    "conversations",
    "messages",
    "chat_preferences",
    "shared_items",
    "notifications",
    "platform_credentials",
    "social_post_logs",
    "agency_events",
    "agency_campaigns",
    "subscriptions",
    "usage_records",
    "canvas_events",
    "api_keys",
  ],
});

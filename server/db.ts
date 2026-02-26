import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/models/chat";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Prevent unhandled 'error' events from crashing the process
pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

export const db = drizzle(pool, { schema });

/**
 * Ensure required tables exist. Runs CREATE TABLE IF NOT EXISTS
 * so the app works even if drizzle-kit push was never executed.
 * Non-fatal: the server will start even if the database is unavailable.
 */
export async function ensureTables(): Promise<void> {
  let client: pg.PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        name VARCHAR(200) NOT NULL,
        name_ciphertext TEXT,
        name_salt VARCHAR(64),
        name_iv VARCHAR(32),
        parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        locked BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS key_versions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        key_encryption_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        title TEXT NOT NULL,
        title_ciphertext TEXT,
        title_salt VARCHAR(64),
        title_iv VARCHAR(32),
        ciphertext TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        iv VARCHAR(32) NOT NULL,
        folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        key_version_id INTEGER REFERENCES key_versions(id),
        locked BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL UNIQUE,
        auto_dictate BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Add columns that were added after initial schema (idempotent)
      DO $$ BEGIN
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS key_version_id INTEGER REFERENCES key_versions(id);
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS title_ciphertext TEXT;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS title_salt VARCHAR(64);
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS title_iv VARCHAR(32);
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE NOT NULL;
        ALTER TABLE folders ADD COLUMN IF NOT EXISTS name_ciphertext TEXT;
        ALTER TABLE folders ADD COLUMN IF NOT EXISTS name_salt VARCHAR(64);
        ALTER TABLE folders ADD COLUMN IF NOT EXISTS name_iv VARCHAR(32);
        ALTER TABLE folders ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE NOT NULL;
        ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS verbose_mode BOOLEAN DEFAULT FALSE NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS persona_versions (
        id SERIAL PRIMARY KEY,
        persona_id VARCHAR(64) NOT NULL,
        version INTEGER NOT NULL,
        definition TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tracking_events (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        persona_id VARCHAR(64),
        template_id VARCHAR(64),
        app_section VARCHAR(64),
        duration_ms INTEGER,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usage_metrics (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        metric_key VARCHAR(64) NOT NULL,
        metric_value INTEGER DEFAULT 0 NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pipeline_artifacts (
        id SERIAL PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id VARCHAR(128) NOT NULL,
        document_id INTEGER,
        parent_artifact_id INTEGER,
        artifact_type VARCHAR(32) NOT NULL,
        source_type VARCHAR(32) NOT NULL,
        source_url TEXT,
        source_title VARCHAR(500),
        thumbnail_url TEXT,
        ciphertext TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        iv VARCHAR(32) NOT NULL,
        status VARCHAR(16) DEFAULT 'pending' NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS persona_overrides (
        id SERIAL PRIMARY KEY,
        persona_id VARCHAR(64) NOT NULL UNIQUE,
        definition TEXT NOT NULL,
        human_curated BOOLEAN DEFAULT FALSE NOT NULL,
        curated_by VARCHAR(128),
        curated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_definitions (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(128) NOT NULL UNIQUE,
        user_id VARCHAR(128) NOT NULL,
        name VARCHAR(256) NOT NULL,
        description TEXT,
        persona TEXT,
        steps TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_prompt_overrides (
        id SERIAL PRIMARY KEY,
        task_type VARCHAR(64) NOT NULL UNIQUE,
        system_prompt TEXT NOT NULL,
        human_curated BOOLEAN DEFAULT FALSE NOT NULL,
        curated_by VARCHAR(128),
        curated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        session_id VARCHAR(64),
        tag VARCHAR(64) NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        url TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        stripe_session_id VARCHAR(256) NOT NULL,
        stripe_customer_id VARCHAR(256),
        stripe_payment_intent_id VARCHAR(256),
        product_id VARCHAR(256),
        price_id VARCHAR(256),
        amount INTEGER,
        currency VARCHAR(8),
        status VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(stripe_session_id);

      -- LLM call logs for gateway-level observability
      CREATE TABLE IF NOT EXISTS llm_call_logs (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(36) NOT NULL UNIQUE,
        user_id VARCHAR(128) NOT NULL,
        session_id VARCHAR(64),
        app_type VARCHAR(64),
        task_type VARCHAR(64) NOT NULL,
        endpoint VARCHAR(128) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        model VARCHAR(128) NOT NULL,
        context_tokens_estimate INTEGER,
        context_characters INTEGER,
        response_characters INTEGER,
        response_tokens_estimate INTEGER,
        max_tokens INTEGER,
        temperature_x100 INTEGER,
        estimated_cost_microdollars INTEGER,
        duration_ms INTEGER,
        status VARCHAR(16) DEFAULT 'success' NOT NULL,
        error_message TEXT,
        streaming BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_llm_call_logs_user ON llm_call_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_llm_call_logs_created ON llm_call_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_llm_call_logs_task ON llm_call_logs(task_type);
      CREATE INDEX IF NOT EXISTS idx_llm_call_logs_app ON llm_call_logs(app_type);

      CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_error_logs_tag ON error_logs(tag);

      -- Messaging tables
      CREATE TABLE IF NOT EXISTS connections (
        id SERIAL PRIMARY KEY,
        requester_id VARCHAR(128) NOT NULL,
        responder_id VARCHAR(128) NOT NULL,
        status VARCHAR(16) DEFAULT 'pending' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);
      CREATE INDEX IF NOT EXISTS idx_connections_responder ON connections(responder_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair ON connections(requester_id, responder_id);

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        connection_id INTEGER NOT NULL,
        participant_a VARCHAR(128) NOT NULL,
        participant_b VARCHAR(128) NOT NULL,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON conversations(participant_a);
      CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON conversations(participant_b);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_connection ON conversations(connection_id);

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        sender_id VARCHAR(128) NOT NULL,
        ciphertext TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        iv VARCHAR(32) NOT NULL,
        message_type VARCHAR(16) DEFAULT 'text' NOT NULL,
        ref_ciphertext TEXT,
        ref_salt VARCHAR(64),
        ref_iv VARCHAR(32),
        read_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at);

      CREATE TABLE IF NOT EXISTS chat_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL UNIQUE,
        presence_status VARCHAR(16) DEFAULT 'available' NOT NULL,
        custom_status_text VARCHAR(100),
        notifications_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        notify_on_mention_only BOOLEAN DEFAULT FALSE NOT NULL,
        muted_conversations TEXT,
        read_receipts_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        typing_indicators_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        message_retention_days INTEGER DEFAULT 7 NOT NULL,
        chat_sound_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        compact_mode BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_preferences_user ON chat_preferences(user_id);

      CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON tracking_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_tracking_events_session ON tracking_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON tracking_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_persona_versions_persona ON persona_versions(persona_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_metrics_user_key ON usage_metrics(user_id, metric_key);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_overrides_persona_id ON persona_overrides(persona_id);
      CREATE INDEX IF NOT EXISTS idx_agent_definitions_user_id ON agent_definitions(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_definitions_agent_id ON agent_definitions(agent_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_prompt_overrides_task_type ON agent_prompt_overrides(task_type);
    `);
    console.log("Database tables verified.");
  } catch (err) {
    console.error("Failed to ensure database tables:", err instanceof Error ? err.message : err);
    console.warn("Server will continue without database — document persistence will be unavailable.");
  } finally {
    client?.release();
  }
}

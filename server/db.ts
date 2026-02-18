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
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        title TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        iv VARCHAR(32) NOT NULL,
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
    `);
    console.log("Database tables verified.");
  } catch (err) {
    console.error("Failed to ensure database tables:", err instanceof Error ? err.message : err);
    console.warn("Server will continue without database — document persistence will be unavailable.");
  } finally {
    client?.release();
  }
}

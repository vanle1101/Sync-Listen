import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const fallbackDatabaseUrl =
  process.env.NODE_ENV === "production"
    ? undefined
    : "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const databaseUrl = process.env.DATABASE_URL ?? fallbackDatabaseUrl;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("⚠️  DATABASE_URL not set - database functionality may be limited");
}

export const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
}) : null;

export const db = pool ? drizzle(pool, { schema }) : null as any;

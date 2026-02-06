import { defineConfig } from "drizzle-kit";
import * as fs from "fs";
import * as path from "path";

// Attempt to load DATABASE_URL from .env if not present
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (match) {
      process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

import { defineConfig } from "drizzle-kit";
import * as fs from "fs";
import * as path from "path";

// robust .env loader for VPS
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const [key, ...parts] = line.trim().split("=");
      if (key === "DATABASE_URL") {
        process.env.DATABASE_URL = parts.join("=").trim().replace(/^["']|["']$/g, "");
        break;
      }
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

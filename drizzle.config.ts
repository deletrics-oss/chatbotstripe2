import { defineConfig } from "drizzle-kit";
import * as fs from "fs";
import * as path from "path";

// robust .env loader for VPS
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const splitIdx = trimmedLine.indexOf("=");
      if (splitIdx === -1) continue;

      const key = trimmedLine.slice(0, splitIdx).trim();
      const value = trimmedLine.slice(splitIdx + 1).trim();

      if (key === "DATABASE_URL") {
        process.env.DATABASE_URL = value.replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.log("Current Directory:", process.cwd());
  console.log(".env file exists:", fs.existsSync(path.resolve(process.cwd(), ".env")));
  throw new Error("DATABASE_URL not found. Check if .env is in the same folder.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

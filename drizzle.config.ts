import { defineConfig } from "drizzle-kit";
import * as fs from "fs";
import * as path from "path";

// robust .env loader for VPS
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    console.log("[Drizzle] Reading .env at:", envPath);
    const content = fs.readFileSync(envPath, "utf8");
    const foundKeys: string[] = [];

    // Improved regex to find DATABASE_URL regardless of weird characters
    const match = content.match(/^[ \t]*DATABASE_URL[ \t]*=[ \t]*["']?([^"'\r\n]+)["']?/m);

    if (match) {
      process.env.DATABASE_URL = match[1].trim();
      console.log("[Drizzle] Found DATABASE_URL in .env!");
    } else {
      // Collect keys for debugging
      content.split(/\r?\n/).forEach(line => {
        const k = line.split("=")[0].trim();
        if (k && !k.startsWith("#")) foundKeys.push(k);
      });
      console.log("[Drizzle] Keys found in .env:", foundKeys.join(", "));
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.log("[Drizzle] Current Dir:", process.cwd());
  throw new Error("DATABASE_URL not found. Run: DATABASE_URL='sua_url' npm run db:push");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

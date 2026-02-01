
import { db } from "./server/db";
import { users } from "./shared/schema";

async function checkConnection() {
    if (!db) {
        console.error("Database not initialized");
        process.exit(1);
    }
    try {
        console.log("Testing database connection...");
        const result = await db.select().from(users).limit(1);
        console.log("Connection successful! Found users:", result.length);
        process.exit(0);
    } catch (err) {
        console.error("Connection failed:", err);
        process.exit(1);
    }
}

checkConnection();

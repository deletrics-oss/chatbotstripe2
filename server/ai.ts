import { GoogleGenAI } from "@google/genai";

// Managed in-memory instances
let systemAiInstance: GoogleGenAI | null = null;
const userAiInstances = new Map<string, GoogleGenAI>();

/**
 * Get Google AI instance. If a userApiKey is provided, it returns an instance for that key.
 * Otherwise, it returns the system-wide instance from environment variables.
 */
export function getAI(userApiKey?: string | null): GoogleGenAI | null {
    // 1. User-specific Key Preference
    if (userApiKey && userApiKey.trim() !== "") {
        if (userAiInstances.has(userApiKey)) {
            return userAiInstances.get(userApiKey)!;
        }
        console.log(`[AI] Initializing new Gemini instance for custom user key (length: ${userApiKey.length})`);
        const userAi = new GoogleGenAI({ apiKey: userApiKey });
        userAiInstances.set(userApiKey, userAi);
        return userAi;
    }

    // 2. System-wide Key Fallback
    if (systemAiInstance) return systemAiInstance;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey && geminiKey.trim() !== "" && geminiKey !== "undefined") {
        console.log(`[AI] Initializing system-wide Gemini instance (length: ${geminiKey.length})`);
        systemAiInstance = new GoogleGenAI({ apiKey: geminiKey });
        return systemAiInstance;
    }

    console.warn(`[AI] ⚠️ getAI() called but NO valid API Key found in env or user settings.`);
    return null;
}

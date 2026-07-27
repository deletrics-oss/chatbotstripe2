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
    if (userApiKey && userApiKey.trim() !== "" && userApiKey !== "undefined") {
        const cleanKey = userApiKey.trim();
        if (userAiInstances.has(cleanKey)) {
            return userAiInstances.get(cleanKey)!;
        }
        console.log(`[AI] Initializing new Gemini instance for custom user key (length: ${cleanKey.length})`);
        const userAi = new GoogleGenAI({ apiKey: cleanKey });
        userAiInstances.set(cleanKey, userAi);
        return userAi;
    }

    // 2. System-wide Key Fallback
    if (systemAiInstance) return systemAiInstance;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey && geminiKey.trim() !== "" && geminiKey !== "undefined" && geminiKey !== "MY_GEMINI_API_KEY") {
        console.log(`[AI] Initializing system-wide Gemini instance (length: ${geminiKey.trim().length})`);
        systemAiInstance = new GoogleGenAI({ apiKey: geminiKey.trim() });
        return systemAiInstance;
    }

    console.warn(`[AI] ⚠️ getAI() called but NO valid API Key found in env or user settings.`);
    return null;
}

/**
 * Invalidate a cached AI instance if key was invalid or rejected by API
 */
export function invalidateAIKey(userApiKey?: string | null) {
    if (userApiKey && userAiInstances.has(userApiKey)) {
        console.log(`[AI] Invalidation requested for custom user key. Removing cached instance.`);
        userAiInstances.delete(userApiKey);
    } else {
        console.log(`[AI] Invalidation requested for system AI instance. Resetting.`);
        systemAiInstance = null;
    }
}

export function resetAI() {
    console.log('[AI] Resetting AI instances...');
    systemAiInstance = null;
    userAiInstances.clear();
}


import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI lazily
let aiInstance: GoogleGenAI | null = null;

export function getAI() {
    if (aiInstance) return aiInstance;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
        aiInstance = new GoogleGenAI({ apiKey: geminiKey });
    }
    return aiInstance;
}

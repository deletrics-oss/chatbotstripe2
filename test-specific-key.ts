
import { GoogleGenAI } from "@google/genai";

async function testGeminiKey() {
    const apiKey = "AIzaSyCqzRGzEbXLQ4IclSKFDCfeeSS1139NC3k";
    console.log(`Testing API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        console.log("Attempting to generate content...");
        const model = "gemini-2.0-flash-exp";

        const response = await ai.models.generateContent({
            model: model,
            contents: "Say 'The key is working!' if you can read this.",
        });

        const text = response.text || JSON.stringify(response);
        console.log("\n✅ SUCCESS! Gemini API responded:");
        console.log("---------------------------------------------------");
        console.log(text);
        console.log("---------------------------------------------------");

    } catch (error: any) {
        console.error("\n❌ FAILED to connect to Gemini API.");
        console.error("Error details:", error.message);
    }
}

testGeminiKey();

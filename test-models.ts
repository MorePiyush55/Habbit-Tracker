import { GoogleGenerativeAI } from "@google/generative-ai";

async function run() {
    const key = process.argv[2];
    if (!key) {
        console.error("No key provided");
        return;
    }
    const genAI = new GoogleGenerativeAI(key);
    try {
        // Unfortunately, the current SDK doesn't natively export listModels in a simple way for v1beta without auth tokens instead of API keys for some users.
        // We will just test if gemini-1.5-flash-latest works.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const res = await model.generateContent("hello");
        console.log("SUCCESS with gemini-1.5-flash-latest:", res.response.text());
    } catch (e: any) {
        console.log("FAIL with gemini-1.5-flash-latest:", e.message);
    }
}
run();

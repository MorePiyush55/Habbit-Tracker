import OpenAI from "openai";

// HuggingFace Router Client for Qwen and DeepSeek
export const hfClient = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: process.env.HF_TOKEN || "dummy-key-for-build",
});

// OpenRouter Client for Gemma 3
export const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "dummy-key-for-build",
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-OpenRouter-Title": "Solo Leveling Habit Tracker",
    },
});

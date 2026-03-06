import { openRouterClient } from "./aiClient";

type TaskType = "chat" | "notification" | "analysis" | "strategy" | "learning" | "tutor";

// Verified free models on OpenRouter — sorted by demand (low → high contest)
// Avoid ultra-popular models (Llama 3.2 3B = 8 rpm limit, too restrictive)
const MODELS = {
    // Chat: Gemma 3 4B — small, fast, low demand vs Llama
    fast: "google/gemma-3-4b-it:free",
    fast2: "google/gemma-3n-e2b-it:free",         // ultra-light fallback
    // Reasoning: DeepSeek R1 — best free reasoning model
    reason: "deepseek/deepseek-r1:free",
    reason2: "google/gemma-3-12b-it:free",          // reasoning fallback
    // Tutor: Gemma 3 27B → 12B → 4B cascade
    tutor: "google/gemma-3-27b-it:free",
    tutor2: "google/gemma-3-12b-it:free",
};

// Retry up to 2 times with 1-second delay between attempts
async function callModel(model: string, prompt: string, retries = 2): Promise<string> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await openRouterClient.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
            });
            return res.choices[0]?.message?.content || "";
        } catch (e: any) {
            const is429 = e?.status === 429 || e?.message?.includes("429");
            // Only retry on rate limits, and only if attempts remain
            if (is429 && attempt < retries) {
                console.warn(`[AI Router] Rate limited on ${model}, retrying in 2s... (attempt ${attempt + 1})`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            throw e; // propagate other errors or final attempt
        }
    }
    return "";
}

export async function aiRouter(taskType: TaskType, prompt: string): Promise<string> {
    // Fast/Simple Tasks → Gemma 3 4B (lighter, less contested than Llama)
    if (taskType === "chat" || taskType === "notification") {
        try {
            return await callModel(MODELS.fast, prompt);
        } catch (e: any) {
            console.warn("[AI Router] Gemma 4B failed, trying ultra-light fallback:", e?.message);
            return await callModel(MODELS.fast2, prompt);
        }
    }

    // Complex Reasoning → DeepSeek R1 free
    if (taskType === "analysis" || taskType === "strategy") {
        try {
            const content = await callModel(MODELS.reason, prompt);
            return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        } catch (e: any) {
            console.warn("[AI Router] DeepSeek failed, falling back to Gemma 12B:", e?.message);
            return await callModel(MODELS.reason2, prompt);
        }
    }

    // Tutoring / Learning → Gemma 3 27B → 12B cascade
    if (taskType === "learning" || taskType === "tutor") {
        try {
            return await callModel(MODELS.tutor, prompt);
        } catch (e: any) {
            console.warn("[AI Router] Gemma 27B rate-limited, trying Gemma 12B:", e?.message);
            return await callModel(MODELS.tutor2, prompt);
        }
    }

    throw new Error(`Unknown task type: ${taskType}`);
}

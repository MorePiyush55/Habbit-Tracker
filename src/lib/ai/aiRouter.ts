import { openRouterClient } from "./aiClient";

type TaskType = "chat" | "notification" | "analysis" | "strategy" | "learning" | "tutor";

// All free-tier models on OpenRouter — no credits required
const MODELS = {
    fast: "meta-llama/llama-3.1-8b-instruct:free",      // Chat, notifications
    reason: "deepseek/deepseek-r1:free",                  // Analysis, strategy
    tutor: "google/gemma-3-27b-it:free",                  // Learning, quizzes
    fallback: "mistralai/mistral-7b-instruct:free",       // Universal fallback
};

async function callModel(model: string, prompt: string): Promise<string> {
    const res = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content || "";
}

export async function aiRouter(taskType: TaskType, prompt: string): Promise<string> {
    // Fast/Simple Tasks -> Llama 3.1 8B (free, fast)
    if (taskType === "chat" || taskType === "notification") {
        try {
            return await callModel(MODELS.fast, prompt);
        } catch (e: any) {
            console.warn("[AI Router] Llama failed, trying fallback:", e?.message);
            return await callModel(MODELS.fallback, prompt);
        }
    }

    // Complex Reasoning -> DeepSeek R1 (free, powerful)
    if (taskType === "analysis" || taskType === "strategy") {
        try {
            const content = await callModel(MODELS.reason, prompt);
            // Strip DeepSeek thinking blocks
            return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        } catch (e: any) {
            console.warn("[AI Router] DeepSeek failed, trying fallback:", e?.message);
            return await callModel(MODELS.fast, prompt);
        }
    }

    // Tutoring / Learning -> Gemma 3 27B (free, knowledgeable)
    if (taskType === "learning" || taskType === "tutor") {
        try {
            return await callModel(MODELS.tutor, prompt);
        } catch (e: any) {
            console.warn("[AI Router] Gemma 3 rate-limited, trying fallback:", e?.message);
            return await callModel(MODELS.fallback, prompt);
        }
    }

    throw new Error(`Unknown task type: ${taskType}`);
}

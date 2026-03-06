import { hfClient, openRouterClient } from "./aiClient";

type TaskType = "chat" | "notification" | "analysis" | "strategy" | "learning" | "tutor";

async function tryHF(model: string, prompt: string): Promise<string> {
    const res = await hfClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content || "";
}

async function tryOpenRouter(model: string, prompt: string): Promise<string> {
    const res = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content || "";
}

export async function aiRouter(taskType: TaskType, prompt: string): Promise<string> {
    // Fast/Simple Tasks -> Qwen 3 (HuggingFace)
    if (taskType === "chat" || taskType === "notification") {
        try {
            return await tryHF("Qwen/Qwen3-8B:fastest", prompt);
        } catch (e: any) {
            console.warn("[AI Router] Qwen failed, falling back to DeepSeek:", e?.message);
            return await tryHF("deepseek-ai/DeepSeek-R1:fastest", prompt);
        }
    }

    // Complex Reasoning -> DeepSeek R1 (HuggingFace)
    if (taskType === "analysis" || taskType === "strategy") {
        try {
            const content = await tryHF("deepseek-ai/DeepSeek-R1:fastest", prompt);
            // Clean up any thinking blocks DeepSeek generates
            return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        } catch (e: any) {
            console.warn("[AI Router] DeepSeek failed, falling back to Qwen:", e?.message);
            return await tryHF("Qwen/Qwen3-8B:fastest", prompt);
        }
    }

    // Deep Tutoring / Knowledge -> Gemma 3 27B (OpenRouter), with Qwen fallback
    if (taskType === "learning" || taskType === "tutor") {
        try {
            return await tryOpenRouter("google/gemma-3-27b-it:free", prompt);
        } catch (e: any) {
            console.warn("[AI Router] Gemma 3 failed (likely rate-limited), falling back to Qwen:", e?.message);
            // Fallback: Qwen on HuggingFace is fast and still capable for quizzes
            return await tryHF("Qwen/Qwen3-8B:fastest", prompt);
        }
    }

    throw new Error(`Unknown task type: ${taskType}`);
}

import { hfClient, openRouterClient } from "./aiClient";

type TaskType = "chat" | "notification" | "analysis" | "strategy" | "learning" | "tutor";

export async function aiRouter(taskType: TaskType, prompt: string): Promise<string> {
    try {
        // Fast/Simple Tasks -> Qwen 3 (HuggingFace)
        if (taskType === "chat" || taskType === "notification") {
            const res = await hfClient.chat.completions.create({
                model: "Qwen/Qwen3-8B:fastest",
                messages: [{ role: "user", content: prompt }],
            });
            return res.choices[0]?.message?.content || "";
        }

        // Complex Reasoning -> DeepSeek R1 (HuggingFace)
        if (taskType === "analysis" || taskType === "strategy") {
            const res = await hfClient.chat.completions.create({
                model: "deepseek-ai/DeepSeek-R1:fastest",
                messages: [{ role: "user", content: prompt }],
            });
            // Clean up thinking blocks that DeepSeek generates occasionally before the answer
            let content = res.choices[0]?.message?.content || "";
            content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            return content;
        }

        // Deep Tutoring / Knowledge -> Gemma 3 27B (OpenRouter)
        if (taskType === "learning" || taskType === "tutor") {
            const res = await openRouterClient.chat.completions.create({
                model: "google/gemma-3-27b-it:free",
                messages: [{ role: "user", content: prompt }],
            });
            return res.choices[0]?.message?.content || "";
        }

        throw new Error(`Unknown task type: ${taskType}`);
    } catch (error) {
        console.error(`[AI Router Error - ${taskType}]:`, error);
        throw error;
    }
}

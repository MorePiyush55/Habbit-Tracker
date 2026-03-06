import { openRouterClient } from "./aiClient";
import { validateAIResponse, getFallbackResponse } from "@/lib/core/qualityControl";
import { trackAICall, trackQualityCheck } from "@/lib/core/observability";
import { getSystemPrompt, determinePersonalityMode } from "@/lib/core/personalityLayer";

type TaskType = "chat" | "notification" | "analysis" | "strategy" | "learning" | "tutor";

// Verified free models on OpenRouter — sorted by demand (low → high contest)
// Model routing map: each task type gets the best model for its purpose
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

// Task → Model mapping for the model router (#12)
const TASK_MODEL_MAP: Record<TaskType, { primary: string; fallback: string }> = {
    chat: { primary: MODELS.fast, fallback: MODELS.fast2 },
    notification: { primary: MODELS.fast, fallback: MODELS.fast2 },
    analysis: { primary: MODELS.reason, fallback: MODELS.reason2 },
    strategy: { primary: MODELS.reason, fallback: MODELS.reason2 },
    learning: { primary: MODELS.tutor, fallback: MODELS.tutor2 },
    tutor: { primary: MODELS.tutor, fallback: MODELS.tutor2 },
};

// Track recent responses per task type for duplicate detection
const recentResponses: Record<string, string[]> = {};

function trackResponse(taskType: string, response: string): void {
    if (!recentResponses[taskType]) recentResponses[taskType] = [];
    recentResponses[taskType].push(response);
    // Keep only last 5 per type
    if (recentResponses[taskType].length > 5) {
        recentResponses[taskType] = recentResponses[taskType].slice(-5);
    }
}

// Retry up to 2 times with 2-second delay between attempts
async function callModel(model: string, prompt: string, systemPrompt?: string, retries = 2): Promise<string> {
    const start = Date.now();

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const messages: { role: "system" | "user"; content: string }[] = [];

            // Inject system personality prompt when available
            if (systemPrompt) {
                messages.push({ role: "system", content: systemPrompt });
            }
            messages.push({ role: "user", content: prompt });

            const res = await openRouterClient.chat.completions.create({
                model,
                messages,
            });

            const content = res.choices[0]?.message?.content || "";
            trackAICall(true, Date.now() - start);
            return content;
        } catch (e: any) {
            const is429 = e?.status === 429 || e?.message?.includes("429");
            // Only retry on rate limits, and only if attempts remain
            if (is429 && attempt < retries) {
                console.warn(`[AI Router] Rate limited on ${model}, retrying in 2s... (attempt ${attempt + 1})`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            trackAICall(false, Date.now() - start);
            throw e; // propagate other errors or final attempt
        }
    }
    return "";
}

/**
 * Enhanced AI Router with:
 *   - Model routing by task type (#12)
 *   - System personality injection (#10)
 *   - Quality control validation (#5)
 *   - Observability tracking (#11)
 *   - Duplicate detection
 */
export async function aiRouter(taskType: TaskType, prompt: string): Promise<string> {
    const config = TASK_MODEL_MAP[taskType];
    if (!config) throw new Error(`Unknown task type: ${taskType}`);

    // Determine personality mode (default cold for non-chat tasks)
    const personalityMode = taskType === "chat" ? "balanced" : "cold";
    const systemPrompt = getSystemPrompt(personalityMode);

    let rawResponse = "";

    // Try primary model, fallback on failure
    try {
        rawResponse = await callModel(config.primary, prompt, systemPrompt);

        // Clean DeepSeek thinking tags for analysis/strategy
        if (taskType === "analysis" || taskType === "strategy") {
            rawResponse = rawResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        }
    } catch (e: any) {
        console.warn(`[AI Router] ${config.primary} failed, trying fallback:`, e?.message);
        try {
            rawResponse = await callModel(config.fallback, prompt, systemPrompt);
            if (taskType === "analysis" || taskType === "strategy") {
                rawResponse = rawResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            }
        } catch (e2: any) {
            console.error(`[AI Router] Both models failed for ${taskType}:`, e2?.message);
            trackAICall(false);
            return getFallbackResponse(mapTaskToFallback(taskType));
        }
    }

    // Quality Control: validate the response
    const qcResult = validateAIResponse(rawResponse, {
        minLength: taskType === "notification" ? 10 : 20,
        recentResponses: recentResponses[taskType] || [],
    });

    trackQualityCheck(qcResult.passed);

    if (!qcResult.passed) {
        console.warn(`[AI Router] QC failed for ${taskType} (score: ${qcResult.score}):`, qcResult.issues);
        return getFallbackResponse(mapTaskToFallback(taskType));
    }

    // Track for future duplicate detection
    trackResponse(taskType, qcResult.cleaned);

    return qcResult.cleaned;
}

// Map task type to fallback context
function mapTaskToFallback(taskType: TaskType): "warning" | "commendation" | "strategy" | "notification" | "training" {
    switch (taskType) {
        case "chat": return "notification";
        case "notification": return "notification";
        case "analysis": return "strategy";
        case "strategy": return "strategy";
        case "learning": return "training";
        case "tutor": return "training";
    }
}

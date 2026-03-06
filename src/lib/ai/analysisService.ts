import { GoogleGenerativeAI } from "@google/generative-ai";
import { weeklyReportPrompt, motivationPrompt, weaknessAnalysisPrompt, systemChatPrompt } from "./prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Simple in-memory rate limiter (per-process)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_CALLS_PER_DAY = 50;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
        return true;
    }

    if (entry.count >= MAX_CALLS_PER_DAY) return false;

    entry.count++;
    return true;
}

// Timeout wrapper — prevents Gemini from hanging forever
const AI_TIMEOUT_MS = 15000;

async function callGeminiWithTimeout(prompt: string): Promise<string> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI_TIMEOUT: System response exceeded 15 seconds.")), AI_TIMEOUT_MS)
    );

    try {
        const response = await Promise.race([
            model.generateContent(prompt),
            timeout
        ]);

        const text = (response as any).response.text();
        console.log("[Gemini Raw Response]:", text.substring(0, 200) + "...");
        return text;
    } catch (error: any) {
        console.error("[Gemini callGeminiWithTimeout Error]:", error.message);
        throw error;
    }
}

// Extracts JSON from Gemini's response (for structured endpoints)
function extractJSON(text: string): string {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
    return text.trim();
}

// Plain text call for System Chat (no JSON parsing needed)
async function callGeminiPlainText(prompt: string): Promise<string> {
    try {
        const text = await callGeminiWithTimeout(prompt);
        // Clean up any markdown fences
        return text.replace(/```[\s\S]*?```/g, "").trim();
    } catch (error: any) {
        console.error("[Gemini Plain Text Error]:", error.message);
        throw error;
    }
}

// JSON call for structured endpoints (reports, motivation, weaknesses)
async function callGeminiJSON(prompt: string): Promise<string> {
    try {
        const text = await callGeminiWithTimeout(prompt);
        return extractJSON(text);
    } catch (error: any) {
        console.error("[Gemini JSON Error]:", error.message);
        throw error;
    }
}

export async function generateWeeklyReport(userId: string, weekData: unknown) {
    if (!checkRateLimit(userId)) {
        throw new Error("SYSTEM NOTICE: Communication limit reached today. Resume tomorrow.");
    }
    const prompt = weeklyReportPrompt(JSON.stringify(weekData, null, 2));
    const response = await callGeminiJSON(prompt);
    return JSON.parse(response);
}

export async function generateMotivation(userId: string, playerData: unknown) {
    if (!checkRateLimit(userId)) {
        throw new Error("SYSTEM NOTICE: Communication limit reached today. Resume tomorrow.");
    }
    const prompt = motivationPrompt(JSON.stringify(playerData, null, 2));
    const response = await callGeminiJSON(prompt);
    return JSON.parse(response);
}

export async function analyzeWeaknesses(userId: string, habitData: unknown) {
    if (!checkRateLimit(userId)) {
        throw new Error("SYSTEM NOTICE: Communication limit reached today. Resume tomorrow.");
    }
    const prompt = weaknessAnalysisPrompt(JSON.stringify(habitData, null, 2));
    const response = await callGeminiJSON(prompt);
    return JSON.parse(response);
}

// System Chat — returns PLAIN TEXT reply (no JSON parsing risk)
export async function generateSystemResponse(userId: string, userData: unknown, messageHistory: unknown[], userMessage: string) {
    if (!checkRateLimit(userId)) {
        return {
            reply: "⚠ SYSTEM NOTICE\n\nCommunication limit reached for today.\nResume your training tomorrow, Hunter.",
            issuePenalty: false,
            penaltyReason: null,
            penaltyQuestTitle: null,
            penaltyXPDeduction: 0
        };
    }

    const prompt = systemChatPrompt(
        JSON.stringify(userData, null, 2),
        JSON.stringify(messageHistory.slice(-5), null, 2),
        userMessage
    );

    try {
        const responseText = await callGeminiPlainText(prompt);

        // Fallback: if AI returns empty
        if (!responseText || responseText.trim().length === 0) {
            return {
                reply: "⚠ SYSTEM NOTICE\n\nHunter, communication with the system failed.\nRetry your request.",
                issuePenalty: false,
                penaltyReason: null,
                penaltyQuestTitle: null,
                penaltyXPDeduction: 0
            };
        }

        return {
            reply: responseText,
            issuePenalty: false,
            penaltyReason: null,
            penaltyQuestTitle: null,
            penaltyXPDeduction: 0
        };
    } catch (error: any) {
        console.error("[generateSystemResponse Error]:", error.message);

        // Timeout or crash fallback
        const fallbackMsg = error.message?.includes("AI_TIMEOUT")
            ? "⚠ SYSTEM NOTICE\n\nConnection interrupted.\nThe System took too long to respond.\nRetry your command, Hunter."
            : "⚠ SYSTEM NOTICE\n\nSystem malfunction detected.\nRetry your request.";

        return {
            reply: fallbackMsg,
            issuePenalty: false,
            penaltyReason: null,
            penaltyQuestTitle: null,
            penaltyXPDeduction: 0
        };
    }
}

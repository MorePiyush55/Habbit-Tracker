import { GoogleGenerativeAI } from "@google/generative-ai";
import { weeklyReportPrompt, motivationPrompt, weaknessAnalysisPrompt, systemChatPrompt } from "./prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Simple in-memory rate limiter (per-process)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_CALLS_PER_DAY = 10;

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

async function callGemini(prompt: string): Promise<string> {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Strip markdown code fences if present
    return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

export async function generateWeeklyReport(userId: string, weekData: unknown) {
    if (!checkRateLimit(userId)) {
        throw new Error("AI rate limit exceeded. Maximum 10 calls per day.");
    }
    const prompt = weeklyReportPrompt(JSON.stringify(weekData, null, 2));
    const response = await callGemini(prompt);
    return JSON.parse(response);
}

export async function generateMotivation(userId: string, playerData: unknown) {
    if (!checkRateLimit(userId)) {
        throw new Error("AI rate limit exceeded. Maximum 10 calls per day.");
    }
    const prompt = motivationPrompt(JSON.stringify(playerData, null, 2));
    const response = await callGemini(prompt);
    return JSON.parse(response);
}

export async function analyzeWeaknesses(userId: string, habitData: unknown) {
    if (!checkRateLimit(userId)) {
        throw new Error("AI rate limit exceeded. Maximum 10 calls per day.");
    }
    const prompt = weaknessAnalysisPrompt(JSON.stringify(habitData, null, 2));
    const response = await callGemini(prompt);
    return JSON.parse(response);
}

export async function generateSystemResponse(userId: string, userData: unknown, messageHistory: unknown[], userMessage: string) {
    if (!checkRateLimit(userId)) {
        throw new Error("AI rate limit exceeded. Maximum 10 calls per day.");
    }
    const prompt = systemChatPrompt(
        JSON.stringify(userData, null, 2),
        JSON.stringify(messageHistory.slice(-5), null, 2), // Send last 5 messages for context
        userMessage
    );
    const response = await callGemini(prompt);
    return JSON.parse(response);
}

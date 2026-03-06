import connectDB from "@/lib/mongodb";
import SystemEvent from "@/models/SystemEvent";
import User from "@/models/User";
import DailyProgress from "@/models/DailyProgress";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { systemEventPrompt } from "@/lib/ai/eventPrompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const AI_TIMEOUT_MS = 10000;

// Generates a short AI message for the event
async function generateEventMessage(eventType: string, context: string): Promise<string> {
    const prompt = systemEventPrompt(eventType, context);

    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Event AI Timeout")), AI_TIMEOUT_MS)
    );

    try {
        const result = await Promise.race([
            model.generateContent(prompt),
            timeout
        ]);
        const text = (result as any).response.text();
        return text.replace(/```[\s\S]*?```/g, "").trim();
    } catch (error: any) {
        console.error("[Event Engine] AI generation failed:", error.message);
        // Fallback: use a static message
        return getStaticFallback(eventType);
    }
}

function getStaticFallback(eventType: string): string {
    const fallbacks: Record<string, string> = {
        TASK_FAILED: "[WARNING] Hunter, you have failed a quest today. Explain yourself.",
        STREAK_BROKEN: "[ALERT] Your streak has been broken. Discipline is declining. The System is watching.",
        GOAL_COMPLETED: "[NOTICE] Quest completed. Acknowledged. Do not rest — more challenges await.",
        WEAK_PROGRESS: "[WARNING] Progress below acceptable threshold. Increase your output immediately.",
        BOSS_DEFEATED: "[COMMENDATION] The Discipline Titan has fallen. But the next one will be stronger.",
        LEVEL_UP: "[NOTICE] Power level increased. New expectations have been set. Do not disappoint.",
        ALL_TASKS_DONE: "[COMMENDATION] All quests completed. Adequate. Maintain this standard tomorrow."
    };
    return fallbacks[eventType] || "[NOTICE] System event detected.";
}

// Check if an event was already triggered today for this user and type
async function wasEventTriggeredToday(userId: string, eventType: string, date: string): Promise<boolean> {
    const existing = await SystemEvent.findOne({ userId, eventType, date });
    return !!existing;
}

// Core engine: detect and fire events
export async function checkAndFireEvents(
    userId: string,
    date: string,
    context: {
        completionRate: number;
        bossDefeated: boolean;
        xpDelta: number;
        totalXP: number;
        previousStreak: number;
        currentStreak: number;
        previousLevel: number;
        currentLevel: number;
        questsCompleted: number;
        totalQuests: number;
    }
) {
    await connectDB();
    const firedEvents: { eventType: string; message: string }[] = [];

    // 1. ALL_TASKS_DONE — 100% completion rate
    if (context.completionRate === 100) {
        if (!(await wasEventTriggeredToday(userId, "ALL_TASKS_DONE", date))) {
            const msg = await generateEventMessage("ALL_TASKS_DONE",
                `Completion Rate: 100%. Quests: ${context.questsCompleted}/${context.totalQuests}. XP: ${context.totalXP}.`);
            await SystemEvent.create({ userId, eventType: "ALL_TASKS_DONE", message: msg, date });
            firedEvents.push({ eventType: "ALL_TASKS_DONE", message: msg });
        }
    }

    // 2. WEAK_PROGRESS — below 50% with at least some activity
    if (context.completionRate > 0 && context.completionRate < 50 && context.questsCompleted >= 1) {
        if (!(await wasEventTriggeredToday(userId, "WEAK_PROGRESS", date))) {
            const msg = await generateEventMessage("WEAK_PROGRESS",
                `Completion Rate: ${context.completionRate}%. Only ${context.questsCompleted}/${context.totalQuests} quests touched.`);
            await SystemEvent.create({ userId, eventType: "WEAK_PROGRESS", message: msg, date });
            firedEvents.push({ eventType: "WEAK_PROGRESS", message: msg });
        }
    }

    // 3. BOSS_DEFEATED
    if (context.bossDefeated) {
        if (!(await wasEventTriggeredToday(userId, "BOSS_DEFEATED", date))) {
            const msg = await generateEventMessage("BOSS_DEFEATED",
                `Boss HP drained to 0. Streak: ${context.currentStreak} days. Total XP: ${context.totalXP}.`);
            await SystemEvent.create({ userId, eventType: "BOSS_DEFEATED", message: msg, date });
            firedEvents.push({ eventType: "BOSS_DEFEATED", message: msg });
        }
    }

    // 4. LEVEL_UP
    if (context.currentLevel > context.previousLevel) {
        if (!(await wasEventTriggeredToday(userId, "LEVEL_UP", date))) {
            const msg = await generateEventMessage("LEVEL_UP",
                `Level ${context.previousLevel} → Level ${context.currentLevel}. Total XP: ${context.totalXP}.`);
            await SystemEvent.create({ userId, eventType: "LEVEL_UP", message: msg, date });
            firedEvents.push({ eventType: "LEVEL_UP", message: msg });
        }
    }

    // 5. STREAK_BROKEN (when streak resets to 0 from a positive value)
    if (context.currentStreak === 0 && context.previousStreak > 0) {
        if (!(await wasEventTriggeredToday(userId, "STREAK_BROKEN", date))) {
            const msg = await generateEventMessage("STREAK_BROKEN",
                `Previous streak: ${context.previousStreak} days. Now: 0. The chain is broken.`);
            await SystemEvent.create({ userId, eventType: "STREAK_BROKEN", message: msg, date });
            firedEvents.push({ eventType: "STREAK_BROKEN", message: msg });
        }
    }

    // 6. GOAL_COMPLETED — triggered when any quest hits 100% for the first time
    if (context.completionRate < 100 && context.questsCompleted > 0) {
        // We track this at the quest level — "individual quest completed" 
        // This is handled by checking if xpDelta indicates a full quest was just finished
        // (Simplified: fires when individual habits reach 100% — more granular event detection needed)
    }

    return firedEvents;
}

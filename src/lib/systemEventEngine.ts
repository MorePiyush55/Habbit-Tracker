import connectDB from "@/lib/mongodb";
import SystemEvent from "@/models/SystemEvent";
import User from "@/models/User";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { systemEventPrompt } from "@/lib/ai/eventPrompts";
import { evaluateRules, RuleResult } from "@/lib/system/ruleEngine";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const AI_TIMEOUT_MS = 10000;

// Only called when a rule flags requiresAI = true
async function generateAIMessage(eventType: string, context: string): Promise<string> {
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
        console.error("[Event Engine] AI generation failed, using rule message:", error.message);
        return ""; // Empty = use the rule's static message instead
    }
}

// Check if an event was already triggered today for this user and type
async function wasEventTriggeredToday(userId: string, eventType: string, date: string): Promise<boolean> {
    const existing = await SystemEvent.findOne({ userId, eventType, date });
    return !!existing;
}

// ============================================================
// HYBRID ENGINE: Rules first, Gemini only when needed
// ============================================================
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

    // Get user data for full rule context
    const user = await User.findById(userId).lean();

    // === STEP 1: Run Rule Engine (instant, zero AI cost) ===
    const ruleResults = evaluateRules({
        completionRate: context.completionRate,
        tasksCompleted: context.questsCompleted,
        tasksFailed: context.totalQuests - context.questsCompleted,
        totalTasks: context.totalQuests,
        currentStreak: context.currentStreak,
        previousStreak: context.previousStreak,
        longestStreak: user?.longestStreak || 0,
        xpEarned: context.xpDelta,
        totalXP: context.totalXP,
        xpDelta: context.xpDelta,
        currentLevel: context.currentLevel,
        previousLevel: context.previousLevel,
        bossDefeated: context.bossDefeated,
        weeklyBossHP: user?.weeklyBossHP || 500,
        disciplineScore: user?.disciplineScore || 50,
        focusScore: user?.focusScore || 50,
        consecutiveMissedDays: 0,
        habitMissedDays: {}
    });

    console.log(`[Event Engine] Rule Engine produced ${ruleResults.length} events (${ruleResults.filter(r => r.requiresAI).length} need AI)`);

    // === STEP 2: Process each rule result ===
    for (const rule of ruleResults) {
        // Skip if already triggered today
        if (await wasEventTriggeredToday(userId, rule.eventType, date)) {
            continue;
        }

        let finalMessage = rule.message;

        // === STEP 3: Only call Gemini if the rule flags requiresAI ===
        if (rule.requiresAI && rule.aiContext) {
            const aiMessage = await generateAIMessage(rule.eventType, rule.aiContext);
            if (aiMessage) {
                finalMessage = aiMessage; // Use AI-generated message
            }
            // If AI fails, the rule's static message is used (fallback built-in)
        }

        // Save the event
        await SystemEvent.create({
            userId,
            eventType: rule.eventType,
            message: finalMessage,
            date
        });

        firedEvents.push({ eventType: rule.eventType, message: finalMessage });
    }

    return firedEvents;
}

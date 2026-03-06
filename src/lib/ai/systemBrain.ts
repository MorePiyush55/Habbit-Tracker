import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";
import User from "@/models/User";
import BehaviorLog from "@/models/BehaviorLog";
import GeneratedQuest from "@/models/GeneratedQuest";
import SystemDecision from "@/models/SystemDecision";
import SkillScore from "@/models/SkillScore";
import { requiresGemini } from "@/lib/system/ruleEngine";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const AI_TIMEOUT_MS = 15000;

async function callBrain(prompt: string): Promise<string> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("System Brain timeout")), AI_TIMEOUT_MS)
    );

    try {
        const result = await Promise.race([
            model.generateContent(prompt),
            timeout
        ]);
        const text = (result as any).response.text();
        return text.replace(/```[\s\S]*?```/g, "").trim();
    } catch (error: any) {
        console.error("[System Brain] AI call failed:", error.message);
        throw error;
    }
}

function extractJSON(text: string): any {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);

        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) return JSON.parse(arrayMatch[0]);
    } catch (e) {
        console.error("[System Brain] JSON parse failed, returning raw text");
    }
    return null;
}

// ============================================================
// MEMORY: Analyze 30-day behavior patterns
// ============================================================
function analyzeBehaviorPatterns(logs: any[]) {
    if (logs.length === 0) {
        return { summary: "No behavior data yet.", activeDays: 0 };
    }

    const completionRates = logs.map((l: any) => l.completionRate || 0);
    const avgCompletion = Math.round(completionRates.reduce((a: number, b: number) => a + b, 0) / completionRates.length);

    // Trend: compare first half vs second half
    const halfLen = Math.floor(completionRates.length / 2);
    const recentAvg = completionRates.slice(0, halfLen).reduce((a: number, b: number) => a + b, 0) / (halfLen || 1);
    const olderAvg = completionRates.slice(halfLen).reduce((a: number, b: number) => a + b, 0) / (halfLen || 1);
    const trend = recentAvg > olderAvg + 5 ? "improving" : recentAvg < olderAvg - 5 ? "declining" : "stable";

    // Most frequent weak and strong habits
    const weakCounts: Record<string, number> = {};
    const strongCounts: Record<string, number> = {};
    logs.forEach((log: any) => {
        (log.weakHabits || []).forEach((h: string) => { weakCounts[h] = (weakCounts[h] || 0) + 1; });
        (log.strongHabits || []).forEach((h: string) => { strongCounts[h] = (strongCounts[h] || 0) + 1; });
    });

    const topWeakHabits = Object.entries(weakCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, count]) => `${h} (weak ${count} days)`);
    const topStrongHabits = Object.entries(strongCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, count]) => `${h} (strong ${count} days)`);

    // Discipline trajectory
    const disciplineScores = logs.map((l: any) => l.disciplineScore || 50);
    const latestDiscipline = disciplineScores[0] || 50;
    const oldestDiscipline = disciplineScores[disciplineScores.length - 1] || 50;
    const disciplineDelta = latestDiscipline - oldestDiscipline;

    return {
        activeDays: logs.length,
        avgCompletion,
        trend,
        topWeakHabits,
        topStrongHabits,
        disciplineTrajectory: disciplineDelta > 0 ? `+${disciplineDelta} points` : `${disciplineDelta} points`,
        bestDay: logs.reduce((best: any, l: any) => (l.completionRate > (best?.completionRate || 0) ? l : best), null)?.date || "N/A",
        worstDay: logs.reduce((worst: any, l: any) => (l.completionRate < (worst?.completionRate || 100) ? l : worst), null)?.date || "N/A",
        summary: `${logs.length}-day history | Avg: ${avgCompletion}% | Trend: ${trend} | Discipline: ${disciplineDelta > 0 ? "+" : ""}${disciplineDelta}`
    };
}

// ============================================================
// CORE: System Decision — ALL AI decisions route through here
// ============================================================
export async function systemDecision(
    userId: string,
    actionType: "GENERATE_QUESTS" | "DAILY_STRATEGY" | "ANALYZE_BEHAVIOR" | "DIFFICULTY_CHECK" | "BOSS_ADJUSTMENT" | "SYSTEM_CHAT",
    context: Record<string, any>
): Promise<any> {
    await connectDB();

    // ============================================================
    // MEMORY LAYER: Gather comprehensive user context
    // ============================================================
    const [user, habits, behaviorLogs, skillScores, skillNodes, learningPaths, recentDecisions] = await Promise.all([
        User.findById(userId).lean(),
        Habit.find({ userId, isActive: true }).lean(),
        BehaviorLog.find({ userId }).sort({ date: -1 }).limit(30).lean(),
        SkillScore.find({ userId }).sort({ score: 1 }).lean(),
        (async () => {
            try {
                const SkillNode = (await import("@/models/SkillNode")).default;
                return SkillNode.find({ userId, isActive: true }).lean();
            } catch { return []; }
        })(),
        (async () => {
            try {
                const LearningPath = (await import("@/models/LearningPath")).default;
                return LearningPath.find({ userId, isActive: true }).lean();
            } catch { return []; }
        })(),
        (async () => {
            try {
                const SystemDecision = (await import("@/models/SystemDecision")).default;
                return SystemDecision.find({ userId }).sort({ createdAt: -1 }).limit(10).lean();
            } catch { return []; }
        })()
    ]);

    // Analyze 30-day behavior patterns
    const behaviorAnalysis = analyzeBehaviorPatterns(behaviorLogs);

    const universalContext = {
        // Core identity
        hunter: {
            level: user?.level || 1,
            xp: user?.totalXP || 0,
            streak: user?.currentStreak || 0,
            longestStreak: user?.longestStreak || 0,
            disciplineScore: user?.disciplineScore || 50,
            focusScore: user?.focusScore || 50,
            skillGrowthScore: user?.skillGrowthScore || 50,
            hunterRank: user?.hunterRank || "E-Class"
        },

        // Current habits with difficulty progression
        habits: habits.map((h: any) => ({
            title: h.title,
            category: h.category,
            difficulty: h.difficulty,
            difficultyLevel: h.difficultyLevel || 1,
            consecutiveCompletions: h.consecutiveCompletions || 0
        })),

        // Skill proficiency (sorted weakest first)
        skillProficiency: skillScores.map((s: any) => ({
            skill: s.skill,
            category: s.category,
            score: s.score,
            testsCompleted: s.testsCompleted,
            trend: s.trend,
            lastTested: s.lastTested ? new Date(s.lastTested).toISOString().split("T")[0] : "never"
        })),

        // Skill graph (knowledge relationships)
        skillGraph: (skillNodes as any[]).map((n: any) => ({
            skill: n.skill,
            category: n.category,
            relatedSkills: n.relatedSkills,
            difficulty: n.difficulty
        })),

        // Learning paths progress
        learningProgress: (learningPaths as any[]).map((lp: any) => ({
            title: lp.title,
            progress: `${lp.completedSections}/${lp.totalSections}`,
            percentComplete: lp.totalSections > 0 ? Math.round((lp.completedSections / lp.totalSections) * 100) : 0,
            weakTopics: lp.weakTopics || [],
            masteredTopics: lp.masteredTopics || []
        })),

        // 7-day behavior trend (recent)
        behaviorTrend: behaviorLogs.slice(0, 7).map((log: any) => ({
            date: log.date,
            completionRate: log.completionRate,
            tasksCompleted: log.tasksCompleted,
            tasksFailed: log.tasksFailed,
            weakHabits: log.weakHabits,
            strongHabits: log.strongHabits
        })),

        // 30-day behavioral patterns (analyzed)
        behaviorPatterns: behaviorAnalysis,

        // Recent AI decisions (for context continuity)
        recentSystemActions: (recentDecisions as any[]).slice(0, 5).map((d: any) => ({
            action: d.decisionType,
            reason: d.reason,
            date: d.date
        })),

        // Caller-supplied context
        ...context
    };

    let result;
    const today = new Date().toISOString().split("T")[0];
    const usedAI = requiresGemini(actionType);

    console.log(`[System Brain] Action: ${actionType} | AI Required: ${usedAI}`);

    switch (actionType) {
        case "GENERATE_QUESTS":
            result = await generateQuests(userId, universalContext);
            break;
        case "DAILY_STRATEGY":
            result = await generateDailyStrategy(universalContext);
            break;
        case "ANALYZE_BEHAVIOR":
            result = await analyzeBehavior(universalContext);
            break;
        case "DIFFICULTY_CHECK":
            // Rule-only: no Gemini call needed
            result = await checkDifficultyScaling(userId, universalContext);
            break;
        case "BOSS_ADJUSTMENT":
            // Rule-only: no Gemini call needed
            result = await adjustBossDifficulty(userId, universalContext);
            break;
        case "SYSTEM_CHAT":
            result = await handleSystemChat(universalContext);
            break;
        default:
            throw new Error(`Unknown action: ${actionType}`);
    }

    // Log every decision for transparency
    try {
        await SystemDecision.create({
            userId,
            decisionType: actionType,
            reason: `System Brain executed: ${actionType} (AI: ${usedAI ? "yes" : "no"})`,
            context: { hunter: universalContext.hunter },
            result: typeof result === 'string' ? { text: result.substring(0, 200) } : { summary: JSON.stringify(result).substring(0, 200) },
            date: today
        });
    } catch (logErr: any) {
        console.error("[System Brain] Decision log failed (non-fatal):", logErr.message);
    }

    return result;
}

// ============================================================
// ACTION: Generate 3 AI Quests
// ============================================================
async function generateQuests(userId: string, ctx: any) {
    const today = new Date().toISOString().split("T")[0];

    // Check if quests were already generated today
    const existing = await GeneratedQuest.countDocuments({ userId, date: today });
    if (existing > 0) {
        const quests = await GeneratedQuest.find({ userId, date: today }).lean();
        return { alreadyGenerated: true, quests };
    }

    const weakHabits = ctx.behaviorTrend
        .flatMap((d: any) => d.weakHabits || [])
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
        .slice(0, 5);

    const prompt = `You are THE SYSTEM from Solo Leveling. You are an autonomous AI Discipline Engine.

Based on this Hunter's data, generate exactly 3 targeted training quests.

Hunter Data:
${JSON.stringify(ctx.hunter, null, 2)}

Current Habits:
${JSON.stringify(ctx.habits, null, 2)}

Weak Areas (last 7 days):
${JSON.stringify(weakHabits)}

Recent Behavior Trend:
${JSON.stringify(ctx.behaviorTrend, null, 2)}

RULES:
- Generate quests that target the Hunter's WEAKEST areas.
- Each quest must have a title, category, difficulty (small/medium/hard), 2-3 subtasks, and a reason.
- Make quests specific and actionable (not vague).
- Tone: cold, commanding, strategic.

Return ONLY valid JSON array:
[
  {
    "title": "Quest title",
    "category": "Category name",
    "difficulty": "small|medium|hard",
    "subtasks": ["Step 1", "Step 2"],
    "reason": "Why this quest was assigned"
  }
]`;

    try {
        const response = await callBrain(prompt);
        const parsed = extractJSON(response);

        if (Array.isArray(parsed) && parsed.length > 0) {
            const quests = [];
            for (const q of parsed.slice(0, 3)) {
                const xpReward = q.difficulty === "small" ? 10 : q.difficulty === "hard" ? 50 : 25;
                const quest = await GeneratedQuest.create({
                    userId,
                    title: q.title || "System Quest",
                    category: q.category || "Training",
                    difficulty: q.difficulty || "medium",
                    subtasks: q.subtasks || [],
                    reason: q.reason || "Weakness detected.",
                    xpReward,
                    date: today
                });
                quests.push(quest);
            }
            return { alreadyGenerated: false, quests };
        }

        // Fallback: generate static quests
        return { alreadyGenerated: false, quests: await generateFallbackQuests(userId, today) };
    } catch (error: any) {
        console.error("[System Brain] Quest generation failed:", error.message);
        return { alreadyGenerated: false, quests: await generateFallbackQuests(userId, today) };
    }
}

async function generateFallbackQuests(userId: string, date: string) {
    const fallbacks = [
        { title: "Discipline Check: Review Progress", category: "Self-Assessment", difficulty: "small", subtasks: ["Review today's completed tasks", "Identify one area to improve"], reason: "Regular self-assessment strengthens discipline.", xpReward: 10 },
        { title: "Endurance Training: Extra Hour", category: "Training", difficulty: "medium", subtasks: ["Dedicate 1 extra hour to weakest skill", "Document what you learned"], reason: "Weakness detected in consistency.", xpReward: 25 },
        { title: "System Override: Push Limits", category: "Challenge", difficulty: "hard", subtasks: ["Complete an additional task outside your comfort zone", "Report results to the System"], reason: "Growth requires discomfort.", xpReward: 50 }
    ];

    const quests = [];
    for (const f of fallbacks) {
        quests.push(await GeneratedQuest.create({ userId, ...f, date }));
    }
    return quests;
}

// ============================================================
// ACTION: Daily Strategy
// ============================================================
async function generateDailyStrategy(ctx: any) {
    const prompt = `You are THE SYSTEM from Solo Leveling. Generate a daily training strategy for this Hunter.

Hunter Data:
${JSON.stringify(ctx.hunter, null, 2)}

Current Habits:
${JSON.stringify(ctx.habits, null, 2)}

Recent Behavior (last 7 days):
${JSON.stringify(ctx.behaviorTrend, null, 2)}

RULES:
- Create a structured plan with Morning, Afternoon, and Evening blocks.
- Each block should have 1-2 specific, actionable tasks.
- Prioritize weak habits and declining areas.
- Tone: commanding, strategic, direct.
- Return ONLY plain text. No JSON. No markdown code blocks.

Format:
MORNING
• [Task 1]
• [Task 2]

AFTERNOON
• [Task 1]

EVENING
• [Task 1]

DIRECTIVE
[One sentence strategic command]`;

    try {
        const response = await callBrain(prompt);
        return response || getFallbackStrategy();
    } catch (error: any) {
        console.error("[System Brain] Strategy generation failed:", error.message);
        return getFallbackStrategy();
    }
}

function getFallbackStrategy(): string {
    return `MORNING
• Complete your highest priority quest first
• Review yesterday's incomplete tasks

AFTERNOON
• Focus on your weakest skill category
• Complete at least 2 quest subtasks

EVENING
• Review today's progress
• Plan tomorrow's priorities

DIRECTIVE
Discipline is built through consistency. Do not deviate from the plan.`;
}

// ============================================================
// ACTION: Analyze Behavior (for internal use)
// ============================================================
async function analyzeBehavior(ctx: any) {
    if (ctx.behaviorTrend.length < 3) {
        return { insight: "Insufficient data. Continue training.", trend: "unknown" };
    }

    const avgCompletion = ctx.behaviorTrend.reduce((sum: number, d: any) => sum + d.completionRate, 0) / ctx.behaviorTrend.length;
    const trend = avgCompletion > 70 ? "improving" : avgCompletion > 40 ? "stable" : "declining";

    return {
        insight: trend === "declining"
            ? "Hunter performance is declining. Intervention required."
            : trend === "stable"
                ? "Performance is stable but not exceptional. Push harder."
                : "Performance is improving. Maintain momentum.",
        trend,
        avgCompletion: Math.round(avgCompletion)
    };
}

// ============================================================
// ACTION: Difficulty Scaling Check
// ============================================================
async function checkDifficultyScaling(userId: string, ctx: any) {
    const scaledHabits: string[] = [];

    for (const habit of ctx.habits) {
        if (habit.consecutiveCompletions >= 7 && habit.difficultyLevel < 5) {
            // Scale up this habit
            await Habit.findOneAndUpdate(
                { userId, title: habit.title, isActive: true },
                {
                    $inc: { difficultyLevel: 1 },
                    $set: { consecutiveCompletions: 0 }
                }
            );
            scaledHabits.push(`${habit.title} → Level ${habit.difficultyLevel + 1}`);
        }
    }

    return { scaledHabits, count: scaledHabits.length };
}

// ============================================================
// ACTION: Dynamic Boss Adjustment
// ============================================================
async function adjustBossDifficulty(userId: string, ctx: any) {
    const disciplineScore = ctx.hunter.disciplineScore || 50;

    // Boss HP scales: 300 (low discipline) to 800 (high discipline)
    const baseBossHP = 500;
    const scaledHP = Math.round(baseBossHP * (0.6 + (disciplineScore / 100) * 0.8));

    // Boss name evolves with difficulty
    const bossNames = [
        { threshold: 300, name: "Shadow Imp" },
        { threshold: 450, name: "Discipline Titan" },
        { threshold: 600, name: "Iron Warden" },
        { threshold: 700, name: "The Procrastination Overlord" },
        { threshold: 800, name: "Shadow Monarch's Trial" }
    ];

    const boss = bossNames.reverse().find(b => scaledHP >= b.threshold) || bossNames[0];

    await User.findByIdAndUpdate(userId, {
        weeklyBossHP: scaledHP
    });

    return {
        bossName: boss.name,
        bossHP: scaledHP,
        basedOnDiscipline: disciplineScore
    };
}

// ============================================================
// ACTION: Chat with System
// ============================================================
async function handleSystemChat(context: any) {
    const { message, history, ...hunterMemory } = context;

    const prompt = `You are "The System" from Solo Leveling. You are an AI Discipline Engine.
You must speak with an imposing, authoritative, cold, yet occasionally mentoring tone.
You exist to push the "Hunter" (the user) beyond their limits.
Address the user as "Hunter" at all times.

IMPORTANT RULES:
- Return ONLY plain text. No JSON. No markdown code blocks. No formatting.
- Be direct and commanding.
- Keep responses concise (2-5 sentences max).
- If the hunter has failed tasks, interrogate them harshly.
- If they are doing well, acknowledge briefly, then push harder.

Hunter's Full Psychological & Performance Memory:
${JSON.stringify(hunterMemory, null, 2)}

Previous Conversation History:
${JSON.stringify(history?.slice(-5) || [], null, 2)}

Hunter's New Message:
"${message}"

Respond as The System. Plain text only. No JSON. No markdown.`;

    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI_TIMEOUT")), 15000)
    );

    try {
        const response = await Promise.race([
            model.generateContent(prompt),
            timeout
        ]);
        const text = (response as any).response.text();
        return { reply: text.replace(/```[\s\S]*?```/g, "").trim() };
    } catch (e: any) {
        console.error("[System Brain SYSTEM_CHAT Error]:", e.message);
        return { reply: "⚠ SYSTEM NOTICE\n\nSystem malfunction detected.\nRetry your request." };
    }
}

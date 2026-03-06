/**
 * System Memory — Persistent Intelligence Layer
 * ================================================
 * Stores summarized knowledge so the brain doesn't rebuild everything every time.
 * Maintains weekly insights, last strategy, intervention history, metrics.
 *
 * Benefits:
 *   - Fewer AI calls (cached knowledge)
 *   - Smarter continuity (AI remembers decisions across days)
 *   - Faster state building (pre-computed summaries)
 */

import connectDB from "@/lib/mongodb";
import SystemMemory from "@/models/SystemMemory";
import type { SystemState } from "@/types";
import type { BehaviorInsight } from "./behaviorAnalyzer";
import { analyzeBehavior } from "./behaviorAnalyzer";

// ============================================================
// Types
// ============================================================

export interface MemorySnapshot {
    weeklyInsights: {
        weakestHabit: string | null;
        strongestHabit: string | null;
        disciplineTrend: string;
        avgCompletion: number;
        consistencyScore: number;
        streakHealth: "strong" | "fragile" | "broken";
        topInterventions: string[];
        generatedAt: string | null;
    };
    lastStrategy: {
        text: string;
        date: string;
        usedAI: boolean;
    };
    lastIntervention: {
        type: string;
        reason: string;
        date: string;
        escalationLevel: number;
    };
    personalityCalibration: {
        responseStyle: "cold" | "balanced" | "encouraging";
        interventionFrequency: "aggressive" | "moderate" | "passive";
    };
    recentDecisionsSummary: {
        decision: string;
        confidence: number;
        reason: string;
        date: string;
    }[];
    skillGraphSnapshot: {
        categories: {
            name: string;
            skills: { skill: string; score: number; trend: string }[];
        }[];
        lastUpdated: string | null;
    };
    metrics: {
        totalAICalls: number;
        totalDirectivesExecuted: number;
        totalEventsProcessed: number;
        aiErrorCount: number;
        lastActivityDate: string;
        sessionCount: number;
    };
}

// ============================================================
// RECALL: Load full memory for a user
// ============================================================

export async function recallMemory(userId: string): Promise<MemorySnapshot> {
    await connectDB();

    const memory = await SystemMemory.findOne({ userId }).lean() as any;

    if (!memory) {
        return getEmptyMemory();
    }

    return {
        weeklyInsights: {
            weakestHabit: memory.weeklyInsights?.weakestHabit || null,
            strongestHabit: memory.weeklyInsights?.strongestHabit || null,
            disciplineTrend: memory.weeklyInsights?.disciplineTrend || "0%",
            avgCompletion: memory.weeklyInsights?.avgCompletion || 0,
            consistencyScore: memory.weeklyInsights?.consistencyScore || 0,
            streakHealth: memory.weeklyInsights?.streakHealth || "broken",
            topInterventions: memory.weeklyInsights?.topInterventions || [],
            generatedAt: memory.weeklyInsights?.generatedAt?.toISOString?.() || null,
        },
        lastStrategy: {
            text: memory.lastStrategy?.text || "",
            date: memory.lastStrategy?.date || "",
            usedAI: memory.lastStrategy?.usedAI || false,
        },
        lastIntervention: {
            type: memory.lastIntervention?.type || "",
            reason: memory.lastIntervention?.reason || "",
            date: memory.lastIntervention?.date || "",
            escalationLevel: memory.lastIntervention?.escalationLevel || 0,
        },
        personalityCalibration: {
            responseStyle: memory.personalityCalibration?.responseStyle || "cold",
            interventionFrequency: memory.personalityCalibration?.interventionFrequency || "moderate",
        },
        recentDecisionsSummary: (memory.recentDecisionsSummary || []).map((d: any) => ({
            decision: d.decision || "",
            confidence: d.confidence || 0,
            reason: d.reason || "",
            date: d.date || "",
        })),
        skillGraphSnapshot: {
            categories: (memory.skillGraphSnapshot?.categories || []).map((c: any) => ({
                name: c.name,
                skills: (c.skills || []).map((s: any) => ({
                    skill: s.skill,
                    score: s.score,
                    trend: s.trend,
                })),
            })),
            lastUpdated: memory.skillGraphSnapshot?.lastUpdated?.toISOString?.() || null,
        },
        metrics: {
            totalAICalls: memory.metrics?.totalAICalls || 0,
            totalDirectivesExecuted: memory.metrics?.totalDirectivesExecuted || 0,
            totalEventsProcessed: memory.metrics?.totalEventsProcessed || 0,
            aiErrorCount: memory.metrics?.aiErrorCount || 0,
            lastActivityDate: memory.metrics?.lastActivityDate || "",
            sessionCount: memory.metrics?.sessionCount || 0,
        },
    };
}

// ============================================================
// REMEMBER: Store a decision in memory
// ============================================================

export async function rememberDecision(
    userId: string,
    decision: string,
    confidence: number,
    reason: string
): Promise<void> {
    await connectDB();

    const today = new Date().toISOString().split("T")[0];

    await SystemMemory.findOneAndUpdate(
        { userId },
        {
            $push: {
                recentDecisionsSummary: {
                    $each: [{ decision, confidence, reason, date: today }],
                    $slice: -50, // keep last 50
                },
            },
            $inc: {
                "metrics.totalEventsProcessed": 1,
            },
            $set: {
                "metrics.lastActivityDate": today,
            },
        },
        { upsert: true }
    );
}

// ============================================================
// UPDATE WEEKLY INSIGHTS: Refresh from behavior analysis
// ============================================================

export async function refreshWeeklyInsights(userId: string): Promise<void> {
    await connectDB();

    const insight: BehaviorInsight = await analyzeBehavior(userId, 30);
    const today = new Date().toISOString().split("T")[0];

    await SystemMemory.findOneAndUpdate(
        { userId },
        {
            $set: {
                weeklyInsights: {
                    weakestHabit: insight.weakestHabit,
                    strongestHabit: insight.strongestHabit,
                    disciplineTrend: insight.disciplineTrend === "improving" ? "+" : insight.disciplineTrend === "declining" ? "-" : "=",
                    avgCompletion: insight.completionRate,
                    consistencyScore: insight.consistencyScore,
                    streakHealth: insight.currentStreakHealth,
                    topInterventions: insight.interventions.slice(0, 5),
                    generatedAt: new Date(),
                },
                "metrics.lastActivityDate": today,
            },
        },
        { upsert: true }
    );
}

// ============================================================
// STORE STRATEGY: Cache daily strategy
// ============================================================

export async function storeStrategy(
    userId: string,
    strategyText: string,
    usedAI: boolean
): Promise<void> {
    await connectDB();
    const today = new Date().toISOString().split("T")[0];

    await SystemMemory.findOneAndUpdate(
        { userId },
        {
            $set: {
                "lastStrategy.text": strategyText,
                "lastStrategy.date": today,
                "lastStrategy.usedAI": usedAI,
            },
        },
        { upsert: true }
    );
}

// ============================================================
// STORE INTERVENTION: Remember the last system intervention
// ============================================================

export async function storeIntervention(
    userId: string,
    interventionType: string,
    reason: string,
    escalationLevel: number
): Promise<void> {
    await connectDB();
    const today = new Date().toISOString().split("T")[0];

    await SystemMemory.findOneAndUpdate(
        { userId },
        {
            $set: {
                "lastIntervention.type": interventionType,
                "lastIntervention.reason": reason,
                "lastIntervention.date": today,
                "lastIntervention.escalationLevel": escalationLevel,
            },
        },
        { upsert: true }
    );
}

// ============================================================
// UPDATE SKILL GRAPH SNAPSHOT
// ============================================================

export async function updateSkillGraph(
    userId: string,
    state: SystemState
): Promise<void> {
    await connectDB();

    // Group skills by category
    const categoryMap: Record<string, { skill: string; score: number; trend: string }[]> = {};
    for (const s of state.skillScores) {
        const cat = s.category || "General";
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push({ skill: s.skill, score: s.score, trend: s.trend });
    }

    const categories = Object.entries(categoryMap).map(([name, skills]) => ({ name, skills }));

    await SystemMemory.findOneAndUpdate(
        { userId },
        {
            $set: {
                "skillGraphSnapshot.categories": categories,
                "skillGraphSnapshot.lastUpdated": new Date(),
            },
        },
        { upsert: true }
    );
}

// ============================================================
// INCREMENT METRICS
// ============================================================

export async function incrementMetrics(
    userId: string,
    field: "totalAICalls" | "totalDirectivesExecuted" | "totalEventsProcessed" | "aiErrorCount" | "sessionCount",
    amount: number = 1
): Promise<void> {
    await connectDB();
    await SystemMemory.findOneAndUpdate(
        { userId },
        { $inc: { [`metrics.${field}`]: amount } },
        { upsert: true }
    );
}

// ============================================================
// SHOULD REFRESH WEEKLY: Check if insights are stale (>7 days)
// ============================================================

export function shouldRefreshWeekly(memory: MemorySnapshot): boolean {
    if (!memory.weeklyInsights.generatedAt) return true;
    const age = Date.now() - new Date(memory.weeklyInsights.generatedAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return age > sevenDays;
}

// ============================================================
// GET CACHED STRATEGY: Return today's strategy if cached
// ============================================================

export function getCachedStrategy(memory: MemorySnapshot): string | null {
    const today = new Date().toISOString().split("T")[0];
    if (memory.lastStrategy.date === today && memory.lastStrategy.text) {
        return memory.lastStrategy.text;
    }
    return null;
}

// ============================================================
// EMPTY MEMORY
// ============================================================

function getEmptyMemory(): MemorySnapshot {
    return {
        weeklyInsights: {
            weakestHabit: null,
            strongestHabit: null,
            disciplineTrend: "0%",
            avgCompletion: 0,
            consistencyScore: 0,
            streakHealth: "broken",
            topInterventions: [],
            generatedAt: null,
        },
        lastStrategy: { text: "", date: "", usedAI: false },
        lastIntervention: { type: "", reason: "", date: "", escalationLevel: 0 },
        personalityCalibration: { responseStyle: "cold", interventionFrequency: "moderate" },
        recentDecisionsSummary: [],
        skillGraphSnapshot: { categories: [], lastUpdated: null },
        metrics: {
            totalAICalls: 0,
            totalDirectivesExecuted: 0,
            totalEventsProcessed: 0,
            aiErrorCount: 0,
            lastActivityDate: "",
            sessionCount: 0,
        },
    };
}

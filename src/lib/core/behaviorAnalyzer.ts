/**
 * Behavior Analyzer — Deep Performance Analysis Engine
 * =====================================================
 * Analyzes 30 days of behavior data to produce insights.
 * Used by the Brain for coaching, difficulty adjustment, and interventions.
 */

import connectDB from "@/lib/mongodb";
import BehaviorLog from "@/models/BehaviorLog";
import type { SystemState } from "@/types";

export interface BehaviorInsight {
    // Overall metrics
    completionRate: number;
    disciplineTrend: "improving" | "stable" | "declining";
    consistencyScore: number;  // 0-100, how consistent are they day-to-day

    // Habit-level insights
    weakestHabit: string | null;
    strongestHabit: string | null;
    habitBreakdown: {
        habit: string;
        avgCompletion: number;
        daysWeak: number;
        daysStrong: number;
        trend: "improving" | "stable" | "declining";
    }[];

    // Time patterns
    bestDay: { date: string; completionRate: number } | null;
    worstDay: { date: string; completionRate: number } | null;
    weekdayPattern: Record<string, number>;  // e.g., "Monday": 85

    // Streak analysis
    currentStreakHealth: "strong" | "fragile" | "broken";
    streakRisk: number;  // 0-100, likelihood of breaking

    // Recommendations (deterministic, no AI)
    interventions: string[];
    summary: string;
}

export async function analyzeBehavior(
    userId: string,
    days: number = 30
): Promise<BehaviorInsight> {
    await connectDB();

    const logs = await BehaviorLog.find({ userId })
        .sort({ date: -1 })
        .limit(days)
        .lean() as any[];

    if (logs.length === 0) {
        return getEmptyInsight();
    }

    // Overall completion rate
    const completionRates = logs.map((l) => l.completionRate || 0);
    const avgCompletion = Math.round(
        completionRates.reduce((a, b) => a + b, 0) / completionRates.length
    );

    // Discipline trend
    const halfLen = Math.floor(completionRates.length / 2) || 1;
    const recentAvg = completionRates.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
    const olderAvg = completionRates.slice(halfLen).reduce((a, b) => a + b, 0) / (halfLen || 1);
    const disciplineTrend: "improving" | "stable" | "declining" =
        recentAvg > olderAvg + 5 ? "improving" : recentAvg < olderAvg - 5 ? "declining" : "stable";

    // Consistency score: standard deviation of completion rates
    const mean = avgCompletion;
    const variance = completionRates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / completionRates.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - stdDev)));

    // Habit-level breakdown
    const habitMap: Record<string, { weak: number; strong: number; total: number }> = {};
    logs.forEach((log) => {
        (log.weakHabits || []).forEach((h: string) => {
            if (!habitMap[h]) habitMap[h] = { weak: 0, strong: 0, total: 0 };
            habitMap[h].weak++;
            habitMap[h].total++;
        });
        (log.strongHabits || []).forEach((h: string) => {
            if (!habitMap[h]) habitMap[h] = { weak: 0, strong: 0, total: 0 };
            habitMap[h].strong++;
            habitMap[h].total++;
        });
    });

    const habitBreakdown = Object.entries(habitMap).map(([habit, data]) => {
        const avgComp = data.total > 0 ? Math.round((data.strong / data.total) * 100) : 50;
        const trend: "improving" | "stable" | "declining" =
            data.weak > data.strong ? "declining" : data.strong > data.weak ? "improving" : "stable";
        return {
            habit,
            avgCompletion: avgComp,
            daysWeak: data.weak,
            daysStrong: data.strong,
            trend,
        };
    });

    const weakestHabit = habitBreakdown.sort((a, b) => a.avgCompletion - b.avgCompletion)[0]?.habit || null;
    const strongestHabit = habitBreakdown.sort((a, b) => b.avgCompletion - a.avgCompletion)[0]?.habit || null;

    // Best/worst days
    const bestLog = logs.reduce((best, l) => (l.completionRate > (best?.completionRate || 0) ? l : best), logs[0]);
    const worstLog = logs.reduce((worst, l) => (l.completionRate < (worst?.completionRate || 100) ? l : worst), logs[0]);

    const bestDay = bestLog ? { date: bestLog.date, completionRate: bestLog.completionRate } : null;
    const worstDay = worstLog ? { date: worstLog.date, completionRate: worstLog.completionRate } : null;

    // Weekday pattern
    const weekdayPattern: Record<string, number[]> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    logs.forEach((log) => {
        const day = dayNames[new Date(log.date).getDay()];
        if (!weekdayPattern[day]) weekdayPattern[day] = [];
        weekdayPattern[day].push(log.completionRate || 0);
    });
    const weekdayAvg: Record<string, number> = {};
    Object.entries(weekdayPattern).forEach(([day, rates]) => {
        weekdayAvg[day] = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    });

    // Streak health analysis
    const recentLogs = logs.slice(0, 3);
    const recentAvgs = recentLogs.map((l) => l.completionRate || 0);
    const avgRecent3 = recentAvgs.reduce((a, b) => a + b, 0) / (recentAvgs.length || 1);

    let currentStreakHealth: "strong" | "fragile" | "broken" = "strong";
    if (avgRecent3 < 30) currentStreakHealth = "broken";
    else if (avgRecent3 < 60) currentStreakHealth = "fragile";

    const streakRisk = Math.max(0, Math.min(100, Math.round(100 - avgRecent3)));

    // Generate interventions
    const interventions: string[] = [];
    if (disciplineTrend === "declining") {
        interventions.push("Performance trend is DECLINING. Increase daily output immediately.");
    }
    if (avgCompletion < 50) {
        interventions.push(`Average completion at ${avgCompletion}%. Target: 80%+.`);
    }
    if (weakestHabit) {
        const weakData = habitBreakdown.find((h) => h.habit === weakestHabit);
        if (weakData && weakData.daysWeak >= 5) {
            interventions.push(`"${weakestHabit}" has been weak for ${weakData.daysWeak} of the last ${days} days. Prioritize this.`);
        }
    }
    if (consistencyScore < 40) {
        interventions.push(`Consistency score: ${consistencyScore}/100. Performance is erratic. Build routine.`);
    }
    if (currentStreakHealth === "fragile") {
        interventions.push("Streak is FRAGILE. Risk of breaking within 48 hours.");
    }

    const summary = `${logs.length}-day analysis | Avg: ${avgCompletion}% | Trend: ${disciplineTrend} | Consistency: ${consistencyScore}/100 | Streak: ${currentStreakHealth}`;

    return {
        completionRate: avgCompletion,
        disciplineTrend,
        consistencyScore,
        weakestHabit,
        strongestHabit,
        habitBreakdown,
        bestDay,
        worstDay,
        weekdayPattern: weekdayAvg,
        currentStreakHealth,
        streakRisk,
        interventions,
        summary,
    };
}

function getEmptyInsight(): BehaviorInsight {
    return {
        completionRate: 0,
        disciplineTrend: "stable",
        consistencyScore: 0,
        weakestHabit: null,
        strongestHabit: null,
        habitBreakdown: [],
        bestDay: null,
        worstDay: null,
        weekdayPattern: {},
        currentStreakHealth: "broken",
        streakRisk: 100,
        interventions: ["No behavior data. Begin completing quests to generate analysis."],
        summary: "No data available.",
    };
}

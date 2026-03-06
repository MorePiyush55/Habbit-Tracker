/**
 * Central System State Builder
 * ============================
 * Single source of truth for the AI Discipline OS.
 * Aggregates ALL user data into one unified SystemState object.
 * Every system decision, AI call, and directive uses this state.
 *
 * Architecture:
 *   User Actions → Event Bus → System State → System Brain → Directives
 */

import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import ProgressEntry from "@/models/ProgressEntry";
import BehaviorLog from "@/models/BehaviorLog";
import SkillScore from "@/models/SkillScore";
import SystemDecision from "@/models/SystemDecision";
import type { SystemState, Difficulty } from "@/types";

// ============================================================
// BEHAVIOR PATTERN ANALYZER (30-day window)
// ============================================================
function analyzeBehaviorPatterns(logs: any[]): SystemState["behaviorAnalysis"] {
    if (logs.length === 0) {
        return {
            activeDays: 0,
            avgCompletion: 0,
            trend: "stable",
            topWeakHabits: [],
            topStrongHabits: [],
            disciplineTrajectory: "0 points",
        };
    }

    const completionRates = logs.map((l) => l.completionRate || 0);
    const avgCompletion = Math.round(
        completionRates.reduce((a: number, b: number) => a + b, 0) / completionRates.length
    );

    // Trend: compare first half (recent) vs second half (older)
    const halfLen = Math.floor(completionRates.length / 2) || 1;
    const recentAvg =
        completionRates.slice(0, halfLen).reduce((a: number, b: number) => a + b, 0) / halfLen;
    const olderAvg =
        completionRates.slice(halfLen).reduce((a: number, b: number) => a + b, 0) / (halfLen || 1);
    const trend: "improving" | "stable" | "declining" =
        recentAvg > olderAvg + 5 ? "improving" : recentAvg < olderAvg - 5 ? "declining" : "stable";

    // Frequency count for weak/strong habits
    const weakCounts: Record<string, number> = {};
    const strongCounts: Record<string, number> = {};
    logs.forEach((log) => {
        (log.weakHabits || []).forEach((h: string) => {
            weakCounts[h] = (weakCounts[h] || 0) + 1;
        });
        (log.strongHabits || []).forEach((h: string) => {
            strongCounts[h] = (strongCounts[h] || 0) + 1;
        });
    });

    const topWeakHabits = Object.entries(weakCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([h, count]) => `${h} (weak ${count} days)`);
    const topStrongHabits = Object.entries(strongCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([h, count]) => `${h} (strong ${count} days)`);

    // Discipline trajectory
    const disciplineScores = logs.map((l) => l.disciplineScore || 50);
    const latestDiscipline = disciplineScores[0] || 50;
    const oldestDiscipline = disciplineScores[disciplineScores.length - 1] || 50;
    const disciplineDelta = latestDiscipline - oldestDiscipline;

    return {
        activeDays: logs.length,
        avgCompletion,
        trend,
        topWeakHabits,
        topStrongHabits,
        disciplineTrajectory:
            disciplineDelta > 0 ? `+${disciplineDelta} points` : `${disciplineDelta} points`,
    };
}

// ============================================================
// BUILD SYSTEM STATE — One call, complete picture
// ============================================================
export async function buildSystemState(userId: string, date?: string): Promise<SystemState> {
    await connectDB();

    const today = date || new Date().toISOString().split("T")[0];

    // Parallel fetch: all data sources at once
    const [user, habits, behaviorLogs, skillScores, recentDecisions] = await Promise.all([
        User.findById(userId).lean(),
        Habit.find({ userId, isActive: true }).sort({ order: 1 }).lean(),
        BehaviorLog.find({ userId }).sort({ date: -1 }).limit(30).lean(),
        SkillScore.find({ userId }).sort({ score: 1 }).lean(),
        SystemDecision.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    // Get today's progress entries for each habit
    const habitIds = habits.map((h: any) => h._id);
    const [todayEntries, allSubtasks] = await Promise.all([
        ProgressEntry.find({ userId, date: today }).lean(),
        Subtask.find({ habitId: { $in: habitIds } }).lean(),
    ]);

    // Build active habits with today's progress
    const activeHabits = habits.map((h: any) => {
        const habitSubtasks = allSubtasks.filter(
            (s: any) => s.habitId.toString() === h._id.toString()
        );
        const habitEntries = todayEntries.filter(
            (e: any) => e.habitId.toString() === h._id.toString()
        );
        const completedCount = habitEntries.filter((e: any) => e.completed).length;
        const totalCount = habitSubtasks.length || 1;

        return {
            id: h._id.toString(),
            name: h.title,
            category: h.category,
            difficulty: h.difficulty as Difficulty,
            difficultyLevel: h.difficultyLevel || 1,
            progress: Math.round((completedCount / totalCount) * 100),
            total: totalCount,
            completed: completedCount,
            consecutiveCompletions: h.consecutiveCompletions || 0,
        };
    });

    // Derive weak/strong habits from today's progress
    const weakHabits = activeHabits
        .filter((h) => h.progress < 50 && h.total > 0)
        .map((h) => h.name);
    const strongHabits = activeHabits
        .filter((h) => h.progress >= 80)
        .map((h) => h.name);

    // Build 7-day behavior trend
    const recentBehavior = (behaviorLogs as any[]).slice(0, 7).map((log) => ({
        date: log.date,
        completionRate: log.completionRate,
        tasksCompleted: log.tasksCompleted,
        tasksFailed: log.tasksFailed,
        weakHabits: log.weakHabits || [],
        strongHabits: log.strongHabits || [],
        xpEarned: log.xpEarned || 0,
    }));

    // 30-day behavior analysis
    const behaviorAnalysis = analyzeBehaviorPatterns(behaviorLogs as any[]);

    // Build skill scores
    const skills = (skillScores as any[]).map((s) => ({
        skill: s.skill,
        category: s.category,
        score: s.score,
        trend: s.trend || "stable",
        lastTested: s.lastTested
            ? new Date(s.lastTested).toISOString().split("T")[0]
            : "never",
    }));

    // Recent decisions for context continuity
    const decisions = (recentDecisions as any[]).slice(0, 5).map((d) => ({
        action: d.decisionType,
        reason: d.reason,
        date: d.date,
    }));

    const state: SystemState = {
        hunter: {
            userId,
            name: user?.name || "Hunter",
            level: user?.level || 1,
            xp: user?.totalXP || 0,
            streak: user?.currentStreak || 0,
            longestStreak: user?.longestStreak || 0,
            disciplineScore: user?.disciplineScore || 50,
            focusScore: user?.focusScore || 50,
            skillGrowthScore: user?.skillGrowthScore || 50,
            hunterRank: user?.hunterRank || "E-Class",
        },
        activeHabits,
        weakHabits,
        strongHabits,
        skillScores: skills,
        bossRaid: {
            bossHP: user?.weeklyBossHP || 500,
            bossDefeatedThisWeek: user?.bossDefeatedThisWeek || false,
        },
        recentBehavior,
        behaviorAnalysis,
        recentDecisions: decisions,
        generatedAt: new Date().toISOString(),
    };

    return state;
}

/**
 * Get a lightweight state snapshot (no DB calls for behavior logs).
 * Used for quick rule evaluations where full state isn't needed.
 */
async function getQuickState(userId: string): Promise<Pick<
    SystemState,
    "hunter" | "activeHabits" | "weakHabits" | "strongHabits" | "bossRaid"
>> {
    await connectDB();

    const today = new Date().toISOString().split("T")[0];
    const [user, habits] = await Promise.all([
        User.findById(userId).lean(),
        Habit.find({ userId, isActive: true }).sort({ order: 1 }).lean(),
    ]);

    const habitIds = habits.map((h: any) => h._id);
    const [todayEntries, allSubtasks] = await Promise.all([
        ProgressEntry.find({ userId, date: today }).lean(),
        Subtask.find({ habitId: { $in: habitIds } }).lean(),
    ]);

    const activeHabits = habits.map((h: any) => {
        const habitSubtasks = allSubtasks.filter(
            (s: any) => s.habitId.toString() === h._id.toString()
        );
        const habitEntries = todayEntries.filter(
            (e: any) => e.habitId.toString() === h._id.toString()
        );
        const completedCount = habitEntries.filter((e: any) => e.completed).length;
        const totalCount = habitSubtasks.length || 1;

        return {
            id: h._id.toString(),
            name: h.title,
            category: h.category,
            difficulty: h.difficulty as Difficulty,
            difficultyLevel: h.difficultyLevel || 1,
            progress: Math.round((completedCount / totalCount) * 100),
            total: totalCount,
            completed: completedCount,
            consecutiveCompletions: h.consecutiveCompletions || 0,
        };
    });

    const weakHabits = activeHabits.filter((h) => h.progress < 50 && h.total > 0).map((h) => h.name);
    const strongHabits = activeHabits.filter((h) => h.progress >= 80).map((h) => h.name);

    return {
        hunter: {
            userId,
            name: user?.name || "Hunter",
            level: user?.level || 1,
            xp: user?.totalXP || 0,
            streak: user?.currentStreak || 0,
            longestStreak: user?.longestStreak || 0,
            disciplineScore: user?.disciplineScore || 50,
            focusScore: user?.focusScore || 50,
            skillGrowthScore: user?.skillGrowthScore || 50,
            hunterRank: user?.hunterRank || "E-Class",
        },
        activeHabits,
        weakHabits,
        strongHabits,
        bossRaid: {
            bossHP: user?.weeklyBossHP || 500,
            bossDefeatedThisWeek: user?.bossDefeatedThisWeek || false,
        },
    };
}

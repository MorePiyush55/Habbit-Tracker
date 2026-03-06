/**
 * Cognitive Optimizer — Workload Intelligence
 * ==============================================
 * Calculates optimal workload based on focus patterns,
 * completion rates, and task complexity.
 *
 * Prevents burnout by detecting overload and recommends
 * task reductions when necessary.
 *
 * Used by: strategyGenerator, difficultyScaler, systemConsole
 */

import type { SystemState } from "@/types";
import { analyzeBehavior, type BehaviorInsight } from "./behaviorAnalyzer";

// ============================================================
// Types
// ============================================================

interface CognitiveAssessment {
    currentLoadHours: number;
    optimalLoadHours: number;
    capacityPercent: number;        // 0-100%, current/optimal ratio
    isOverloaded: boolean;
    activeTasks: number;
    recentCompletionRate: number;
    focusScore: number;
    recommendation: string;
    taskRecommendations: TaskRecommendation[];
}

interface TaskRecommendation {
    action: "keep" | "reduce" | "remove" | "prioritize";
    habitName: string;
    reason: string;
}

// ============================================================
// Estimated time per difficulty level (in hours)
// ============================================================

const DIFFICULTY_HOURS: Record<string, number> = {
    small: 0.5,
    medium: 1.0,
    hard: 2.0,
};

const DIFFICULTY_LEVEL_MULTIPLIER = [1.0, 1.0, 1.2, 1.4, 1.6, 2.0]; // Level 0-5

// ============================================================
// CORE: Assess cognitive load
// ============================================================

export async function assessCognitiveLoad(
    userId: string,
    state: SystemState
): Promise<CognitiveAssessment> {
    // Get behavior patterns
    let insight: BehaviorInsight;
    try {
        insight = await analyzeBehavior(userId, 14); // 2-week window
    } catch {
        insight = {
            completionRate: 50,
            disciplineTrend: "stable",
            consistencyScore: 50,
            weakestHabit: null,
            strongestHabit: null,
            habitBreakdown: [],
            bestDay: null,
            worstDay: null,
            weekdayPattern: {},
            currentStreakHealth: "fragile",
            streakRisk: 50,
            interventions: [],
            summary: "",
        };
    }

    // ── Calculate current load (estimated hours) ─────────
    let currentLoadHours = 0;
    const taskRecommendations: TaskRecommendation[] = [];

    for (const habit of state.activeHabits) {
        const baseHours = DIFFICULTY_HOURS[habit.difficulty] || 1.0;
        const levelMultiplier = DIFFICULTY_LEVEL_MULTIPLIER[habit.difficultyLevel] || 1.0;
        const subtaskMultiplier = Math.max(1, habit.total * 0.3); // More subtasks = more time
        const habitHours = baseHours * levelMultiplier * subtaskMultiplier;
        currentLoadHours += habitHours;

        // Generate recommendation for each habit
        const habitInsight = insight.habitBreakdown.find(
            (h) => h.habit === habit.name
        );

        if (habit.progress >= 100) {
            taskRecommendations.push({
                action: "keep",
                habitName: habit.name,
                reason: "Completed today.",
            });
        } else if (habitInsight?.avgCompletion !== undefined && habitInsight.avgCompletion < 30) {
            taskRecommendations.push({
                action: "reduce",
                habitName: habit.name,
                reason: `Chronic underperformance (${habitInsight.avgCompletion}% avg). Consider reducing scope.`,
            });
        } else if (habit.difficulty === "hard" && insight.completionRate < 50) {
            taskRecommendations.push({
                action: "reduce",
                habitName: habit.name,
                reason: "Hard task during low-performance period. Risk of skip.",
            });
        } else {
            taskRecommendations.push({
                action: "keep",
                habitName: habit.name,
                reason: "Within capacity.",
            });
        }
    }

    // ── Calculate optimal load ───────────────────────────
    const optimalLoadHours = calculateOptimalLoad(
        insight.completionRate,
        insight.consistencyScore,
        state.hunter.focusScore,
        state.hunter.disciplineScore
    );

    // ── Capacity assessment ──────────────────────────────
    const capacityPercent = optimalLoadHours > 0
        ? Math.round((currentLoadHours / optimalLoadHours) * 100)
        : 100;

    const isOverloaded = capacityPercent > 120;

    // ── Generate recommendation ──────────────────────────
    const recommendation = generateRecommendation(
        currentLoadHours,
        optimalLoadHours,
        capacityPercent,
        isOverloaded,
        insight,
        state
    );

    // Prioritize tasks that are most important
    prioritizeTasks(taskRecommendations, state);

    return {
        currentLoadHours: Math.round(currentLoadHours * 10) / 10,
        optimalLoadHours: Math.round(optimalLoadHours * 10) / 10,
        capacityPercent,
        isOverloaded,
        activeTasks: state.activeHabits.length,
        recentCompletionRate: insight.completionRate,
        focusScore: state.hunter.focusScore,
        recommendation,
        taskRecommendations,
    };
}

// ============================================================
// Calculate optimal load based on user capacity signals
// ============================================================

function calculateOptimalLoad(
    completionRate: number,
    consistencyScore: number,
    focusScore: number,
    disciplineScore: number
): number {
    // Base: 2 hours for a new user
    const base = 2.0;

    // Capacity factors
    const completionFactor = completionRate / 100;      // 0.0 – 1.0
    const consistencyFactor = consistencyScore / 100;   // 0.0 – 1.0
    const focusFactor = focusScore / 100;               // 0.0 – 1.0
    const disciplineFactor = disciplineScore / 100;     // 0.0 – 1.0

    // Weighted capacity score
    const capacity =
        completionFactor * 0.35 +
        consistencyFactor * 0.25 +
        focusFactor * 0.20 +
        disciplineFactor * 0.20;

    // Optimal hours: 1.5h (weak) to 5h (strong)
    const optimal = base + capacity * 3.0;

    return Math.max(1.0, Math.min(6.0, optimal));
}

// ============================================================
// Generate human-readable recommendation
// ============================================================

function generateRecommendation(
    currentHours: number,
    optimalHours: number,
    capacityPercent: number,
    isOverloaded: boolean,
    insight: BehaviorInsight,
    state: SystemState
): string {
    if (isOverloaded && insight.disciplineTrend === "declining") {
        return `OVERLOAD DETECTED. Current load ${currentHours.toFixed(1)}h exceeds optimal ${optimalHours.toFixed(1)}h by ${(capacityPercent - 100)}%. Performance is declining. Immediate task reduction required. Remove or simplify your lowest-priority habit.`;
    }

    if (isOverloaded) {
        return `Load at ${capacityPercent}% of optimal capacity (${currentHours.toFixed(1)}h vs ${optimalHours.toFixed(1)}h). Consider removing one task or reducing difficulty levels. Sustained overload leads to burnout and streak breaks.`;
    }

    if (capacityPercent < 50 && insight.completionRate >= 80) {
        return `Load at ${capacityPercent}% of capacity. You are underutilized. Consider adding a new habit or increasing difficulty on an existing one. You can handle more.`;
    }

    if (capacityPercent >= 80 && capacityPercent <= 120) {
        return `Load at ${capacityPercent}% of optimal (${currentHours.toFixed(1)}h / ${optimalHours.toFixed(1)}h). This is within acceptable range. Maintain current pace.`;
    }

    return `Load at ${capacityPercent}% of capacity. ${insight.completionRate >= 60 ? "Performance adequate." : "Focus on completing existing tasks before adding more."} Current: ${currentHours.toFixed(1)}h, Optimal: ${optimalHours.toFixed(1)}h.`;
}

// ============================================================
// Mark highest-value tasks as priority
// ============================================================

function prioritizeTasks(
    recommendations: TaskRecommendation[],
    state: SystemState
): void {
    // Weak habits should be prioritized
    for (const rec of recommendations) {
        if (state.weakHabits.includes(rec.habitName) && rec.action === "keep") {
            rec.action = "prioritize";
            rec.reason = "Weak habit — prioritize to prevent further decline.";
        }
    }
}

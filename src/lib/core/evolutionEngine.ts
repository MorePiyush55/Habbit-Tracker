/**
 * Evolution Engine — AI Self-Improvement Layer
 * ===============================================
 * Analyzes performance patterns and evolves strategy rules.
 * The system learns from behavior data and adjusts its own parameters.
 *
 * Flow:
 *   behaviorAnalyzer → evolutionEngine → updated strategy parameters
 *
 * What it evolves:
 *   - Optimal task timing (morning vs afternoon vs evening)
 *   - Difficulty scaling thresholds
 *   - Intervention sensitivity
 *   - Strategy focus areas
 *
 * Runs periodically (not on every request) — typically daily or weekly.
 */

import type { SystemState } from "@/types";
import type { MemorySnapshot } from "./systemMemory";
import { analyzeBehavior, type BehaviorInsight } from "./behaviorAnalyzer";

// ============================================================
// Types
// ============================================================

interface EvolutionRule {
    parameter: string;
    previousValue: string;
    newValue: string;
    reason: string;
    confidence: number;
    appliedAt: string;
}

interface EvolutionResult {
    rules: EvolutionRule[];
    totalAdjustments: number;
    nextEvaluationIn: string;   // e.g. "7 days"
    summary: string;
}

interface StrategyParameters {
    optimalTaskTime: "morning" | "afternoon" | "evening" | "mixed";
    difficultyScaleThreshold: number;   // consecutive completions needed (default 6)
    interventionSensitivity: "low" | "medium" | "high";
    focusPriority: "weak_habits" | "skill_growth" | "consistency" | "balanced";
    maxDailyTasks: number;
    streakProtectionMode: boolean;
}

// ============================================================
// Default parameters
// ============================================================

const DEFAULT_PARAMS: StrategyParameters = {
    optimalTaskTime: "morning",
    difficultyScaleThreshold: 6,
    interventionSensitivity: "medium",
    focusPriority: "balanced",
    maxDailyTasks: 8,
    streakProtectionMode: false,
};

// ============================================================
// CORE: Evolve strategy based on performance data
// ============================================================

export async function evolveStrategy(
    userId: string,
    state: SystemState,
    memory: MemorySnapshot | null
): Promise<EvolutionResult> {
    const insight = await analyzeBehavior(userId, 30);
    const rules: EvolutionRule[] = [];
    const now = new Date().toISOString();

    // Current params (from memory or defaults)
    const currentParams = getStoredParams(memory);

    // ── Rule 1: Optimal task timing ──────────────────────
    const timingRule = evaluateOptimalTiming(insight, currentParams);
    if (timingRule) rules.push({ ...timingRule, appliedAt: now });

    // ── Rule 2: Difficulty scaling threshold ──────────────
    const difficultyRule = evaluateDifficultyThreshold(insight, state, currentParams);
    if (difficultyRule) rules.push({ ...difficultyRule, appliedAt: now });

    // ── Rule 3: Intervention sensitivity ─────────────────
    const interventionRule = evaluateInterventionSensitivity(insight, currentParams);
    if (interventionRule) rules.push({ ...interventionRule, appliedAt: now });

    // ── Rule 4: Focus priority ───────────────────────────
    const focusRule = evaluateFocusPriority(insight, state, currentParams);
    if (focusRule) rules.push({ ...focusRule, appliedAt: now });

    // ── Rule 5: Max daily tasks ──────────────────────────
    const loadRule = evaluateTaskLoad(insight, state, currentParams);
    if (loadRule) rules.push({ ...loadRule, appliedAt: now });

    // ── Rule 6: Streak protection ────────────────────────
    const streakRule = evaluateStreakProtection(state, currentParams);
    if (streakRule) rules.push({ ...streakRule, appliedAt: now });

    const summary = rules.length > 0
        ? `${rules.length} parameter${rules.length > 1 ? "s" : ""} adjusted based on ${insight.completionRate}% avg completion and ${insight.disciplineTrend} trend.`
        : "No adjustments needed. Current parameters are effective.";

    return {
        rules,
        totalAdjustments: rules.length,
        nextEvaluationIn: "7 days",
        summary,
    };
}

// ============================================================
// Get current parameters from memory
// ============================================================

export function getStoredParams(memory: MemorySnapshot | null): StrategyParameters {
    if (!memory?.skillGraphSnapshot) return { ...DEFAULT_PARAMS };

    // Strategy params are stored in the skillGraphSnapshot field (repurposed metadata)
    const stored = (memory as any).strategyParams;
    if (!stored) return { ...DEFAULT_PARAMS };

    return { ...DEFAULT_PARAMS, ...stored };
}

// ============================================================
// EVALUATION FUNCTIONS
// ============================================================

function evaluateOptimalTiming(
    insight: BehaviorInsight,
    params: StrategyParameters
): Omit<EvolutionRule, "appliedAt"> | null {
    // Analyze weekday patterns for time-of-day hints
    // If best performance correlates with certain days, suggest timing shift
    const weekdayEntries = Object.entries(insight.weekdayPattern);
    if (weekdayEntries.length < 3) return null;

    const avgRate = insight.completionRate;
    const bestDay = weekdayEntries.sort((a, b) => b[1] - a[1])[0];
    const worstDay = weekdayEntries.sort((a, b) => a[1] - b[1])[0];

    // If high variance between best/worst days, suggest consistency focus
    if (bestDay && worstDay && bestDay[1] - worstDay[1] > 30) {
        const newTime = avgRate >= 70 ? "morning" : "afternoon";
        if (newTime !== params.optimalTaskTime) {
            return {
                parameter: "optimalTaskTime",
                previousValue: params.optimalTaskTime,
                newValue: newTime,
                reason: `High day variance (${bestDay[0]}: ${bestDay[1]}% vs ${worstDay[0]}: ${worstDay[1]}%). Shifting to ${newTime} tasks for consistency.`,
                confidence: 0.72,
            };
        }
    }

    return null;
}

function evaluateDifficultyThreshold(
    insight: BehaviorInsight,
    state: SystemState,
    params: StrategyParameters
): Omit<EvolutionRule, "appliedAt"> | null {
    // If completion rate is very high, lower the threshold (scale faster)
    if (insight.completionRate >= 85 && params.difficultyScaleThreshold > 4) {
        return {
            parameter: "difficultyScaleThreshold",
            previousValue: String(params.difficultyScaleThreshold),
            newValue: "4",
            reason: `Completion rate at ${insight.completionRate}%. Player is ready for faster difficulty scaling.`,
            confidence: 0.80,
        };
    }

    // If completion rate is low, increase threshold (slower scaling)
    if (insight.completionRate < 50 && params.difficultyScaleThreshold < 8) {
        return {
            parameter: "difficultyScaleThreshold",
            previousValue: String(params.difficultyScaleThreshold),
            newValue: "8",
            reason: `Completion rate at ${insight.completionRate}%. Slowing difficulty scaling to prevent overwhelm.`,
            confidence: 0.75,
        };
    }

    return null;
}

function evaluateInterventionSensitivity(
    insight: BehaviorInsight,
    params: StrategyParameters
): Omit<EvolutionRule, "appliedAt"> | null {
    // If discipline is declining, increase sensitivity
    if (insight.disciplineTrend === "declining" && params.interventionSensitivity !== "high") {
        return {
            parameter: "interventionSensitivity",
            previousValue: params.interventionSensitivity,
            newValue: "high",
            reason: `Discipline trend: DECLINING. Increasing intervention frequency.`,
            confidence: 0.85,
        };
    }

    // If discipline is improving and currently high sensitivity, lower it
    if (insight.disciplineTrend === "improving" && params.interventionSensitivity === "high") {
        return {
            parameter: "interventionSensitivity",
            previousValue: "high",
            newValue: "medium",
            reason: `Discipline improving. Reducing intervention frequency to avoid fatigue.`,
            confidence: 0.70,
        };
    }

    return null;
}

function evaluateFocusPriority(
    insight: BehaviorInsight,
    state: SystemState,
    params: StrategyParameters
): Omit<EvolutionRule, "appliedAt"> | null {
    const weakSkills = state.skillScores.filter((s) => s.score < 40);
    const weakHabits = insight.habitBreakdown.filter((h) => h.avgCompletion < 40);

    // Many weak skills → focus on skill growth
    if (weakSkills.length >= 3 && params.focusPriority !== "skill_growth") {
        return {
            parameter: "focusPriority",
            previousValue: params.focusPriority,
            newValue: "skill_growth",
            reason: `${weakSkills.length} skills below 40. Shifting focus to skill growth.`,
            confidence: 0.78,
        };
    }

    // Erratic consistency → focus on consistency
    if (insight.consistencyScore < 40 && params.focusPriority !== "consistency") {
        return {
            parameter: "focusPriority",
            previousValue: params.focusPriority,
            newValue: "consistency",
            reason: `Consistency at ${insight.consistencyScore}/100. Prioritizing routine stability.`,
            confidence: 0.82,
        };
    }

    // Many weak habits → focus weak habits
    if (weakHabits.length >= 2 && params.focusPriority !== "weak_habits") {
        return {
            parameter: "focusPriority",
            previousValue: params.focusPriority,
            newValue: "weak_habits",
            reason: `${weakHabits.length} habits chronically weak. Redirecting focus.`,
            confidence: 0.75,
        };
    }

    return null;
}

function evaluateTaskLoad(
    insight: BehaviorInsight,
    state: SystemState,
    params: StrategyParameters
): Omit<EvolutionRule, "appliedAt"> | null {
    const currentTasks = state.activeHabits.length;

    // If completion rate is consistently low with many tasks, suggest reduction
    if (insight.completionRate < 45 && currentTasks > 5 && params.maxDailyTasks > 5) {
        const suggested = Math.max(4, currentTasks - 2);
        return {
            parameter: "maxDailyTasks",
            previousValue: String(params.maxDailyTasks),
            newValue: String(suggested),
            reason: `Completion rate ${insight.completionRate}% with ${currentTasks} tasks. Recommending reduction to ${suggested}.`,
            confidence: 0.73,
        };
    }

    // If completion rate is very high, can handle more
    if (insight.completionRate >= 90 && currentTasks <= 4) {
        const suggested = Math.min(10, currentTasks + 2);
        return {
            parameter: "maxDailyTasks",
            previousValue: String(params.maxDailyTasks),
            newValue: String(suggested),
            reason: `Completion at ${insight.completionRate}% with only ${currentTasks} tasks. Capacity exists for more.`,
            confidence: 0.68,
        };
    }

    return null;
}

function evaluateStreakProtection(
    state: SystemState,
    params: StrategyParameters
): Omit<EvolutionRule, "appliedAt"> | null {
    // Enable streak protection if streak is significant and at risk
    if (state.hunter.streak >= 10 && !params.streakProtectionMode) {
        return {
            parameter: "streakProtectionMode",
            previousValue: "false",
            newValue: "true",
            reason: `${state.hunter.streak}-day streak active. Enabling protection mode to prevent break.`,
            confidence: 0.85,
        };
    }

    // Disable if streak is low
    if (state.hunter.streak < 3 && params.streakProtectionMode) {
        return {
            parameter: "streakProtectionMode",
            previousValue: "true",
            newValue: "false",
            reason: `Streak at ${state.hunter.streak} days. Protection mode unnecessary.`,
            confidence: 0.80,
        };
    }

    return null;
}

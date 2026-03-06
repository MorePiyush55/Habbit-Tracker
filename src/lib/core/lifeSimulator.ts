/**
 * Life Simulator — Future Outcome Predictor
 * ============================================
 * Projects the hunter's performance 30 days forward
 * based on current behavior patterns.
 *
 * Inputs: systemState, behavior history, skill scores
 * Output: 30-day projection with projected stats
 *
 * Used by: strategyGenerator, systemConsole, REQUEST_PREDICTION handler
 */

import type { SystemState } from "@/types";
import { analyzeBehavior, type BehaviorInsight } from "./behaviorAnalyzer";

// ============================================================
// Types
// ============================================================

export interface FutureProjection {
    projectedDiscipline: number;
    projectedCompletion: number;
    projectedStreak: number;
    projectedLevel: number;
    projectedXP: number;
    projectedSkills: { skill: string; projected: number; current: number; delta: number }[];
    outcome: "excellent" | "good" | "stagnant" | "declining" | "critical";
    verdict: string;
    daysSimulated: number;
    assumptions: string[];
}

// ============================================================
// CORE: Simulate future based on current patterns
// ============================================================

export async function simulateFuture(
    userId: string,
    state: SystemState,
    days: number = 30
): Promise<FutureProjection> {
    // Get behavior patterns for simulation
    let insight: BehaviorInsight;
    try {
        insight = await analyzeBehavior(userId, 30);
    } catch {
        return getDefaultProjection(state, days);
    }

    const assumptions: string[] = [];

    // ── Project discipline score ─────────────────────────
    const disciplineDelta = projectTrend(
        state.hunter.disciplineScore,
        insight.disciplineTrend,
        days
    );
    const projectedDiscipline = clamp(state.hunter.disciplineScore + disciplineDelta, 0, 100);
    assumptions.push(`Discipline trend: ${insight.disciplineTrend} (${disciplineDelta > 0 ? "+" : ""}${disciplineDelta} projected)`);

    // ── Project completion rate ──────────────────────────
    const completionDelta = projectTrend(
        insight.completionRate,
        insight.disciplineTrend,
        days
    );
    const projectedCompletion = clamp(insight.completionRate + completionDelta, 0, 100);

    // ── Project streak ───────────────────────────────────
    let projectedStreak = state.hunter.streak;
    if (insight.completionRate >= 70 && insight.disciplineTrend !== "declining") {
        projectedStreak += days * 0.8; // ~80% of days maintained
        assumptions.push("Streak projected assuming 80% daily completion");
    } else if (insight.completionRate >= 40) {
        projectedStreak += days * 0.4;
        assumptions.push("Streak partially maintained at current rate");
    } else {
        projectedStreak = Math.max(0, projectedStreak - Math.floor(days * 0.3));
        assumptions.push("Streak likely to break within projection period");
    }
    projectedStreak = Math.round(projectedStreak);

    // ── Project level and XP ─────────────────────────────
    const dailyXPRate = estimateDailyXP(state, insight.completionRate);
    const projectedXP = state.hunter.xp + Math.round(dailyXPRate * days);
    const projectedLevel = estimateLevel(projectedXP);
    assumptions.push(`Estimated ${Math.round(dailyXPRate)} XP/day based on current activity`);

    // ── Project skill scores ─────────────────────────────
    const projectedSkills = state.skillScores.map((s) => {
        let delta = 0;
        if (s.trend === "improving") delta = Math.round(days * 0.5);
        else if (s.trend === "declining") delta = -Math.round(days * 0.3);
        else delta = Math.round(days * 0.1);

        const projected = clamp(s.score + delta, 0, 100);
        return {
            skill: s.skill,
            projected,
            current: s.score,
            delta: projected - s.score,
        };
    });

    // ── Determine outcome ────────────────────────────────
    const outcome = determineOutcome(projectedDiscipline, projectedCompletion, insight.disciplineTrend);
    const verdict = generateVerdict(outcome, state, projectedDiscipline, projectedCompletion, projectedStreak);

    return {
        projectedDiscipline,
        projectedCompletion,
        projectedStreak,
        projectedLevel,
        projectedXP,
        projectedSkills,
        outcome,
        verdict,
        daysSimulated: days,
        assumptions,
    };
}

// ============================================================
// HELPER: Project a numeric value based on trend
// ============================================================

function projectTrend(
    currentValue: number,
    trend: "improving" | "stable" | "declining",
    days: number
): number {
    const dailyRate = trend === "improving" ? 0.5 : trend === "declining" ? -0.7 : 0.1;
    // Diminishing returns — trend weakens over time
    const projected = dailyRate * days * (1 - (days / (days + 30)));
    return Math.round(projected);
}

function estimateDailyXP(state: SystemState, avgCompletion: number): number {
    // Base XP from habits
    const taskCount = state.activeHabits.length;
    const avgXPPerTask = 15; // rough average
    return taskCount * avgXPPerTask * (avgCompletion / 100);
}

function estimateLevel(totalXP: number): number {
    // Simple logarithmic leveling: level = floor(sqrt(xp / 50))
    return Math.max(1, Math.floor(Math.sqrt(totalXP / 50)));
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ============================================================
// Outcome classification
// ============================================================

function determineOutcome(
    projectedDiscipline: number,
    projectedCompletion: number,
    trend: "improving" | "stable" | "declining"
): FutureProjection["outcome"] {
    if (projectedDiscipline >= 75 && projectedCompletion >= 80) return "excellent";
    if (projectedDiscipline >= 55 && projectedCompletion >= 60) return "good";
    if (trend === "declining" && projectedCompletion < 40) return "critical";
    if (trend === "declining") return "declining";
    return "stagnant";
}

function generateVerdict(
    outcome: FutureProjection["outcome"],
    state: SystemState,
    discipline: number,
    completion: number,
    streak: number
): string {
    switch (outcome) {
        case "excellent":
            return `At this rate, you reach ${discipline}% discipline with a ${streak}-day streak. Performance is commendable. Push for rank advancement.`;
        case "good":
            return `Projected trajectory is positive. Discipline at ${discipline}%, completion at ${completion}%. Maintain current intensity to keep progressing.`;
        case "stagnant":
            return `Progress is stagnating. Without increased effort, discipline stays at ${discipline}% and completion at ${completion}%. This is not growth. This is coasting.`;
        case "declining":
            return `WARNING: Current pattern leads to ${discipline}% discipline and ${completion}% completion in 30 days. Trajectory is NEGATIVE. Intervention recommended immediately.`;
        case "critical":
            return `CRITICAL: If this continues, discipline drops to ${discipline}% and completion to ${completion}%. Streak will break. System intervention required. Change course NOW.`;
    }
}

// ============================================================
// Fallback when no behavior data
// ============================================================

function getDefaultProjection(state: SystemState, days: number): FutureProjection {
    return {
        projectedDiscipline: state.hunter.disciplineScore,
        projectedCompletion: 50,
        projectedStreak: state.hunter.streak,
        projectedLevel: state.hunter.level,
        projectedXP: state.hunter.xp,
        projectedSkills: [],
        outcome: "stagnant",
        verdict: "Insufficient data for accurate projection. Complete more daily tasks to generate a reliable simulation.",
        daysSimulated: days,
        assumptions: ["No historical data available — using current state only"],
    };
}

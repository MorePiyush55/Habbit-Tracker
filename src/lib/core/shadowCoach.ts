/**
 * Shadow Coach — Dual Brain Directive Critic
 * =============================================
 * Reviews directives before execution and critiques them.
 * Acts as a "second opinion" — the adversarial check layer.
 *
 * Flow:
 *   Brain Controller → candidate directives → Shadow Coach
 *     → adjusted directives (lower count, different priority, etc.)
 *
 * The Shadow Coach:
 *   - Reduces unrealistic task counts
 *   - Adjusts difficulty expectations
 *   - Warns about burnout risk
 *   - Validates strategy feasibility
 */

import type { SystemState } from "@/types";
import type { MemorySnapshot } from "./systemMemory";
import type { DailyStrategy } from "./strategyGenerator";

// ============================================================
// Types
// ============================================================

interface CoachReview {
    approved: boolean;
    adjustments: CoachAdjustment[];
    warnings: string[];
    originalScore: number;    // 0-100 — feasibility of original plan
    adjustedScore: number;    // 0-100 — feasibility after adjustments
    summary: string;
}

interface CoachAdjustment {
    target: string;          // What was adjusted
    original: string;        // Original value
    adjusted: string;        // New value
    reason: string;
}

// ============================================================
// CORE: Review a daily strategy
// ============================================================

export function reviewStrategy(
    strategy: DailyStrategy,
    state: SystemState,
    memory: MemorySnapshot | null
): CoachReview {
    const adjustments: CoachAdjustment[] = [];
    const warnings: string[] = [];

    const totalTasks = [
        ...strategy.morning,
        ...strategy.afternoon,
        ...strategy.evening,
    ].length;

    // ── Check 1: Task count feasibility ──────────────────
    const avgCompletion = state.behaviorAnalysis.avgCompletion;
    const completionCapacity = estimateCapacity(avgCompletion, state.activeHabits.length);

    if (totalTasks > completionCapacity.maxFeasibleTasks) {
        const reducedMorning = strategy.morning.slice(0, Math.ceil(strategy.morning.length * 0.7));
        const reducedAfternoon = strategy.afternoon.slice(0, Math.ceil(strategy.afternoon.length * 0.7));
        const reducedEvening = strategy.evening.slice(0, Math.ceil(strategy.evening.length * 0.7));
        const newTotal = reducedMorning.length + reducedAfternoon.length + reducedEvening.length;

        adjustments.push({
            target: "taskCount",
            original: `${totalTasks} tasks`,
            adjusted: `${newTotal} tasks`,
            reason: `Completion rate at ${avgCompletion}%. ${totalTasks} tasks exceeds feasible capacity of ${completionCapacity.maxFeasibleTasks}.`,
        });
    }

    // ── Check 2: Streak risk protection ──────────────────
    if (state.hunter.streak >= 7 && avgCompletion < 60) {
        warnings.push(
            `Streak at ${state.hunter.streak} days but completion rate at ${avgCompletion}%. Risk of streak break is HIGH. Consider reducing mandatory tasks.`
        );
    }

    // ── Check 3: Burnout indicator ───────────────────────
    if (avgCompletion < 40 && state.behaviorAnalysis.trend === "declining") {
        warnings.push(
            `Performance declining with ${avgCompletion}% completion. Burnout risk detected. Recommend recovery day with minimal tasks.`
        );
        adjustments.push({
            target: "difficulty",
            original: "standard",
            adjusted: "reduced",
            reason: "Declining trend with low completion suggests overwhelm. Reduce difficulty.",
        });
    }

    // ── Check 4: Skill focus validation ──────────────────
    const weakSkills = state.skillScores.filter((s) => s.score < 40);
    const strategyText = strategy.rawText.toLowerCase();
    const addressesWeakSkills = weakSkills.some((s) =>
        strategyText.includes(s.skill.toLowerCase())
    );

    if (weakSkills.length > 0 && !addressesWeakSkills) {
        warnings.push(
            `Strategy does not address critically weak skills: ${weakSkills.map((s) => `${s.skill} (${s.score})`).join(", ")}. Consider adding training.`
        );
    }

    // ── Check 5: Recent intervention repetition ──────────
    if (memory?.lastIntervention.type) {
        const daysSinceIntervention = daysSince(memory.lastIntervention.date);
        if (daysSinceIntervention < 1) {
            warnings.push(
                `Intervention already issued today (${memory.lastIntervention.type}). Avoid stacking pressure.`
            );
        }
    }

    // Calculate scores
    const originalScore = calculateFeasibility(totalTasks, avgCompletion, state.hunter.disciplineScore);
    const adjustedScore = adjustments.length > 0
        ? Math.min(100, originalScore + (adjustments.length * 10))
        : originalScore;

    const summary = adjustments.length > 0
        ? `Shadow Coach made ${adjustments.length} adjustment(s). Feasibility: ${originalScore} → ${adjustedScore}/100.`
        : warnings.length > 0
            ? `No adjustments, but ${warnings.length} warning(s) flagged.`
            : "Strategy approved. No issues detected.";

    return {
        approved: originalScore >= 40,
        adjustments,
        warnings,
        originalScore,
        adjustedScore,
        summary,
    };
}

// ============================================================
// Review a single response (for console commands)
// ============================================================

export function reviewConsoleResponse(
    response: string,
    state: SystemState
): { feedback: string | null } {
    // Check if response is too long for a console answer
    if (response.length > 2000) {
        return { feedback: "Response exceeds console limit. Truncate to key points." };
    }

    // Check if response contradicts state
    if (response.toLowerCase().includes("no tasks") && state.activeHabits.length > 0) {
        return { feedback: "Response claims no tasks, but active habits exist. Contradiction detected." };
    }

    // Check if response is too vague
    const vaguePatterns = [
        /keep going/i,
        /you can do it/i,
        /try harder/i,
        /stay focused/i,
    ];
    const isVague = vaguePatterns.some((p) => p.test(response)) && response.length < 100;
    if (isVague) {
        return { feedback: "Response is generic. Should reference specific hunter data." };
    }

    return { feedback: null };
}

// ============================================================
// HELPERS
// ============================================================

function estimateCapacity(
    avgCompletion: number,
    activeTasks: number
): { maxFeasibleTasks: number; loadFactor: number } {
    // If avg completion is 80%+ with 6 tasks, they can handle 7-8
    // If avg completion is 40% with 6 tasks, they should do 3-4
    const loadFactor = avgCompletion / 100;
    const maxFeasible = Math.max(2, Math.round(activeTasks * loadFactor * 1.2));

    return { maxFeasibleTasks: maxFeasible, loadFactor };
}

function calculateFeasibility(
    taskCount: number,
    avgCompletion: number,
    discipline: number
): number {
    // Score based on: can the hunter realistically complete this plan?
    let score = 50;

    // High completion history → higher feasibility
    score += Math.round((avgCompletion - 50) * 0.5);

    // High discipline → higher feasibility
    score += Math.round((discipline - 50) * 0.3);

    // Too many tasks → lower feasibility
    if (taskCount > 8) score -= (taskCount - 8) * 5;
    if (taskCount > 12) score -= 15;

    // Few tasks → higher feasibility
    if (taskCount <= 4) score += 10;

    return Math.max(0, Math.min(100, score));
}

function daysSince(dateStr: string): number {
    if (!dateStr) return Infinity;
    return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

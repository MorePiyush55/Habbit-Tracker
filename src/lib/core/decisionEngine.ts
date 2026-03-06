/**
 * Decision Engine — AI Reasoning Layer Before Directive Execution
 * ================================================================
 * Sits between Brain Controller and Directive Executor.
 * Evaluates candidate directives, assigns confidence scores,
 * filters conflicting/redundant actions, and reasons about intent.
 *
 * Flow:
 *   Brain Controller → Decision Engine → Filtered Directives → Executor
 *
 * Benefits:
 *   - System reasons before acting (no blind execution)
 *   - Confidence scoring for audit trail
 *   - Conflict resolution between competing directives
 *   - Deduplication of redundant actions
 */

import type { SystemDirective, SystemState, SystemNotification } from "@/types";
import type { MemorySnapshot } from "./systemMemory";
import { rememberDecision } from "./systemMemory";

// ============================================================
// Types
// ============================================================

export interface EvaluatedDirective extends SystemDirective {
    confidence: number;        // 0.0 – 1.0
    reasoning: string;         // Why this directive was approved/rejected
    approved: boolean;         // Whether it passed evaluation
    originalIndex: number;     // Position in the original list
}

export interface DecisionResult {
    approved: EvaluatedDirective[];
    rejected: EvaluatedDirective[];
    conflicts: string[];       // Descriptions of detected conflicts
    totalEvaluated: number;
}

// ============================================================
// CORE: Evaluate all directives before execution
// ============================================================

export async function evaluateDirectives(
    userId: string,
    directives: SystemDirective[],
    state: SystemState,
    memory: MemorySnapshot | null
): Promise<DecisionResult> {
    const evaluated: EvaluatedDirective[] = [];
    const conflicts: string[] = [];

    // Phase 1: Score each directive individually
    for (let i = 0; i < directives.length; i++) {
        const d = directives[i];
        const score = scoreDirective(d, state, memory);
        evaluated.push({
            ...d,
            confidence: score.confidence,
            reasoning: score.reasoning,
            approved: score.confidence >= 0.3, // Min threshold to execute
            originalIndex: i,
        });
    }

    // Phase 2: Detect and resolve conflicts
    resolveConflicts(evaluated, conflicts);

    // Phase 3: Deduplicate redundant directives
    deduplicateDirectives(evaluated, conflicts);

    // Phase 4: Check against memory (avoid repeating recent interventions)
    if (memory) {
        checkMemoryConflicts(evaluated, memory, conflicts);
    }

    const approved = evaluated.filter((e) => e.approved);
    const rejected = evaluated.filter((e) => !e.approved);

    // Phase 5: Persist top decisions to memory
    for (const d of approved.slice(0, 5)) {
        try {
            await rememberDecision(userId, d.type, d.confidence, d.reasoning);
        } catch {
            // Non-fatal
        }
    }

    return {
        approved,
        rejected,
        conflicts,
        totalEvaluated: directives.length,
    };
}

// ============================================================
// SCORE: Assign confidence to a directive
// ============================================================

function scoreDirective(
    directive: SystemDirective,
    state: SystemState,
    memory: MemorySnapshot | null
): { confidence: number; reasoning: string } {
    let confidence = 0.5; // Base confidence
    let reasoning = "";

    switch (directive.type) {
        case "REWARD_XP": {
            confidence = 0.95;
            reasoning = "XP rewards are always valid on task completion.";
            break;
        }

        case "DEDUCT_XP": {
            confidence = 0.90;
            reasoning = "XP deduction valid on task uncomplete.";
            break;
        }

        case "TRIGGER_WARNING": {
            // Higher confidence if performance is actually declining
            if (state.behaviorAnalysis.trend === "declining") {
                confidence = 0.92;
                reasoning = "Performance trending down — warning justified.";
            } else if (state.hunter.disciplineScore < 40) {
                confidence = 0.88;
                reasoning = `Discipline at ${state.hunter.disciplineScore}% — warning appropriate.`;
            } else {
                confidence = 0.55;
                reasoning = "Performance acceptable — warning may be premature.";
            }

            // If we already warned recently, lower confidence
            if (memory?.lastIntervention.type === "TRIGGER_WARNING") {
                const daysSince = daysBetween(memory.lastIntervention.date);
                if (daysSince < 1) {
                    confidence *= 0.4;
                    reasoning += " Already warned today — reducing urgency.";
                }
            }
            break;
        }

        case "TRIGGER_COMMENDATION": {
            confidence = 0.85;
            reasoning = "Positive reinforcement improves retention.";
            // Lower confidence if performance is poor (contradicts reality)
            if (state.behaviorAnalysis.avgCompletion < 40) {
                confidence = 0.35;
                reasoning = "Average completion very low — commendation may not be appropriate.";
            }
            break;
        }

        case "TRIGGER_TRAINING": {
            const weakSkills = state.skillScores.filter((s) => s.score < 50);
            if (weakSkills.length > 0) {
                confidence = 0.88;
                reasoning = `${weakSkills.length} weak skill(s) detected — training justified.`;
            } else {
                confidence = 0.45;
                reasoning = "No critically weak skills — training may be unnecessary.";
            }
            break;
        }

        case "SCALE_DIFFICULTY": {
            const habit = state.activeHabits.find((h) => h.id === directive.data.habitId);
            if (habit && habit.consecutiveCompletions >= 6) {
                confidence = 0.90;
                reasoning = `${habit.name}: ${habit.consecutiveCompletions} consecutive completions — scale up.`;
            } else {
                confidence = 0.40;
                reasoning = "Insufficient consecutive completions for scaling.";
            }
            break;
        }

        case "GENERATE_QUEST": {
            confidence = 0.80;
            reasoning = "Quest generation keeps engagement high.";
            if (state.weakHabits.length > 0) {
                confidence = 0.90;
                reasoning += ` ${state.weakHabits.length} weak habit(s) need quest focus.`;
            }
            break;
        }

        case "GENERATE_STRATEGY": {
            // Check if we already have today's strategy cached
            if (memory) {
                const today = new Date().toISOString().split("T")[0];
                if (memory.lastStrategy.date === today) {
                    confidence = 0.20;
                    reasoning = "Strategy already generated today — skip.";
                } else {
                    confidence = 0.85;
                    reasoning = "No strategy for today — generation needed.";
                }
            } else {
                confidence = 0.80;
                reasoning = "Strategy generation requested.";
            }
            break;
        }

        case "GENERATE_NOTIFICATION": {
            confidence = 0.70;
            reasoning = "AI-generated notification for user engagement.";
            break;
        }

        case "UPDATE_BOSS": {
            confidence = 0.90;
            reasoning = "Boss state update is event-driven and valid.";
            if (state.bossRaid.bossDefeatedThisWeek) {
                confidence = 0.30;
                reasoning = "Boss already defeated this week.";
            }
            break;
        }

        case "LOG_BEHAVIOR": {
            confidence = 0.95;
            reasoning = "Behavior logging is always valid.";
            break;
        }

        case "ANALYZE_PERFORMANCE": {
            confidence = 0.80;
            reasoning = "Performance analysis on session start.";
            break;
        }

        case "ISSUE_PENALTY": {
            // Penalties need strong justification
            if (state.hunter.disciplineScore < 30) {
                confidence = 0.85;
                reasoning = `Discipline critically low (${state.hunter.disciplineScore}) — penalty justified.`;
            } else if (state.behaviorAnalysis.trend === "declining" && state.behaviorAnalysis.avgCompletion < 40) {
                confidence = 0.75;
                reasoning = "Declining performance and low completion — penalty may help.";
            } else {
                confidence = 0.35;
                reasoning = "Penalty not strongly justified by current performance.";
            }
            break;
        }

        case "NO_ACTION": {
            confidence = 1.0;
            reasoning = "No action is always safe.";
            break;
        }

        default: {
            confidence = 0.50;
            reasoning = `Unknown directive type: ${directive.type}`;
        }
    }

    return { confidence: Math.min(1.0, Math.max(0.0, confidence)), reasoning };
}

// ============================================================
// CONFLICT RESOLUTION: Competing directives
// ============================================================

function resolveConflicts(
    directives: EvaluatedDirective[],
    conflicts: string[]
): void {
    // Conflict: REWARD_XP and DEDUCT_XP for the same habit
    const rewardHabits = directives.filter((d) => d.type === "REWARD_XP" && d.approved);
    const deductHabits = directives.filter((d) => d.type === "DEDUCT_XP" && d.approved);

    for (const reward of rewardHabits) {
        const conflicting = deductHabits.find(
            (d) => d.data.habitId === reward.data.habitId
        );
        if (conflicting) {
            // Keep the more recent one (higher original index)
            if (reward.originalIndex > conflicting.originalIndex) {
                conflicting.approved = false;
                conflicting.reasoning += " [CONFLICT: overridden by later REWARD_XP]";
            } else {
                reward.approved = false;
                reward.reasoning += " [CONFLICT: overridden by later DEDUCT_XP]";
            }
            conflicts.push(
                `XP conflict on habit ${reward.data.habitId}: REWARD vs DEDUCT — kept more recent.`
            );
        }
    }

    // Conflict: TRIGGER_WARNING and TRIGGER_COMMENDATION in same batch
    const warnings = directives.filter((d) => d.type === "TRIGGER_WARNING" && d.approved);
    const commendations = directives.filter((d) => d.type === "TRIGGER_COMMENDATION" && d.approved);

    if (warnings.length > 0 && commendations.length > 0) {
        // Keep higher-confidence side
        const maxWarning = Math.max(...warnings.map((w) => w.confidence));
        const maxCommend = Math.max(...commendations.map((c) => c.confidence));

        if (maxWarning > maxCommend) {
            for (const c of commendations) {
                c.approved = false;
                c.reasoning += " [CONFLICT: warning takes priority over commendation]";
            }
        } else {
            for (const w of warnings) {
                w.approved = false;
                w.reasoning += " [CONFLICT: commendation takes priority over warning]";
            }
        }
        conflicts.push("Warning vs Commendation conflict — kept higher-confidence side.");
    }
}

// ============================================================
// DEDUPLICATION: Remove redundant directives
// ============================================================

function deduplicateDirectives(
    directives: EvaluatedDirective[],
    conflicts: string[]
): void {
    const seen = new Map<string, number>(); // type+key → index

    for (const d of directives) {
        if (!d.approved) continue;

        const dedupeKey = `${d.type}:${d.data.habitId || d.data.skill || "global"}`;

        if (seen.has(dedupeKey)) {
            const existingIdx = seen.get(dedupeKey)!;
            const existing = directives[existingIdx];
            // Keep the higher-confidence one
            if (d.confidence > existing.confidence) {
                existing.approved = false;
                existing.reasoning += " [DUPLICATE: lower confidence copy removed]";
                seen.set(dedupeKey, directives.indexOf(d));
            } else {
                d.approved = false;
                d.reasoning += " [DUPLICATE: lower confidence copy removed]";
            }
            conflicts.push(`Duplicate ${d.type} for ${d.data.habitId || "global"} — kept higher confidence.`);
        } else {
            seen.set(dedupeKey, directives.indexOf(d));
        }
    }
}

// ============================================================
// MEMORY CHECK: Don't repeat recent interventions
// ============================================================

function checkMemoryConflicts(
    directives: EvaluatedDirective[],
    memory: MemorySnapshot,
    conflicts: string[]
): void {
    const today = new Date().toISOString().split("T")[0];

    for (const d of directives) {
        if (!d.approved) continue;

        // Don't issue the same intervention type twice in one day
        if (
            (d.type === "TRIGGER_WARNING" || d.type === "ISSUE_PENALTY" || d.type === "TRIGGER_TRAINING") &&
            memory.lastIntervention.type === d.type &&
            memory.lastIntervention.date === today
        ) {
            d.confidence *= 0.3;
            d.reasoning += ` [MEMORY: same intervention (${d.type}) already issued today]`;
            if (d.confidence < 0.3) {
                d.approved = false;
                conflicts.push(`${d.type} already issued today — suppressed.`);
            }
        }

        // Check if we've made this exact decision recently
        const recentSame = memory.recentDecisionsSummary.filter(
            (dec) => dec.decision === d.type && dec.date === today
        );
        if (recentSame.length >= 3) {
            d.confidence *= 0.5;
            d.reasoning += ` [MEMORY: ${d.type} already decided ${recentSame.length} times today]`;
            if (d.confidence < 0.3) {
                d.approved = false;
                conflicts.push(`${d.type} decided ${recentSame.length} times today — suppressed.`);
            }
        }
    }
}

// ============================================================
// DECISION ROUTING: Choose rule vs AI vs cache
// ============================================================

export type DecisionPath = "rule" | "ai" | "cache";

export interface RoutingDecision {
    path: DecisionPath;
    reason: string;
    confidence: number;
}

/**
 * Determines whether a command/directive should be handled by
 * rule engine, AI, or cached response.
 */
export function routeDecision(
    directiveType: string,
    memory: MemorySnapshot | null
): RoutingDecision {
    // Always rule-based (deterministic, instant)
    const RULE_TYPES = new Set([
        "REWARD_XP", "DEDUCT_XP", "LOG_BEHAVIOR", "UPDATE_BOSS",
        "SCALE_DIFFICULTY", "NO_ACTION", "ANALYZE_PERFORMANCE",
        "SHOW_REMAINING_TASKS", "SHOW_COMPLETED_TASKS", "SHOW_STATUS",
        "SHOW_SKILL_REPORT", "SHOW_HELP",
        "REQUEST_REMAINING_TASKS", "REQUEST_COMPLETED_TASKS",
        "REQUEST_STATUS", "REQUEST_SKILL_REPORT", "REQUEST_HELP",
        "REQUEST_PREDICTION", "REQUEST_WORKLOAD_CHECK",
    ]);

    // Always AI (complex reasoning needed)
    const AI_TYPES = new Set([
        "GENERATE_STRATEGY", "FREE_CHAT", "REQUEST_DEBRIEF",
        "REQUEST_BEHAVIOR_ANALYSIS", "REQUEST_MOTIVATION",
    ]);

    // Cache candidates (check memory first)
    const CACHE_TYPES = new Set([
        "GENERATE_QUEST", "REQUEST_DAILY_STRATEGY",
    ]);

    if (RULE_TYPES.has(directiveType)) {
        return { path: "rule", reason: "Deterministic operation — rule engine handles this.", confidence: 1.0 };
    }

    if (CACHE_TYPES.has(directiveType) && memory) {
        const today = new Date().toISOString().split("T")[0];
        if (memory.lastStrategy.date === today) {
            return { path: "cache", reason: "Today's result already cached in memory.", confidence: 0.95 };
        }
    }

    if (AI_TYPES.has(directiveType)) {
        return { path: "ai", reason: "Complex reasoning required — AI layer needed.", confidence: 0.85 };
    }

    // Default to rule with lower confidence
    return { path: "rule", reason: "Unknown type — defaulting to rule engine.", confidence: 0.5 };
}

// ============================================================
// HELPERS
// ============================================================

function daysBetween(dateStr: string): number {
    if (!dateStr) return Infinity;
    const diff = Date.now() - new Date(dateStr).getTime();
    return diff / (1000 * 60 * 60 * 24);
}

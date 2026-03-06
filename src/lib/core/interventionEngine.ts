/**
 * Intervention Engine — Escalating System Response
 * ===================================================
 * When the system detects repeated failure, it escalates actions
 * progressively instead of repeating the same intervention.
 *
 * Escalation Levels:
 *   Level 0: Observation (no action)
 *   Level 1: Warning message
 *   Level 2: Penalty quest assigned
 *   Level 3: Training test required
 *   Level 4: Difficulty reduction + mandatory review
 *
 * The engine tracks escalation per-user in System Memory.
 */

import type { SystemState, SystemDirective } from "@/types";
import type { MemorySnapshot } from "./systemMemory";
import { storeIntervention } from "./systemMemory";

// ============================================================
// Types
// ============================================================

export interface InterventionDecision {
    shouldIntervene: boolean;
    level: number;                      // 0-4
    action: InterventionAction;
    directives: SystemDirective[];
    reason: string;
    escalated: boolean;                 // Did we escalate from previous level?
}

export type InterventionAction =
    | "NONE"
    | "WARNING"
    | "PENALTY_QUEST"
    | "TRAINING_TEST"
    | "DIFFICULTY_REDUCTION";

// ============================================================
// CORE: Evaluate whether intervention is needed
// ============================================================

export async function evaluateIntervention(
    userId: string,
    state: SystemState,
    memory: MemorySnapshot
): Promise<InterventionDecision> {
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Determine current failure severity
    const severity = assessFailureSeverity(state);

    if (severity === "none") {
        return {
            shouldIntervene: false,
            level: 0,
            action: "NONE",
            directives: [],
            reason: "Performance within acceptable range.",
            escalated: false,
        };
    }

    // Determine escalation level based on previous intervention + current severity
    const previousLevel = memory.lastIntervention.escalationLevel || 0;
    const lastInterventionDate = memory.lastIntervention.date;
    const daysSinceIntervention = lastInterventionDate
        ? Math.floor((Date.now() - new Date(lastInterventionDate).getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;

    let newLevel = calculateEscalationLevel(severity, previousLevel, daysSinceIntervention);

    // Generate directives for this escalation level
    const { action, directives } = generateInterventionDirectives(newLevel, state, now);
    const escalated = newLevel > previousLevel;

    const reason = buildInterventionReason(severity, newLevel, state);

    // Persist the intervention to memory
    try {
        await storeIntervention(userId, action, reason, newLevel);
    } catch {
        // Non-fatal
    }

    return {
        shouldIntervene: true,
        level: newLevel,
        action,
        directives,
        reason,
        escalated,
    };
}

// ============================================================
// ASSESS: How severe is the current failure?
// ============================================================

type FailureSeverity = "none" | "mild" | "moderate" | "severe" | "critical";

function assessFailureSeverity(state: SystemState): FailureSeverity {
    const { behaviorAnalysis, hunter } = state;

    // Critical: very low discipline + declining + low completion
    if (
        hunter.disciplineScore < 25 &&
        behaviorAnalysis.trend === "declining" &&
        behaviorAnalysis.avgCompletion < 30
    ) {
        return "critical";
    }

    // Severe: low discipline OR very low completion
    if (hunter.disciplineScore < 35 || behaviorAnalysis.avgCompletion < 25) {
        return "severe";
    }

    // Moderate: declining trend with below-average completion
    if (behaviorAnalysis.trend === "declining" && behaviorAnalysis.avgCompletion < 50) {
        return "moderate";
    }

    // Mild: slight decline or many weak habits
    if (
        behaviorAnalysis.trend === "declining" ||
        state.weakHabits.length >= 3 ||
        hunter.streak === 0
    ) {
        return "mild";
    }

    return "none";
}

// ============================================================
// CALCULATE: Determine escalation level
// ============================================================

function calculateEscalationLevel(
    severity: FailureSeverity,
    previousLevel: number,
    daysSince: number
): number {
    // If it's been 7+ days since last intervention, reset escalation
    if (daysSince >= 7) {
        return severityToBaseLevel(severity);
    }

    // If same day, don't escalate further
    if (daysSince < 1) {
        return previousLevel;
    }

    // Escalate: previous level + severity bump
    const severityBump = severity === "critical" ? 2 : severity === "severe" ? 1 : 0;
    const newLevel = Math.min(4, previousLevel + severityBump + (daysSince <= 2 ? 1 : 0));

    return Math.max(newLevel, severityToBaseLevel(severity));
}

function severityToBaseLevel(severity: FailureSeverity): number {
    switch (severity) {
        case "critical": return 3;
        case "severe": return 2;
        case "moderate": return 1;
        case "mild": return 1;
        default: return 0;
    }
}

// ============================================================
// GENERATE: Create directives for each escalation level
// ============================================================

function generateInterventionDirectives(
    level: number,
    state: SystemState,
    timestamp: string
): { action: InterventionAction; directives: SystemDirective[] } {
    const directives: SystemDirective[] = [];

    switch (level) {
        case 0:
            return { action: "NONE", directives: [] };

        case 1: {
            // Warning message
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "high",
                data: {
                    message: `Hunter. Your discipline is at ${state.hunter.disciplineScore}%. Performance trend: ${state.behaviorAnalysis.trend}. This is your warning.`,
                    interventionLevel: 1,
                },
                reason: "Intervention Level 1: Warning issued",
                requiresAI: false,
                timestamp,
            });
            return { action: "WARNING", directives };
        }

        case 2: {
            // Warning + Penalty Quest
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "high",
                data: {
                    message: `ESCALATION: Performance continues to decline. A penalty quest has been assigned.`,
                    interventionLevel: 2,
                },
                reason: "Intervention Level 2: Penalty quest",
                requiresAI: false,
                timestamp,
            });
            directives.push({
                type: "GENERATE_QUEST",
                priority: "critical",
                data: {
                    questType: "penalty",
                    weakHabits: state.weakHabits,
                    reason: "Penalty quest for declining performance",
                },
                reason: "Penalty quest generated due to escalation",
                requiresAI: true,
                timestamp,
            });
            return { action: "PENALTY_QUEST", directives };
        }

        case 3: {
            // Warning + Training Test
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "critical",
                data: {
                    message: `CRITICAL ESCALATION: Mandatory training test required. Your knowledge will be verified.`,
                    interventionLevel: 3,
                },
                reason: "Intervention Level 3: Training test required",
                requiresAI: false,
                timestamp,
            });
            directives.push({
                type: "TRIGGER_TRAINING",
                priority: "critical",
                data: {
                    mandatory: true,
                    reason: "Escalation Level 3 — mandatory skill verification",
                },
                reason: "Mandatory training test due to critical escalation",
                requiresAI: false,
                timestamp,
            });
            return { action: "TRAINING_TEST", directives };
        }

        case 4: {
            // All of the above + Difficulty Reduction
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "critical",
                data: {
                    message: `MAXIMUM ESCALATION: Performance at critical levels. Difficulty reduced. Mandatory review initiated.`,
                    interventionLevel: 4,
                },
                reason: "Intervention Level 4: Difficulty reduction",
                requiresAI: false,
                timestamp,
            });

            // Reduce difficulty of all habits that are below 50% completion
            for (const habit of state.activeHabits) {
                if (habit.progress < 50 && habit.difficultyLevel > 1) {
                    directives.push({
                        type: "SCALE_DIFFICULTY",
                        priority: "high",
                        data: {
                            habitId: habit.id,
                            habitName: habit.name,
                            currentLevel: habit.difficultyLevel,
                            newLevel: Math.max(1, habit.difficultyLevel - 1),
                        },
                        reason: `Difficulty reduction for ${habit.name} due to Level 4 intervention`,
                        requiresAI: false,
                        timestamp,
                    });
                }
            }

            directives.push({
                type: "TRIGGER_TRAINING",
                priority: "critical",
                data: {
                    mandatory: true,
                    reason: "Maximum escalation — full knowledge review",
                },
                reason: "Mandatory training at maximum escalation",
                requiresAI: false,
                timestamp,
            });

            return { action: "DIFFICULTY_REDUCTION", directives };
        }

        default:
            return { action: "NONE", directives: [] };
    }
}

// ============================================================
// BUILD REASON: Human-readable intervention reason
// ============================================================

function buildInterventionReason(
    severity: FailureSeverity,
    level: number,
    state: SystemState
): string {
    const parts: string[] = [];

    parts.push(`Severity: ${severity.toUpperCase()}`);
    parts.push(`Escalation Level: ${level}/4`);
    parts.push(`Discipline: ${state.hunter.disciplineScore}%`);
    parts.push(`Avg Completion: ${state.behaviorAnalysis.avgCompletion}%`);
    parts.push(`Trend: ${state.behaviorAnalysis.trend}`);

    if (state.weakHabits.length > 0) {
        parts.push(`Weak: ${state.weakHabits.slice(0, 3).join(", ")}`);
    }

    return parts.join(" | ");
}

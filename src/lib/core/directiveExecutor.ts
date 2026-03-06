/**
 * Directive Executor — Executes System Brain Decisions
 * =====================================================
 * The Brain decides. The Executor acts.
 * 
 * Each directive type has a handler that performs the actual
 * side effects: DB updates, XP changes, notifications, etc.
 */

import type { SystemDirective, SystemState } from "@/types";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Habit from "@/models/Habit";
import SystemEvent from "@/models/SystemEvent";
import SystemDecision from "@/models/SystemDecision";
import BehaviorLog from "@/models/BehaviorLog";

// ============================================================
// CORE: Execute a batch of directives
// ============================================================
export async function executeDirectives(
    userId: string,
    directives: SystemDirective[],
    state: SystemState
): Promise<void> {
    await connectDB();

    // Sort by priority: critical > high > medium > low
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...directives].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (const directive of sorted) {
        try {
            await executeOne(userId, directive, state);
        } catch (err: any) {
            console.error(`[Executor] Failed to execute ${directive.type}:`, err.message);
            // Non-fatal: continue executing remaining directives
        }
    }
}

// ============================================================
// Execute a single directive
// ============================================================
async function executeOne(
    userId: string,
    directive: SystemDirective,
    state: SystemState
): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    switch (directive.type) {
        case "REWARD_XP": {
            // XP is already handled by progressService inline
            // This directive is for logging/auditing
            await logDecision(userId, "QUEST_GENERATION", directive.reason, directive.data, today);
            break;
        }

        case "DEDUCT_XP": {
            await logDecision(userId, "PENALTY_ISSUED", directive.reason, directive.data, today);
            break;
        }

        case "TRIGGER_WARNING": {
            await createNotificationEvent(
                userId,
                directive.data.eventType || "WEAK_PROGRESS",
                directive.data.message || directive.reason,
                today
            );
            break;
        }

        case "TRIGGER_COMMENDATION": {
            await createNotificationEvent(
                userId,
                directive.data.eventType || "ALL_TASKS_DONE",
                directive.data.message || directive.reason,
                today
            );
            break;
        }

        case "TRIGGER_TRAINING": {
            await logDecision(userId, "SKILL_TEST", directive.reason, {
                skill: directive.data.skill,
                retestNeeded: directive.data.retestNeeded,
            }, today);
            break;
        }

        case "SCALE_DIFFICULTY": {
            const { habitId, newLevel } = directive.data;
            if (habitId && newLevel) {
                await Habit.findByIdAndUpdate(habitId, {
                    $set: { difficultyLevel: newLevel, consecutiveCompletions: 0 },
                });
                console.log(`[Executor] Scaled ${directive.data.habitName} to level ${newLevel}`);
            }
            await logDecision(userId, "DIFFICULTY_SCALE", directive.reason, directive.data, today);
            break;
        }

        case "GENERATE_NOTIFICATION": {
            await createNotificationEvent(
                userId,
                directive.data.eventType || "WEAK_PROGRESS",
                directive.data.message || directive.reason,
                today
            );
            break;
        }

        case "UPDATE_BOSS": {
            if (directive.data.damage) {
                // Boss damage is already handled by progressService inline
                // This is for auditing
            }
            await logDecision(userId, "BOSS_ADJUSTMENT", directive.reason, directive.data, today);
            break;
        }

        case "LOG_BEHAVIOR": {
            // Behavior logging is handled inline by progressService
            // This logs the directive decision
            await logDecision(userId, "BEHAVIOR_ANALYSIS", directive.reason, directive.data, today);
            break;
        }

        case "ANALYZE_PERFORMANCE": {
            // Performance analysis — used on session start
            const analysis = analyzeCurrentPerformance(state);
            if (analysis.needsIntervention) {
                await createNotificationEvent(
                    userId,
                    "WEAK_PROGRESS",
                    analysis.message,
                    today
                );
            }
            break;
        }

        case "GENERATE_QUEST":
        case "GENERATE_STRATEGY": {
            // These are handled by the existing API routes on-demand
            // The directive flags that they should be refreshed
            await logDecision(userId, "QUEST_GENERATION", directive.reason, directive.data, today);
            break;
        }

        case "ISSUE_PENALTY": {
            const penalty = directive.data;
            if (penalty.xpPenalty) {
                await User.findByIdAndUpdate(userId, {
                    $inc: { totalXP: -Math.abs(penalty.xpPenalty) },
                });
            }
            await logDecision(userId, "PENALTY_ISSUED", directive.reason, penalty, today);
            break;
        }

        case "NO_ACTION":
            // Explicitly do nothing
            break;

        default:
            console.warn(`[Executor] Unknown directive type: ${directive.type}`);
    }
}

// ============================================================
// Performance Analysis (deterministic, no AI)
// ============================================================
function analyzeCurrentPerformance(state: SystemState): {
    needsIntervention: boolean;
    message: string;
} {
    const { behaviorAnalysis, hunter } = state;

    if (behaviorAnalysis.trend === "declining" && hunter.disciplineScore < 40) {
        return {
            needsIntervention: true,
            message: `[CRITICAL] Hunter performance in critical decline. Completion: ${behaviorAnalysis.avgCompletion}%. Discipline: ${hunter.disciplineScore}%. Immediate action required.`,
        };
    }

    if (behaviorAnalysis.trend === "declining") {
        return {
            needsIntervention: true,
            message: `[WARNING] Performance trend: DECLINING. Average completion: ${behaviorAnalysis.avgCompletion}%. Reverse this trajectory.`,
        };
    }

    if (behaviorAnalysis.avgCompletion < 50 && behaviorAnalysis.activeDays >= 3) {
        return {
            needsIntervention: true,
            message: `[WARNING] Average completion at ${behaviorAnalysis.avgCompletion}%. This is below acceptable threshold. Increase output.`,
        };
    }

    return { needsIntervention: false, message: "" };
}

// ============================================================
// HELPERS
// ============================================================
async function createNotificationEvent(
    userId: string,
    eventType: string,
    message: string,
    date: string
): Promise<void> {
    // Validate event type against Schema enum
    const validTypes = [
        "TASK_FAILED", "STREAK_BROKEN", "GOAL_COMPLETED", "WEAK_PROGRESS",
        "BOSS_DEFEATED", "LEVEL_UP", "ALL_TASKS_DONE", "SKILL_DEGRADATION",
        "INACTIVITY_WARNING", "DISCIPLINE_IMPROVEMENT"
    ];

    const mappedType = validTypes.includes(eventType) ? eventType : "WEAK_PROGRESS";

    // Skip if already exists today
    const existing = await SystemEvent.findOne({ userId, eventType: mappedType, date });
    if (existing) return;

    await SystemEvent.create({
        userId,
        eventType: mappedType,
        message,
        date,
    });
}

async function logDecision(
    userId: string,
    decisionType: string,
    reason: string,
    data: Record<string, any>,
    date: string
): Promise<void> {
    try {
        // Validate decision type against Schema enum
        const validTypes = [
            "QUEST_GENERATION", "DAILY_STRATEGY", "DIFFICULTY_SCALE",
            "PENALTY_ISSUED", "SKILL_TEST", "BEHAVIOR_ANALYSIS",
            "BOSS_ADJUSTMENT", "INACTIVITY_CHECK", "EVENT_TRIGGERED"
        ];
        const mapped = validTypes.includes(decisionType) ? decisionType : "EVENT_TRIGGERED";

        await SystemDecision.create({
            userId,
            decisionType: mapped,
            reason: reason.substring(0, 500),
            context: data,
            result: { processed: true },
            date,
        });
    } catch (err: any) {
        // Non-fatal
        console.error("[Executor] Decision log failed:", err.message);
    }
}

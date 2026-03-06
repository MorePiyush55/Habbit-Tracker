/**
 * Event Bus — The Heartbeat of the AI Discipline OS
 * ===================================================
 * All user actions flow through here as events.
 * The event bus dispatches to:
 *   1. Rule Engine (instant, deterministic)
 *   2. System Brain (complex decisions, may call AI)
 *   3. Notification Engine (user-facing alerts)
 *
 * Architecture:
 *   User Action → emit() → Event Bus → System Brain → Directives → Execute
 */

import type { SystemEventPayload, SystemEventType, SystemState, BrainDecisionResult } from "@/types";
import { buildSystemState } from "./systemState";
import { processBrainEvent } from "./brainController";
import { executeDirectives } from "./directiveExecutor";
import connectDB from "@/lib/mongodb";
import SystemEvent from "@/models/SystemEvent";

// ============================================================
// EVENT CREATION HELPERS
// ============================================================

export function createEvent(
    type: SystemEventType,
    userId: string,
    payload: Record<string, any> = {}
): SystemEventPayload {
    return {
        type,
        userId,
        timestamp: new Date().toISOString(),
        payload,
    };
}

// ============================================================
// CORE: Emit an event into the OS
// ============================================================
/**
 * emit() — The primary entry point for ALL user actions.
 *
 * Flow:
 *   1. Build current system state
 *   2. Send event + state to System Brain
 *   3. Brain produces directives
 *   4. Execute directives (XP, notifications, quests, etc.)
 *   5. Persist event for audit trail
 *   6. Return result to caller
 */
export async function emit(event: SystemEventPayload): Promise<BrainDecisionResult | null> {
    const startTime = Date.now();

    try {
        await connectDB();

        console.log(`[Event Bus] ⚡ ${event.type} | User: ${event.userId}`);

        // Step 1: Build system state
        const state = await buildSystemState(event.userId);

        // Step 2: Route to System Brain
        const decision = await processBrainEvent(event, state);

        // Step 3: Execute all directives produced by the brain
        if (decision.directives.length > 0) {
            await executeDirectives(event.userId, decision.directives, state);
        }

        // Step 4: Persist the event for audit trail
        await persistEvent(event, decision);

        const processingTime = Date.now() - startTime;
        console.log(`[Event Bus] ✓ ${event.type} processed in ${processingTime}ms | ${decision.directives.length} directives | AI: ${decision.metadata.aiCalled}`);

        return {
            ...decision,
            metadata: {
                ...decision.metadata,
                processingTimeMs: processingTime,
            },
        };
    } catch (error: any) {
        console.error(`[Event Bus] ✗ Failed to process ${event.type}:`, error.message);
        return null;
    }
}

// ============================================================
// BATCH EMIT: Process multiple events (e.g., daily reset)
// ============================================================
export async function emitBatch(events: SystemEventPayload[]): Promise<(BrainDecisionResult | null)[]> {
    const results: (BrainDecisionResult | null)[] = [];
    for (const event of events) {
        results.push(await emit(event));
    }
    return results;
}

// ============================================================
// SILENT EMIT: Process event but don't generate notifications
// Used for internal bookkeeping events.
// ============================================================
export async function emitSilent(event: SystemEventPayload): Promise<void> {
    try {
        await connectDB();
        const state = await buildSystemState(event.userId);
        const decision = await processBrainEvent(event, state);

        // Only execute non-notification directives
        const silentDirectives = decision.directives.filter(
            (d) => d.type !== "GENERATE_NOTIFICATION" && d.type !== "TRIGGER_WARNING" && d.type !== "TRIGGER_COMMENDATION"
        );

        if (silentDirectives.length > 0) {
            await executeDirectives(event.userId, silentDirectives, state);
        }
    } catch (error: any) {
        console.error(`[Event Bus] Silent emit failed for ${event.type}:`, error.message);
    }
}

// ============================================================
// PERSIST: Store event in database for audit/replay
// ============================================================
async function persistEvent(
    event: SystemEventPayload,
    decision: BrainDecisionResult
): Promise<void> {
    try {
        // Map the OS event type to the existing SystemEvent model enum
        const mappedType = mapToStoredEventType(event.type);
        if (!mappedType) return; // Skip events that don't need persistence

        const notificationMessages = decision.notifications.map((n) => n.message).join("\n");
        const directiveSummary = decision.directives.map((d) => d.type).join(", ");

        const date = new Date().toISOString().split("T")[0];

        // Check if already persisted today
        const existing = await SystemEvent.findOne({
            userId: event.userId,
            eventType: mappedType,
            date,
        });
        if (existing) return;

        await SystemEvent.create({
            userId: event.userId,
            eventType: mappedType,
            message: notificationMessages || `System processed: ${event.type}`,
            context: JSON.stringify({
                payload: event.payload,
                directives: directiveSummary,
            }),
            date,
        });
    } catch (err: any) {
        // Non-fatal: event persistence failure shouldn't block the flow
        console.error("[Event Bus] Event persistence failed (non-fatal):", err.message);
    }
}

/**
 * Map OS event types to the existing SystemEvent model enum values.
 * Returns null for events that don't need to be stored as SystemEvents.
 */
function mapToStoredEventType(type: SystemEventType): string | null {
    const mapping: Partial<Record<SystemEventType, string>> = {
        TASK_COMPLETED: "GOAL_COMPLETED",
        TASK_FAILED: "TASK_FAILED",
        STREAK_BROKEN: "STREAK_BROKEN",
        LEVEL_UP: "LEVEL_UP",
        BOSS_DEFEATED: "BOSS_DEFEATED",
        ALL_TASKS_DONE: "ALL_TASKS_DONE",
        WEAK_PROGRESS: "WEAK_PROGRESS",
        SKILL_DEGRADATION: "SKILL_DEGRADATION",
        INACTIVITY: "INACTIVITY_WARNING",
        DISCIPLINE_IMPROVEMENT: "DISCIPLINE_IMPROVEMENT",
    };
    return mapping[type] || null;
}

// ============================================================
// CONVENIENCE EMITTERS — Typed shortcuts for common events
// ============================================================

export const SystemEvents = {
    taskCompleted: (userId: string, habitId: string, habitName: string, xpEarned: number) =>
        createEvent("TASK_COMPLETED", userId, { habitId, habitName, xpEarned }),

    taskFailed: (userId: string, habitId: string, habitName: string) =>
        createEvent("TASK_FAILED", userId, { habitId, habitName }),

    subtaskToggled: (userId: string, habitId: string, subtaskId: string, completed: boolean, xpDelta: number) =>
        createEvent("SUBTASK_TOGGLED", userId, { habitId, subtaskId, completed, xpDelta }),

    streakBroken: (userId: string, previousStreak: number) =>
        createEvent("STREAK_BROKEN", userId, { previousStreak }),

    streakMilestone: (userId: string, streakDays: number) =>
        createEvent("STREAK_MILESTONE", userId, { streakDays }),

    inactivity: (userId: string, daysMissed: number) =>
        createEvent("INACTIVITY", userId, { daysMissed }),

    skillDegradation: (userId: string, skill: string, currentScore: number) =>
        createEvent("SKILL_DEGRADATION", userId, { skill, currentScore }),

    levelUp: (userId: string, previousLevel: number, newLevel: number) =>
        createEvent("LEVEL_UP", userId, { previousLevel, newLevel }),

    bossDefeated: (userId: string) =>
        createEvent("BOSS_DEFEATED", userId, {}),

    bossDamage: (userId: string, damage: number, remainingHP: number) =>
        createEvent("BOSS_DAMAGE", userId, { damage, remainingHP }),

    allTasksDone: (userId: string, totalXP: number) =>
        createEvent("ALL_TASKS_DONE", userId, { totalXP }),

    weakProgress: (userId: string, completionRate: number) =>
        createEvent("WEAK_PROGRESS", userId, { completionRate }),

    disciplineImprovement: (userId: string, score: number) =>
        createEvent("DISCIPLINE_IMPROVEMENT", userId, { score }),

    questAccepted: (userId: string, questId: string) =>
        createEvent("QUEST_ACCEPTED", userId, { questId }),

    questRejected: (userId: string, questId: string) =>
        createEvent("QUEST_REJECTED", userId, { questId }),

    trainingCompleted: (userId: string, skill: string, score: number, correct: boolean) =>
        createEvent("TRAINING_COMPLETED", userId, { skill, score, correct }),

    habitCreated: (userId: string, habitId: string, habitName: string) =>
        createEvent("HABIT_CREATED", userId, { habitId, habitName }),

    habitDeleted: (userId: string, habitId: string) =>
        createEvent("HABIT_DELETED", userId, { habitId }),

    sessionStart: (userId: string) =>
        createEvent("SESSION_START", userId, {}),

    dailyReset: (userId: string) =>
        createEvent("DAILY_RESET", userId, {}),
};

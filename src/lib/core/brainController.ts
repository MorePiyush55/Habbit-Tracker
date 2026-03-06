/**
 * Brain Controller — The Central Intelligence of the AI Discipline OS
 * ====================================================================
 * Receives events + system state, produces directives.
 *
 * Decision flow:
 *   1. Rule Engine (instant, deterministic) — handles simple cases
 *   2. AI Layer (Gemini/DeepSeek) — handles complex reasoning
 *   3. Directive Assembly — combines rule + AI outputs into directives
 *
 * The Brain does NOT execute directives. It only decides.
 * Execution is handled by directiveExecutor.ts
 */

import type {
    SystemEventPayload,
    SystemState,
    BrainDecisionResult,
    SystemDirective,
    SystemNotification,
    SystemEventType,
} from "@/types";
import { evaluateRules, type RuleResult } from "@/lib/system/ruleEngine";

// ============================================================
// CORE: Process an event through the Brain
// ============================================================
export async function processBrainEvent(
    event: SystemEventPayload,
    state: SystemState
): Promise<BrainDecisionResult> {
    const startTime = Date.now();
    const directives: SystemDirective[] = [];
    const notifications: SystemNotification[] = [];
    const rulesTriggered: string[] = [];
    let aiCalled = false;

    // ============================================================
    // PHASE 1: Rule Engine — Instant deterministic decisions
    // ============================================================
    const ruleContext = buildRuleContext(event, state);
    const ruleResults = evaluateRules(ruleContext);

    for (const rule of ruleResults) {
        rulesTriggered.push(rule.eventType);

        // Convert rule results to directives
        const ruleDirectives = ruleToDirectives(rule, event, state);
        directives.push(...ruleDirectives);

        // Convert rule results to notifications
        if (rule.message) {
            notifications.push({
                type: mapSeverityToType(rule.severity),
                title: rule.eventType.replace(/_/g, " "),
                message: rule.message,
                severity: rule.severity,
                eventType: event.type,
            });
        }
    }

    // ============================================================
    // PHASE 2: Event-specific logic (deterministic)
    // ============================================================
    const eventDirectives = processEventSpecificLogic(event, state);
    directives.push(...eventDirectives.directives);
    notifications.push(...eventDirectives.notifications);

    // ============================================================
    // PHASE 3: AI Layer — Only for rules that flag requiresAI
    // ============================================================
    const aiNeededRules = ruleResults.filter((r) => r.requiresAI && r.aiContext);
    if (aiNeededRules.length > 0) {
        try {
            const aiDirectives = await processAIDecisions(aiNeededRules, event, state);
            directives.push(...aiDirectives.directives);
            notifications.push(...aiDirectives.notifications);
            aiCalled = true;
        } catch (err: any) {
            console.error("[Brain] AI processing failed (using rule fallbacks):", err.message);
        }
    }

    return {
        directives,
        stateUpdates: {},
        notifications,
        metadata: {
            eventProcessed: event.type,
            processingTimeMs: Date.now() - startTime,
            aiCalled,
            rulesTriggered,
        },
    };
}

// ============================================================
// Build rule context from event + state
// ============================================================
function buildRuleContext(event: SystemEventPayload, state: SystemState) {
    const todayBehavior = state.recentBehavior[0];

    // Build habit missed days map from behavior analysis
    const habitMissedDays: Record<string, number> = {};
    for (const habit of state.weakHabits) {
        // Count how many of the last 7 days this habit appeared as weak
        const weakDays = state.recentBehavior.filter((d) =>
            d.weakHabits.includes(habit)
        ).length;
        if (weakDays >= 3) {
            habitMissedDays[habit] = weakDays;
        }
    }

    return {
        completionRate: todayBehavior?.completionRate ?? 0,
        tasksCompleted: todayBehavior?.tasksCompleted ?? 0,
        tasksFailed: todayBehavior?.tasksFailed ?? 0,
        totalTasks: state.activeHabits.length,
        currentStreak: state.hunter.streak,
        previousStreak: event.payload.previousStreak ?? state.hunter.streak,
        longestStreak: state.hunter.longestStreak,
        xpEarned: event.payload.xpDelta ?? event.payload.xpEarned ?? 0,
        totalXP: state.hunter.xp,
        xpDelta: event.payload.xpDelta ?? 0,
        currentLevel: state.hunter.level,
        previousLevel: event.payload.previousLevel ?? state.hunter.level,
        bossDefeated: event.type === "BOSS_DEFEATED" || state.bossRaid.bossDefeatedThisWeek,
        weeklyBossHP: state.bossRaid.bossHP,
        disciplineScore: state.hunter.disciplineScore,
        focusScore: state.hunter.focusScore,
        consecutiveMissedDays: 0,
        habitMissedDays,
    };
}

// ============================================================
// Convert rule results to system directives
// ============================================================
function ruleToDirectives(
    rule: RuleResult,
    event: SystemEventPayload,
    state: SystemState
): SystemDirective[] {
    const directives: SystemDirective[] = [];
    const now = new Date().toISOString();

    switch (rule.eventType) {
        case "ALL_TASKS_DONE":
            directives.push({
                type: "TRIGGER_COMMENDATION",
                priority: "medium",
                data: { message: rule.message },
                reason: "All tasks completed today",
                requiresAI: false,
                timestamp: now,
            });
            break;

        case "WEAK_PROGRESS":
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "high",
                data: { message: rule.message, completionRate: state.recentBehavior[0]?.completionRate },
                reason: "Low progress detected",
                requiresAI: rule.requiresAI,
                timestamp: now,
            });
            break;

        case "STREAK_BROKEN":
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "critical",
                data: { message: rule.message },
                reason: "Streak chain severed",
                requiresAI: false,
                timestamp: now,
            });
            break;

        case "LEVEL_UP":
            directives.push({
                type: "TRIGGER_COMMENDATION",
                priority: "high",
                data: { message: rule.message, newLevel: state.hunter.level },
                reason: "Hunter leveled up",
                requiresAI: false,
                timestamp: now,
            });
            break;

        case "BOSS_DEFEATED":
            directives.push({
                type: "UPDATE_BOSS",
                priority: "high",
                data: { message: rule.message },
                reason: "Weekly boss defeated",
                requiresAI: false,
                timestamp: now,
            });
            break;

        case "INACTIVITY_WARNING":
            directives.push({
                type: "TRIGGER_WARNING",
                priority: "critical",
                data: { message: rule.message },
                reason: "Zero activity detected",
                requiresAI: false,
                timestamp: now,
            });
            break;

        case "SKILL_DEGRADATION":
            directives.push({
                type: "TRIGGER_TRAINING",
                priority: "high",
                data: { message: rule.message, aiContext: rule.aiContext },
                reason: "Skill degradation detected — training required",
                requiresAI: true,
                timestamp: now,
            });
            break;

        case "DISCIPLINE_IMPROVEMENT":
            directives.push({
                type: "TRIGGER_COMMENDATION",
                priority: "low",
                data: { message: rule.message },
                reason: "Discipline above threshold",
                requiresAI: false,
                timestamp: now,
            });
            break;
    }

    return directives;
}

// ============================================================
// Event-specific deterministic logic
// ============================================================
function processEventSpecificLogic(
    event: SystemEventPayload,
    state: SystemState
): { directives: SystemDirective[]; notifications: SystemNotification[] } {
    const directives: SystemDirective[] = [];
    const notifications: SystemNotification[] = [];
    const now = new Date().toISOString();

    switch (event.type) {
        case "SUBTASK_TOGGLED": {
            const xpDelta = event.payload.xpDelta || 0;
            if (xpDelta > 0) {
                directives.push({
                    type: "REWARD_XP",
                    priority: "low",
                    data: { xp: xpDelta, habitId: event.payload.habitId },
                    reason: "Subtask completed",
                    requiresAI: false,
                    timestamp: now,
                });

                // Check if boss takes damage
                if (!state.bossRaid.bossDefeatedThisWeek) {
                    directives.push({
                        type: "UPDATE_BOSS",
                        priority: "low",
                        data: { damage: xpDelta },
                        reason: "Boss damaged by task completion",
                        requiresAI: false,
                        timestamp: now,
                    });
                }
            } else if (xpDelta < 0) {
                directives.push({
                    type: "DEDUCT_XP",
                    priority: "low",
                    data: { xp: Math.abs(xpDelta), habitId: event.payload.habitId },
                    reason: "Subtask unchecked",
                    requiresAI: false,
                    timestamp: now,
                });
            }

            // Check for difficulty scaling
            const habit = state.activeHabits.find((h) => h.id === event.payload.habitId);
            if (habit && habit.consecutiveCompletions >= 6 && habit.difficultyLevel < 5) {
                directives.push({
                    type: "SCALE_DIFFICULTY",
                    priority: "medium",
                    data: {
                        habitId: habit.id,
                        habitName: habit.name,
                        currentLevel: habit.difficultyLevel,
                        newLevel: habit.difficultyLevel + 1,
                    },
                    reason: `${habit.name} has ${habit.consecutiveCompletions + 1} consecutive completions`,
                    requiresAI: false,
                    timestamp: now,
                });
            }
            break;
        }

        case "TASK_COMPLETED": {
            directives.push({
                type: "LOG_BEHAVIOR",
                priority: "low",
                data: { habitId: event.payload.habitId, habitName: event.payload.habitName },
                reason: "Task completion tracked",
                requiresAI: false,
                timestamp: now,
            });
            break;
        }

        case "SESSION_START": {
            // On session start, analyze if strategy/quests are needed
            directives.push({
                type: "ANALYZE_PERFORMANCE",
                priority: "medium",
                data: {},
                reason: "Session started — analyzing current state",
                requiresAI: false,
                timestamp: now,
            });

            // Check for inactivity
            if (state.recentBehavior.length > 0) {
                const lastDate = state.recentBehavior[0]?.date;
                if (lastDate) {
                    const daysSinceActive = Math.floor(
                        (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    if (daysSinceActive >= 2) {
                        notifications.push({
                            type: "warning",
                            title: "INACTIVITY DETECTED",
                            message: `Hunter. ${daysSinceActive} days without training. Resume immediately.`,
                            severity: "critical",
                            eventType: "INACTIVITY",
                        });
                    }
                }
            }
            break;
        }

        case "DAILY_RESET": {
            // Generate new quests and strategy
            directives.push({
                type: "GENERATE_QUEST",
                priority: "high",
                data: { weakHabits: state.weakHabits },
                reason: "Daily reset — new quests required",
                requiresAI: true,
                timestamp: now,
            });
            directives.push({
                type: "GENERATE_STRATEGY",
                priority: "high",
                data: {},
                reason: "Daily reset — new strategy required",
                requiresAI: true,
                timestamp: now,
            });
            break;
        }

        case "TRAINING_COMPLETED": {
            const score = event.payload.score || 0;
            if (score >= 70) {
                notifications.push({
                    type: "commendation",
                    title: "TRAINING PASSED",
                    message: `Score: ${score}/100. Knowledge verified. Continue progressing.`,
                    severity: "commendation",
                    eventType: "TRAINING_COMPLETED",
                });
            } else {
                notifications.push({
                    type: "warning",
                    title: "TRAINING FAILED",
                    message: `Score: ${score}/100. Weakness confirmed. Additional training required.`,
                    severity: "warning",
                    eventType: "TRAINING_COMPLETED",
                });
                directives.push({
                    type: "TRIGGER_TRAINING",
                    priority: "high",
                    data: { skill: event.payload.skill, retestNeeded: true },
                    reason: "Training score below threshold",
                    requiresAI: false,
                    timestamp: now,
                });
            }
            break;
        }
    }

    return { directives, notifications };
}

// ============================================================
// AI Decision Layer — Only for complex reasoning
// ============================================================
async function processAIDecisions(
    aiRules: RuleResult[],
    event: SystemEventPayload,
    state: SystemState
): Promise<{ directives: SystemDirective[]; notifications: SystemNotification[] }> {
    const directives: SystemDirective[] = [];
    const notifications: SystemNotification[] = [];
    const now = new Date().toISOString();

    // Lazy import AI router to avoid circular deps
    const { aiRouter } = await import("@/lib/ai/aiRouter");
    const { systemEventPrompt } = await import("@/lib/ai/eventPrompts");

    for (const rule of aiRules) {
        try {
            const prompt = systemEventPrompt(rule.eventType, rule.aiContext || "");
            const aiMessage = await aiRouter("notification", prompt);
            const cleanMessage = aiMessage.replace(/```[\s\S]*?```/g, "").trim();

            if (cleanMessage) {
                notifications.push({
                    type: mapSeverityToType(rule.severity),
                    title: rule.eventType.replace(/_/g, " "),
                    message: cleanMessage,
                    severity: rule.severity,
                    eventType: event.type,
                });

                directives.push({
                    type: "GENERATE_NOTIFICATION",
                    priority: rule.severity === "critical" ? "critical" : "high",
                    data: { message: cleanMessage, eventType: rule.eventType },
                    reason: `AI-generated response for ${rule.eventType}`,
                    requiresAI: true,
                    timestamp: now,
                });
            }
        } catch (err: any) {
            console.error(`[Brain] AI failed for rule ${rule.eventType}:`, err.message);
            // Fall back to the rule's static message
            notifications.push({
                type: mapSeverityToType(rule.severity),
                title: rule.eventType.replace(/_/g, " "),
                message: rule.message,
                severity: rule.severity,
                eventType: event.type,
            });
        }
    }

    return { directives, notifications };
}

// ============================================================
// HELPERS
// ============================================================
function mapSeverityToType(severity: string): "alert" | "warning" | "notice" | "commendation" | "system" {
    switch (severity) {
        case "critical": return "alert";
        case "warning": return "warning";
        case "commendation": return "commendation";
        case "info": return "notice";
        default: return "system";
    }
}

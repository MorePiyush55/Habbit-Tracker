/**
 * Rule Engine — Deterministic Intelligence Layer
 * 
 * Fast local logic that handles simple decisions instantly (zero AI cost).
 * Only routes complex decisions to the Gemini Brain.
 * 
 * Architecture:
 *   User Actions → Event Engine → Rule Engine → (simple: execute rule) | (complex: Gemini Brain)
 */

// ============================================================
// RULE DEFINITIONS
// ============================================================

interface RuleContext {
    // Progress data
    completionRate: number;
    tasksCompleted: number;
    tasksFailed: number;
    totalTasks: number;

    // Streak data
    currentStreak: number;
    previousStreak: number;
    longestStreak: number;

    // XP data
    xpEarned: number;
    totalXP: number;
    xpDelta: number;

    // Level data
    currentLevel: number;
    previousLevel: number;

    // Boss data
    bossDefeated: boolean;
    weeklyBossHP: number;

    // Discipline
    disciplineScore: number;
    focusScore: number;

    // Behavior
    consecutiveMissedDays: number;
    habitMissedDays: Record<string, number>; // habitTitle → days missed
}

export interface RuleResult {
    eventType: string;
    message: string;
    severity: "info" | "warning" | "critical" | "commendation";
    requiresAI: boolean;           // Whether Gemini should generate a richer message
    aiContext?: string;             // Context to pass to Gemini if requiresAI is true
}

// ============================================================
// CORE: Evaluate all rules against context
// ============================================================
export function evaluateRules(context: Partial<RuleContext>): RuleResult[] {
    const results: RuleResult[] = [];
    const ctx = fillDefaults(context);

    // --- INSTANT RULES (no AI needed) ---

    // Rule 1: ALL_TASKS_DONE — 100% completion
    if (ctx.completionRate === 100) {
        results.push({
            eventType: "ALL_TASKS_DONE",
            message: `[COMMENDATION] All ${ctx.totalTasks} quests completed. Total XP: ${ctx.totalXP}. Maintain this standard.`,
            severity: "commendation",
            requiresAI: false
        });
    }

    // Rule 2: WEAK_PROGRESS — below 50% with some activity
    if (ctx.completionRate > 0 && ctx.completionRate < 50 && ctx.tasksCompleted >= 1) {
        results.push({
            eventType: "WEAK_PROGRESS",
            message: `[WARNING] Progress at ${ctx.completionRate}%. Only ${ctx.tasksCompleted}/${ctx.totalTasks} quests touched. Increase output.`,
            severity: "warning",
            requiresAI: false
        });
    }

    // Rule 3: STREAK_BROKEN
    if (ctx.currentStreak === 0 && ctx.previousStreak > 0) {
        results.push({
            eventType: "STREAK_BROKEN",
            message: `[ALERT] Streak broken. Previous: ${ctx.previousStreak} days. The chain is severed. Rebuild immediately.`,
            severity: "critical",
            requiresAI: false
        });
    }

    // Rule 4: LEVEL_UP
    if (ctx.currentLevel > ctx.previousLevel) {
        results.push({
            eventType: "LEVEL_UP",
            message: `[NOTICE] Power level increased: Level ${ctx.previousLevel} → Level ${ctx.currentLevel}. Total XP: ${ctx.totalXP}. New expectations set.`,
            severity: "commendation",
            requiresAI: false
        });
    }

    // Rule 5: BOSS_DEFEATED
    if (ctx.bossDefeated) {
        results.push({
            eventType: "BOSS_DEFEATED",
            message: `[COMMENDATION] Weekly Boss defeated. Streak: ${ctx.currentStreak} days. But the next one will be stronger.`,
            severity: "commendation",
            requiresAI: false
        });
    }

    // Rule 6: INACTIVITY_WARNING — no tasks completed at all
    if (ctx.completionRate === 0 && ctx.totalTasks > 0) {
        results.push({
            eventType: "INACTIVITY_WARNING",
            message: `[ALERT] Hunter. Zero quests completed today. ${ctx.totalTasks} quests remain untouched. Resume training immediately.`,
            severity: "critical",
            requiresAI: false
        });
    }

    // Rule 7: DISCIPLINE_IMPROVEMENT — high discipline score
    if (ctx.disciplineScore >= 75) {
        results.push({
            eventType: "DISCIPLINE_IMPROVEMENT",
            message: `[COMMENDATION] Discipline score at ${ctx.disciplineScore}%. This is above acceptable threshold. Do not become complacent.`,
            severity: "commendation",
            requiresAI: false
        });
    }

    // Rule 8: STREAK_MILESTONE — streak hits 7, 14, 21, 30 days
    const milestones = [7, 14, 21, 30, 50, 100];
    if (milestones.includes(ctx.currentStreak)) {
        results.push({
            eventType: "LEVEL_UP",
            message: `[COMMENDATION] ${ctx.currentStreak}-day streak achieved. Discipline is hardening. Continue.`,
            severity: "commendation",
            requiresAI: false
        });
    }

    // --- COMPLEX RULES (require Gemini for strategic response) ---

    // Rule 9: Habit-specific stagnation (3+ days missed)
    for (const [habit, days] of Object.entries(ctx.habitMissedDays)) {
        if (days >= 3) {
            results.push({
                eventType: "SKILL_DEGRADATION",
                message: `[WARNING] ${habit} training stagnated for ${days} days. Skill degradation detected.`,
                severity: "warning",
                requiresAI: true,
                aiContext: `Hunter has skipped "${habit}" for ${days} consecutive days. Current discipline score: ${ctx.disciplineScore}%. Generate a short, cold directive to resume training.`
            });
        }
    }

    // Rule 10: Performance declining — completion rate dropped significantly
    if (ctx.completionRate < 30 && ctx.disciplineScore < 40) {
        results.push({
            eventType: "WEAK_PROGRESS",
            message: `[CRITICAL] Hunter performance is critically low. Completion: ${ctx.completionRate}%. Discipline: ${ctx.disciplineScore}%.`,
            severity: "critical",
            requiresAI: true,
            aiContext: `Hunter is in critical state. Completion rate: ${ctx.completionRate}%. Discipline score: ${ctx.disciplineScore}%. Streak: ${ctx.currentStreak}. Generate a stern intervention directive.`
        });
    }

    return results;
}

// ============================================================
// HELPER: Classify if a decision needs AI or not
// ============================================================
export function requiresGemini(actionType: string): boolean {
    const aiOnlyActions = [
        "GENERATE_QUESTS",
        "DAILY_STRATEGY",
        "SKILL_TEST",
        "ANALYZE_BEHAVIOR"
    ];

    const ruleOnlyActions = [
        "ALL_TASKS_DONE",
        "STREAK_BROKEN",
        "LEVEL_UP",
        "BOSS_DEFEATED",
        "INACTIVITY_WARNING",
        "DISCIPLINE_IMPROVEMENT",
        "DIFFICULTY_CHECK",
        "BOSS_ADJUSTMENT"
    ];

    if (ruleOnlyActions.includes(actionType)) return false;
    if (aiOnlyActions.includes(actionType)) return true;

    // Default: use rules first
    return false;
}

// ============================================================
// HELPER: Fill default values
// ============================================================
function fillDefaults(ctx: Partial<RuleContext>): RuleContext {
    return {
        completionRate: ctx.completionRate ?? 0,
        tasksCompleted: ctx.tasksCompleted ?? 0,
        tasksFailed: ctx.tasksFailed ?? 0,
        totalTasks: ctx.totalTasks ?? 0,
        currentStreak: ctx.currentStreak ?? 0,
        previousStreak: ctx.previousStreak ?? 0,
        longestStreak: ctx.longestStreak ?? 0,
        xpEarned: ctx.xpEarned ?? 0,
        totalXP: ctx.totalXP ?? 0,
        xpDelta: ctx.xpDelta ?? 0,
        currentLevel: ctx.currentLevel ?? 1,
        previousLevel: ctx.previousLevel ?? 1,
        bossDefeated: ctx.bossDefeated ?? false,
        weeklyBossHP: ctx.weeklyBossHP ?? 500,
        disciplineScore: ctx.disciplineScore ?? 50,
        focusScore: ctx.focusScore ?? 50,
        consecutiveMissedDays: ctx.consecutiveMissedDays ?? 0,
        habitMissedDays: ctx.habitMissedDays ?? {}
    };
}

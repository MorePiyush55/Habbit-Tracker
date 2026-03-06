export type Difficulty = "small" | "medium" | "hard";

interface IUser {
    _id?: string;
    googleId: string;
    name: string;
    email: string;
    photo: string;
    level: number;
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: string;
    createdAt: Date;
    updatedAt: Date;
}

interface IHabit {
    _id?: string;
    userId: string;
    title: string;
    category: string;
    difficulty: Difficulty;
    xpReward: number;
    order: number;
    isActive: boolean;
    createdAt: Date;
}

interface ISubtask {
    _id?: string;
    habitId: string;
    title: string;
    order: number;
}

interface IDailyProgress {
    _id?: string;
    userId: string;
    date: string; // YYYY-MM-DD
    totalXP: number;
    completionRate: number;
    bossDefeated: boolean;
    createdAt: Date;
}

interface IProgressEntry {
    _id?: string;
    dailyProgressId: string;
    userId: string;
    date: string;
    habitId: string;
    subtaskId?: string;
    completed: boolean;
    xpEarned: number;
}

interface IAchievement {
    _id?: string;
    userId: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    unlocked: boolean;
    unlockedAt?: Date;
}

interface IWeeklyReport {
    _id?: string;
    userId: string;
    week: string; // YYYY-Wnn
    strongHabits: string[];
    weakHabits: string[];
    suggestions: string[];
    report: string;
    totalXP: number;
    avgCompletion: number;
    generatedAt: Date;
}

// Game engine types
export interface LevelInfo {
    level: number;
    rank: string;
    title: string;
    currentXP: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    progress: number; // 0-100
}

interface BossState {
    totalHP: number;
    currentHP: number;
    damageDealt: number;
    isDefeated: boolean;
    bossName: string;
}

export interface StreakInfo {
    current: number;
    longest: number;
    milestones: { days: number; label: string; reached: boolean }[];
}

// ============================================================
// AI DISCIPLINE OS — Core Architecture Types
// ============================================================

/**
 * Central System State — Single source of truth for system decisions.
 * Aggregated from all user data. Every system decision uses this.
 */
export interface SystemState {
    // Core identity
    hunter: {
        userId: string;
        name: string;
        level: number;
        xp: number;
        streak: number;
        longestStreak: number;
        disciplineScore: number;
        focusScore: number;
        skillGrowthScore: number;
        hunterRank: string;
    };

    // Active habits with progress
    activeHabits: {
        id: string;
        name: string;
        category: string;
        difficulty: Difficulty;
        difficultyLevel: number;
        progress: number;       // completion % today
        total: number;          // total subtasks
        completed: number;      // completed subtasks today
        consecutiveCompletions: number;
    }[];

    // Derived habit analysis
    weakHabits: string[];
    strongHabits: string[];

    // Skill proficiency landscape
    skillScores: {
        skill: string;
        category: string;
        score: number;
        trend: "improving" | "stable" | "declining";
        lastTested: string;
    }[];

    // Boss raid state
    bossRaid: {
        bossHP: number;
        bossDefeatedThisWeek: boolean;
    };

    // 7-day behavior trend (most recent first)
    recentBehavior: {
        date: string;
        completionRate: number;
        tasksCompleted: number;
        tasksFailed: number;
        weakHabits: string[];
        strongHabits: string[];
        xpEarned: number;
    }[];

    // 30-day analysis summary
    behaviorAnalysis: {
        activeDays: number;
        avgCompletion: number;
        trend: "improving" | "stable" | "declining";
        topWeakHabits: string[];
        topStrongHabits: string[];
        disciplineTrajectory: string;
    };

    // Last 5 system decisions (for context continuity)
    recentDecisions: {
        action: string;
        reason: string;
        date: string;
    }[];

    // Timestamp
    generatedAt: string;
}

/**
 * System Event Types — Everything the user does emits an event.
 * Events are the heartbeat of the OS.
 */
export type SystemEventType =
    | "TASK_COMPLETED"
    | "TASK_FAILED"
    | "SUBTASK_TOGGLED"
    | "STREAK_BROKEN"
    | "STREAK_MILESTONE"
    | "INACTIVITY"
    | "SKILL_DEGRADATION"
    | "GOAL_PROGRESS"
    | "GOAL_COMPLETED"
    | "LEVEL_UP"
    | "BOSS_DEFEATED"
    | "BOSS_DAMAGE"
    | "ALL_TASKS_DONE"
    | "WEAK_PROGRESS"
    | "DISCIPLINE_IMPROVEMENT"
    | "QUEST_ACCEPTED"
    | "QUEST_REJECTED"
    | "TRAINING_COMPLETED"
    | "HABIT_CREATED"
    | "HABIT_DELETED"
    | "SESSION_START"
    | "DAILY_RESET";

export interface SystemEventPayload {
    type: SystemEventType;
    userId: string;
    timestamp: string;
    payload: Record<string, any>;
}

/**
 * System Directive Types — Commands the brain produces.
 * UI, notifications, and game engine all execute these.
 */
type DirectiveType =
    | "REWARD_XP"
    | "DEDUCT_XP"
    | "GENERATE_QUEST"
    | "GENERATE_STRATEGY"
    | "TRIGGER_WARNING"
    | "TRIGGER_COMMENDATION"
    | "TRIGGER_TRAINING"
    | "SCALE_DIFFICULTY"
    | "GENERATE_NOTIFICATION"
    | "UPDATE_BOSS"
    | "LOG_BEHAVIOR"
    | "ANALYZE_PERFORMANCE"
    | "ISSUE_PENALTY"
    | "NO_ACTION";

export interface SystemDirective {
    type: DirectiveType;
    priority: "low" | "medium" | "high" | "critical";
    data: Record<string, any>;
    reason: string;
    requiresAI: boolean;
    timestamp: string;
}

/**
 * Brain Decision Result — What the System Brain returns
 * after processing an event through the state.
 */
export interface BrainDecisionResult {
    directives: SystemDirective[];
    stateUpdates: Partial<SystemState>;
    notifications: SystemNotification[];
    metadata: {
        eventProcessed: SystemEventType;
        processingTimeMs: number;
        aiCalled: boolean;
        rulesTriggered: string[];
    };
}

export interface SystemNotification {
    type: "alert" | "warning" | "notice" | "commendation" | "system";
    title: string;
    message: string;
    severity: "info" | "warning" | "critical" | "commendation";
    eventType: SystemEventType;
    autoExpire?: number; // ms
}

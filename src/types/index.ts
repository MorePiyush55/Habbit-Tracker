export type Difficulty = "small" | "medium" | "hard";

export interface IUser {
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

export interface IHabit {
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

export interface ISubtask {
    _id?: string;
    habitId: string;
    title: string;
    order: number;
}

export interface IDailyProgress {
    _id?: string;
    userId: string;
    date: string; // YYYY-MM-DD
    totalXP: number;
    completionRate: number;
    bossDefeated: boolean;
    createdAt: Date;
}

export interface IProgressEntry {
    _id?: string;
    dailyProgressId: string;
    userId: string;
    date: string;
    habitId: string;
    subtaskId?: string;
    completed: boolean;
    xpEarned: number;
}

export interface IAchievement {
    _id?: string;
    userId: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    unlocked: boolean;
    unlockedAt?: Date;
}

export interface IWeeklyReport {
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

export interface BossState {
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

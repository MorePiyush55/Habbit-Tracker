interface AchievementDef {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    check: (stats: AchievementCheckData) => boolean;
}

export interface AchievementCheckData {
    currentStreak: number;
    longestStreak: number;
    totalXP: number;
    level: number;
    totalBossesDefeated: number;
    totalDaysCompleted: number;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
    {
        id: "first_flame",
        title: "First Flame",
        description: "Maintain a 3-day streak",
        icon: "🔥",
        category: "streak",
        check: (s) => s.currentStreak >= 3,
    },
    {
        id: "warrior_spirit",
        title: "Warrior Spirit",
        description: "Maintain a 7-day streak",
        icon: "⚔️",
        category: "streak",
        check: (s) => s.currentStreak >= 7,
    },
    {
        id: "unstoppable",
        title: "Unstoppable",
        description: "Maintain a 30-day streak",
        icon: "🏆",
        category: "streak",
        check: (s) => s.currentStreak >= 30,
    },
    {
        id: "legend",
        title: "Legend",
        description: "Maintain a 90-day streak",
        icon: "💀",
        category: "streak",
        check: (s) => s.currentStreak >= 90,
    },
    {
        id: "first_steps",
        title: "First Steps",
        description: "Earn your first 100 XP",
        icon: "⭐",
        category: "xp",
        check: (s) => s.totalXP >= 100,
    },
    {
        id: "xp_500",
        title: "Rising Power",
        description: "Earn 500 XP total",
        icon: "💎",
        category: "xp",
        check: (s) => s.totalXP >= 500,
    },
    {
        id: "boss_slayer",
        title: "Boss Slayer",
        description: "Defeat your first daily boss",
        icon: "🗡️",
        category: "boss",
        check: (s) => s.totalBossesDefeated >= 1,
    },
    {
        id: "boss_hunter",
        title: "Boss Hunter",
        description: "Defeat 10 daily bosses",
        icon: "🐉",
        category: "boss",
        check: (s) => s.totalBossesDefeated >= 10,
    },
    {
        id: "shadow_monarch",
        title: "Shadow Monarch",
        description: "Reach Level 30",
        icon: "👑",
        category: "level",
        check: (s) => s.level >= 30,
    },
    {
        id: "committed",
        title: "Committed",
        description: "Complete 7 days total",
        icon: "📅",
        category: "consistency",
        check: (s) => s.totalDaysCompleted >= 7,
    },
];

export function checkAchievements(
    stats: AchievementCheckData,
    alreadyUnlocked: string[]
): AchievementDef[] {
    return ACHIEVEMENT_DEFINITIONS.filter(
        (a) => !alreadyUnlocked.includes(a.id) && a.check(stats)
    );
}

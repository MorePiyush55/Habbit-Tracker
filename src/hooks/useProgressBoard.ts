import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ProgressBoardData {
    tasks: Array<{
        _id: string;
        title: string;
        category: string;
        rank?: string;
        difficulty?: string;
        xpReward: number;
        subtasks: Array<{ _id: string; title: string; completed: boolean; order: number; xpEarned: number; completionType?: "normal" | "late" | "backlog" | "recovery"; sourceDate?: string | null }>;
        isFullyCompleted: boolean;
        completionPercent: number;
        isBacklog?: boolean;
        sourceDate?: string | null;
        isDaily?: boolean;
        primaryStat?: string;
        deadline?: string;
        completionType?: "normal" | "late" | "backlog" | "recovery";
    }>;
    completionRate: number;
    xp: number;
    streak: number;
    longestStreak: number;
    level: number;
    gold: number;
    statPoints: number;
    stats: { STR: { value: number; xp: number }; VIT: { value: number; xp: number }; INT: { value: number; xp: number }; AGI: { value: number; xp: number }; PER: { value: number; xp: number }; CHA: { value: number; xp: number } };
    bossHP: number;
    maxBossHP: number;
    bossDefeatedThisWeek: boolean;
    hp: number;
    maxHp: number;
    disciplineScore: number;
    focusScore: number;
    skillGrowthScore: number;
    hunterRank: string;
    jobClass: string;
    yesterdayReview: {
        date: string;
        canLateFix: boolean;
        unresolvedCount: number;
        unresolvedHabits: Array<{ habitId: string; title: string }>;
    } | null;
    streakSecuredDate: string;
    failFeedback: boolean;
}

export function useProgressBoard(todayDate: string, enabled = true) {
    const { data: progressData, isLoading: progressLoading, mutate: mutateProgress } = useSWR(
        enabled ? `/api/progress?date=${todayDate}` : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    const { data: statsData } = useSWR(
        enabled ? `/api/analytics?days=120` : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    const quests = (progressData?.habits || []).map((q: any) => ({
        ...q,
        subtasks: (q.subtasks || []).map((s: any) => ({
            ...s,
            order: s.order ?? 0,
            xpEarned: s.xpEarned ?? 0,
        })),
    }));
    const yesterdayReview = progressData?.yesterdayReview || null;
    const failFeedback = progressData?.failFeedback || false;

    const boardData: ProgressBoardData = {
        tasks: quests,
        completionRate: quests.length > 0 
            ? Math.round((quests.filter((q: any) => q.isFullyCompleted).length / quests.length) * 100)
            : 0,
        xp: quests.reduce((sum: number, q: any) => sum + (q.isFullyCompleted ? q.xpReward : 0), 0),
        streak: statsData?.user?.currentStreak || 0,
        longestStreak: statsData?.user?.longestStreak || 0,
        level: statsData?.user?.level || 1,
        gold: statsData?.user?.gold || 0,
        statPoints: statsData?.user?.statPoints || 0,
        stats: statsData?.user?.stats || {
            STR: { value: 10, xp: 0 },
            VIT: { value: 10, xp: 0 },
            INT: { value: 10, xp: 0 },
            AGI: { value: 10, xp: 0 },
            PER: { value: 10, xp: 0 },
            CHA: { value: 10, xp: 0 },
        },
        bossHP: statsData?.user?.weeklyBossHP || 500,
        maxBossHP: 500,
        bossDefeatedThisWeek: statsData?.user?.bossDefeatedThisWeek || false,
        hp: statsData?.user?.hp ?? 100,
        maxHp: statsData?.user?.maxHp ?? 100,
        disciplineScore: statsData?.user?.disciplineScore ?? 50,
        focusScore: statsData?.user?.focusScore ?? 50,
        skillGrowthScore: statsData?.user?.skillGrowthScore ?? 50,
        hunterRank: statsData?.user?.hunterRank || "E-Class",
        jobClass: statsData?.user?.jobClass || "F-Rank Recruit",
        yesterdayReview,
        streakSecuredDate: progressData?.streakSecuredDate || "",
        failFeedback,
    };

    return {
        data: boardData,
        isLoading: progressLoading,
        mutate: mutateProgress,
    };
}

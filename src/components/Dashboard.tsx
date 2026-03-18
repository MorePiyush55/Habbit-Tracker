"use client";

import { useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import PlayerStats from "@/components/game/PlayerStats";
import QuestPanel from "@/components/game/QuestPanel";
import BossBattle from "@/components/game/BossBattle";
import CreateQuestModal from "@/components/game/CreateQuestModal";
import SystemEventBanner from "@/components/system/SystemEventBanner";
import HabitHeatmap from "@/components/game/HabitHeatmap";
import AchievementBadges from "@/components/game/AchievementBadges";
import AppNav from "@/components/AppNav";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Subtask {
    _id: string;
    title: string;
    order: number;
    completed: boolean;
    xpEarned: number;
}

interface Quest {
    _id: string;
    title: string;
    category: string;
    difficulty: string;
    xpReward: number;
    subtasks: Subtask[];
    completionPercent: number;
    isFullyCompleted: boolean;
    isDaily?: boolean;
    deadline?: string;
}

export default function Dashboard() {
    const { data: session } = useSession();
    const [toggling, setToggling] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

    const { data: progressData, isLoading: progressLoading, mutate: mutateProgress } = useSWR(
        `/api/progress?date=${today}`,
        fetcher,
        { refreshInterval: 30000 }
    );

    const { data: statsData } = useSWR("/api/analytics?days=1", fetcher, { refreshInterval: 30000 });

    const quests: Quest[] = progressData?.habits || [];
    const userStats = {
        totalXP: statsData?.user?.totalXP || 0,
        currentStreak: statsData?.user?.currentStreak || 0,
        longestStreak: statsData?.user?.longestStreak || 0,
        level: statsData?.user?.level || 1,
        gold: statsData?.user?.gold || 0,
        statPoints: statsData?.user?.statPoints || 0,
        stats: statsData?.user?.stats || {
            STR: { value: 10, xp: 0 }, VIT: { value: 10, xp: 0 }, INT: { value: 10, xp: 0 },
            AGI: { value: 10, xp: 0 }, PER: { value: 10, xp: 0 }, CHA: { value: 10, xp: 0 }
        },
        disciplineScore: statsData?.user?.disciplineScore || 50,
        focusScore: statsData?.user?.focusScore || 50,
        skillGrowthScore: statsData?.user?.skillGrowthScore || 50,
        hunterRank: statsData?.user?.hunterRank || "E-Class",
        jobClass: statsData?.user?.jobClass || "F-Rank Recruit",
        hp: statsData?.user?.hp ?? 100,
        maxHp: statsData?.user?.maxHp ?? 100,
        weeklyBossHP: statsData?.user?.weeklyBossHP || 500,
        bossDefeatedThisWeek: statsData?.user?.bossDefeatedThisWeek || false,
    };
    const loading = progressLoading;

    // Emit SESSION_START once on mount via ref (not in useEffect)
    const sessionStartRef = useRef(false);
    if (!sessionStartRef.current) {
        sessionStartRef.current = true;
        if (typeof window !== "undefined") {
            fetch("/api/system/process-event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventType: "SESSION_START" }),
            }).catch(() => {/* non-blocking */});
        }
    }

    const handleToggleSubtask = async (habitId: string, subtaskId: string, completed: boolean) => {
        setToggling(true);

        // Optimistic update
        const optimisticData = {
            ...progressData,
            habits: quests.map((q) => {
                if (q._id !== habitId) return q;
                const updatedSubtasks = q.subtasks.map((s) =>
                    s._id === subtaskId ? { ...s, completed } : s
                );
                const completedCount = updatedSubtasks.filter((s) => s.completed).length;
                const totalCount = updatedSubtasks.length || 1;
                return {
                    ...q,
                    subtasks: updatedSubtasks,
                    completionPercent: Math.round((completedCount / totalCount) * 100),
                    isFullyCompleted: completedCount === totalCount,
                };
            }),
        };
        mutateProgress(optimisticData, false);

        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId, completed, date: today }),
            });
            // Revalidate from server
            mutateProgress();
        } catch (error) {
            console.error("Failed to toggle subtask:", error);
            mutateProgress();
        }
        setToggling(false);
    };

    // Build boss entries from quests
    const bossEntries = quests.flatMap((q) =>
        q.subtasks.map((s) => ({
            xpEarned: s.xpEarned || (q.xpReward / (q.subtasks.length || 1)),
            completed: s.completed,
        }))
    );

    const user = session?.user;

    if (loading) {
        return (
            <div className="loading-spinner" style={{ minHeight: "100vh" }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            <AppNav />
            <SystemEventBanner />
            <div className="dashboard-grid">
                {/* ── LEFT SIDEBAR ── */}
                <div className="sidebar-left">
                    <PlayerStats
                        name={user?.name || "Hunter"}
                        photo={(user as Record<string, unknown>)?.image as string || ""}
                        totalXP={userStats.totalXP}
                        currentStreak={userStats.currentStreak}
                        longestStreak={userStats.longestStreak}
                        level={userStats.level}
                        gold={userStats.gold}
                        statPoints={userStats.statPoints}
                        hp={userStats.hp}
                        maxHp={userStats.maxHp}
                        stats={userStats.stats}
                        disciplineScore={userStats.disciplineScore}
                        hunterRank={userStats.hunterRank}
                    />

                    <AchievementBadges unlockedIds={[]} />
                </div>

                {/* ── MAIN CONTENT ── */}
                <div className="main-content">
                    {/* 1. Weekly Boss Raid — TOP */}
                    <BossBattle
                        bossHP={userStats.weeklyBossHP}
                        isDefeated={userStats.bossDefeatedThisWeek}
                        currentStreak={userStats.currentStreak}
                    />

                    {/* Phase 4: Habit Heatmap */}
                    <div style={{ marginBottom: "1rem", marginTop: "1rem" }}>
                        <HabitHeatmap data={statsData?.heatmapData || []} />
                    </div>
                </div>

                <CreateQuestModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onQuestCreated={() => mutateProgress()}
                />
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import PlayerStats from "@/components/game/PlayerStats";
import QuestPanel from "@/components/game/QuestPanel";
import BossBattle from "@/components/game/BossBattle";
import CreateQuestModal from "@/components/game/CreateQuestModal";
import SystemChat from "@/components/system/SystemChat";
import SystemEventBanner from "@/components/system/SystemEventBanner";
import DailyStrategyPanel from "@/components/system/DailyStrategyPanel";
import ActiveTrainingUI from "@/components/system/ActiveTrainingUI";
import AchievementBadges from "@/components/game/AchievementBadges";
import AppNav from "@/components/AppNav";

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
}

export default function Dashboard() {
    const { data: session } = useSession();
    const [quests, setQuests] = useState<Quest[]>([]);
    const [userStats, setUserStats] = useState({
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        disciplineScore: 50,
        focusScore: 50,
        skillGrowthScore: 50,
        hunterRank: "E-Class",
        weeklyBossHP: 500,
        bossDefeatedThisWeek: false,
    });
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const today = new Date().toISOString().split("T")[0];

    const fetchProgress = useCallback(async () => {
        try {
            const res = await fetch(`/api/progress?date=${today}`);
            if (res.ok) {
                const data = await res.json();
                setQuests(data.habits || []);
            }

            // Fetch user stats
            const statsRes = await fetch("/api/analytics?days=1");
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                if (statsData.user) {
                    setUserStats({
                        totalXP: statsData.user.totalXP || 0,
                        currentStreak: statsData.user.currentStreak || 0,
                        longestStreak: statsData.user.longestStreak || 0,
                        level: statsData.user.level || 1,
                        disciplineScore: statsData.user.disciplineScore || 50,
                        focusScore: statsData.user.focusScore || 50,
                        skillGrowthScore: statsData.user.skillGrowthScore || 50,
                        hunterRank: statsData.user.hunterRank || "E-Class",
                        weeklyBossHP: statsData.user.weeklyBossHP || 500,
                        bossDefeatedThisWeek: statsData.user.bossDefeatedThisWeek || false,
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch progress:", error);
        }
        setLoading(false);
    }, [today]);

    useEffect(() => {
        fetchProgress();

        // Poll every 30 seconds
        const interval = setInterval(fetchProgress, 30000);
        return () => clearInterval(interval);
    }, [fetchProgress]);

    const handleToggleSubtask = async (habitId: string, subtaskId: string, completed: boolean) => {
        setToggling(true);

        // Optimistic update
        setQuests((prev) =>
            prev.map((q) => {
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
            })
        );

        try {
            const res = await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId, completed, date: today }),
            });

            if (res.ok) {
                // Refresh to get accurate server state
                await fetchProgress();
            }
        } catch (error) {
            console.error("Failed to toggle subtask:", error);
            // Revert on failure
            await fetchProgress();
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
                        disciplineScore={userStats.disciplineScore}
                        hunterRank={userStats.hunterRank}
                    />

                    {/* Active Training — above achievements */}
                    <ActiveTrainingUI />

                    <AchievementBadges unlockedIds={[]} />
                </div>

                {/* ── MAIN CONTENT ── */}
                <div className="main-content">
                    {/* System Chat */}
                    <SystemChat />

                    {/* Weekly Boss Raid — back in main column */}
                    <BossBattle
                        bossHP={userStats.weeklyBossHP}
                        isDefeated={userStats.bossDefeatedThisWeek}
                        currentStreak={userStats.currentStreak}
                    />

                    {/* Daily Strategy */}
                    <DailyStrategyPanel />
                </div>

                <CreateQuestModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onQuestCreated={fetchProgress}
                />
            </div>
        </div>
    );
}

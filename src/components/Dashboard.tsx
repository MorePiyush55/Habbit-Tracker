"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import PlayerStats from "@/components/game/PlayerStats";
import QuestPanel from "@/components/game/QuestPanel";
import type { Quest } from "@/components/game/QuestPanel";
import BossBattle from "@/components/game/BossBattle";
import CreateQuestModal from "@/components/game/CreateQuestModal";
import EditQuestModal from "@/components/game/EditQuestModal";
import CelebrationOverlay from "@/components/game/CelebrationOverlay";
import QuickAddTask from "@/components/game/QuickAddTask";
import SessionTimer from "@/components/game/SessionTimer";
import NextBestAction from "@/components/game/NextBestAction";
import SystemEventBanner from "@/components/system/SystemEventBanner";
import HabitHeatmap from "@/components/game/HabitHeatmap";
import AppNav from "@/components/AppNav";
import { ListChecks, ChevronDown, Shield, AlertTriangle } from "lucide-react";
import { getRankConfigs } from "@/lib/rankConfig";

const fetcher = (url: string) => fetch(url).then(res => res.json());
const DAILY_MINIMUM = 3;

export default function Dashboard() {
    const { data: session } = useSession();
    const [toggling, setToggling] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [focusMode, setFocusMode] = useState(true);
    const [streakSecured, setStreakSecured] = useState(false);
    const [failFeedback, setFailFeedback] = useState(false);
    const [reviewActionLoading, setReviewActionLoading] = useState(false);
    const [combo, setCombo] = useState(0);
    const [lastTaskTime, setLastTaskTime] = useState<Date | null>(null);
    const [comboToast, setComboToast] = useState<{ text: string; xp: number } | null>(null);

    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
    const celebrationShownRef = useRef(false);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingToggles = useRef(0);

    const { data: progressData, isLoading: progressLoading, mutate: mutateProgress } = useSWR(
        `/api/progress?date=${today}`,
        fetcher,
        { refreshInterval: 30000 }
    );

    const { data: statsData } = useSWR("/api/analytics?days=120", fetcher, { refreshInterval: 30000 });

    const quests: Quest[] = progressData?.habits || [];
    const yesterdayReview = progressData?.yesterdayReview || null;
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

    useEffect(() => {
        if (progressData?.streakSecuredDate === today) {
            setStreakSecured(true);
        }
        if (progressData?.failFeedback) {
            setFailFeedback(true);
        }
    }, [progressData, today]);

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

    const showComboToast = useCallback((text: string, xp: number) => {
        setComboToast({ text, xp });
        setTimeout(() => setComboToast(null), 2500);
    }, []);

    const scheduleSync = useCallback(() => {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(async () => {
            if (pendingToggles.current === 0) {
                await mutateProgress();
            }
        }, 1500);
    }, [mutateProgress]);

    const handleTaskCompleted = useCallback(async (isCompleted: boolean, totalQuestCount: number) => {
        if (!isCompleted) return;

        const taskNow = new Date();
        const gapMinutes = lastTaskTime ? (taskNow.getTime() - lastTaskTime.getTime()) / 60000 : 999;
        const newCombo = gapMinutes <= 120 ? combo + 1 : 1;

        setCombo(newCombo);
        setLastTaskTime(taskNow);

        let bonusXP = 0;
        let toastText = "";
        if (newCombo === 3) {
            bonusXP = 20;
            toastText = "3x COMBO!";
        } else if (newCombo === 5) {
            bonusXP = 50;
            toastText = "5x COMBO!";
        } else if (newCombo === totalQuestCount && totalQuestCount > 0) {
            bonusXP = 100;
            toastText = "PERFECT COMBO!";
        }

        if (bonusXP > 0) {
            showComboToast(toastText, bonusXP);
            fetch("/api/user/add-xp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: bonusXP, comboCount: newCombo, timestamp: taskNow.toISOString(), reason: "combo" }),
            }).catch(() => {});
        }
    }, [combo, lastTaskTime, showComboToast]);

    const handleToggleSubtask = async (habitId: string, subtaskId: string, completed: boolean) => {
        if (!completed) {
            const quest = quests.find(q => q._id === habitId);
            if (quest?.isDaily) {
                const sub = quest.subtasks.find(s => s._id === subtaskId);
                if (sub?.completed) return;
            }
        }

        setToggling(true);

        mutateProgress((current: any) => ({
            ...current,
            habits: (current?.habits || []).map((q: Quest) => {
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
        }), false);

        pendingToggles.current++;
        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId, completed, date: today }),
            });
            if (completed) await handleTaskCompleted(true, quests.length);
        } catch (error) {
            console.error("Failed to toggle subtask:", error);
            mutateProgress();
        }
        pendingToggles.current--;
        scheduleSync();
        setToggling(false);
    };

    const handleToggleMainTask = async (habitId: string, completed: boolean) => {
        if (!completed) {
            const quest = quests.find(q => q._id === habitId);
            if (quest?.isDaily && quest.isFullyCompleted) return;
        }

        setToggling(true);

        mutateProgress((current: any) => ({
            ...current,
            habits: (current?.habits || []).map((q: Quest) => q._id === habitId
                ? { ...q, completionPercent: completed ? 100 : 0, isFullyCompleted: completed }
                : q),
        }), false);

        pendingToggles.current++;
        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId: "", completed, date: today }),
            });
            if (completed) await handleTaskCompleted(true, quests.length);
        } catch (error) {
            console.error("Failed to toggle main task:", error);
            mutateProgress();
        }
        pendingToggles.current--;
        scheduleSync();
        setToggling(false);
    };

    const handleDeleteQuest = async (habitId: string) => {
        mutateProgress((current: any) => ({
            ...current,
            habits: (current?.habits || []).filter((q: Quest) => q._id !== habitId),
        }), false);

        try {
            const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
            if (!res.ok) await mutateProgress();
        } catch {
            await mutateProgress();
        }
    };

    const handleEditQuest = (quest: Quest) => setEditingQuest(quest);

    const handleChangeRank = async (habitId: string, newRank: string) => {
        const configs = getRankConfigs();
        const customXp = configs.find(r => r.key === newRank)?.xp || 10;

        mutateProgress((current: any) => ({
            ...current,
            habits: (current?.habits || []).map((q: Quest) =>
                q._id === habitId ? { ...q, rank: newRank, xpReward: customXp } : q
            ),
        }), false);

        try {
            await fetch(`/api/habits/${habitId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rank: newRank, xpReward: customXp }),
            });
        } catch {
            await mutateProgress();
        }
    };

    const handleLateFix = async () => {
        if (!yesterdayReview || !yesterdayReview.unresolvedHabits?.length) return;

        setReviewActionLoading(true);
        try {
            await Promise.all(
                yesterdayReview.unresolvedHabits.map((habit: { habitId: string; title: string }) =>
                    fetch("/api/progress/late-complete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            date: today,
                            habitId: habit.habitId,
                        }),
                    })
                )
            );
            await mutateProgress();
        } finally {
            setReviewActionLoading(false);
        }
    };

    const handleConvertBacklog = async () => {
        setReviewActionLoading(true);
        try {
            await fetch("/api/progress/convert-backlog", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: today }),
            });
            await mutateProgress();
        } finally {
            setReviewActionLoading(false);
        }
    };

    const sortedQuests = useMemo(() => {
        const pOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

        return [...quests].sort((a, b) => {
            if (Boolean(a.isBacklog) !== Boolean(b.isBacklog)) {
                return a.isBacklog ? -1 : 1;
            }
            if (a.isFullyCompleted !== b.isFullyCompleted) {
                return a.isFullyCompleted ? 1 : -1;
            }
            const aPri = pOrder[(a as any).priority] ?? 1;
            const bPri = pOrder[(b as any).priority] ?? 1;
            if (aPri !== bPri) return aPri - bPri;
            return (b.xpReward || 0) - (a.xpReward || 0);
        });
    }, [quests]);

    const displayedQuests = focusMode ? sortedQuests.slice(0, 3) : sortedQuests;
    const hiddenCount = Math.max(0, sortedQuests.length - 3);
    const backlogCount = sortedQuests.filter((q) => q.isBacklog && !q.isFullyCompleted).length;
    const backlogQuests = sortedQuests.filter((q) => q.isBacklog);
    const completedCount = quests.filter((q) => q.isFullyCompleted).length;
    const totalXP = quests.reduce((sum, q) => sum + (q.isFullyCompleted ? q.xpReward : 0), 0);

    useEffect(() => {
        if (!streakSecured && completedCount >= DAILY_MINIMUM && quests.length > 0 && !loading) {
            setStreakSecured(true);
            fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secureStreak: true, date: today }),
            }).catch(() => {});
        }
    }, [completedCount, streakSecured, quests.length, loading, today]);

    useEffect(() => {
        if (quests.length > 0 && completedCount === quests.length && !celebrationShownRef.current && !loading) {
            celebrationShownRef.current = true;
            setShowCelebration(true);
        }
        if (completedCount < quests.length) celebrationShownRef.current = false;
    }, [completedCount, quests.length, loading]);

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
            <CelebrationOverlay show={showCelebration} totalXP={totalXP} questCount={quests.length} onClose={() => setShowCelebration(false)} />

            {comboToast && (
                <div style={{
                    position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
                    zIndex: 9999, background: "rgba(10,10,30,0.95)",
                    border: "1px solid rgba(255,204,0,0.5)", borderRadius: 50,
                    padding: "10px 24px", display: "flex", alignItems: "center", gap: 10,
                    boxShadow: "0 0 30px rgba(255,204,0,0.3)",
                    animation: "fadeInDown 0.3s ease",
                    fontFamily: "monospace",
                }}>
                    <span style={{ fontSize: "1.2rem" }}>🔥</span>
                    <span style={{ fontWeight: 900, color: "#ffcc00", letterSpacing: 2, fontSize: "0.95rem" }}>{comboToast.text}</span>
                    <span style={{ color: "#00ff88", fontWeight: 700 }}>+{comboToast.xp} XP</span>
                </div>
            )}

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

                    <SessionTimer />

                    <div style={{
                        padding: "8px 16px", borderRadius: 8, marginBottom: 8,
                        background: streakSecured
                            ? "rgba(0,255,136,0.08)" : completedCount > 0
                            ? "rgba(255,204,0,0.08)" : "rgba(239,68,68,0.06)",
                        border: `1px solid ${streakSecured ? "rgba(0,255,136,0.25)" : completedCount > 0 ? "rgba(255,204,0,0.25)" : "rgba(239,68,68,0.2)"}`,
                        display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", fontFamily: "monospace",
                    }}>
                        {streakSecured
                            ? <><Shield size={14} style={{ color: "#00ff88" }} /><span style={{ color: "#00ff88" }}>Streak secured for today! ({completedCount}/{quests.length} done)</span></>
                            : <><AlertTriangle size={14} style={{ color: completedCount > 0 ? "#ffcc00" : "#ff4466" }} />
                                <span style={{ color: completedCount > 0 ? "#ffcc00" : "#ff4466" }}>
                                    {DAILY_MINIMUM - completedCount > 0
                                        ? `${DAILY_MINIMUM - completedCount} more task${DAILY_MINIMUM - completedCount > 1 ? "s" : ""} to protect streak (${completedCount}/${DAILY_MINIMUM} min)`
                                        : "Complete tasks to protect your streak!"}
                                </span>
                              </>
                        }
                    </div>

                    {yesterdayReview && yesterdayReview.unresolvedCount > 0 && (
                        <div style={{
                            background: "rgba(255,204,0,0.08)",
                            border: "1px solid rgba(255,204,0,0.35)",
                            borderRadius: 12,
                            padding: "14px 18px",
                            marginBottom: 14,
                            boxShadow: "0 0 16px rgba(255,204,0,0.12)",
                        }}>
                            <div style={{ color: "#ffcc00", fontWeight: 700, fontSize: "0.95rem", marginBottom: 6, fontFamily: "monospace", letterSpacing: 1 }}>
                                SYSTEM ALERT: YESTERDAY REVIEW
                            </div>
                            <div style={{ color: "var(--text-primary)", fontSize: "0.85rem", marginBottom: 10 }}>
                                {yesterdayReview.unresolvedCount} task(s) from {yesterdayReview.date} were not confirmed.
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button
                                    onClick={handleLateFix}
                                    disabled={reviewActionLoading || !yesterdayReview.canLateFix}
                                    style={{
                                        padding: "7px 14px",
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,204,0,0.45)",
                                        background: "rgba(255,204,0,0.16)",
                                        color: "#ffcc00",
                                        fontFamily: "monospace",
                                        cursor: reviewActionLoading || !yesterdayReview.canLateFix ? "not-allowed" : "pointer",
                                        opacity: reviewActionLoading || !yesterdayReview.canLateFix ? 0.6 : 1,
                                    }}
                                >
                                    Fix Now (70% XP)
                                </button>
                                <button
                                    onClick={handleConvertBacklog}
                                    disabled={reviewActionLoading}
                                    style={{
                                        padding: "7px 14px",
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,122,122,0.4)",
                                        background: "rgba(255,68,68,0.14)",
                                        color: "#ff7a7a",
                                        fontFamily: "monospace",
                                        cursor: reviewActionLoading ? "not-allowed" : "pointer",
                                        opacity: reviewActionLoading ? 0.6 : 1,
                                    }}
                                >
                                    Carry Forward as Backlog
                                </button>
                            </div>
                            {!yesterdayReview.canLateFix && (
                                <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                                    Late fix window expired. Use backlog recovery before today ends.
                                </div>
                            )}
                        </div>
                    )}

                    {failFeedback && (
                        <div style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.5)",
                            borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "center",
                            boxShadow: "0 0 20px rgba(239,68,68,0.15)"
                        }}>
                            <div style={{ color: "#ff4466", fontWeight: 700, fontSize: "1.1rem", marginBottom: 8, fontFamily: "monospace", letterSpacing: 1 }}>
                                SYSTEM WARNING
                            </div>
                            <div style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>
                                You failed to meet the daily minimum requirements yesterday.<br />
                                <span style={{ color: "#ff4466", fontWeight: 600 }}>Your streak has been reset to 0.</span>
                            </div>
                            <button
                                onClick={() => setFailFeedback(false)}
                                style={{
                                    marginTop: 12, padding: "6px 16px", background: "rgba(239,68,68,0.2)",
                                    border: "1px solid rgba(239,68,68,0.5)", borderRadius: 8, color: "#ff4466",
                                    cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s"
                                }}>
                                Acknowledge
                            </button>
                        </div>
                    )}

                    <NextBestAction
                        quest={sortedQuests.find(q => !q.isFullyCompleted) || null}
                        onComplete={(id) => {
                            const quest = sortedQuests.find(q => q._id === id || q.subtasks?.some(s => s._id === id));
                            if (!quest) return;
                            if (quest._id === id) handleToggleMainTask(id, true);
                            else handleToggleSubtask(quest._id, id, true);
                        }}
                    />

                    <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <ListChecks size={28} style={{ color: "var(--accent-blue)" }} />
                                <div>
                                    <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: 1 }}>
                                        {focusMode ? "TODAY'S FOCUS" : "DAILY QUESTS"}
                                    </h1>
                                    <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.85rem" }}>
                                        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-blue)" }}>{completedCount}/{quests.length}</div>
                                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: 1 }}>COMPLETED</div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-gold)" }}>+{totalXP}</div>
                                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: 1 }}>XP TODAY</div>
                                </div>
                                {combo >= 2 && (
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#ff8c00" }}>🔥{combo}x</div>
                                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: 1 }}>COMBO</div>
                                    </div>
                                )}
                                <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                                    + Add Quest
                                </button>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: "16px 24px", marginTop: "14px", marginBottom: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", letterSpacing: 1 }}>DAILY COMPLETION</span>
                                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent-blue)" }}>
                                    {quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0}%
                                </span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill progress-fill-xp" style={{ width: `${quests.length > 0 ? (completedCount / quests.length) * 100 : 0}%` }} />
                            </div>
                        </div>

                        <QuickAddTask onAdded={() => mutateProgress()} />

                        {backlogCount > 0 && (
                            <div style={{
                                marginTop: "12px",
                                marginBottom: "12px",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid rgba(255,122,122,0.45)",
                                background: "rgba(255,68,68,0.12)",
                                color: "#ff9ca8",
                                fontSize: "0.8rem",
                                fontFamily: "monospace",
                            }}>
                                {backlogCount} backlog task(s) pending. Backlog is prioritized at the top.
                            </div>
                        )}

                        {backlogQuests.length > 0 && (
                            <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 12 }}>
                                <div style={{ color: "#ff7a7a", fontWeight: 700, fontFamily: "monospace", fontSize: "0.85rem", marginBottom: 8 }}>
                                    BACKLOG MISSIONS
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {backlogQuests.map((q) => (
                                        <div key={`backlog-${q._id}`} style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                                            • {q.title} {q.sourceDate ? `(${q.sourceDate})` : "(Yesterday)"}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <QuestPanel
                            quests={displayedQuests}
                            date={today}
                            onToggleSubtask={handleToggleSubtask}
                            onDeleteQuest={handleDeleteQuest}
                            onEditQuest={handleEditQuest}
                            onToggleMainTask={handleToggleMainTask}
                            onChangeRank={handleChangeRank}
                            loading={toggling}
                        />

                        {sortedQuests.length > 3 && (
                            <button
                                onClick={() => setFocusMode(prev => !prev)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    width: "100%", padding: "10px", justifyContent: "center",
                                    background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
                                    borderRadius: 8, cursor: "pointer", color: "var(--text-muted)",
                                    fontSize: "0.8rem", fontFamily: "monospace", letterSpacing: 1,
                                    marginTop: 12,
                                }}
                            >
                                <ChevronDown size={14} style={{ transform: focusMode ? "none" : "rotate(180deg)", transition: "transform 0.2s" }} />
                                {focusMode ? `Show all ${sortedQuests.length} quests (+${hiddenCount} more)` : "Show Focus Mode (top 3)"}
                            </button>
                        )}
                    </div>
                </div>

                <CreateQuestModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onQuestCreated={() => mutateProgress()}
                />
                {editingQuest && <EditQuestModal quest={editingQuest} onClose={() => setEditingQuest(null)} onQuestUpdated={() => mutateProgress()} />}
            </div>

            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}

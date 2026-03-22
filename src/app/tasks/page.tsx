"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import QuestPanel from "@/components/game/QuestPanel";
import type { Quest } from "@/components/game/QuestPanel";
import CreateQuestModal from "@/components/game/CreateQuestModal";
import EditQuestModal from "@/components/game/EditQuestModal";
import CelebrationOverlay from "@/components/game/CelebrationOverlay";
import QuickAddTask from "@/components/game/QuickAddTask";
import SessionTimer from "@/components/game/SessionTimer";
import AppNav from "@/components/AppNav";
import { ListChecks, ChevronDown, Shield, AlertTriangle } from "lucide-react";
import { getRankConfigs } from "@/lib/rankConfig";

const DAILY_MINIMUM = 3; // tasks needed to secure streak

export default function TasksPage() {
    const { data: session, status } = useSession();
    const [quests, setQuests] = useState<Quest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [focusMode, setFocusMode] = useState(true);   // Today Focus Mode
    const [streakSecured, setStreakSecured] = useState(false);

    // Combo XP state (in-memory, resets on refresh by design)
    const [combo, setCombo] = useState(0);
    const [lastTaskTime, setLastTaskTime] = useState<Date | null>(null);
    const [comboToast, setComboToast] = useState<{ text: string; xp: number } | null>(null);

    const celebrationShownRef = useRef(false);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingToggles = useRef(0);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const fetchQuests = useCallback(async () => {
        try {
            const res = await fetch(`/api/progress?date=${today}`);
            if (res.ok) {
                const data = await res.json();
                setQuests(data.habits || []);
                // Check if streak already secured today
                if (data.streakSecuredDate === today) setStreakSecured(true);
            }
        } catch (err) {
            console.error("Failed to fetch quests:", err);
        }
        setLoading(false);
    }, [today]);

    useEffect(() => {
        fetchQuests();
        const interval = setInterval(fetchQuests, 30000);
        return () => clearInterval(interval);
    }, [fetchQuests]);

    const scheduleSync = useCallback(() => {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(async () => {
            if (pendingToggles.current === 0) await fetchQuests();
        }, 1500);
    }, [fetchQuests]);

    // Show combo toast for 2s then hide
    const showComboToast = (text: string, xp: number) => {
        setComboToast({ text, xp });
        setTimeout(() => setComboToast(null), 2500);
    };

    // Handle task completion with combo + streak locking logic
    const handleTaskCompleted = useCallback(async (isCompleted: boolean) => {
        if (!isCompleted) return;

        const taskNow = new Date();
        const gapMinutes = lastTaskTime ? (taskNow.getTime() - lastTaskTime.getTime()) / 60000 : 999;
        const newCombo = gapMinutes <= 120 ? combo + 1 : 1;

        setCombo(newCombo);
        setLastTaskTime(taskNow);

        // Combo bonus thresholds
        const allCount = quests.length;
        let bonusXP = 0;
        let toastText = "";
        if (newCombo === 3)        { bonusXP = 20;  toastText = "3x COMBO!"; }
        else if (newCombo === 5)   { bonusXP = 50;  toastText = "5x COMBO!"; }
        else if (newCombo === allCount && allCount > 0) { bonusXP = 100; toastText = "PERFECT COMBO!"; }

        if (bonusXP > 0) {
            showComboToast(toastText, bonusXP);
            fetch("/api/user/add-xp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: bonusXP, comboCount: newCombo, timestamp: taskNow.toISOString(), reason: "combo" }),
            }).catch(() => {});
        }
    }, [combo, lastTaskTime, quests.length]);

    const handleToggleSubtask = async (habitId: string, subtaskId: string, completed: boolean) => {
        if (!completed) {
            const quest = quests.find(q => q._id === habitId);
            if (quest?.isDaily) {
                const sub = quest.subtasks.find(s => s._id === subtaskId);
                if (sub?.completed) return;
            }
        }
        setQuests((prev) =>
            prev.map((q) => {
                if (q._id !== habitId) return q;
                const updatedSubtasks = q.subtasks.map((s) =>
                    s._id === subtaskId ? { ...s, completed } : s
                );
                const done = updatedSubtasks.filter((s) => s.completed).length;
                const total = updatedSubtasks.length || 1;
                return { ...q, subtasks: updatedSubtasks,
                    completionPercent: Math.round((done / total) * 100),
                    isFullyCompleted: done === total };
            })
        );
        pendingToggles.current++;
        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId, completed, date: today }),
            });
            if (completed) await handleTaskCompleted(true);
        } catch {}
        pendingToggles.current--;
        scheduleSync();
    };

    const handleDeleteQuest = async (habitId: string) => {
        setQuests((prev) => prev.filter((q) => q._id !== habitId));
        try {
            const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
            if (!res.ok) await fetchQuests();
        } catch { await fetchQuests(); }
    };

    const handleEditQuest = (quest: Quest) => setEditingQuest(quest);

    const handleToggleMainTask = async (habitId: string, completed: boolean) => {
        if (!completed) {
            const quest = quests.find(q => q._id === habitId);
            if (quest?.isDaily && quest.isFullyCompleted) return;
        }
        setQuests((prev) =>
            prev.map((q) => q._id !== habitId ? q : { ...q, completionPercent: completed ? 100 : 0, isFullyCompleted: completed })
        );
        pendingToggles.current++;
        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId: "", completed, date: today }),
            });
            if (completed) await handleTaskCompleted(true);
        } catch {}
        pendingToggles.current--;
        scheduleSync();
    };

    const handleChangeRank = async (habitId: string, newRank: string) => {
        const configs = getRankConfigs();
        const customXp = configs.find(r => r.key === newRank)?.xp || 10;
        setQuests(prev => prev.map(q => q._id === habitId ? { ...q, rank: newRank, xpReward: customXp } : q));
        try {
            await fetch(`/api/habits/${habitId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rank: newRank, xpReward: customXp }),
            });
        } catch { await fetchQuests(); }
    };

    // Sort: priority HIGH→MEDIUM→LOW, then XP desc, completed last
    const sortedQuests = useMemo(() => {
        const pOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return [...quests].sort((a, b) => {
            if (a.isFullyCompleted !== b.isFullyCompleted) return a.isFullyCompleted ? 1 : -1;
            const aPri = pOrder[(a as any).priority] ?? 1;
            const bPri = pOrder[(b as any).priority] ?? 1;
            if (aPri !== bPri) return aPri - bPri;
            return (b.xpReward || 0) - (a.xpReward || 0);
        });
    }, [quests]);

    const completedCount = quests.filter((q) => q.isFullyCompleted).length;
    const totalXP = quests.reduce((sum, q) => sum + (q.isFullyCompleted ? q.xpReward : 0), 0);

    // Streak locking: secure once ≥ DAILY_MINIMUM completed (delete-proof)
    useEffect(() => {
        if (!streakSecured && completedCount >= DAILY_MINIMUM && quests.length > 0 && !loading) {
            setStreakSecured(true);
            // Notify server to lock streak for today
            fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secureStreak: true, date: today }),
            }).catch(() => {});
        }
    }, [completedCount, streakSecured, quests.length, loading, today]);

    // Celebration: fires when ALL quests done
    useEffect(() => {
        if (quests.length > 0 && completedCount === quests.length && !celebrationShownRef.current && !loading) {
            celebrationShownRef.current = true;
            setShowCelebration(true);
        }
        if (completedCount < quests.length) celebrationShownRef.current = false;
    }, [completedCount, quests.length, loading]);

    // Focus mode: show top 3 by default
    const displayedQuests = focusMode ? sortedQuests.slice(0, 3) : sortedQuests;
    const hiddenCount = sortedQuests.length - 3;

    if (status === "loading" || loading) {
        return (<div className="loading-spinner" style={{ minHeight: "100vh" }}><div className="spinner" /></div>);
    }

    if (!session) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            <CelebrationOverlay show={showCelebration} totalXP={totalXP} questCount={quests.length} onClose={() => setShowCelebration(false)} />

            {/* Combo Toast */}
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

            <div className="tasks-page">
                {/* Session Timer */}
                <SessionTimer />

                {/* Streak indicator */}
                <div style={{
                    padding: "8px 16px", borderRadius: 8, marginBottom: 8,
                    background: streakSecured
                        ? "rgba(0,255,136,0.08)" : completedCount > 0
                        ? "rgba(255,204,0,0.08)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${streakSecured ? "rgba(0,255,136,0.25)" : completedCount > 0 ? "rgba(255,204,0,0.25)" : "rgba(239,68,68,0.2)"}`,
                    display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", fontFamily: "monospace",
                }}>
                    {streakSecured
                        ? <><Shield size={14} style={{ color: "#00ff88" }} /><span style={{ color: "#00ff88" }}>🛡️ Streak secured for today! ({completedCount}/{quests.length} done)</span></>
                        : <><AlertTriangle size={14} style={{ color: completedCount > 0 ? "#ffcc00" : "#ff4466" }} />
                            <span style={{ color: completedCount > 0 ? "#ffcc00" : "#ff4466" }}>
                                {DAILY_MINIMUM - completedCount > 0
                                    ? `⚠️ ${DAILY_MINIMUM - completedCount} more task${DAILY_MINIMUM - completedCount > 1 ? "s" : ""} to protect streak (${completedCount}/${DAILY_MINIMUM} min)`
                                    : "Complete tasks to protect your streak!"}
                            </span>
                          </>
                    }
                </div>

                {/* Header */}
                <div className="tasks-header glass-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ListChecks size={28} style={{ color: "var(--accent-blue)" }} />
                        <div>
                            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: 1 }}>
                                {focusMode ? "🎯 TODAY'S FOCUS" : "DAILY QUESTS"}
                            </h1>
                            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.85rem" }}>
                                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
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
                        <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)} style={{ marginLeft: "auto" }}>
                            + Add Quest
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="glass-card" style={{ padding: "16px 24px" }}>
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

                {/* Quick Add */}
                <QuickAddTask onAdded={fetchQuests} />

                {/* Quest List */}
                <div className="tasks-content">
                    <QuestPanel
                        quests={displayedQuests}
                        date={today}
                        onToggleSubtask={handleToggleSubtask}
                        onDeleteQuest={handleDeleteQuest}
                        onEditQuest={handleEditQuest}
                        onToggleMainTask={handleToggleMainTask}
                        onChangeRank={handleChangeRank}
                        loading={false}
                    />
                    {/* Focus mode toggle */}
                    {sortedQuests.length > 3 && (
                        <button
                            onClick={() => setFocusMode(prev => !prev)}
                            style={{
                                display: "flex", alignItems: "center", gap: 6,
                                width: "100%", padding: "10px", justifyContent: "center",
                                background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
                                borderRadius: 8, cursor: "pointer", color: "var(--text-muted)",
                                fontSize: "0.8rem", fontFamily: "monospace", letterSpacing: 1,
                                marginTop: 4,
                            }}
                        >
                            <ChevronDown size={14} style={{ transform: focusMode ? "none" : "rotate(180deg)", transition: "transform 0.2s" }} />
                            {focusMode ? `Show all ${sortedQuests.length} quests (+${hiddenCount} more)` : "Show Focus Mode (top 3)"}
                        </button>
                    )}
                </div>
            </div>

            <CreateQuestModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onQuestCreated={fetchQuests} />
            {editingQuest && <EditQuestModal quest={editingQuest} onClose={() => setEditingQuest(null)} onQuestUpdated={fetchQuests} />}

            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}

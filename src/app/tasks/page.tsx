"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import QuestPanel from "@/components/game/QuestPanel";
import type { Quest } from "@/components/game/QuestPanel";
import CreateQuestModal from "@/components/game/CreateQuestModal";
import EditQuestModal from "@/components/game/EditQuestModal";
import AppNav from "@/components/AppNav";
import { ListChecks } from "lucide-react";

export default function TasksPage() {
    const { data: session, status } = useSession();
    const [quests, setQuests] = useState<Quest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingToggles = useRef(0);

    const today = new Date().toISOString().split("T")[0];

    const fetchQuests = useCallback(async () => {
        try {
            const res = await fetch(`/api/progress?date=${today}`);
            if (res.ok) {
                const data = await res.json();
                setQuests(data.habits || []);
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

    // Background sync: debounced re-fetch after toggling stops
    const scheduleSync = useCallback(() => {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(async () => {
            // Only sync if no toggles are in flight
            if (pendingToggles.current === 0) {
                await fetchQuests();
            }
        }, 1500);
    }, [fetchQuests]);

    const handleToggleSubtask = async (habitId: string, subtaskId: string, completed: boolean) => {
        // Optimistic update — instant, no disabling
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

        // Fire API call in background — don't block UI
        pendingToggles.current++;
        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId, completed, date: today }),
            });
        } catch {
            // On error, schedule a sync to get correct state
        }
        pendingToggles.current--;
        scheduleSync();
    };

    const handleDeleteQuest = async (habitId: string) => {
        // Optimistic removal
        setQuests((prev) => prev.filter((q) => q._id !== habitId));
        try {
            const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
            if (!res.ok) {
                // Revert on failure
                await fetchQuests();
            }
        } catch {
            await fetchQuests();
        }
    };

    const handleEditQuest = (quest: Quest) => {
        setEditingQuest(quest);
    };

    const handleToggleMainTask = async (habitId: string, completed: boolean) => {
        // Optimistic update — instant, no disabling
        setQuests((prev) =>
            prev.map((q) => {
                if (q._id !== habitId) return q;
                return {
                    ...q,
                    completionPercent: completed ? 100 : 0,
                    isFullyCompleted: completed,
                };
            })
        );

        // Fire API call in background
        pendingToggles.current++;
        try {
            await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ habitId, subtaskId: "", completed, date: today }),
            });
        } catch {
            // sync will fix it
        }
        pendingToggles.current--;
        scheduleSync();
    };

    // Sort: incomplete quests first, completed quests at the bottom
    const sortedQuests = useMemo(() => {
        return [...quests].sort((a, b) => {
            if (a.isFullyCompleted === b.isFullyCompleted) return 0;
            return a.isFullyCompleted ? 1 : -1;
        });
    }, [quests]);

    const completedCount = quests.filter((q) => q.isFullyCompleted).length;
    const totalXP = quests.reduce((sum, q) => sum + (q.isFullyCompleted ? q.xpReward : 0), 0);

    if (status === "loading" || loading) {
        return (
            <div className="loading-spinner" style={{ minHeight: "100vh" }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            <AppNav />
            <div className="tasks-page">
                {/* Header */}
                <div className="tasks-header glass-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ListChecks size={28} style={{ color: "var(--accent-blue)" }} />
                        <div>
                            <h1 style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "1.5rem",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                margin: 0,
                                letterSpacing: 1
                            }}>
                                DAILY QUESTS
                            </h1>
                            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.85rem" }}>
                                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-blue)" }}>
                                {completedCount}/{quests.length}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: 1 }}>COMPLETED</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-gold)" }}>
                                +{totalXP}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: 1 }}>XP TODAY</div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => setIsCreateModalOpen(true)}
                            style={{ marginLeft: "auto" }}
                        >
                            + Add Quest
                        </button>
                    </div>
                </div>

                {/* Overall progress bar */}
                <div className="glass-card" style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", letterSpacing: 1 }}>DAILY COMPLETION</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent-blue)" }}>
                            {quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0}%
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill progress-fill-xp"
                            style={{ width: `${quests.length > 0 ? (completedCount / quests.length) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Full Quest List */}
                <div className="tasks-content">
                    <QuestPanel
                        quests={sortedQuests}
                        date={today}
                        onToggleSubtask={handleToggleSubtask}
                        onDeleteQuest={handleDeleteQuest}
                        onEditQuest={handleEditQuest}
                        onToggleMainTask={handleToggleMainTask}
                        loading={false}
                    />
                </div>
            </div>

            <CreateQuestModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onQuestCreated={fetchQuests}
            />

            {editingQuest && (
                <EditQuestModal
                    quest={editingQuest}
                    onClose={() => setEditingQuest(null)}
                    onQuestUpdated={fetchQuests}
                />
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2, RefreshCw, Check, X, Swords } from "lucide-react";

interface GeneratedQuest {
    _id: string;
    title: string;
    category: string;
    difficulty: string;
    subtasks: string[];
    reason: string;
    xpReward: number;
    accepted: boolean;
    rejected: boolean;
}

export default function DailyStrategyPanel() {
    const [strategy, setStrategy] = useState<string>("");
    const [quests, setQuests] = useState<GeneratedQuest[]>([]);
    const [loadingStrategy, setLoadingStrategy] = useState(false);
    const [loadingQuests, setLoadingQuests] = useState(false);
    const [activeTab, setActiveTab] = useState<"strategy" | "quests">("strategy");

    const fetchStrategy = async () => {
        setLoadingStrategy(true);
        try {
            const res = await fetch("/api/system/daily-strategy");
            if (res.ok) {
                const data = await res.json();
                setStrategy(data.strategy || "");
            }
        } catch (err) {
            console.error("Failed to fetch strategy:", err);
            setStrategy("⚠ SYSTEM NOTICE\n\nFailed to generate strategy.\nRetry later, Hunter.");
        } finally {
            setLoadingStrategy(false);
        }
    };

    const fetchQuests = async () => {
        setLoadingQuests(true);
        try {
            const res = await fetch("/api/system/generate-quests");
            if (res.ok) {
                const data = await res.json();
                setQuests(data.quests || []);
            }
        } catch (err) {
            console.error("Failed to fetch quests:", err);
        } finally {
            setLoadingQuests(false);
        }
    };

    useEffect(() => {
        fetchStrategy();
        fetchQuests();
    }, []);

    const handleQuestAction = async (questId: string, action: "accept" | "reject") => {
        try {
            const res = await fetch("/api/system/generate-quests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questId, action })
            });

            if (res.ok) {
                setQuests(prev => prev.map(q =>
                    q._id === questId
                        ? { ...q, accepted: action === "accept", rejected: action === "reject" }
                        : q
                ));
            }
        } catch (err) {
            console.error("Quest action failed:", err);
        }
    };

    const difficultyColors: Record<string, string> = {
        small: "#00ff88",
        medium: "#ffaa00",
        hard: "#ff4444"
    };

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-md)" }}>
            {/* Tab Headers */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "var(--space-md)" }}>
                <button
                    onClick={() => setActiveTab("strategy")}
                    style={{
                        flex: 1,
                        padding: "10px",
                        background: activeTab === "strategy" ? "rgba(139, 92, 246, 0.2)" : "rgba(255,255,255,0.05)",
                        border: activeTab === "strategy" ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: activeTab === "strategy" ? "#8b5cf6" : "#888",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                    }}
                >
                    <Brain size={14} /> DAILY STRATEGY
                </button>
                <button
                    onClick={() => setActiveTab("quests")}
                    style={{
                        flex: 1,
                        padding: "10px",
                        background: activeTab === "quests" ? "rgba(139, 92, 246, 0.2)" : "rgba(255,255,255,0.05)",
                        border: activeTab === "quests" ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: activeTab === "quests" ? "#8b5cf6" : "#888",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                    }}
                >
                    <Swords size={14} /> SYSTEM QUESTS
                </button>
            </div>

            {/* Strategy Tab */}
            {activeTab === "strategy" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
                        <h3 style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "3px", color: "#8b5cf6", textTransform: "uppercase" }}>
                            ⚡ SYSTEM TRAINING DIRECTIVE
                        </h3>
                        <button
                            onClick={fetchStrategy}
                            disabled={loadingStrategy}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#666",
                                cursor: "pointer",
                                padding: 4
                            }}
                        >
                            {loadingStrategy ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}
                        </button>
                    </div>

                    {loadingStrategy ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                            <Loader2 size={20} className="spinning" />
                            <div style={{ marginTop: 8, fontSize: "0.7rem", letterSpacing: "2px" }}>GENERATING STRATEGY...</div>
                        </div>
                    ) : (
                        <div style={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "0.82rem",
                            lineHeight: 1.7,
                            color: "#d0d0d0",
                            padding: "var(--space-md)",
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: "8px",
                            borderLeft: "3px solid #8b5cf6"
                        }}>
                            {strategy || "No strategy available. Click refresh to generate."}
                        </div>
                    )}
                </div>
            )}

            {/* Quests Tab */}
            {activeTab === "quests" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
                        <h3 style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "3px", color: "#8b5cf6", textTransform: "uppercase" }}>
                            ⚡ SYSTEM GENERATED QUESTS
                        </h3>
                        <button
                            onClick={fetchQuests}
                            disabled={loadingQuests}
                            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}
                        >
                            {loadingQuests ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}
                        </button>
                    </div>

                    {loadingQuests ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                            <Loader2 size={20} className="spinning" />
                            <div style={{ marginTop: 8, fontSize: "0.7rem", letterSpacing: "2px" }}>ANALYZING WEAKNESSES...</div>
                        </div>
                    ) : quests.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "#666", fontSize: "0.8rem" }}>
                            No system quests generated yet. Click refresh.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {quests.map(quest => (
                                <div key={quest._id} style={{
                                    background: "rgba(0,0,0,0.3)",
                                    borderRadius: "8px",
                                    padding: "14px",
                                    borderLeft: `3px solid ${difficultyColors[quest.difficulty] || "#8b5cf6"}`,
                                    opacity: (quest.accepted || quest.rejected) ? 0.5 : 1
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: "#e0e0e0", fontSize: "0.85rem" }}>
                                                {quest.title}
                                            </div>
                                            <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 2 }}>
                                                {quest.category} • {quest.difficulty.toUpperCase()} • {quest.xpReward} XP
                                            </div>
                                            {quest.reason && (
                                                <div style={{ fontSize: "0.72rem", color: "#ff8800", marginTop: 6, fontStyle: "italic" }}>
                                                    "{quest.reason}"
                                                </div>
                                            )}
                                            {quest.subtasks.length > 0 && (
                                                <ul style={{ margin: "6px 0 0 0", padding: "0 0 0 16px", fontSize: "0.75rem", color: "#aaa" }}>
                                                    {quest.subtasks.map((s, i) => <li key={i}>{s}</li>)}
                                                </ul>
                                            )}
                                        </div>

                                        {!quest.accepted && !quest.rejected && (
                                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleQuestAction(quest._id, "accept")}
                                                    style={{
                                                        background: "rgba(0, 255, 136, 0.15)",
                                                        border: "1px solid rgba(0,255,136,0.3)",
                                                        color: "#00ff88",
                                                        borderRadius: "6px",
                                                        padding: "6px 10px",
                                                        cursor: "pointer",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    <Check size={12} /> Accept
                                                </button>
                                                <button
                                                    onClick={() => handleQuestAction(quest._id, "reject")}
                                                    style={{
                                                        background: "rgba(255, 68, 68, 0.15)",
                                                        border: "1px solid rgba(255,68,68,0.3)",
                                                        color: "#ff4444",
                                                        borderRadius: "6px",
                                                        padding: "6px 10px",
                                                        cursor: "pointer",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    <X size={12} /> Reject
                                                </button>
                                            </div>
                                        )}

                                        {quest.accepted && (
                                            <span style={{ color: "#00ff88", fontSize: "0.7rem", fontWeight: 600 }}>✓ ACCEPTED</span>
                                        )}
                                        {quest.rejected && (
                                            <span style={{ color: "#ff4444", fontSize: "0.7rem", fontWeight: 600 }}>✗ REJECTED</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

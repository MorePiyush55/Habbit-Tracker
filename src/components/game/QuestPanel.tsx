"use client";

import { useState } from "react";
import { ChevronDown, Scroll, Zap, Trash2 } from "lucide-react";

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

interface QuestPanelProps {
    quests: Quest[];
    date: string;
    onToggleSubtask: (habitId: string, subtaskId: string, completed: boolean) => void;
    onDeleteQuest?: (habitId: string) => void;
    loading: boolean;
}

export default function QuestPanel({ quests, date, onToggleSubtask, onDeleteQuest, loading }: QuestPanelProps) {
    const [expandedQuests, setExpandedQuests] = useState<Set<string>>(new Set());

    const toggleExpand = (questId: string) => {
        setExpandedQuests((prev) => {
            const next = new Set(prev);
            if (next.has(questId)) next.delete(questId);
            else next.add(questId);
            return next;
        });
    };

    const totalCompletion =
        quests.length > 0
            ? Math.round(quests.reduce((sum, q) => sum + q.completionPercent, 0) / quests.length)
            : 0;

    return (
        <div>
            <div className="section-title">
                <Scroll size={20} className="section-title-icon" />
                Today&apos;s Quests
                <span
                    className="badge badge-xp"
                    style={{ marginLeft: "auto", fontSize: "0.8rem" }}
                >
                    {totalCompletion}% Complete
                </span>
            </div>

            <div className="progress-bar" style={{ marginBottom: "var(--space-lg)", height: 8 }}>
                <div
                    className="progress-fill progress-fill-quest"
                    style={{ width: `${totalCompletion}%` }}
                />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {quests.map((quest, index) => {
                    const isExpanded = expandedQuests.has(quest._id);
                    return (
                        <div
                            key={quest._id}
                            className={`quest-item glass-card ${quest.isFullyCompleted ? "completed" : ""}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="quest-header" onClick={() => toggleExpand(quest._id)}>
                                <div className="quest-info">
                                    <div className="quest-title">
                                        {quest.isFullyCompleted ? "✅ " : ""}
                                        {quest.title}
                                    </div>
                                    <div className="quest-meta">
                                        <span className={`badge badge-difficulty-${quest.difficulty}`}>
                                            {quest.difficulty}
                                        </span>
                                        <span className="badge badge-xp">
                                            <Zap size={11} /> {quest.xpReward} XP
                                        </span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {quest.completionPercent}%
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {onDeleteQuest && (
                                        <button
                                            className="quest-delete-btn"
                                            aria-label="Delete quest"
                                            title="Delete quest"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Delete "${quest.title}"? This cannot be undone.`)) {
                                                    onDeleteQuest(quest._id);
                                                }
                                            }}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                padding: 4,
                                                borderRadius: 6,
                                                color: "var(--text-muted)",
                                                transition: "color 0.2s, background 0.2s",
                                                display: "flex",
                                                alignItems: "center",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color = "#ef4444";
                                                e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color = "var(--text-muted)";
                                                e.currentTarget.style.background = "none";
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <button
                                        className={`quest-expand ${isExpanded ? "open" : ""}`}
                                        aria-label="Toggle subtasks"
                                    >
                                        <ChevronDown size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Mini progress bar */}
                            <div className="quest-progress-bar">
                                <div
                                    className="progress-fill progress-fill-quest"
                                    style={{ width: `${quest.completionPercent}%`, height: "100%" }}
                                />
                            </div>

                            {isExpanded && (
                                <div className="quest-subtasks">
                                    {quest.subtasks.map((sub) => (
                                        <div key={sub._id} className="subtask-item">
                                            <input
                                                type="checkbox"
                                                className="quest-checkbox"
                                                checked={sub.completed}
                                                disabled={loading}
                                                onChange={(e) => {
                                                    onToggleSubtask(quest._id, sub._id, e.target.checked);
                                                }}
                                                id={`subtask-${sub._id}`}
                                            />
                                            <label
                                                htmlFor={`subtask-${sub._id}`}
                                                className={`subtask-title ${sub.completed ? "done" : ""}`}
                                                style={{ cursor: "pointer" }}
                                            >
                                                {sub.title}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

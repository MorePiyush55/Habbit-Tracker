"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Scroll, Zap, Trash2, Pencil, Lock } from "lucide-react";

interface Subtask {
    _id: string;
    title: string;
    order: number;
    completed: boolean;
    xpEarned: number;
}

export interface Quest {
    _id: string;
    title: string;
    category: string;
    rank?: string;
    primaryStat?: string;
    xpReward: number;
    subtasks: Subtask[];
    completionPercent: number;
    isFullyCompleted: boolean;
    isDaily?: boolean;
    deadline?: string;
}

interface QuestPanelProps {
    quests: Quest[];
    date: string;
    onToggleSubtask: (habitId: string, subtaskId: string, completed: boolean) => void;
    onDeleteQuest?: (habitId: string) => void;
    onEditQuest?: (quest: Quest) => void;
    onToggleMainTask?: (habitId: string, completed: boolean) => void;
    onChangeRank?: (habitId: string, newRank: string) => void;
    loading: boolean;
}

// ── Rank colour palette ────────────────────────────────────────────────────
const RANK_STYLE: Record<string, { bg: string; border: string; color: string; glow: string }> = {
    S: { bg: "rgba(255, 0, 128, 0.18)",  border: "rgba(255, 0, 128, 0.6)",  color: "#ff0080", glow: "0 0 8px rgba(255,0,128,0.4)" },
    A: { bg: "rgba(255, 140, 0, 0.18)",  border: "rgba(255, 140, 0, 0.6)",  color: "#ff8c00", glow: "0 0 8px rgba(255,140,0,0.35)" },
    B: { bg: "rgba(139, 92, 246, 0.18)", border: "rgba(139, 92, 246, 0.6)", color: "#8b5cf6", glow: "0 0 8px rgba(139,92,246,0.35)" },
    C: { bg: "rgba(0, 180, 255, 0.15)",  border: "rgba(0, 180, 255, 0.5)",  color: "#00b4ff", glow: "0 0 8px rgba(0,180,255,0.3)" },
    D: { bg: "rgba(0, 255, 136, 0.12)",  border: "rgba(0, 255, 136, 0.4)",  color: "#00ff88", glow: "0 0 8px rgba(0,255,136,0.3)" },
    E: { bg: "rgba(160, 160, 160, 0.1)", border: "rgba(160, 160, 160, 0.3)", color: "#a0a0a0", glow: "none" },
};

const RANKS = ["S", "A", "B", "C", "D", "E"] as const;
const RANK_XP: Record<string, number> = { S: 120, A: 80, B: 55, C: 35, D: 20, E: 10 };

// ── Inline rank picker badge ───────────────────────────────────────────────
function InlineRankBadge({ rank, questId, onChangeRank, disabled }: {
    rank: string;
    questId: string;
    onChangeRank?: (habitId: string, newRank: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const s = RANK_STYLE[rank] ?? RANK_STYLE.E;

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const handleSelect = async (newRank: string) => {
        if (newRank === rank || !onChangeRank) return;
        setSaving(true);
        setOpen(false);
        await onChangeRank(questId, newRank);
        setSaving(false);
    };

    return (
        <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled && onChangeRank) setOpen(o => !o);
                }}
                title={onChangeRank ? "Click to change rank" : undefined}
                style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    padding: "2px 8px",
                    borderRadius: 5,
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    color: saving ? "#666" : s.color,
                    boxShadow: s.glow,
                    fontFamily: "var(--font-display, monospace)",
                    cursor: onChangeRank ? "pointer" : "default",
                    transition: "opacity 0.2s",
                    opacity: saving ? 0.6 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                }}
            >
                {saving ? "..." : `${rank}-Rank`}
                {onChangeRank && !saving && <ChevronDown size={10} style={{ marginLeft: 1 }} />}
            </button>

            {open && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 9999,
                        background: "#1a1a2e",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        padding: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        minWidth: 130,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                >
                    <div style={{ fontSize: "0.6rem", color: "#555", padding: "2px 6px", letterSpacing: 1 }}>SELECT RANK</div>
                    {RANKS.map(r => {
                        const rs = RANK_STYLE[r];
                        return (
                            <button
                                key={r}
                                onClick={() => handleSelect(r)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "5px 10px",
                                    borderRadius: 6,
                                    background: r === rank ? rs.bg : "transparent",
                                    border: r === rank ? `1px solid ${rs.border}` : "1px solid transparent",
                                    color: rs.color,
                                    cursor: "pointer",
                                    fontSize: "0.76rem",
                                    fontWeight: 600,
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = rs.bg)}
                                onMouseLeave={e => (e.currentTarget.style.background = r === rank ? rs.bg : "transparent")}
                            >
                                <span>{r}-Rank</span>
                                <span style={{ fontSize: "0.65rem", color: "#666" }}>{RANK_XP[r]} XP</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function QuestPanel({ quests, date, onToggleSubtask, onDeleteQuest, onEditQuest, onToggleMainTask, onChangeRank, loading }: QuestPanelProps) {
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
                <span className="badge badge-xp" style={{ marginLeft: "auto", fontSize: "0.8rem" }}>
                    {totalCompletion}% Complete
                </span>
            </div>

            <div className="progress-bar" style={{ marginBottom: "var(--space-lg)", height: 8 }}>
                <div className="progress-fill progress-fill-quest" style={{ width: `${totalCompletion}%` }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {quests.map((quest, index) => {
                    const isExpanded = expandedQuests.has(quest._id);
                    const rank = quest.rank || "E";
                    const rankStyle = RANK_STYLE[rank] ?? RANK_STYLE.E;
                    return (
                        <div
                            key={quest._id}
                            className={`quest-item glass-card ${quest.isFullyCompleted ? "completed" : ""}`}
                            style={{
                                animationDelay: `${index * 0.05}s`,
                                borderLeft: `3px solid ${rankStyle.border}`,
                                opacity: quest.isFullyCompleted ? 0.65 : 1,
                                transition: "opacity 0.3s",
                            }}
                        >
                            <div
                                className="quest-header"
                                role="button"
                                tabIndex={0}
                                onClick={() => quest.subtasks.length > 0 ? toggleExpand(quest._id) : undefined}
                                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && quest.subtasks.length > 0) { e.preventDefault(); toggleExpand(quest._id); } }}
                            >
                                <div className="quest-info" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    {quest.subtasks.length === 0 && onToggleMainTask && (
                                        <input
                                            type="checkbox"
                                            className="quest-checkbox"
                                            checked={quest.isFullyCompleted}
                                            disabled={loading || (quest.isDaily && quest.isFullyCompleted)}
                                            onChange={(e) => { e.stopPropagation(); onToggleMainTask(quest._id, e.target.checked); }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ flexShrink: 0 }}
                                        />
                                    )}
                                    <div>
                                        <div className="quest-title">
                                            {quest.isFullyCompleted ? "✅ " : ""}
                                            {quest.title}
                                        </div>
                                        <div className="quest-meta" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            {/* ⬇ Inline rank picker — click to change rank directly */}
                                            <InlineRankBadge
                                                rank={rank}
                                                questId={quest._id}
                                                onChangeRank={onChangeRank}
                                            />
                                            <span className="badge badge-xp">
                                                <Zap size={11} /> {quest.xpReward} XP
                                            </span>
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                {quest.completionPercent}%
                                            </span>
                                            {quest.isDaily && quest.isFullyCompleted && (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.65rem", color: "var(--accent-green)", background: "rgba(0,255,136,0.08)", padding: "2px 6px", borderRadius: 4 }}>
                                                    <Lock size={10} /> Locked
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {onEditQuest && (
                                        <button
                                            aria-label="Edit quest"
                                            title="Edit quest"
                                            onClick={(e) => { e.stopPropagation(); onEditQuest(quest); }}
                                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "var(--text-muted)", transition: "color 0.2s, background 0.2s", display: "flex", alignItems: "center" }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-blue)"; e.currentTarget.style.background = "rgba(59,130,246,0.1)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none"; }}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                    {onDeleteQuest && (
                                        <button
                                            className="quest-delete-btn"
                                            aria-label="Delete quest"
                                            title="Delete quest"
                                            onClick={(e) => { e.stopPropagation(); onDeleteQuest(quest._id); }}
                                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "var(--text-muted)", transition: "color 0.2s, background 0.2s", display: "flex", alignItems: "center" }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none"; }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    {quest.subtasks.length > 0 && (
                                        <button className={`quest-expand ${isExpanded ? "open" : ""}`} aria-label="Toggle subtasks">
                                            <ChevronDown size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Rank-coloured progress bar */}
                            <div className="quest-progress-bar">
                                <div style={{
                                    width: `${quest.completionPercent}%`,
                                    height: "100%",
                                    background: rankStyle.color,
                                    borderRadius: 4,
                                    transition: "width 0.4s ease",
                                    boxShadow: quest.completionPercent > 0 ? rankStyle.glow : "none",
                                }} />
                            </div>

                            {isExpanded && (
                                <div className="quest-subtasks">
                                    {quest.subtasks.map((sub) => (
                                        <div key={sub._id} className="subtask-item">
                                            <input
                                                type="checkbox"
                                                className="quest-checkbox"
                                                checked={sub.completed}
                                                disabled={loading || (quest.isDaily && sub.completed)}
                                                onChange={(e) => onToggleSubtask(quest._id, sub._id, e.target.checked)}
                                                id={`subtask-${sub._id}`}
                                            />
                                            <label htmlFor={`subtask-${sub._id}`} className={`subtask-title ${sub.completed ? "done" : ""}`} style={{ cursor: "pointer" }}>
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

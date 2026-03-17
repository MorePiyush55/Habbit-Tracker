"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { X, Plus, Trash2, RotateCw, CalendarCheck, Calendar, BookOpen, Shield, Briefcase, TrendingUp, Pen } from "lucide-react";

const goalsFetcher = (url: string) => fetch(url).then(res => res.json());

interface Goal {
    _id: string;
    title: string;
}

interface CreateQuestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onQuestCreated: () => void;
}

export default function CreateQuestModal({ isOpen, onClose, onQuestCreated }: CreateQuestModalProps) {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("Learning");
    const [customCategory, setCustomCategory] = useState("");
    const [rank, setRank] = useState<"E" | "D" | "C" | "B" | "A" | "S">("E");
    const [primaryStat, setPrimaryStat] = useState<"STR" | "VIT" | "INT" | "AGI" | "PER" | "CHA">("STR");
    const subtaskIdRef = useRef(1);
    const [subtasks, setSubtasks] = useState<{id: number, text: string}[]>([{id: 0, text: ""}]);
    const [scheduleType, setScheduleType] = useState<"daily" | "today" | "custom">("daily");
    const [deadline, setDeadline] = useState("");
    const [linkedGoalId, setLinkedGoalId] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Fetch goals via SWR (only when modal is open)
    const { data: goalsData } = useSWR(isOpen ? "/api/goals" : null, goalsFetcher);
    const availableGoals: Goal[] = goalsData?.goals || [];

    if (!isOpen) return null;

    const handleAddSubtask = () => {
        setSubtasks(prev => [...prev, {id: subtaskIdRef.current++, text: ""}]);
    };

    const handleSubtaskChange = (id: number, value: string) => {
        setSubtasks(prev => prev.map(s => s.id === id ? {...s, text: value} : s));
    };

    const handleRemoveSubtask = (id: number) => {
        setSubtasks(prev => prev.filter(s => s.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const validSubtasks = subtasks.map(s => s.text).filter(t => t.trim() !== "");
            const finalCategory = category === "Custom" ? customCategory : category;

            const isDaily = scheduleType === "daily";
            const todayStr = new Date().toISOString().split("T")[0];
            const effectiveDeadline = scheduleType === "today" ? todayStr : scheduleType === "custom" ? deadline : undefined;

            const payload: Record<string, unknown> = {
                title,
                category: finalCategory,
                rank,
                primaryStat,
                xpReward: 10, // Default fallback, but game engine calculates exact amount
                subtasks: validSubtasks,
                isDaily,
            };

            if (effectiveDeadline) payload.deadline = effectiveDeadline;
            if (linkedGoalId) payload.linkedGoalId = linkedGoalId;

            const res = await fetch("/api/habits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create quest");
            }

            // Reset form
            setTitle("");
            setCategory("Learning");
            setCustomCategory("");
            setRank("E");
            setPrimaryStat("STR");
            setScheduleType("daily");
            subtaskIdRef.current = 1;
            setSubtasks([{id: 0, text: ""}]);
            setDeadline("");
            setLinkedGoalId("");

            onQuestCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error creating quest");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose} onKeyDown={e => e.key === 'Escape' && onClose()}>
            <div className="modal-content glass-card" role="document" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="section-title" style={{ margin: 0 }}>CREATE DAILY TASK</h2>
                    <button className="icon-btn" onClick={onClose}><X size={20} /></button>
                </div>

                {error && <div className="error-message" style={{ color: "var(--accent-red)", marginBottom: "var(--space-md)" }}>{error}</div>}

                <form onSubmit={handleSubmit} className="quest-form">
                    <div className="form-group">
                        <label htmlFor="create-quest-title">Quest Title</label>
                        <input
                            id="create-quest-title"
                            type="text"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. CompTIA Security+ Study"
                            className="game-input"
                        />
                    </div>

                    <div className="form-group">
                        <span style={{ fontSize: 'inherit', fontWeight: 500 }}>Category</span>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                            {(["Learning", "Cybersecurity", "Career", "Business", "Custom"] as const).map(cat => {
                                const icons = { Learning: <BookOpen size={14} />, Cybersecurity: <Shield size={14} />, Career: <Briefcase size={14} />, Business: <TrendingUp size={14} />, Custom: <Pen size={14} /> };
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        style={{
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                                            padding: "8px 4px", borderRadius: 8, cursor: "pointer", fontSize: "0.72rem",
                                            border: category === cat ? "1.5px solid var(--accent-green)" : "1px solid rgba(255,255,255,0.1)",
                                            background: category === cat ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)",
                                            color: category === cat ? "var(--accent-green)" : "var(--text-muted)",
                                            transition: "border-color 0.2s, background 0.2s, color 0.2s",
                                        }}
                                    >
                                        {icons[cat]}
                                        <strong>{cat}</strong>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {category === "Custom" && (
                        <div className="form-group">
                            <label htmlFor="create-quest-custom-cat">Custom Category</label>
                            <input
                                id="create-quest-custom-cat"
                                type="text"
                                required
                                value={customCategory}
                                onChange={e => setCustomCategory(e.target.value)}
                                placeholder="e.g. Health, Music"
                                className="game-input"
                            />
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginTop: "1rem" }}>
                        <div className="form-group">
                            <label htmlFor="create-quest-rank">Quest Rank</label>
                            <select
                                id="create-quest-rank"
                                value={rank}
                                onChange={e => setRank(e.target.value as any)}
                                className="game-input"
                            >
                                <option value="E">E-Rank (10 XP, Easy)</option>
                                <option value="D">D-Rank (20 XP, Moderate)</option>
                                <option value="C">C-Rank (35 XP, Hard)</option>
                                <option value="B">B-Rank (55 XP, Very Hard)</option>
                                <option value="A">A-Rank (80 XP, Extreme)</option>
                                <option value="S">S-Rank (120 XP, Boss)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="create-quest-stat">Target Stat</label>
                            <select
                                id="create-quest-stat"
                                value={primaryStat}
                                onChange={e => setPrimaryStat(e.target.value as any)}
                                className="game-input"
                            >
                                <option value="STR">STR - Strength (Fitness/Health)</option>
                                <option value="VIT">VIT - Vitality (Recovery/Sleep)</option>
                                <option value="INT">INT - Intelligence (Study/Coding)</option>
                                <option value="AGI">AGI - Agility (Inbox/Speed Tasks)</option>
                                <option value="PER">PER - Perception (Planning/Focus)</option>
                                <option value="CHA">CHA - Charisma (Networking/Speaking)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <span style={{ fontSize: 'inherit', fontWeight: 500 }}>Schedule</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                            {(["daily", "today", "custom"] as const).map(type => {
                                const icons = { daily: <RotateCw size={14} />, today: <CalendarCheck size={14} />, custom: <Calendar size={14} /> };
                                const labels = { daily: "Daily", today: "Today", custom: "Custom" };
                                const descs = { daily: "Repeats every day", today: "One-time, due today", custom: "Pick a deadline" };
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setScheduleType(type)}
                                        style={{
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                                            padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem",
                                            border: scheduleType === type ? "1.5px solid var(--accent-green)" : "1px solid rgba(255,255,255,0.1)",
                                            background: scheduleType === type ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)",
                                            color: scheduleType === type ? "var(--accent-green)" : "var(--text-muted)",
                                            transition: "border-color 0.2s, background 0.2s, color 0.2s",
                                        }}
                                    >
                                        {icons[type]}
                                        <strong>{labels[type]}</strong>
                                        <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{descs[type]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {scheduleType === "custom" && (
                        <div className="form-group">
                            <label htmlFor="create-quest-deadline">Deadline</label>
                            <input
                                id="create-quest-deadline"
                                type="date"
                                required
                                value={deadline}
                                onChange={e => setDeadline(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                className="game-input"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="create-quest-goal">Link to Goal (Optional)</label>
                        <select
                            id="create-quest-goal"
                            value={linkedGoalId}
                            onChange={e => setLinkedGoalId(e.target.value)}
                            className="game-input"
                        >
                            <option value="">No Goal</option>
                            {availableGoals.map(g => (
                                <option key={g._id} value={g._id}>{g.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 500 }}>
                            Subtasks
                            <button type="button" onClick={handleAddSubtask} className="text-btn">
                                <Plus size={14} /> Add Step
                            </button>
                        </span>
                        <div className="subtasks-list">
                            {subtasks.map((subtask) => (
                                <div key={subtask.id} className="subtask-input-row">
                                    <input
                                        type="text"
                                        value={subtask.text}
                                        onChange={e => handleSubtaskChange(subtask.id, e.target.value)}
                                        placeholder="Step"
                                        className="game-input"
                                    />
                                    {subtasks.length > 1 && (
                                        <button type="button" onClick={() => handleRemoveSubtask(subtask.id)} className="icon-btn danger">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? "Forging Quest..." : "Create Quest"}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}

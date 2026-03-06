"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { X, Plus, Trash2 } from "lucide-react";

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
    const [category, setCategory] = useState("");
    const [difficulty, setDifficulty] = useState<"small" | "medium" | "hard">("medium");
    const subtaskIdRef = useRef(1);
    const [subtasks, setSubtasks] = useState<{id: number, text: string}[]>([{id: 0, text: ""}]);
    const [deadline, setDeadline] = useState("");
    const [linkedGoalId, setLinkedGoalId] = useState("");
    const [isDaily, setIsDaily] = useState(true);

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
            const xpReward = difficulty === "small" ? 10 : difficulty === "medium" ? 25 : 50;

            const payload: any = {
                title,
                category,
                difficulty,
                xpReward,
                subtasks: validSubtasks,
                isDaily
            };

            if (!isDaily && deadline) payload.deadline = deadline;
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
            setCategory("");
            setDifficulty("medium");
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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                        <div className="form-group">
                            <label htmlFor="create-quest-category">Category</label>
                            <input
                                id="create-quest-category"
                                type="text"
                                required
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                placeholder="e.g. Learning"
                                className="game-input"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="create-quest-difficulty">Difficulty</label>
                            <select
                                id="create-quest-difficulty"
                                value={difficulty}
                                onChange={e => setDifficulty(e.target.value as any)}
                                className="game-input"
                            >
                                <option value="small">E-Rank (10 XP)</option>
                                <option value="medium">C-Rank (25 XP)</option>
                                <option value="hard">A-Rank (50 XP)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                        <div className="form-group">
                            <span style={{ fontSize: 'inherit', fontWeight: 'inherit' }}>Schedule</span>
                            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                <input
                                    type="checkbox"
                                    checked={isDaily}
                                    onChange={(e) => setIsDaily(e.target.checked)}
                                    className="game-checkbox"
                                />
                                Make Daily Repeating Task
                            </label>
                        </div>

                        {!isDaily && (
                            <div className="form-group">
                                <label htmlFor="create-quest-deadline">Deadline (One-Time Task)</label>
                                <input
                                    id="create-quest-deadline"
                                    type="date"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="game-input"
                                />
                            </div>
                        )}

                        <div className="form-group" style={{ gridColumn: isDaily ? "1 / -1" : "auto" }}>
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

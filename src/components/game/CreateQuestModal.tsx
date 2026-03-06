"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";

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
    const [subtasks, setSubtasks] = useState<string[]>([""]);
    const [deadline, setDeadline] = useState("");
    const [linkedGoalId, setLinkedGoalId] = useState("");
    const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetch("/api/goals")
                .then(res => res.json())
                .then(data => {
                    if (data.goals) setAvailableGoals(data.goals);
                })
                .catch(err => console.error("Error fetching goals:", err));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddSubtask = () => {
        setSubtasks([...subtasks, ""]);
    };

    const handleSubtaskChange = (index: number, value: string) => {
        const newSubtasks = [...subtasks];
        newSubtasks[index] = value;
        setSubtasks(newSubtasks);
    };

    const handleRemoveSubtask = (index: number) => {
        setSubtasks(subtasks.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const validSubtasks = subtasks.filter(s => s.trim() !== "");
            const xpReward = difficulty === "small" ? 10 : difficulty === "medium" ? 25 : 50;

            const payload: any = {
                title,
                category,
                difficulty,
                xpReward,
                subtasks: validSubtasks
            };

            if (deadline) payload.deadline = deadline;
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
            setSubtasks([""]);
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="section-title" style={{ margin: 0 }}>CREATE DAILY TASK</h2>
                    <button className="icon-btn" onClick={onClose}><X size={20} /></button>
                </div>

                {error && <div className="error-message" style={{ color: "var(--accent-red)", marginBottom: "var(--space-md)" }}>{error}</div>}

                <form onSubmit={handleSubmit} className="quest-form">
                    <div className="form-group">
                        <label>Quest Title</label>
                        <input
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
                            <label>Category</label>
                            <input
                                type="text"
                                required
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                placeholder="e.g. Learning"
                                className="game-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Difficulty</label>
                            <select
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
                            <label>Deadline (Optional)</label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={e => setDeadline(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                className="game-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Link to Goal (Optional)</label>
                            <select
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
                        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            Subtasks
                            <button type="button" onClick={handleAddSubtask} className="text-btn">
                                <Plus size={14} /> Add Step
                            </button>
                        </label>
                        <div className="subtasks-list">
                            {subtasks.map((subtask, index) => (
                                <div key={index} className="subtask-input-row">
                                    <input
                                        type="text"
                                        value={subtask}
                                        onChange={e => handleSubtaskChange(index, e.target.value)}
                                        placeholder={`Step ${index + 1}`}
                                        className="game-input"
                                    />
                                    {subtasks.length > 1 && (
                                        <button type="button" onClick={() => handleRemoveSubtask(index)} className="icon-btn danger">
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
            </div>
        </div>
    );
}

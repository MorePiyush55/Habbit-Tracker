"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { Quest } from "./QuestPanel";

interface EditQuestModalProps {
    quest: Quest;
    onClose: () => void;
    onQuestUpdated: () => void;
}

export default function EditQuestModal({ quest, onClose, onQuestUpdated }: EditQuestModalProps) {
    const [title, setTitle] = useState(quest.title);
    const [category, setCategory] = useState(quest.category);
    const [difficulty, setDifficulty] = useState<"small" | "medium" | "hard">(
        quest.difficulty as "small" | "medium" | "hard"
    );
    const [subtasks, setSubtasks] = useState<string[]>(
        quest.subtasks.length > 0
            ? quest.subtasks.map((s) => s.title)
            : []
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

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
            const xpReward = difficulty === "small" ? 10 : difficulty === "medium" ? 25 : 50;
            const validSubtasks = subtasks.filter((s) => s.trim() !== "");

            const payload: Record<string, unknown> = {
                title,
                category,
                difficulty,
                xpReward,
                subtasks: validSubtasks,
            };

            const res = await fetch(`/api/habits/${quest._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update quest");
            }

            onQuestUpdated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error updating quest");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="section-title" style={{ margin: 0 }}>EDIT QUEST</h2>
                    <button className="icon-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div
                        className="error-message"
                        style={{ color: "var(--accent-red)", marginBottom: "var(--space-md)" }}
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="quest-form">
                    <div className="form-group">
                        <label>Quest Title</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
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
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g. Learning"
                                className="game-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Difficulty</label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as "small" | "medium" | "hard")}
                                className="game-input"
                            >
                                <option value="small">E-Rank (10 XP)</option>
                                <option value="medium">C-Rank (25 XP)</option>
                                <option value="hard">A-Rank (50 XP)</option>
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
                        {subtasks.length === 0 && (
                            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "4px 0" }}>
                                No subtasks — task will show a direct checkbox.
                            </p>
                        )}
                        <div className="subtasks-list">
                            {subtasks.map((subtask, index) => (
                                <div key={index} className="subtask-input-row">
                                    <input
                                        type="text"
                                        value={subtask}
                                        onChange={(e) => handleSubtaskChange(index, e.target.value)}
                                        placeholder={`Step ${index + 1}`}
                                        className="game-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSubtask(index)}
                                        className="icon-btn danger"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

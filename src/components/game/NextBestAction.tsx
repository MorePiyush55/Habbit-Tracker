"use client";

import { Target, CheckCircle2, ArrowRight } from "lucide-react";
import type { Quest } from "./QuestPanel";
import { getTop3Tasks } from "@/lib/core/productLoop";

interface Props {
    quests?: Quest[];
    quest?: Quest | null;
    onComplete: (habitId: string) => void;
    onScrollToTask?: (habitId: string) => void;
}

export default function NextBestAction({ quests = [], quest, onComplete, onScrollToTask }: Props) {
    // Use Focus Mode to find best next action
    const topTasks = quests && quests.length > 0 ? getTop3Tasks(quests) : [];
    const nextTask = topTasks[0] || quest || null;

    if (!nextTask) return null;

    return (
        <div style={{
            background: "linear-gradient(135deg, rgba(0,180,255,0.1), rgba(139,92,246,0.1))",
            border: "1px solid rgba(0,180,255,0.4)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            boxShadow: "0 0 20px rgba(0,180,255,0.15)",
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Animated background glow */}
            <div style={{
                position: "absolute", top: -50, right: -50,
                width: 150, height: 150,
                background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)",
                borderRadius: "50%", pointerEvents: "none"
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div style={{ 
                        fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, 
                        color: "var(--accent-blue)", letterSpacing: 2, marginBottom: 6,
                        display: "flex", alignItems: "center", gap: 6
                    }}>
                        <Target size={14} /> NEXT BEST ACTION
                    </div>
                    
                    <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                        {nextTask.title}
                    </div>
                    
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.8rem", fontFamily: "monospace" }}>
                        <span style={{ color: "#ffcc00", fontWeight: 700 }}>+{nextTask.xpReward} XP</span>
                        {/* If it's a long task with subtasks, show subtask count */}
                        {nextTask.subtasks && nextTask.subtasks.length > 0 && (
                            <span style={{ color: "var(--text-muted)" }}>• {nextTask.subtasks.length} steps</span>
                        )}
                        <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>• {nextTask.category}</span>
                    </div>
                </div>

                <button
                    onClick={() => {
                        onScrollToTask?.(nextTask._id);

                        // Instant completion path for simple tasks (no subtasks)
                        if (!nextTask.subtasks || nextTask.subtasks.length === 0) {
                            onComplete(nextTask._id);
                            return;
                        }

                        // Complex task path: complete next incomplete subtask
                        const nextSub = nextTask.subtasks.find(s => !s.completed);
                        if (nextSub) {
                            onComplete(nextSub._id);
                        } else {
                            onComplete(nextTask._id);
                        }
                    }}
                    style={{
                        background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.5)",
                        color: "#00ff88", borderRadius: 8, padding: "8px 16px",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                        fontWeight: 600, fontFamily: "monospace", letterSpacing: 1,
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0,255,136,0.25)";
                        e.currentTarget.style.boxShadow = "0 0 15px rgba(0,255,136,0.3)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,255,136,0.15)";
                        e.currentTarget.style.boxShadow = "none";
                    }}
                >
                    <CheckCircle2 size={16} /> DO IT NOW
                </button>
            </div>
        </div>
    );
}

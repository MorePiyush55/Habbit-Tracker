import React from "react";
import { X } from "lucide-react";

interface DayClosureScreenProps {
    tasksCompleted: number;
    totalTasks: number;
    xpGained: number;
    streakMaintained: boolean;
    onDismiss: () => void;
}

export default function DayClosureScreen({
    tasksCompleted,
    totalTasks,
    xpGained,
    streakMaintained,
    onDismiss,
}: DayClosureScreenProps) {
    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                backdropFilter: "blur(2px)",
                animation: "fadeIn 0.3s ease",
            }}
            onClick={onDismiss}
        >
            <div
                style={{
                    background: "linear-gradient(135deg, rgba(20,30,50,0.95), rgba(30,40,60,0.95))",
                    border: "1px solid rgba(100,200,255,0.2)",
                    borderRadius: 16,
                    padding: "32px",
                    maxWidth: 400,
                    textAlign: "center",
                    fontFamily: "monospace",
                    color: "#fff",
                    boxShadow: "0 16px 48px rgba(0,100,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                    animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onDismiss}
                    style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        background: "none",
                        border: "none",
                        color: "#888",
                        cursor: "pointer",
                        padding: 4,
                    }}
                >
                    <X size={20} />
                </button>

                {/* Title */}
                <div
                    style={{
                        fontSize: "1.8rem",
                        fontWeight: "bold",
                        marginBottom: 24,
                        background: "linear-gradient(135deg, #00ff88, #00d4ff)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Day Complete
                </div>

                {/* Stats Grid */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                        marginBottom: 24,
                    }}
                >
                    {/* Tasks */}
                    <div
                        style={{
                            background: "rgba(0,255,136,0.08)",
                            border: "1px solid rgba(0,255,136,0.2)",
                            borderRadius: 8,
                            padding: "16px",
                        }}
                    >
                        <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6 }}>TASKS</div>
                        <div style={{ fontSize: "1.6rem", color: "#00ff88", fontWeight: "bold" }}>
                            {tasksCompleted}/{totalTasks}
                        </div>
                    </div>

                    {/* XP */}
                    <div
                        style={{
                            background: "rgba(255,140,0,0.08)",
                            border: "1px solid rgba(255,140,0,0.2)",
                            borderRadius: 8,
                            padding: "16px",
                        }}
                    >
                        <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6 }}>XP</div>
                        <div style={{ fontSize: "1.6rem", color: "#ff8c00", fontWeight: "bold" }}>
                            +{xpGained}
                        </div>
                    </div>

                    {/* Streak */}
                    <div
                        style={{
                            gridColumn: "1 / -1",
                            background: "rgba(100,200,255,0.08)",
                            border: "1px solid rgba(100,200,255,0.2)",
                            borderRadius: 8,
                            padding: "12px",
                        }}
                    >
                        <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 4 }}>STREAK</div>
                        <div style={{ fontSize: "1.2rem", color: "#64c8ff", fontWeight: "bold" }}>
                            {streakMaintained ? "✓ Maintained" : "○ Reset"}
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <button
                    onClick={onDismiss}
                    style={{
                        width: "100%",
                        padding: "12px 20px",
                        background: "linear-gradient(135deg, rgba(0,255,136,0.2), rgba(100,200,255,0.2))",
                        border: "1px solid rgba(0,255,136,0.3)",
                        borderRadius: 8,
                        color: "#00ff88",
                        fontFamily: "monospace",
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,255,136,0.3), rgba(100,200,255,0.3))";
                        e.currentTarget.style.boxShadow = "0 0 16px rgba(0,255,136,0.2)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,255,136,0.2), rgba(100,200,255,0.2))";
                        e.currentTarget.style.boxShadow = "none";
                    }}
                >
                    Tomorrow Awaits
                </button>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Zap, Clock } from "lucide-react";

export default function SessionTimer() {
    const [active, setActive] = useState(false);
    const [startedAt, setStartedAt] = useState<Date | null>(null);
    const [durationMs, setDurationMs] = useState(60 * 60 * 1000); // 60 min
    const [timeLeft, setTimeLeft] = useState(60 * 60 * 1000);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [summary, setSummary] = useState<{ bonusXP: number; tasks: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // On mount: check if there's an active session (resume on refresh)
    useEffect(() => {
        fetch("/api/session")
            .then(r => r.json())
            .then(data => {
                if (data.autoEnded) {
                    setSummary({ bonusXP: data.bonusXP, tasks: data.completedTasks });
                    return;
                }
                if (data.active && data.startedAt) {
                    const start = new Date(data.startedAt);
                    const dur = (data.durationMinutes || 60) * 60 * 1000;
                    const elapsed = Date.now() - start.getTime();
                    const remaining = Math.max(0, dur - elapsed);
                    setActive(true);
                    setStartedAt(start);
                    setDurationMs(dur);
                    setTimeLeft(remaining);
                    setCompletedTasks(data.completedTasksDuringSession || 0);
                }
            })
            .catch(() => {});
    }, []);

    // Countdown tick
    useEffect(() => {
        if (!active) return;
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1000) {
                    clearInterval(intervalRef.current!);
                    handleEnd(true);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current!);
    }, [active]);

    const handleStart = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "start", durationMinutes: 60 }),
            });
            const data = await res.json();
            if (data.success) {
                setActive(true);
                setStartedAt(new Date(data.startedAt));
                setTimeLeft(60 * 60 * 1000);
                setCompletedTasks(0);
                setSummary(null);
            }
        } catch {}
        setLoading(false);
    };

    const handleEnd = async (auto = false) => {
        if (!auto) setLoading(true);
        try {
            const res = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "end" }),
            });
            const data = await res.json();
            setSummary({ bonusXP: data.bonusXP || 0, tasks: data.completedTasks || 0 });
        } catch {}
        setActive(false);
        setLoading(false);
    };

    const mm = String(Math.floor(timeLeft / 60000)).padStart(2, "0");
    const ss = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, "0");
    const progress = active ? ((durationMs - timeLeft) / durationMs) * 100 : 0;
    const urgency = timeLeft < 5 * 60 * 1000; // < 5 min left

    if (summary) {
        return (
            <div style={{
                background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)",
                borderRadius: 12, padding: "12px 20px", marginBottom: 12,
                display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between",
                boxShadow: "0 0 20px rgba(0,255,136,0.1)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Zap size={18} style={{ color: "#ffcc00" }} />
                    <div>
                        <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#00ff88", fontSize: "0.9rem" }}>
                            ⚔️ Session Complete!
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                            {summary.tasks} tasks • +{summary.bonusXP} bonus XP earned
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setSummary(null)}
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
                >×</button>
            </div>
        );
    }

    if (!active) {
        return (
            <button
                onClick={handleStart}
                disabled={loading}
                style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "10px 16px", marginBottom: 12,
                    background: "rgba(139,92,246,0.08)",
                    border: "1px dashed rgba(139,92,246,0.3)", borderRadius: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                    color: "rgba(139,92,246,0.8)", fontFamily: "monospace",
                    fontSize: "0.85rem", letterSpacing: 1, justifyContent: "center",
                    transition: "all 0.2s ease",
                }}
            >
                <Clock size={15} />
                {loading ? "Starting..." : "⏱ Start 60-Min Focus Session"}
            </button>
        );
    }

    return (
        <div style={{
            background: urgency ? "rgba(255,0,64,0.08)" : "rgba(139,92,246,0.08)",
            border: `1px solid ${urgency ? "rgba(255,0,64,0.4)" : "rgba(139,92,246,0.3)"}`,
            borderRadius: 12, padding: "12px 20px", marginBottom: 12,
            boxShadow: urgency ? "0 0 20px rgba(255,0,64,0.15)" : "0 0 20px rgba(139,92,246,0.1)",
            transition: "all 0.5s ease",
        }}>
            {/* Progress bar */}
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)", marginBottom: 10 }}>
                <div style={{
                    height: "100%", borderRadius: 2,
                    width: `${progress}%`,
                    background: urgency
                        ? "linear-gradient(90deg, #ff0040, #ff6600)"
                        : "linear-gradient(90deg, #8b5cf6, #00b4ff)",
                    transition: "width 1s linear",
                }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Play size={14} style={{ color: urgency ? "#ff0040" : "#8b5cf6" }} />
                    <div>
                        <span style={{
                            fontFamily: "monospace", fontWeight: 900, fontSize: "1.3rem",
                            color: urgency ? "#ff0040" : "#8b5cf6",
                            textShadow: urgency ? "0 0 12px rgba(255,0,64,0.6)" : "0 0 12px rgba(139,92,246,0.5)",
                            letterSpacing: 2,
                        }}>{mm}:{ss}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginLeft: 8, fontFamily: "monospace" }}>
                            {completedTasks} tasks done
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => handleEnd(false)}
                    disabled={loading}
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "4px 12px", borderRadius: 8,
                        background: "rgba(255,0,64,0.12)", border: "1px solid rgba(255,0,64,0.3)",
                        color: "#ff4466", cursor: "pointer", fontSize: "0.75rem",
                        fontFamily: "monospace", letterSpacing: 1,
                    }}
                >
                    <Square size={11} /> End
                </button>
            </div>
        </div>
    );
}

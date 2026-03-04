"use client";

import { getStreakInfo } from "@/lib/game-engine/streakSystem";
import { Flame } from "lucide-react";

interface StreakDisplayProps {
    currentStreak: number;
    longestStreak: number;
}

export default function StreakDisplay({ currentStreak, longestStreak }: StreakDisplayProps) {
    const streakInfo = getStreakInfo(currentStreak, longestStreak);

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
            <div className="section-title">
                <Flame size={20} className="section-title-icon" />
                Streak
            </div>

            <div style={{ textAlign: "center", margin: "var(--space-md) 0" }}>
                <div className="streak-fire">🔥</div>
                <div
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "2rem",
                        fontWeight: 800,
                        color: "#fb923c",
                    }}
                >
                    {currentStreak} {currentStreak === 1 ? "Day" : "Days"}
                </div>
            </div>

            <div className="streak-milestones">
                {streakInfo.milestones.slice(0, 5).map((m) => (
                    <div
                        key={m.days}
                        className={`streak-milestone ${m.reached ? "reached" : ""}`}
                    >
                        <span>{m.reached ? "✅" : "⬜"}</span>
                        <span>{m.days} days — {m.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

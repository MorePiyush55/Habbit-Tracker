"use client";

import { Skull, Shield, Flame } from "lucide-react";

interface BossBattleProps {
    bossHP: number;
    isDefeated: boolean;
    currentStreak: number;
}

export default function BossBattle({ bossHP, isDefeated, currentStreak }: BossBattleProps) {
    const totalHP = 500;
    const hpPercent = (bossHP / totalHP) * 100;

    return (
        <div className={`glass-card boss-card ${isDefeated ? "defeated" : ""}`}>
            <div className="section-title">
                {isDefeated ? (
                    <Shield size={20} style={{ color: "var(--accent-green)" }} />
                ) : (
                    <Skull size={20} style={{ color: "var(--accent-red)" }} />
                )}
                {isDefeated ? "Raid Cleared!" : "Weekly Boss Raid"}
            </div>

            <div className="boss-name">
                {isDefeated ? `☠️ Discipline Titan (Defeated)` : `💀 Discipline Titan`}
            </div>

            {!isDefeated ? (
                <>
                    <div className="boss-hp-label">
                        <span>HP</span>
                        <span>{bossHP} / {totalHP}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 16 }}>
                        <div
                            className="progress-fill progress-fill-boss"
                            style={{ width: `${hpPercent}%` }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)", justifyContent: "center" }}>
                        <span className="badge" style={{ background: currentStreak >= 5 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)", color: currentStreak >= 5 ? "var(--accent-green)" : "var(--accent-red)" }}>
                            <Flame size={12} style={{ display: "inline", marginRight: 4 }} />
                            Requirement: 5 Day Streak ({currentStreak}/5)
                        </span>
                        <span className="badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "var(--accent-gold)" }}>
                            Reward: +300 XP
                        </span>
                    </div>

                    <p
                        style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            marginTop: "var(--space-sm)",
                            textAlign: "center",
                        }}
                    >
                        Deal 500 damage (XP) and maintain a 5-day streak to slay the titan!
                    </p>
                </>
            ) : (
                <div className="boss-defeated-text">⚔️ RAID CLEAR! +300 XP GRANTED ⚔️</div>
            )}
        </div>
    );
}

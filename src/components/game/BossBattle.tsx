"use client";

import { Skull, Shield, Flame, Swords } from "lucide-react";

interface BossBattleProps {
    bossHP: number;
    isDefeated: boolean;
    currentStreak: number;
    disciplineScore?: number;
}

function getBossName(bossHP: number): string {
    if (bossHP >= 800) return "Shadow Monarch's Trial";
    if (bossHP >= 700) return "The Procrastination Overlord";
    if (bossHP >= 600) return "Iron Warden";
    if (bossHP >= 450) return "Discipline Titan";
    return "Shadow Imp";
}

function getBossTier(bossHP: number): string {
    if (bossHP >= 800) return "S-CLASS";
    if (bossHP >= 700) return "A-CLASS";
    if (bossHP >= 600) return "B-CLASS";
    if (bossHP >= 450) return "C-CLASS";
    return "D-CLASS";
}

export default function BossBattle({ bossHP, isDefeated, currentStreak, disciplineScore }: BossBattleProps) {
    const totalHP = bossHP > 0 ? Math.max(bossHP, 300) : 500;
    const hpPercent = (bossHP / totalHP) * 100;
    const bossName = getBossName(totalHP);
    const bossTier = getBossTier(totalHP);

    const tierColors: Record<string, string> = {
        "S-CLASS": "#ff4444",
        "A-CLASS": "#ff8800",
        "B-CLASS": "#ffaa00",
        "C-CLASS": "#00aaff",
        "D-CLASS": "#888888"
    };

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

            <div className="boss-name" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {isDefeated ? `☠️ ${bossName} (Defeated)` : `💀 ${bossName}`}
                <span style={{
                    fontSize: "0.6rem",
                    letterSpacing: "2px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: `${tierColors[bossTier] || "#888"}22`,
                    color: tierColors[bossTier] || "#888",
                    border: `1px solid ${tierColors[bossTier] || "#888"}44`,
                    fontWeight: 700
                }}>
                    {bossTier}
                </span>
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

                    <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)", justifyContent: "center", flexWrap: "wrap" }}>
                        <span className="badge" style={{ background: currentStreak >= 5 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)", color: currentStreak >= 5 ? "var(--accent-green)" : "var(--accent-red)" }}>
                            <Flame size={12} style={{ display: "inline", marginRight: 4 }} />
                            Requirement: 5 Day Streak ({currentStreak}/5)
                        </span>
                        <span className="badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "var(--accent-gold)" }}>
                            Reward: +300 XP
                        </span>
                        {disciplineScore !== undefined && (
                            <span className="badge" style={{ background: "rgba(139, 92, 246, 0.2)", color: "#8b5cf6" }}>
                                <Swords size={12} style={{ display: "inline", marginRight: 4 }} />
                                Difficulty: Based on Discipline ({disciplineScore}%)
                            </span>
                        )}
                    </div>

                    <p
                        style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            marginTop: "var(--space-sm)",
                            textAlign: "center",
                        }}
                    >
                        Deal {totalHP} damage (XP) and maintain a 5-day streak to slay {bossName}!
                    </p>
                </>
            ) : (
                <div className="boss-defeated-text">⚔️ RAID CLEAR! +300 XP GRANTED ⚔️</div>
            )}
        </div>
    );
}

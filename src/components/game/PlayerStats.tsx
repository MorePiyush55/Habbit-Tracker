"use client";

import { useState } from "react";
import { calculateRequiredXpForLevel, getHunterRankTitle } from "@/lib/game-engine/engine";
import Image from "next/image";
import { Flame, Zap, TrendingUp, Award, Coins, Star } from "lucide-react";

interface PlayerStatsProps {
    name: string;
    photo: string;
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    level: number;
    gold: number;
    statPoints: number;
    hp: number;
    maxHp: number;
    stats: {
        STR: { value: number; xp: number };
        VIT: { value: number; xp: number };
        INT: { value: number; xp: number };
        AGI: { value: number; xp: number };
        PER: { value: number; xp: number };
        CHA: { value: number; xp: number };
    };
    disciplineScore: number;
    hunterRank: string;
}

export default function PlayerStats({
    name,
    photo,
    totalXP,
    currentStreak,
    longestStreak,
    level,
    gold,
    statPoints,
    hp,
    maxHp,
    stats,
    disciplineScore,
}: PlayerStatsProps) {
    // Math for XP Progress Bar
    const xpForCurrentLevel = calculateRequiredXpForLevel(level);
    const xpForNextLevel = calculateRequiredXpForLevel(level + 1);
    const xpIntoLevel = Math.max(0, totalXP - xpForCurrentLevel);
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const progress = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));

    // Dynamic Rank Title
    const displayRank = getHunterRankTitle(level);

    // Fallback stats just in case
    const safeStats = stats || {
        STR: { value: 10, xp: 0 }, VIT: { value: 10, xp: 0 }, INT: { value: 10, xp: 0 },
        AGI: { value: 10, xp: 0 }, PER: { value: 10, xp: 0 }, CHA: { value: 10, xp: 0 }
    };

    const [upgradingFor, setUpgradingFor] = useState<string | null>(null);

    const handleUpgradeStat = async (statId: string) => {
        if (statPoints <= 0 || upgradingFor) return;
        setUpgradingFor(statId);
        try {
            const res = await fetch("/api/user/stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ statId }),
            });
            if (res.ok) {
                import("swr").then(({ mutate }) => {
                    mutate(
                        (key) => typeof key === "string" && key.startsWith("/api/analytics"),
                        undefined,
                        { revalidate: true }
                    );
                });
            }
        } catch (error) {
            console.error("Failed to upgrade stat:", error);
        } finally {
            setUpgradingFor(null);
        }
    };

    return (
        <div className="glass-card player-card">
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {photo ? (
                        <Image src={photo} alt={name} width={50} height={50} style={{ borderRadius: "50%", border: "2px solid var(--accent-blue)" }} />
                    ) : (
                        <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", border: "2px solid var(--accent-blue)" }}>⚔️</div>
                    )}
                    <div>
                        <div className="player-name" style={{ fontSize: "1.1rem" }}>{name}</div>
                        <span className="badge badge-rank" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>{displayRank}</span>
                    </div>
                </div>
                
                <div style={{ textAlign: "right" }}>
                    <div style={{ color: "var(--accent-gold)", fontWeight: "bold", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                        <Coins size={16} /> {gold}
                    </div>
                    {statPoints > 0 && (
                        <div style={{ color: "var(--accent-green)", fontSize: "0.8rem", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                            <Star size={12} /> {statPoints} pts
                        </div>
                    )}
                </div>
            </div>

            <div className="player-level" style={{ fontSize: "1.5rem", marginBottom: "4px", textAlign: "left", width: "100%" }}>Lv. {level}</div>

            {/* HP Bar */}
            <div className="xp-label" style={{ color: "#ff4444" }}>
                <span>HP</span>
                <span>{hp} / {maxHp}</span>
            </div>
            <div className="progress-bar" style={{ height: "6px", marginBottom: "15px", background: "rgba(255, 0, 0, 0.15)" }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((hp / maxHp) * 100))}%`, background: "linear-gradient(90deg, #aa0000, #ff4444)" }} />
            </div>

            {/* XP Bar */}
            <div className="xp-label">
                <span>XP</span>
                <span>{xpIntoLevel} / {xpNeeded}</span>
            </div>
            <div className="progress-bar" style={{ height: "6px", marginBottom: "20px" }}>
                <div className="progress-fill progress-fill-xp" style={{ width: `${progress}%` }} />
            </div>

            {/* Core RPG Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px", width: "100%" }}>
                {Object.entries(safeStats).map(([statName, data]) => (
                    <div key={statName} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem" }}>
                        <span style={{ width: "35px", fontWeight: "bold", color: "var(--text-secondary)" }}>{statName}</span>
                        <div className="progress-bar" style={{ height: "4px", flex: 1, background: "rgba(255,255,255,0.05)" }}>
                            <div className="progress-fill" style={{ width: `${data.xp}%`, background: "var(--accent-blue)", opacity: 0.8 }} />
                        </div>
                        <span style={{ width: "20px", textAlign: "right", color: "var(--text-primary)" }}>{data.value}</span>
                        {statPoints > 0 && (
                            <button 
                                onClick={() => handleUpgradeStat(statName)}
                                disabled={upgradingFor === statName}
                                style={{
                                    background: "rgba(0, 255, 136, 0.1)",
                                    border: "1px solid var(--accent-green)",
                                    color: "var(--accent-green)",
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: upgradingFor === statName ? "default" : "pointer",
                                    fontSize: "14px",
                                    opacity: upgradingFor === statName ? 0.5 : 1
                                }}
                            >
                                +
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="stat-item" style={{ background: "rgba(79, 124, 255, 0.1)", border: "1px solid rgba(79, 124, 255, 0.3)" }}>
                    <div className="stat-value" style={{ color: "var(--accent-blue)", fontSize: "1.4rem" }}>
                        {disciplineScore}
                    </div>
                    <div className="stat-label">
                        <Award size={12} style={{ display: "inline", marginRight: 4 }} />
                        Disc. Score
                    </div>
                </div>
                <div className="stat-item">
                    <div className="stat-value" style={{ color: "#fb923c", fontSize: "1.4rem" }}>
                        {currentStreak} <span style={{fontSize: "0.8rem", color: "var(--text-muted)"}}>({longestStreak})</span>
                    </div>
                    <div className="stat-label">
                        <Flame size={12} style={{ display: "inline", marginRight: 2 }} />
                        Streak (Best)
                    </div>
                </div>
            </div>
        </div>
    );
}

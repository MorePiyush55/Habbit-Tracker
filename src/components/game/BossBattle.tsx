"use client";

import { Skull, Shield, Flame, Swords, Star, Trophy } from "lucide-react";

interface BossBattleProps {
    bossHP: number;
    isDefeated: boolean;
    currentStreak: number;
    disciplineScore?: number;
    bossRewardClaimed?: boolean;
}

function getBossPhase(hp: number): 1 | 2 | 3 | 0 {
    if (hp <= 0) return 0;       // Defeated
    if (hp <= 100) return 3;     // RAGE MODE
    if (hp <= 250) return 2;     // Enraged
    return 1;                    // Awakening
}

const TOTAL_HP = 500;

export default function BossBattle({ bossHP, isDefeated, currentStreak, disciplineScore, bossRewardClaimed }: BossBattleProps) {
    const phase = getBossPhase(bossHP);
    const hpPercent = Math.max(0, (bossHP / TOTAL_HP) * 100);
    const defeated = isDefeated || bossHP <= 0;

    const phaseConfig = {
        0: { label: "DEFEATED",      color: "#00ff88",  glow: "0 0 30px rgba(0,255,136,0.5)", pulse: false,  name: "Shadow Imp" },
        1: { label: "AWAKENING",     color: "#00b4ff",  glow: "0 0 20px rgba(0,180,255,0.3)", pulse: false,  name: "Discipline Titan" },
        2: { label: "ENRAGED ⚠️",    color: "#ff8c00",  glow: "0 0 25px rgba(255,140,0,0.5)", pulse: true,   name: "The Procrastination Overlord" },
        3: { label: "⚡ RAGE MODE",  color: "#ff0040",  glow: "0 0 35px rgba(255,0,64,0.6)",  pulse: true,   name: "Shadow Monarch's Trial" },
    };

    const cfg = phaseConfig[phase];

    const hpBarColor = phase === 3 ? "#ff0040" : phase === 2 ? "#ff8c00" : "#00b4ff";

    return (
        <div
            className="glass-card boss-card"
            style={{
                border: `1px solid ${cfg.color}44`,
                boxShadow: cfg.glow,
                animation: cfg.pulse ? "phasePulse 1.5s ease-in-out infinite" : "none",
                transition: "all 0.5s ease",
            }}
        >
            <style>{`
                @keyframes phasePulse {
                    0%, 100% { box-shadow: ${cfg.glow}; }
                    50% { box-shadow: ${cfg.glow.replace("0.5", "0.9").replace("0.6", "1").replace("0.3", "0.6")}; }
                }
                @keyframes goldShimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
            `}</style>

            {/* Header */}
            <div className="section-title" style={{ color: cfg.color }}>
                {defeated ? <Trophy size={20} /> : <Skull size={20} />}
                {defeated ? "Raid Cleared!" : "Weekly Boss Raid"}
                {!defeated && (
                    <span style={{
                        fontSize: "0.6rem", letterSpacing: 2,
                        padding: "2px 8px", borderRadius: 4,
                        background: `${cfg.color}22`, color: cfg.color,
                        border: `1px solid ${cfg.color}44`, fontWeight: 700,
                        marginLeft: 8,
                    }}>
                        PHASE {phase} — {cfg.label}
                    </span>
                )}
            </div>

            {/* Boss Name */}
            <div style={{ textAlign: "center", fontFamily: "monospace", fontWeight: 700,
                fontSize: "1rem", color: cfg.color, marginBottom: 12,
                textShadow: `0 0 12px ${cfg.color}88`,
            }}>
                {defeated ? `☠️ ${cfg.name} (Defeated)` : `💀 ${cfg.name}`}
            </div>

            {!defeated ? (
                <>
                    {/* HP Bar */}
                    <div className="boss-hp-label">
                        <span>HP</span>
                        <span style={{ color: hpBarColor, fontWeight: 700 }}>{bossHP} / {TOTAL_HP}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 16, marginBottom: 8 }}>
                        <div
                            className="progress-fill"
                            style={{
                                width: `${hpPercent}%`,
                                background: phase === 3
                                    ? "linear-gradient(90deg, #ff0040, #ff6600)"
                                    : phase === 2
                                    ? "linear-gradient(90deg, #ff8c00, #ffcc00)"
                                    : "linear-gradient(90deg, #00b4ff, #8b5cf6)",
                                boxShadow: `0 0 8px ${hpBarColor}88`,
                                transition: "width 0.6s ease, background 0.5s ease",
                            }}
                        />
                    </div>

                    {/* Phase hint text */}
                    {phase === 3 && (
                        <div style={{ textAlign: "center", color: "#ff0040", fontSize: "0.75rem",
                            fontFamily: "monospace", letterSpacing: 1, marginBottom: 8,
                            textShadow: "0 0 8px rgba(255,0,64,0.8)" }}>
                            ⚠️ BOSS ENTERING FINAL STAND — FINISH IT!
                        </div>
                    )}
                    {phase === 2 && (
                        <div style={{ textAlign: "center", color: "#ff8c00", fontSize: "0.75rem",
                            fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
                            ⚡ Boss power surging — push through!
                        </div>
                    )}

                    {/* Info badges */}
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                        <span className="badge" style={{
                            background: currentStreak >= 3 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                            color: currentStreak >= 3 ? "var(--accent-green)" : "var(--accent-red)"
                        }}>
                            <Flame size={12} style={{ display: "inline", marginRight: 4 }} />
                            {currentStreak}/3 streak min
                        </span>
                        <span className="badge" style={{ background: "rgba(255,204,0,0.15)", color: "#ffcc00" }}>
                            <Trophy size={12} style={{ display: "inline", marginRight: 4 }} />
                            Reward: +500 XP + Stat Boost
                        </span>
                        {disciplineScore !== undefined && (
                            <span className="badge" style={{ background: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>
                                <Swords size={12} style={{ display: "inline", marginRight: 4 }} />
                                Discipline: {disciplineScore}%
                            </span>
                        )}
                    </div>
                </>
            ) : (
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        fontSize: "1.1rem", fontWeight: 900, fontFamily: "monospace",
                        letterSpacing: 2, padding: "16px 0",
                        background: "linear-gradient(90deg, #ffcc00, #ff8c00, #ffcc00)",
                        backgroundSize: "200% auto",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        animation: "goldShimmer 2s linear infinite",
                    }}>
                        ⚔️ RAID CLEAR!
                    </div>
                    {bossRewardClaimed ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                            <span className="badge" style={{ background: "rgba(255,204,0,0.2)", color: "#ffcc00" }}>
                                <Star size={12} style={{ display: "inline", marginRight: 4 }} />
                                +500 XP Awarded
                            </span>
                            <span className="badge" style={{ background: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>
                                +1 Stat Point Awarded
                            </span>
                        </div>
                    ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Rewards being processed...</p>
                    )}
                </div>
            )}
        </div>
    );
}

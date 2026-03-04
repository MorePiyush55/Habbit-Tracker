"use client";

import { calculateBossState } from "@/lib/game-engine/bossBattleSystem";
import { Skull, Shield } from "lucide-react";

interface BossBattleProps {
    date: string;
    entries: { xpEarned: number; completed: boolean }[];
}

export default function BossBattle({ date, entries }: BossBattleProps) {
    const boss = calculateBossState(date, entries);
    const hpPercent = (boss.currentHP / boss.totalHP) * 100;

    return (
        <div className={`glass-card boss-card ${boss.isDefeated ? "defeated" : ""}`}>
            <div className="section-title">
                {boss.isDefeated ? (
                    <Shield size={20} style={{ color: "var(--accent-green)" }} />
                ) : (
                    <Skull size={20} style={{ color: "var(--accent-red)" }} />
                )}
                {boss.isDefeated ? "Boss Defeated!" : "Today's Boss"}
            </div>

            <div className="boss-name">
                {boss.isDefeated ? `☠️ ${boss.bossName}` : `💀 ${boss.bossName}`}
            </div>

            {!boss.isDefeated ? (
                <>
                    <div className="boss-hp-label">
                        <span>HP</span>
                        <span>{boss.currentHP} / {boss.totalHP}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 16 }}>
                        <div
                            className="progress-fill progress-fill-boss"
                            style={{ width: `${hpPercent}%` }}
                        />
                    </div>
                    <p
                        style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            marginTop: "var(--space-sm)",
                            textAlign: "center",
                        }}
                    >
                        Complete all quests to defeat the boss!
                    </p>
                </>
            ) : (
                <div className="boss-defeated-text">⚔️ VICTORY! ⚔️</div>
            )}
        </div>
    );
}

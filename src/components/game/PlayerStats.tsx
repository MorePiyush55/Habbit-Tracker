"use client";

import { getLevelInfo } from "@/lib/game-engine/levelSystem";
import { getStreakInfo } from "@/lib/game-engine/streakSystem";
import { Flame, Zap, TrendingUp, Award } from "lucide-react";

interface PlayerStatsProps {
    name: string;
    photo: string;
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    disciplineScore: number;
    hunterRank: string;
}

export default function PlayerStats({
    name,
    photo,
    totalXP,
    currentStreak,
    longestStreak,
    disciplineScore,
    hunterRank,
}: PlayerStatsProps) {
    const levelInfo = getLevelInfo(totalXP);
    const streakInfo = getStreakInfo(currentStreak, longestStreak);

    return (
        <div className="glass-card player-card">
            {photo ? (
                <img src={photo} alt={name} className="player-avatar" />
            ) : (
                <div
                    className="player-avatar"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--bg-tertiary)",
                        fontSize: "1.8rem",
                    }}
                >
                    ⚔️
                </div>
            )}
            <div className="player-name">{name}</div>
            <span className="badge badge-rank">{hunterRank}</span>
            <div className="player-level">Lv. {levelInfo.level}</div>

            <div className="xp-label">
                <span>XP</span>
                <span>
                    {levelInfo.currentXP} / {levelInfo.xpForNextLevel - levelInfo.xpForCurrentLevel}
                </span>
            </div>
            <div className="progress-bar">
                <div
                    className="progress-fill progress-fill-xp"
                    style={{ width: `${levelInfo.progress}%` }}
                />
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "var(--space-md)" }}>
                <div className="stat-item" style={{ gridColumn: "span 2", background: "rgba(79, 124, 255, 0.1)", border: "1px solid rgba(79, 124, 255, 0.3)" }}>
                    <div className="stat-value" style={{ color: "var(--accent-blue)", fontSize: "2rem" }}>
                        {disciplineScore}
                    </div>
                    <div className="stat-label">
                        <Award size={14} style={{ display: "inline", marginRight: 4 }} />
                        Discipline Score
                    </div>
                </div>
            </div>

            <div className="stat-grid">
                <div className="stat-item">
                    <div className="stat-value" style={{ color: "var(--accent-gold)" }}>
                        {totalXP}
                    </div>
                    <div className="stat-label">
                        <Zap size={12} style={{ display: "inline", marginRight: 2 }} />
                        Total XP
                    </div>
                </div>
                <div className="stat-item">
                    <div className="stat-value" style={{ color: "#fb923c" }}>
                        {currentStreak}
                    </div>
                    <div className="stat-label">
                        <Flame size={12} style={{ display: "inline", marginRight: 2 }} />
                        Streak
                    </div>
                </div>
                <div className="stat-item">
                    <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
                        {longestStreak}
                    </div>
                    <div className="stat-label">
                        <TrendingUp size={12} style={{ display: "inline", marginRight: 2 }} />
                        Best
                    </div>
                </div>
                <div className="stat-item">
                    <div className="stat-value" style={{ color: "var(--accent-blue)" }}>
                        {levelInfo.rank.charAt(0)}
                    </div>
                    <div className="stat-label">
                        <Award size={12} style={{ display: "inline", marginRight: 2 }} />
                        Rank
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { ACHIEVEMENT_DEFINITIONS } from "@/lib/game-engine/achievementSystem";
import { Award } from "lucide-react";

interface AchievementBadgesProps {
    unlockedIds: string[];
}

export default function AchievementBadges({ unlockedIds }: AchievementBadgesProps) {
    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
            <div className="section-title">
                <Award size={20} className="section-title-icon" />
                Achievements
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                    gap: "var(--space-sm)",
                }}
            >
                {ACHIEVEMENT_DEFINITIONS.map((ach) => {
                    const isUnlocked = unlockedIds.includes(ach.id);
                    return (
                        <div
                            key={ach.id}
                            className={`achievement-badge ${isUnlocked ? "unlocked" : "locked"}`}
                            title={`${ach.title}: ${ach.description}`}
                        >
                            <span className="achievement-icon">{ach.icon}</span>
                            <span style={{ fontSize: "0.7rem", fontWeight: 600, lineHeight: 1.2 }}>
                                {ach.title}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

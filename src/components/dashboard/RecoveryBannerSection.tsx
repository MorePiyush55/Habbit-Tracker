import React from "react";
import { AlertTriangle } from "lucide-react";
import type { ProgressBoardData } from "../../hooks/useProgressBoard";

interface RecoveryBannerSectionProps {
    yesterdayReview: ProgressBoardData["yesterdayReview"];
    onLateFixClick?: () => void;
}

export default function RecoveryBannerSection({
    yesterdayReview,
    onLateFixClick,
}: RecoveryBannerSectionProps) {
    if (!yesterdayReview) return null;

    return (
        <div className="section recovery-banner-section">
            <div className="banner-alert">
                <AlertTriangle size={20} className="banner-icon" />
                <div className="banner-content">
                    <h3>Yesterday's Unresolved Habits</h3>
                    <p>{yesterdayReview.unresolvedCount} habit(s) need attention</p>
                    {yesterdayReview.unresolvedHabits.length > 0 && (
                        <ul className="unresolved-list">
                            {yesterdayReview.unresolvedHabits.map((habit) => (
                                <li key={habit.habitId}>{habit.title}</li>
                            ))}
                        </ul>
                    )}
                    {yesterdayReview.canLateFix && (
                        <button
                            className="btn-late-fix"
                            onClick={onLateFixClick}
                            aria-label="Use recovery token to fix yesterday's habits"
                        >
                            Use Recovery Token
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

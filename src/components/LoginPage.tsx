"use client";

import { signIn } from "next-auth/react";
import { Swords, Target, Flame, Trophy, Zap } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="login-container">
            <div className="glass-card login-card">
                <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚔️</div>
                <h1 className="login-title">Solo Leveling</h1>
                <p className="login-subtitle">
                    Your daily quests await, Hunter.<br />
                    Level up your discipline. Conquer your goals.
                </p>
                <button
                    className="btn btn-gold login-btn"
                    onClick={() => signIn("google")}
                    id="login-button"
                >
                    <Swords size={20} />
                    Enter the Gate
                </button>
                <div className="login-features">
                    <div className="login-feature">
                        <Target size={16} className="login-feature-icon" />
                        <span>Daily quests with XP rewards</span>
                    </div>
                    <div className="login-feature">
                        <Flame size={16} className="login-feature-icon" />
                        <span>Streak tracking & boss battles</span>
                    </div>
                    <div className="login-feature">
                        <Trophy size={16} className="login-feature-icon" />
                        <span>Level up from E-Rank to Shadow Monarch</span>
                    </div>
                    <div className="login-feature">
                        <Zap size={16} className="login-feature-icon" />
                        <span>AI-powered performance analysis</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

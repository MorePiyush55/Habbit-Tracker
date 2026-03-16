"use client";

import { signIn } from "next-auth/react";
import { Swords, Target, Flame, Trophy, Zap } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="landing-container">
            {/* Hero Section */}
            <div className="landing-hero">
                <div style={{ fontSize: "4rem", marginBottom: "20px", textShadow: "0 0 40px var(--accent-blue)" }}>⚔️</div>
                <h1 className="landing-title">Solo Leveling System</h1>
                <h2 className="landing-subtitle">
                    Step through the gate and start solo carrying your own life.
                </h2>
                <p className="landing-desc">
                    The Solo Leveling System transforms routines, tasks, and habits into an action-packed RPG where you level up from E-Rank newcomer to S-Rank legend, all inside one dashboard.
                </p>
                <button
                    className="btn btn-primary landing-btn"
                    onClick={() => signIn("google")}
                    id="login-button"
                >
                    <Swords size={20} />
                    Enter the Dungeon
                </button>
            </div>

            {/* Features Grid */}
            <div className="landing-features">
                <div className="feature-card glass-card">
                    <div className="feature-icon"><Zap size={24} /></div>
                    <h3>5-Minute Account Setup</h3>
                    <p>Enter the dungeon instantly, create your profile, choose a class, and start farming EXP.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon"><Target size={24} /></div>
                    <h3>Character Identity Dashboard</h3>
                    <p>Evaluate and improve your life performance with insightful metrics like a hunter&apos;s license.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon"><Flame size={24} /></div>
                    <h3>Solo Leveling Habit Tracker</h3>
                    <p>Growth Mode to nurture good habits, Fight Mode to slay bad ones. Each win feeds your level bar.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon"><Swords size={24} /></div>
                    <h3>Task Tracker</h3>
                    <p>Queue quests and clear them for instant EXP & Coin rewards.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon"><Trophy size={24} /></div>
                    <h3>Reward System</h3>
                    <p>Spend coins in the Market, Hotel & Black Market to reward yourself in real life.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon" style={{ color: "var(--accent-purple)" }}>◈</div>
                    <h3>Vision Board</h3>
                    <p>Pin your ultimate end-game goals and define your character&apos;s vision and ideal life.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon" style={{ color: "var(--text-secondary)" }}>⟳</div>
                    <h3>Activity Log</h3>
                    <p>A battle report of the day, tracking all your history in one scrollable timeline.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon">⚙️</div>
                    <h3>Settings</h3>
                    <p>No wrestling with databases. Simple sliders & toggles do the heavy lifting behind the UI.</p>
                </div>

                <div className="feature-card glass-card">
                    <div className="feature-icon">📱</div>
                    <h3>Mobile Version</h3>
                    <p>Kill bosses anywhere, anytime; your progress syncs instantly across all devices.</p>
                </div>
            </div>
        </div>
    );
}

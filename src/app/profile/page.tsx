"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import AppNav from "@/components/AppNav";
import {
    Target, BookOpen, Briefcase, Brain, Clock, AlertTriangle,
    Eye, Save, Plus, Trash2, ArrowLeft, Shield
} from "lucide-react";

const profileFetcher = (url: string) => fetch(url).then(res => res.json());

interface LearningProgress {
    _uid: string;
    name: string;
    completedUnits: number;
    totalUnits: number;
    avgStudyTimeMinutes: number;
}

interface WeeklyTarget {
    _uid: string;
    name: string;
    target: number;
    current: number;
}

interface SkillRating {
    name: string;
    rating: number;
}

interface HunterProfile {
    missions: string[];
    learningProgress: LearningProgress[];
    weeklyTargets: WeeklyTarget[];
    skillRatings: SkillRating[];
    dailyAvailableHours: number;
    bestFocusTime: string;
    frequentlySkippedTasks: string[];
    selfDisciplineRating: number;
    selfFocusRating: number;
    sixMonthVision: string[];
    isOnboarded: boolean;
}

const DEFAULT_PROFILE: HunterProfile = {
    missions: ["", "", ""],
    learningProgress: [],
    weeklyTargets: [],
    skillRatings: [],
    dailyAvailableHours: 4,
    bestFocusTime: "morning",
    frequentlySkippedTasks: [],
    selfDisciplineRating: 50,
    selfFocusRating: 50,
    sixMonthVision: [],
    isOnboarded: false,
};

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [profile, setProfile] = useState<HunterProfile>(DEFAULT_PROFILE);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const uidRef = useRef(0);
    const nextUid = () => `uid-${uidRef.current++}`;

    // Temp inputs for adding items
    const [newSkillName, setNewSkillName] = useState("");
    const [newSkipTask, setNewSkipTask] = useState("");
    const [newVision, setNewVision] = useState("");

    // Fetch profile via SWR
    const { data: profileData, isLoading } = useSWR(
        status === "authenticated" ? "/api/hunter-profile" : null,
        profileFetcher,
        { revalidateOnFocus: false }
    );

    useEffect(() => {
        if (profileData?.profile && !profileLoaded) {
            setProfileLoaded(true);
            const p = profileData.profile;
            setProfile({
                ...DEFAULT_PROFILE,
                ...p,
                missions: p.missions?.length > 0
                    ? [...p.missions, ...Array(Math.max(0, 3 - p.missions.length)).fill("")]
                    : ["", "", ""],
                learningProgress: (p.learningProgress || []).map((lp: Omit<LearningProgress, '_uid'>) => ({ ...lp, _uid: nextUid() })),
                weeklyTargets: (p.weeklyTargets || []).map((wt: Omit<WeeklyTarget, '_uid'>) => ({ ...wt, _uid: nextUid() })),
            });
        }
    }, [profileData, profileLoaded]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const cleanProfile = {
                ...profile,
                missions: profile.missions.filter(m => m.trim()),
                sixMonthVision: profile.sixMonthVision.filter(v => v.trim()),
                frequentlySkippedTasks: profile.frequentlySkippedTasks.filter(t => t.trim()),
                learningProgress: profile.learningProgress.map(({ _uid, ...rest }) => rest),
                weeklyTargets: profile.weeklyTargets.map(({ _uid, ...rest }) => rest),
            };

            const res = await fetch("/api/hunter-profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cleanProfile),
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            console.error("Failed to save profile:", err);
        }
        setSaving(false);
    };

    // ── ADD HELPERS ──

    const addLearningProgress = () => {
        setProfile(p => ({
            ...p,
            learningProgress: [...p.learningProgress, { _uid: nextUid(), name: "", completedUnits: 0, totalUnits: 1, avgStudyTimeMinutes: 60 }],
        }));
    };

    const addWeeklyTarget = () => {
        setProfile(p => ({
            ...p,
            weeklyTargets: [...p.weeklyTargets, { _uid: nextUid(), name: "", target: 5, current: 0 }],
        }));
    };

    const addSkillRating = () => {
        if (!newSkillName.trim()) return;
        setProfile(p => ({
            ...p,
            skillRatings: [...p.skillRatings, { name: newSkillName.trim(), rating: 50 }],
        }));
        setNewSkillName("");
    };

    const addSkippedTask = () => {
        if (!newSkipTask.trim()) return;
        setProfile(p => ({
            ...p,
            frequentlySkippedTasks: [...p.frequentlySkippedTasks, newSkipTask.trim()],
        }));
        setNewSkipTask("");
    };

    const addVision = () => {
        if (!newVision.trim()) return;
        setProfile(p => ({
            ...p,
            sixMonthVision: [...p.sixMonthVision, newVision.trim()],
        }));
        setNewVision("");
    };

    if (status === "loading" || isLoading) {
        return (
            <div className="loading-spinner" style={{ minHeight: "100vh" }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            <AppNav />
            <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-lg)" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                        <button onClick={() => router.push("/")} className="btn-ghost" style={{ padding: 8 }}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 style={{ margin: 0, fontSize: "1.5rem", color: "var(--text-primary)" }}>
                                <Shield size={24} style={{ marginRight: 8, verticalAlign: "middle", color: "var(--accent-blue)" }} />
                                Hunter Profile
                            </h1>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                Configure your missions, skills, and goals. The System uses this for intelligent coaching.
                            </p>
                        </div>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                        <Save size={16} />
                        {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
                    </button>
                </div>

                {/* ── SECTION 1: MISSIONS ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <Target size={18} style={{ color: "var(--accent-red)" }} />
                        Top 3 Life Missions
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-md) 0" }}>
                        What are your primary objectives right now?
                    </p>
                    {[0, 1, 2].map(slot => (
                        <input
                            key={`mission-slot-${slot}`}
                            className="game-input"
                            placeholder={`Mission ${slot + 1} (e.g. Pass CompTIA Security+)`}
                            value={profile.missions[slot] || ""}
                            onChange={e => {
                                const updated = [...profile.missions];
                                updated[slot] = e.target.value;
                                setProfile(p => ({ ...p, missions: updated }));
                            }}
                            style={{ marginBottom: "var(--space-sm)", width: "100%" }}
                        />
                    ))}
                </div>

                {/* ── SECTION 2: LEARNING PROGRESS ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <BookOpen size={18} style={{ color: "var(--accent-blue)" }} />
                        Learning Progress
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-md) 0" }}>
                        Courses, certifications, or study programs you&apos;re working through.
                    </p>
                    {profile.learningProgress.map((lp) => (
                        <div key={lp._uid} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "var(--space-sm)", marginBottom: "var(--space-sm)", alignItems: "center" }}>
                            <input
                                className="game-input"
                                placeholder="Course name"
                                value={lp.name}
                                onChange={e => {
                                    const uid = lp._uid;
                                    setProfile(p => ({
                                        ...p,
                                        learningProgress: p.learningProgress.map(item =>
                                            item._uid === uid ? { ...item, name: e.target.value } : item
                                        ),
                                    }));
                                }}
                            />
                            <input
                                className="game-input"
                                type="number"
                                placeholder="Done"
                                value={lp.completedUnits}
                                onChange={e => {
                                    const uid = lp._uid;
                                    setProfile(p => ({
                                        ...p,
                                        learningProgress: p.learningProgress.map(item =>
                                            item._uid === uid ? { ...item, completedUnits: parseInt(e.target.value) || 0 } : item
                                        ),
                                    }));
                                }}
                                style={{ textAlign: "center" }}
                            />
                            <input
                                className="game-input"
                                type="number"
                                placeholder="Total"
                                value={lp.totalUnits}
                                onChange={e => {
                                    const uid = lp._uid;
                                    setProfile(p => ({
                                        ...p,
                                        learningProgress: p.learningProgress.map(item =>
                                            item._uid === uid ? { ...item, totalUnits: parseInt(e.target.value) || 1 } : item
                                        ),
                                    }));
                                }}
                                style={{ textAlign: "center" }}
                            />
                            <input
                                className="game-input"
                                type="number"
                                placeholder="min/day"
                                value={lp.avgStudyTimeMinutes}
                                onChange={e => {
                                    const uid = lp._uid;
                                    setProfile(p => ({
                                        ...p,
                                        learningProgress: p.learningProgress.map(item =>
                                            item._uid === uid ? { ...item, avgStudyTimeMinutes: parseInt(e.target.value) || 0 } : item
                                        ),
                                    }));
                                }}
                                style={{ textAlign: "center" }}
                            />
                            <button
                                className="btn-ghost"
                                onClick={() => {
                                    const uid = lp._uid;
                                    setProfile(p => ({ ...p, learningProgress: p.learningProgress.filter(item => item._uid !== uid) }));
                                }}
                                style={{ padding: 4, color: "var(--accent-red)" }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {profile.learningProgress.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "var(--space-sm)", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
                            <span>Name</span><span style={{ textAlign: "center" }}>Done</span><span style={{ textAlign: "center" }}>Total</span><span style={{ textAlign: "center" }}>Min/Day</span><span></span>
                        </div>
                    )}
                    <button className="btn-ghost" onClick={addLearningProgress} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                        <Plus size={14} /> Add Learning Item
                    </button>
                </div>

                {/* ── SECTION 3: WEEKLY TARGETS ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <Briefcase size={18} style={{ color: "var(--accent-green)" }} />
                        Weekly Targets
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-md) 0" }}>
                        Recurring weekly goals (e.g. job applications, client outreach).
                    </p>
                    {profile.weeklyTargets.map((wt) => (
                        <div key={wt._uid} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "var(--space-sm)", marginBottom: "var(--space-sm)", alignItems: "center" }}>
                            <input
                                className="game-input"
                                placeholder="Target name"
                                value={wt.name}
                                onChange={e => {
                                    const uid = wt._uid;
                                    setProfile(p => ({
                                        ...p,
                                        weeklyTargets: p.weeklyTargets.map(item =>
                                            item._uid === uid ? { ...item, name: e.target.value } : item
                                        ),
                                    }));
                                }}
                            />
                            <input
                                className="game-input"
                                type="number"
                                placeholder="Goal"
                                value={wt.target}
                                onChange={e => {
                                    const uid = wt._uid;
                                    setProfile(p => ({
                                        ...p,
                                        weeklyTargets: p.weeklyTargets.map(item =>
                                            item._uid === uid ? { ...item, target: parseInt(e.target.value) || 0 } : item
                                        ),
                                    }));
                                }}
                                style={{ textAlign: "center" }}
                            />
                            <input
                                className="game-input"
                                type="number"
                                placeholder="Done"
                                value={wt.current}
                                onChange={e => {
                                    const uid = wt._uid;
                                    setProfile(p => ({
                                        ...p,
                                        weeklyTargets: p.weeklyTargets.map(item =>
                                            item._uid === uid ? { ...item, current: parseInt(e.target.value) || 0 } : item
                                        ),
                                    }));
                                }}
                                style={{ textAlign: "center" }}
                            />
                            <button
                                className="btn-ghost"
                                onClick={() => {
                                    const uid = wt._uid;
                                    setProfile(p => ({ ...p, weeklyTargets: p.weeklyTargets.filter(item => item._uid !== uid) }));
                                }}
                                style={{ padding: 4, color: "var(--accent-red)" }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    <button className="btn-ghost" onClick={addWeeklyTarget} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                        <Plus size={14} /> Add Weekly Target
                    </button>
                </div>

                {/* ── SECTION 4: SKILL RATINGS ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <Brain size={18} style={{ color: "var(--accent-purple, #a78bfa)" }} />
                        Self-Rated Skills
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-md) 0" }}>
                        Rate your current skill levels (0-100). The System uses this for training recommendations.
                    </p>
                    {profile.skillRatings.map((sr, i) => (
                        <div key={`sr-${sr.name}`} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                            <span style={{ minWidth: 120, fontSize: "0.9rem", color: "var(--text-secondary)" }}>{sr.name}</span>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={sr.rating}
                                onChange={e => {
                                    const updated = [...profile.skillRatings];
                                    updated[i] = { ...sr, rating: parseInt(e.target.value) };
                                    setProfile(p => ({ ...p, skillRatings: updated }));
                                }}
                                style={{ flex: 1 }}
                            />
                            <span style={{ minWidth: 40, textAlign: "right", fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                                {sr.rating}
                            </span>
                            <button
                                className="btn-ghost"
                                onClick={() => setProfile(p => ({ ...p, skillRatings: p.skillRatings.filter((_, idx) => idx !== i) }))}
                                style={{ padding: 4, color: "var(--accent-red)" }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                        <input
                            className="game-input"
                            placeholder="Skill name (e.g. Networking)"
                            value={newSkillName}
                            onChange={e => setNewSkillName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addSkillRating()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn-ghost" onClick={addSkillRating} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </div>

                {/* ── SECTION 5: TIME & FOCUS ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <Clock size={18} style={{ color: "var(--accent-yellow, #fbbf24)" }} />
                        Time & Focus
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                        <div>
                            <label htmlFor="profile-daily-hours" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                                Daily Available Hours
                            </label>
                            <input
                                id="profile-daily-hours"
                                className="game-input"
                                type="number"
                                min={0.5}
                                max={16}
                                step={0.5}
                                value={profile.dailyAvailableHours}
                                onChange={e => setProfile(p => ({ ...p, dailyAvailableHours: parseFloat(e.target.value) || 4 }))}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div>
                            <label htmlFor="profile-focus-time" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                                Best Focus Time
                            </label>
                            <select
                                id="profile-focus-time"
                                className="game-input"
                                value={profile.bestFocusTime}
                                onChange={e => setProfile(p => ({ ...p, bestFocusTime: e.target.value }))}
                                style={{ width: "100%", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                            >
                                <option value="morning">Morning</option>
                                <option value="afternoon">Afternoon</option>
                                <option value="night">Night</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 6: WEAKNESS DETECTION ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <AlertTriangle size={18} style={{ color: "var(--accent-red)" }} />
                        Weakness Detection
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-md) 0" }}>
                        Tasks you tend to skip or procrastinate on. Be honest — the System uses this to push you harder.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                        {profile.frequentlySkippedTasks.map((task, i) => (
                            <span key={`skip-${task}`} style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem",
                                background: "rgba(239, 68, 68, 0.15)", color: "var(--accent-red)", border: "1px solid rgba(239, 68, 68, 0.3)"
                            }}>
                                {task}
                                <button
                                    onClick={() => setProfile(p => ({ ...p, frequentlySkippedTasks: p.frequentlySkippedTasks.filter((_, idx) => idx !== i) }))}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <input
                            className="game-input"
                            placeholder="e.g. Client outreach"
                            value={newSkipTask}
                            onChange={e => setNewSkipTask(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addSkippedTask()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn-ghost" onClick={addSkippedTask} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </div>

                {/* ── SECTION 7: SELF EVALUATION ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        Self Evaluation
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                        <div>
                            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                                <span>Discipline Level</span>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{profile.selfDisciplineRating}/100</span>
                            </label>
                            <input
                                type="range" min={0} max={100}
                                value={profile.selfDisciplineRating}
                                onChange={e => setProfile(p => ({ ...p, selfDisciplineRating: parseInt(e.target.value) }))}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                                <span>Focus Level</span>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{profile.selfFocusRating}/100</span>
                            </label>
                            <input
                                type="range" min={0} max={100}
                                value={profile.selfFocusRating}
                                onChange={e => setProfile(p => ({ ...p, selfFocusRating: parseInt(e.target.value) }))}
                                style={{ width: "100%" }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── SECTION 8: 6-MONTH VISION ── */}
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 var(--space-md) 0", fontSize: "1.1rem" }}>
                        <Eye size={18} style={{ color: "var(--accent-blue)" }} />
                        6-Month Vision
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-md) 0" }}>
                        Where do you want to be in 6 months?
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                        {profile.sixMonthVision.map((v, i) => (
                            <span key={`vision-${v}`} style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem",
                                background: "rgba(59, 130, 246, 0.15)", color: "var(--accent-blue)", border: "1px solid rgba(59, 130, 246, 0.3)"
                            }}>
                                {v}
                                <button
                                    onClick={() => setProfile(p => ({ ...p, sixMonthVision: p.sixMonthVision.filter((_, idx) => idx !== i) }))}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <input
                            className="game-input"
                            placeholder="e.g. CompTIA certified"
                            value={newVision}
                            onChange={e => setNewVision(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addVision()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn-ghost" onClick={addVision} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </div>

                {/* Save Button (bottom) */}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "var(--space-xl)" }}>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 32px", fontSize: "1rem" }}
                    >
                        <Save size={18} />
                        {saving ? "Saving..." : saved ? "Saved!" : "Save Hunter Profile"}
                    </button>
                </div>
            </div>
        </div>
    );
}

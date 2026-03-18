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

    const [newSkillName, setNewSkillName] = useState("");
    const [newSkipTask, setNewSkipTask] = useState("");
    const [newVision, setNewVision] = useState("");

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
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a1a" }}>
                <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: "linear-gradient(to top right, #4f7cff, #7c3aed)" }}></div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", position: "relative", background: "radial-gradient(circle at top center, #161640 0%, #0a0a1a 100%)", color: "#e8e8ff", overflowX: "hidden", paddingBottom: 150 }}>
            {/* Holographic grid background */}
            <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.15, backgroundImage: "linear-gradient(to right, rgba(79, 124, 255, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(79, 124, 255, 0.2) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div style={{ position: "fixed", top: "-10%", left: "-10%", width: "40%", height: "40%", borderRadius: "50%", background: "#4f7cff", opacity: 0.05, filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "40%", height: "40%", borderRadius: "50%", background: "#7c3aed", opacity: 0.05, filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />
            
            <AppNav />
            
            <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
                
                {/* ── HEADER ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
                    <div style={{ position: "absolute", bottom: -1, left: 0, width: "30%", height: 1, background: "linear-gradient(to right, #4f7cff, transparent)" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        <button onClick={() => router.push("/")} style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", cursor: "pointer", transition: "all 0.3s" }}>
                            <ArrowLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ margin: 0, fontSize: "2rem", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 1, display: "flex", alignItems: "center", gap: 12, textShadow: "0 0 15px rgba(79, 124, 255, 0.5)" }}>
                                <Shield size={32} color="#00c7e6" />
                                SYSTEM PROFILE
                            </h1>
                            <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "#9b9bc4", textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>
                                Configure Hunter Attributes & Temporal Parameters
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 32 }}>
                    
                    {/* ── LEFT COLUMN ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                        
                        {/* SECTION: MISSIONS */}
                        <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "rgba(15, 15, 46, 0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#ef4444", opacity: 0.05, filter: "blur(60px)" }} />
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ padding: 8, borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", boxShadow: "0 0 15px rgba(239, 68, 68, 0.2)" }}>
                                    <Target size={22} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 1 }}>CORE MISSIONS</h2>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9b9bc4" }}>Primary objectives dictated by the System</p>
                                </div>
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {[0, 1, 2].map((slot, idx) => (
                                    <div key={`mission-${slot}`} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontWeight: "bold", fontSize: "0.85rem", color: "#ef4444", boxShadow: "inset 0 0 10px rgba(239, 68, 68, 0.1)" }}>
                                            0{idx + 1}
                                        </div>
                                        <div style={{ flex: 1, position: "relative" }}>
                                            <input
                                                style={{ width: "100%", background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 16px", fontSize: "0.9rem", color: "#fff", outline: "none", transition: "all 0.3s" }}
                                                placeholder={`Establish Objective ${slot + 1}...`}
                                                value={profile.missions[slot] || ""}
                                                onChange={e => {
                                                    const updated = [...profile.missions];
                                                    updated[slot] = e.target.value;
                                                    setProfile(p => ({ ...p, missions: updated }));
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = "rgba(239, 68, 68, 0.5)";
                                                    e.target.style.background = "rgba(22, 22, 64, 0.8)";
                                                    e.target.style.boxShadow = "0 0 20px rgba(239, 68, 68, 0.15), inset 0 0 10px rgba(239, 68, 68, 0.05)";
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                                    e.target.style.background = "rgba(22, 22, 64, 0.5)";
                                                    e.target.style.boxShadow = "none";
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SECTION: SKILL PROFICIENCY */}
                        <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "rgba(15, 15, 46, 0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#7c3aed", opacity: 0.05, filter: "blur(60px)" }} />
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ padding: 8, borderRadius: 8, background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", boxShadow: "0 0 15px rgba(124, 58, 237, 0.2)" }}>
                                    <Brain size={22} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 1 }}>SKILL PROFICIENCY</h2>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9b9bc4" }}>Current estimated capability levels</p>
                                </div>
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
                                {profile.skillRatings.map((sr, i) => (
                                    <div key={`sr-${sr.name}`}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                                            <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "rgba(255,255,255,0.8)", letterSpacing: 0.5 }}>{sr.name}</span>
                                            <span style={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: "bold", color: "#7c3aed", background: "rgba(124, 58, 237, 0.1)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(124, 58, 237, 0.3)" }}>{sr.rating}/100</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                            <div style={{ position: "relative", flex: 1, height: 12, background: "rgba(0,0,0,0.5)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                                <input
                                                    type="range"
                                                    min={0} max={100} value={sr.rating}
                                                    onChange={e => {
                                                        const updated = [...profile.skillRatings];
                                                        updated[i] = { ...sr, rating: parseInt(e.target.value) };
                                                        setProfile(p => ({ ...p, skillRatings: updated }));
                                                    }}
                                                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 10 }}
                                                />
                                                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "linear-gradient(to right, #4f7cff, #7c3aed)", borderRadius: 6, boxShadow: "0 0 10px rgba(124, 58, 237, 0.5)", width: `${sr.rating}%`, transition: "width 0.2s ease-out" }} />
                                            </div>
                                            <button 
                                                style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                onClick={() => setProfile(p => ({ ...p, skillRatings: p.skillRatings.filter((_, idx) => idx !== i) }))}
                                                onMouseOver={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                                onMouseOut={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <input
                                    style={{ flex: 1, background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 16px", fontSize: "0.85rem", color: "#fff", outline: "none", transition: "all 0.3s" }}
                                    placeholder="Initialize new skill matrix..."
                                    value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addSkillRating()}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "rgba(124, 58, 237, 0.5)";
                                        e.target.style.boxShadow = "0 0 20px rgba(124, 58, 237, 0.15)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                                <button 
                                    style={{ height: 44, padding: "0 20px", borderRadius: 12, background: "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.1))", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "all 0.3s" }}
                                    onClick={addSkillRating}
                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.5)"; e.currentTarget.style.boxShadow = "0 0 15px rgba(124, 58, 237, 0.3)"; }}
                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                                >
                                    <Plus size={16} /> ADD
                                </button>
                            </div>
                        </div>

                        {/* SECTION: THREAT VULNERABILITIES */}
                        <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "rgba(15, 15, 46, 0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#ef4444", opacity: 0.05, filter: "blur(60px)" }} />
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ padding: 8, borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", boxShadow: "0 0 15px rgba(239, 68, 68, 0.2)" }}>
                                    <AlertTriangle size={22} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 1 }}>VULNERABILITIES</h2>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9b9bc4" }}>Identified system flaws & friction points</p>
                                </div>
                            </div>
                            
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                                {profile.frequentlySkippedTasks.map((task, i) => (
                                    <div key={`skip-${task}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(239, 68, 68, 0.2)", fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.9)", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
                                        {task}
                                        <button 
                                            style={{ width: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "none", cursor: "pointer" }}
                                            onClick={() => setProfile(p => ({ ...p, frequentlySkippedTasks: p.frequentlySkippedTasks.filter((_, idx) => idx !== i) }))}
                                            onMouseOver={(e) => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "#fff"; }}
                                            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "#ef4444"; }}
                                        >
                                            <svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <path d="M1 1L13 13M1 13L13 1" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {profile.frequentlySkippedTasks.length === 0 && (
                                    <div style={{ fontSize: "0.75rem", color: "#5e5e8a", fontStyle: "italic", padding: "4px 8px" }}>No vulnerabilities logged. System optimal.</div>
                                )}
                            </div>
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <input
                                    style={{ flex: 1, background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 16px", fontSize: "0.85rem", color: "#fff", outline: "none", transition: "all 0.3s" }}
                                    placeholder="Log new vulnerability..."
                                    value={newSkipTask} onChange={e => setNewSkipTask(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addSkippedTask()}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "rgba(239, 68, 68, 0.5)";
                                        e.target.style.boxShadow = "0 0 20px rgba(239, 68, 68, 0.15)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                                <button 
                                    style={{ height: 44, width: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.3s" }}
                                    onClick={addSkippedTask}
                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>

                    </div>
                    
                    {/* ── RIGHT COLUMN ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

                        {/* SECTION: TIME PROTOCOLS */}
                        <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "rgba(15, 15, 46, 0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#f59e0b", opacity: 0.05, filter: "blur(60px)" }} />
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ padding: 8, borderRadius: 8, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", boxShadow: "0 0 15px rgba(245, 158, 11, 0.2)" }}>
                                    <Clock size={22} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 1 }}>TEMPORAL PROTOCOLS</h2>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9b9bc4" }}>Time availability & focus patterns</p>
                                </div>
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#9b9bc4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>Daily Available Hours</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            style={{ width: "100%", background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 16px", fontSize: "1.1rem", fontFamily: "monospace", fontWeight: "bold", color: "#f59e0b", outline: "none", transition: "all 0.3s" }}
                                            type="number" min={0.5} max={16} step={0.5}
                                            value={profile.dailyAvailableHours}
                                            onChange={e => setProfile(p => ({ ...p, dailyAvailableHours: parseFloat(e.target.value) || 4 }))}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = "rgba(245, 158, 11, 0.5)";
                                                e.target.style.boxShadow = "0 0 20px rgba(245, 158, 11, 0.15)";
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                                e.target.style.boxShadow = "none";
                                            }}
                                        />
                                        <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
                                            <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>HRS</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#9b9bc4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>Peak Focus Window</label>
                                    <div style={{ position: "relative" }}>
                                        <select
                                            style={{ width: "100%", background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 16px", fontSize: "0.85rem", color: "#fff", outline: "none", transition: "all 0.3s", appearance: "none", cursor: "pointer" }}
                                            value={profile.bestFocusTime}
                                            onChange={e => setProfile(p => ({ ...p, bestFocusTime: e.target.value }))}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = "rgba(245, 158, 11, 0.5)";
                                                e.target.style.boxShadow = "0 0 20px rgba(245, 158, 11, 0.15)";
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                                e.target.style.boxShadow = "none";
                                            }}
                                        >
                                            <option value="morning">Morning Phase (06:00 - 12:00)</option>
                                            <option value="afternoon">Afternoon Phase (12:00 - 18:00)</option>
                                            <option value="night">Nocturnal Phase (18:00 - 02:00)</option>
                                        </select>
                                        <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#f59e0b" }}>
                                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION: LEARNING PROGRESS */}
                        <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "rgba(15, 15, 46, 0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#4f7cff", opacity: 0.05, filter: "blur(60px)" }} />
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ padding: 8, borderRadius: 8, background: "rgba(79, 124, 255, 0.1)", color: "#4f7cff", boxShadow: "0 0 15px rgba(79, 124, 255, 0.2)" }}>
                                    <BookOpen size={22} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 1 }}>TRAINING LOGS</h2>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9b9bc4" }}>Active learning and coursework</p>
                                </div>
                                <button style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "#4f7cff", border: "none", cursor: "pointer", transition: "all 0.3s" }} onClick={addLearningProgress}>
                                    <Plus size={18} />
                                </button>
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {profile.learningProgress.map((lp) => (
                                    <div key={lp._uid} style={{ display: "flex", flexDirection: "column", gap: 12, background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <input
                                            style={{ flex: 1, background: "transparent", border: "none", fontSize: "0.85rem", color: "#fff", outline: "none" }}
                                            placeholder="Skill/Course Name"
                                            value={lp.name}
                                            onChange={e => {
                                                const uid = lp._uid;
                                                setProfile(p => ({
                                                    ...p, learningProgress: p.learningProgress.map(item => item._uid === uid ? { ...item, name: e.target.value } : item)
                                                }));
                                            }}
                                        />
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <input
                                                style={{ width: 64, background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 8, padding: "6px 8px", textAlign: "center", fontSize: "0.85rem", fontFamily: "monospace", color: "#00c7e6", outline: "none" }}
                                                type="number" placeholder="Done"
                                                value={lp.completedUnits || ""}
                                                onChange={e => setProfile(p => ({...p, learningProgress: p.learningProgress.map(item => item._uid === lp._uid ? { ...item, completedUnits: parseInt(e.target.value) || 0 } : item)}))}
                                            />
                                            <span style={{ color: "#5e5e8a", fontWeight: "bold" }}>/</span>
                                            <input
                                                style={{ width: 64, background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 8, padding: "6px 8px", textAlign: "center", fontSize: "0.85rem", fontFamily: "monospace", color: "#fff", outline: "none" }}
                                                type="number" placeholder="Total"
                                                value={lp.totalUnits || ""}
                                                onChange={e => setProfile(p => ({...p, learningProgress: p.learningProgress.map(item => item._uid === lp._uid ? { ...item, totalUnits: parseInt(e.target.value) || 1 } : item)}))}
                                            />
                                            <div style={{ position: "relative", marginLeft: 8 }}>
                                                <input
                                                    style={{ width: 64, background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 8, padding: "6px 24px 6px 8px", textAlign: "right", fontSize: "0.85rem", fontFamily: "monospace", color: "#fff", outline: "none" }}
                                                    type="number" placeholder="Min"
                                                    value={lp.avgStudyTimeMinutes || ""}
                                                    onChange={e => setProfile(p => ({...p, learningProgress: p.learningProgress.map(item => item._uid === lp._uid ? { ...item, avgStudyTimeMinutes: parseInt(e.target.value) || 0 } : item)}))}
                                                />
                                                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "#5e5e8a" }}>m</span>
                                            </div>
                                            <button style={{ padding: 6, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer", marginLeft: 4 }} onClick={() => setProfile(p => ({ ...p, learningProgress: p.learningProgress.filter(item => item._uid !== lp._uid) }))}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {profile.learningProgress.length === 0 && (
                                    <div style={{ fontSize: "0.85rem", color: "#5e5e8a", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>No active training logs.</div>
                                )}
                            </div>
                        </div>

                        {/* SECTION: 6-MONTH VISION */}
                        <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "rgba(15, 15, 46, 0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#00c7e6", opacity: 0.05, filter: "blur(60px)" }} />
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ padding: 8, borderRadius: 8, background: "rgba(0, 199, 230, 0.1)", color: "#00c7e6", boxShadow: "0 0 15px rgba(0, 199, 230, 0.2)" }}>
                                    <Eye size={22} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 1 }}>LONG TERM TRAJECTORY</h2>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9b9bc4" }}>Projected outcomes</p>
                                </div>
                            </div>
                            
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                                {profile.sixMonthVision.map((v, i) => (
                                    <div key={`vision-${v}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0, 199, 230, 0.2)", fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.9)", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
                                        {v}
                                        <button 
                                            style={{ width: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 199, 230, 0.2)", color: "#00c7e6", border: "none", cursor: "pointer" }}
                                            onClick={() => setProfile(p => ({ ...p, sixMonthVision: p.sixMonthVision.filter((_, idx) => idx !== i) }))}
                                            onMouseOver={(e) => { e.currentTarget.style.background = "#00c7e6"; e.currentTarget.style.color = "#fff"; }}
                                            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0, 199, 230, 0.2)"; e.currentTarget.style.color = "#00c7e6"; }}
                                        >
                                            <svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <path d="M1 1L13 13M1 13L13 1" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <input
                                    style={{ flex: 1, background: "rgba(22, 22, 64, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "12px 16px", fontSize: "0.85rem", color: "#fff", outline: "none", transition: "all 0.3s" }}
                                    placeholder="Enter projection..."
                                    value={newVision} onChange={e => setNewVision(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addVision()}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "rgba(0, 199, 230, 0.5)";
                                        e.target.style.boxShadow = "0 0 20px rgba(0, 199, 230, 0.15)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                                <button 
                                    style={{ height: 44, width: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.3s" }}
                                    onClick={addVision}
                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(0, 199, 230, 0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── STICKY SAVE BAR ── */}
                <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 48px)", maxWidth: 900, zIndex: 1000 }}>
                    <div style={{ position: "relative", borderRadius: 16, background: "rgba(10, 10, 26, 0.8)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 50px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "linear-gradient(to right, transparent, rgba(0, 199, 230, 0.5), transparent)" }} />
                        
                        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 4, background: saved ? "#22c55e" : "#f59e0b", boxShadow: `0 0 10px ${saved ? "#22c55e" : "#f59e0b"}` }} />
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ color: "#fff", fontSize: "0.85rem", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 1 }}>
                                        SYSTEM OVERRIDE READY
                                    </span>
                                    <span style={{ color: "#9b9bc4", fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: 0.5 }}>
                                        {saved ? "Synchronized with primary database // STATUS: OPTIMAL" : "Pending uncommitted parameters // AWAITING SYNC"}
                                    </span>
                                </div>
                            </div>
                            
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    position: "relative", padding: "12px 32px", borderRadius: 12, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 2, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8, cursor: saving ? "not-allowed" : "pointer", overflow: "hidden", border: "1px solid", transition: "all 0.3s",
                                    ...(saved 
                                        ? { background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.3)" } 
                                        : { background: "rgba(6, 182, 212, 0.1)", color: "#00c7e6", borderColor: "rgba(6, 182, 212, 0.4)", boxShadow: "0 0 15px rgba(6,182,212,0.2)" })
                                }}
                                onMouseOver={(e) => {
                                    if(!saved) {
                                        e.currentTarget.style.boxShadow = "0 0 25px rgba(6,182,212,0.5)";
                                        e.currentTarget.style.background = "rgba(6,182,212,0.2)";
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if(!saved) {
                                        e.currentTarget.style.boxShadow = "0 0 15px rgba(6,182,212,0.2)";
                                        e.currentTarget.style.background = "rgba(6,182,212,0.1)";
                                    }
                                }}
                            >
                                {saved ? <Shield size={16} /> : <Save size={16} />}
                                {saving ? "SYNCING..." : saved ? "SYNCED" : "COMMIT CHANGES"}
                            </button>
                        </div>
                    </div>
                </div>
                
            </div>
            
        </div>
    );
}

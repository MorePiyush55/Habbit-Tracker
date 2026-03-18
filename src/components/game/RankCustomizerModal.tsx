"use client";

import { useState, useEffect } from "react";
import { X, RotateCcw, Save, Trash2, Plus } from "lucide-react";
import { getRankConfigs, saveRankConfigs, DEFAULT_RANKS, type RankConfig } from "@/lib/rankConfig";

const RANK_COLORS: Record<string, string> = {
    S: "#ff0080", A: "#ff8c00", B: "#8b5cf6", C: "#00b4ff", D: "#00ff88", E: "#a0a0a0",
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void; // notify parent to re-render dropdowns
}

export default function RankCustomizerModal({ isOpen, onClose, onSaved }: Props) {
    const [configs, setConfigs] = useState<RankConfig[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setConfigs(getRankConfigs().map(r => ({ ...r })));
            setSaved(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const update = (key: string, field: keyof RankConfig, value: string | number) => {
        setConfigs(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
    };

    const handleSave = () => {
        saveRankConfigs(configs);
        setSaved(true);
        setTimeout(() => { onSaved(); onClose(); }, 600);
    };

    const handleReset = () => {
        setConfigs(DEFAULT_RANKS.map(r => ({ ...r })));
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
            <div style={{
                background: "#0f0f1a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: 28,
                width: "100%", maxWidth: 540,
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#e0e0e0" }}>
                            ⚙ Customize Quest Ranks
                        </h2>
                        <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#555" }}>
                            Edit rank labels, names, and XP rewards.
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 90px 30px", gap: 8, marginBottom: 8, padding: "0 6px" }}>
                    {["Rank", "Label", "Name", "XP", ""].map((h, i) => (
                        <span key={i} style={{ fontSize: "0.65rem", color: "#555", letterSpacing: "1px", textTransform: "uppercase" }}>{h}</span>
                    ))}
                </div>

                {/* Rank rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {configs.map(r => {
                        const color = RANK_COLORS[r.key] || "#a0a0a0";
                        return (
                            <div key={r.key} style={{
                                display: "grid", gridTemplateColumns: "60px 1fr 1fr 90px 30px",
                                gap: 8, alignItems: "center",
                                padding: "10px 12px",
                                borderRadius: 10,
                                background: "rgba(255,255,255,0.03)",
                                border: `1px solid rgba(255,255,255,0.07)`,
                                borderLeft: `3px solid ${color}`,
                            }}>
                                {/* Static key */}
                                <span style={{
                                    fontSize: "0.85rem", fontWeight: 800, color,
                                    fontFamily: "monospace",
                                }}>
                                    {r.key}
                                </span>

                                {/* Label (editable letter/symbol) */}
                                <input
                                    value={r.label}
                                    maxLength={3}
                                    onChange={e => update(r.key, "label", e.target.value)}
                                    style={{
                                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 6, color: "#e0e0e0", padding: "5px 8px",
                                        fontSize: "0.82rem", fontFamily: "monospace", fontWeight: 700,
                                        outline: "none", width: "100%",
                                    }}
                                    placeholder="E"
                                />

                                {/* Name */}
                                <input
                                    value={r.name}
                                    maxLength={20}
                                    onChange={e => update(r.key, "name", e.target.value)}
                                    style={{
                                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 6, color: "#e0e0e0", padding: "5px 8px",
                                        fontSize: "0.82rem", outline: "none", width: "100%",
                                    }}
                                    placeholder="Easy"
                                />

                                {/* XP */}
                                <input
                                    type="number"
                                    min={1}
                                    max={9999}
                                    value={r.xp}
                                    onChange={e => update(r.key, "xp", parseInt(e.target.value) || 1)}
                                    style={{
                                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 6, color: "#ffcc44", padding: "5px 8px",
                                        fontSize: "0.82rem", fontWeight: 700, textAlign: "right",
                                        outline: "none", width: "100%",
                                    }}
                                />

                                {/* Delete btn */}
                                <button
                                    onClick={() => setConfigs(prev => prev.filter(c => c.key !== r.key))}
                                    disabled={configs.length <= 1}
                                    style={{
                                        background: "none", border: "none",
                                        color: configs.length <= 1 ? "#444" : "#ff4444",
                                        cursor: configs.length <= 1 ? "not-allowed" : "pointer",
                                        padding: 4, display: "flex", alignItems: "center", justifyContent: "center"
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                        onClick={() => {
                            const newKey = `N${Math.floor(Math.random() * 1000)}`;
                            setConfigs(prev => [...prev, { key: newKey, label: "X", name: "New Rank", xp: 10 }]);
                        }}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                            borderRadius: 8, color: "#60a5fa", padding: "6px 12px",
                            cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                        }}
                    >
                        <Plus size={14} /> Add Rank
                    </button>
                    <div style={{ flex: 1 }} />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
                    <button
                        onClick={handleReset}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8, color: "#888", padding: "8px 14px",
                            cursor: "pointer", fontSize: "0.8rem",
                        }}
                    >
                        <RotateCcw size={13} /> Reset Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: saved ? "rgba(0,255,136,0.2)" : "rgba(139,92,246,0.25)",
                            border: `1px solid ${saved ? "rgba(0,255,136,0.4)" : "rgba(139,92,246,0.5)"}`,
                            borderRadius: 8, color: saved ? "#00ff88" : "#c4b5fd",
                            padding: "8px 20px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                            transition: "all 0.3s",
                        }}
                    >
                        <Save size={13} /> {saved ? "Saved!" : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

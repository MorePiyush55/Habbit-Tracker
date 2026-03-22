"use client";

import { useState, useRef } from "react";
import { Plus, Loader2 } from "lucide-react";
import { getRankConfigs } from "@/lib/rankConfig";

interface Props {
    onAdded: () => void;
}

export default function QuickAddTask({ onAdded }: Props) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.KeyboardEvent | React.MouseEvent) => {
        if ("key" in e && e.key !== "Enter") return;
        const title = value.trim();
        if (!title) return;

        setLoading(true);
        setError("");

        try {
            const rankConfigs = getRankConfigs();
            const eRankXP = rankConfigs.find(r => r.key === "E")?.xp || 10;

            const res = await fetch("/api/habits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    category: "General",
                    primaryStat: "INT",
                    rank: "E",
                    xpReward: eRankXP,
                    isDaily: true,
                    priority: "MEDIUM",
                    subtasks: [],
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to add quest");
            }

            setValue("");
            setExpanded(false);
            onAdded();
        } catch (err: any) {
            setError(err.message || "Failed to add quest");
        } finally {
            setLoading(false);
        }
    };

    if (!expanded) {
        return (
            <button
                onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "10px 16px",
                    background: "rgba(0,180,255,0.06)",
                    border: "1px dashed rgba(0,180,255,0.25)",
                    borderRadius: 10, cursor: "pointer",
                    color: "rgba(0,180,255,0.6)", fontFamily: "monospace",
                    fontSize: "0.85rem", letterSpacing: 1,
                    transition: "all 0.2s ease",
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(0,180,255,0.12)"; (e.target as HTMLElement).style.borderColor = "rgba(0,180,255,0.5)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,180,255,0.06)"; (e.target as HTMLElement).style.borderColor = "rgba(0,180,255,0.25)"; }}
            >
                <Plus size={16} />
                Quick Add Quest...
            </button>
        );
    }

    return (
        <div style={{ position: "relative" }}>
            <input
                ref={inputRef}
                value={value}
                onChange={e => { setValue(e.target.value); setError(""); }}
                onKeyDown={handleSubmit}
                onBlur={() => { if (!value) setExpanded(false); }}
                placeholder="⚡ Type quest name and press Enter..."
                disabled={loading}
                style={{
                    width: "100%", padding: "12px 48px 12px 16px",
                    background: "rgba(0,180,255,0.08)",
                    border: "1px solid rgba(0,180,255,0.5)",
                    borderRadius: 10, color: "var(--text-primary)",
                    fontFamily: "monospace", fontSize: "0.9rem",
                    outline: "none", boxSizing: "border-box",
                    boxShadow: "0 0 12px rgba(0,180,255,0.15)",
                    transition: "all 0.2s ease",
                }}
            />
            {loading && (
                <Loader2
                    size={16}
                    style={{
                        position: "absolute", right: 14, top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--accent-blue)",
                        animation: "spin 1s linear infinite",
                    }}
                />
            )}
            {error && (
                <div style={{ color: "var(--accent-red)", fontSize: "0.75rem", marginTop: 4, fontFamily: "monospace" }}>
                    {error}
                </div>
            )}
            <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
        </div>
    );
}

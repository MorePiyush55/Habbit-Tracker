"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2, RefreshCw } from "lucide-react";

export default function DailyStrategyPanel() {
    const [strategy, setStrategy] = useState<string>("");
    const [loadingStrategy, setLoadingStrategy] = useState(false);

    const fetchStrategy = async () => {
        setLoadingStrategy(true);
        try {
            const res = await fetch("/api/system/daily-strategy");
            if (res.ok) {
                const data = await res.json();
                setStrategy(data.strategy || "");
            }
        } catch (err) {
            console.error("Failed to fetch strategy:", err);
            setStrategy("⚠ SYSTEM NOTICE\n\nFailed to generate strategy.\nRetry later, Hunter.");
        } finally {
            setLoadingStrategy(false);
        }
    };

    useEffect(() => {
        fetchStrategy();
    }, []);

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-md)" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
                <h3 style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "3px", color: "#8b5cf6", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <Brain size={14} /> DAILY STRATEGY
                </h3>
                <button
                    onClick={fetchStrategy}
                    disabled={loadingStrategy}
                    style={{
                        background: "none",
                        border: "none",
                        color: "#666",
                        cursor: "pointer",
                        padding: 4
                    }}
                >
                    {loadingStrategy ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}
                </button>
            </div>

            {loadingStrategy ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                    <Loader2 size={20} className="spinning" />
                    <div style={{ marginTop: 8, fontSize: "0.7rem", letterSpacing: "2px" }}>GENERATING STRATEGY...</div>
                </div>
            ) : (
                <div style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.82rem",
                    lineHeight: 1.7,
                    color: "#d0d0d0",
                    padding: "var(--space-md)",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "8px",
                    borderLeft: "3px solid #8b5cf6"
                }}>
                    {strategy || "No strategy available. Click refresh to generate."}
                </div>
            )}
        </div>
    );
}

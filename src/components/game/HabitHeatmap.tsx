"use client";

import HeatMap from "@uiw/react-heat-map";
import { useMemo, useRef, useState } from "react";
import { Tooltip } from "react-tooltip";
import { X } from "lucide-react";

interface HabitHeatmapProps {
    data: { date: string; count: number }[];
}

interface DayDetail {
    date: string;
    completedTasks: string[];
    failedTasks: string[];
    totalXP: number;
    completionRate: number;
}

export default function HabitHeatmap({ data }: HabitHeatmapProps) {
    const cacheRef = useRef<Record<string, DayDetail>>({});
    const [selected, setSelected] = useState<DayDetail | null>(null);
    const [loadingDate, setLoadingDate] = useState<string | null>(null);

    const { startDate, endDate } = useMemo(() => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 120);
        return { startDate: past, endDate: today };
    }, []);

    const validData = (data || [])
        .map(d => {
            const [y, m, day] = d.date.split('-');
            return {
                date: `${y}/${parseInt(m, 10)}/${parseInt(day, 10)}`, 
                count: Math.min(10, d.count || 0) 
            };
        })
        .filter(d => d.count > 0);

    const handleDayClick = async (dateStr: string) => {
        if (!dateStr) return;
        // Cache hit — no fetch
        if (cacheRef.current[dateStr]) {
            setSelected(cacheRef.current[dateStr]);
            return;
        }
        setLoadingDate(dateStr);
        try {
            const res = await fetch(`/api/analytics?detail=${dateStr}`);
            const detail: DayDetail = await res.json();
            cacheRef.current[dateStr] = detail;
            setSelected(detail);
        } catch {
            setSelected({ date: dateStr, completedTasks: [], failedTasks: [], totalXP: 0, completionRate: 0 });
        }
        setLoadingDate(null);
    };

    return (
        <div className="glass-card" style={{ padding: "20px", width: "100%", overflowX: "auto", position: "relative" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Hunter Activity Log</span>
                <span className="badge badge-rank" style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(0,255,136,0.1)", color: "var(--accent-green)", border: "1px solid var(--accent-green)" }}>
                    Click any day
                </span>
            </h3>

            <div style={{ minWidth: "600px", display: "flex", justifyContent: "center" }}>
                <HeatMap
                    value={validData}
                    startDate={startDate}
                    endDate={endDate}
                    width={700}
                    style={{ color: "#8bacc1", "--theme-val": "transparent" } as React.CSSProperties}
                    rectSize={12}
                    space={4}
                    rectProps={{ rx: 3 }}
                    panelColors={{
                        0: "rgba(255,255,255,0.05)",
                        2: "rgba(0,255,136,0.2)",
                        4: "rgba(0,255,136,0.4)",
                        6: "rgba(0,255,136,0.6)",
                        8: "rgba(0,255,136,0.8)",
                        10: "#00ff88",
                    }}
                    rectRender={(props, rectData) => (
                        <rect
                            {...props}
                            data-tooltip-id="heatmap-tooltip"
                            data-tooltip-content={`${rectData.date || ""}: ${rectData.count ? (rectData.count * 10) + "% completion" : "No activity"}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleDayClick(rectData.date || "")}
                        />
                    )}
                />
            </div>
            <Tooltip id="heatmap-tooltip" style={{ backgroundColor: "#111", color: "#fff", borderRadius: "4px", border: "1px solid #333" }} />

            {/* Day detail popover */}
            {selected && (
                <div style={{
                    position: "absolute", top: 16, right: 16, zIndex: 10,
                    background: "rgba(10,10,30,0.97)", border: "1px solid rgba(0,180,255,0.3)",
                    borderRadius: 12, padding: "16px 20px", minWidth: 240,
                    boxShadow: "0 0 30px rgba(0,180,255,0.15)",
                    fontFamily: "monospace",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ color: "var(--accent-blue)", fontWeight: 700, fontSize: "0.85rem", letterSpacing: 1 }}>
                            {selected.date}
                        </span>
                        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
                            <X size={14} />
                        </button>
                    </div>

                    <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Completion</span>
                        <span style={{ color: "var(--accent-blue)", fontWeight: 700, fontSize: "0.75rem" }}>{selected.completionRate}%</span>
                    </div>
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>XP Earned</span>
                        <span style={{ color: "#ffcc00", fontWeight: 700, fontSize: "0.75rem" }}>+{selected.totalXP}</span>
                    </div>

                    {selected.completedTasks.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                            <div style={{ color: "#00ff88", fontSize: "0.7rem", marginBottom: 3, letterSpacing: 1 }}>✅ COMPLETED</div>
                            {selected.completedTasks.map((t, i) => (
                                <div key={i} style={{ color: "var(--text-secondary)", fontSize: "0.72rem", padding: "1px 0" }}>• {t}</div>
                            ))}
                        </div>
                    )}
                    {selected.failedTasks.length > 0 && (
                        <div>
                            <div style={{ color: "#ff4466", fontSize: "0.7rem", marginBottom: 3, letterSpacing: 1 }}>❌ MISSED</div>
                            {selected.failedTasks.map((t, i) => (
                                <div key={i} style={{ color: "rgba(255,68,102,0.7)", fontSize: "0.72rem", padding: "1px 0" }}>• {t}</div>
                            ))}
                        </div>
                    )}
                    {selected.completedTasks.length === 0 && selected.failedTasks.length === 0 && (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>No task data for this day.</div>
                    )}
                </div>
            )}

            {loadingDate && (
                <div style={{ position: "absolute", top: 60, right: 20, color: "var(--accent-blue)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                    Loading {loadingDate}...
                </div>
            )}
        </div>
    );
}

"use client";

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

    const normalizeDateKey = (dateStr: string) => {
        const parts = dateStr.split(/[\/-]/).map((p) => p.trim()).filter(Boolean);
        if (parts.length !== 3) return dateStr;
        const y = parts[0];
        const m = String(parseInt(parts[1], 10)).padStart(2, "0");
        const day = String(parseInt(parts[2], 10)).padStart(2, "0");
        return `${y}/${m}/${day}`;
    };

    const formatDateKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${y}/${m}/${day}`;
    };

    const validData = (data || []).map((d) => {
        const [y, m, day] = d.date.split("-");
        return {
            date: `${y}/${parseInt(m, 10)}/${parseInt(day, 10)}`,
            count: Math.max(0, Math.min(10, d.count || 0))
        };
    });

    const countByDate = useMemo(() => {
        const map: Record<string, number> = {};
        for (const item of validData) {
            map[normalizeDateKey(item.date)] = Math.max(0, Math.min(10, item.count || 0));
        }
        return map;
    }, [validData]);

    const heatmapKey = useMemo(() => Object.entries(countByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, c]) => `${d}:${c}`)
        .join("|"), [countByDate]);

    const colorForCount = (count: number) => {
        if (count <= 0) return "rgba(255,255,255,0.05)";
        if (count <= 1) return "rgba(0,255,136,0.1)";
        if (count <= 2) return "rgba(0,255,136,0.2)";
        if (count <= 4) return "rgba(0,255,136,0.4)";
        if (count <= 6) return "rgba(0,255,136,0.6)";
        if (count <= 8) return "rgba(0,255,136,0.8)";
        return "#00ff88";
    };

    const weeks = useMemo(() => {
        const gridStart = new Date(startDate);
        gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // Sunday start

        const gridEnd = new Date(endDate);
        gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())); // Saturday end

        const msPerDay = 24 * 60 * 60 * 1000;
        const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / msPerDay) + 1;
        const totalWeeks = Math.ceil(totalDays / 7);

        return Array.from({ length: totalWeeks }, (_, weekIndex) => {
            const cells = Array.from({ length: 7 }, (_, dayIndex) => {
                const cellDate = new Date(gridStart);
                cellDate.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);

                const inRange = cellDate >= startDate && cellDate <= endDate;
                if (!inRange) {
                    return { dateKey: null as string | null, count: 0, monthLabel: "" };
                }

                const dateKey = formatDateKey(cellDate);
                const count = countByDate[dateKey] || 0;
                const monthLabel = cellDate.getDate() === 1
                    ? cellDate.toLocaleString("en-US", { month: "short" })
                    : "";

                return { dateKey, count, monthLabel };
            });

            const headerLabel = cells.find((c) => c.monthLabel)?.monthLabel || "";
            return { headerLabel, cells };
        });
    }, [startDate, endDate, countByDate]);

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
                <div key={heatmapKey} style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#8bacc1" }}>
                    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: "0.65rem", color: "#5e7b95", textAlign: "right" }}>
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                    </div>

                    <div style={{ display: "flex", gap: 4 }}>
                        {weeks.map((week, wi) => (
                            <div key={`week-${wi}`} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                                <div style={{ height: 14, fontSize: "0.72rem", color: "#5e7b95", width: 14, textAlign: "center" }}>
                                    {week.headerLabel}
                                </div>
                                {week.cells.map((cell, di) => {
                                    const clickable = Boolean(cell.dateKey);
                                    return (
                                        <div
                                            key={`cell-${wi}-${di}`}
                                            data-tooltip-id="heatmap-tooltip"
                                            data-tooltip-content={cell.dateKey
                                                ? `${cell.dateKey}: ${cell.count ? (cell.count * 10) + "% completion" : "No activity"}`
                                                : ""
                                            }
                                            onClick={() => {
                                                if (cell.dateKey) handleDayClick(cell.dateKey);
                                            }}
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: 3,
                                                background: cell.dateKey ? colorForCount(cell.count) : "transparent",
                                                cursor: clickable ? "pointer" : "default",
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
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

"use client";

import HeatMap from "@uiw/react-heat-map";
import { useMemo } from "react";
import { Tooltip } from "react-tooltip";

interface HabitHeatmapProps {
    data: { date: string; count: number }[];
}

export default function HabitHeatmap({ data }: HabitHeatmapProps) {
    // Determine the date range (e.g., last 90 days)
    const { startDate, endDate } = useMemo(() => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 120); // Show last 120 days approx 4 months
        return { startDate: past, endDate: today };
    }, []);

    // Filter valid objects that actually have counts
    const validData = (data || []).map(d => ({
        date: d.date,
        count: d.count || 0,
    }));

    return (
        <div className="glass-card" style={{ padding: "20px", width: "100%", overflowX: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Hunter Activity Log</span>
                <span className="badge badge-rank" style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(0, 255, 136, 0.1)", color: "var(--accent-green)", border: "1px solid var(--accent-green)" }}>
                    Consistency Array
                </span>
            </h3>
            
            <div style={{ minWidth: "600px", display: "flex", justifyContent: "center" }}>
                <HeatMap
                    value={validData}
                    startDate={startDate}
                    endDate={endDate}
                    width={700}
                    style={{ color: "#8bacc1", '--theme-val': 'transparent' } as React.CSSProperties}
                    rectSize={12}
                    space={4}
                    rectProps={{
                        rx: 3, // slightly rounded
                    }}
                    panelColors={{
                        0: "rgba(255, 255, 255, 0.05)",
                        2: "rgba(0, 255, 136, 0.2)",
                        4: "rgba(0, 255, 136, 0.4)",
                        6: "rgba(0, 255, 136, 0.6)",
                        8: "rgba(0, 255, 136, 0.8)",
                        10: "#00ff88",
                    }}
                    rectRender={(props, data) => {
                        return (
                            <rect
                                {...props}
                                data-tooltip-id="heatmap-tooltip"
                                data-tooltip-content={`${data.date ? data.date : ''}: ${data.count ? (data.count*10) + "% Completion" : "No Activity"}`}
                            />
                        );
                    }}
                />
            </div>
            {/* Install react-tooltip if not already installed, otherwise this gracefully degrades or we can just use native titles */}
            <Tooltip id="heatmap-tooltip" style={{ backgroundColor: '#111', color: '#fff', borderRadius: '4px', border: '1px solid #333' }} />
        </div>
    );
}

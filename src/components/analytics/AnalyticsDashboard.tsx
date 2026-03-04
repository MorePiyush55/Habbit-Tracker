"use client";

import { useEffect, useState, useRef } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { BarChart3 } from "lucide-react";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface HistoryEntry {
    date: string;
    completionRate: number;
    totalXP: number;
}

export default function AnalyticsDashboard() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch("/api/analytics?days=14");
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data.history?.reverse() || []);
                }
            } catch {
                // silently fail — analytics are non-critical
            }
            setLoading(false);
        };
        fetchAnalytics();
    }, []);

    if (loading || history.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
                <div className="section-title">
                    <BarChart3 size={20} className="section-title-icon" />
                    Analytics
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "var(--space-lg) 0" }}>
                    {loading ? "Loading analytics..." : "Complete some quests to see analytics!"}
                </p>
            </div>
        );
    }

    const labels = history.map((h) => {
        const d = new Date(h.date);
        return d.toLocaleDateString("en", { month: "short", day: "numeric" });
    });

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(15, 15, 46, 0.95)",
                borderColor: "rgba(79, 124, 255, 0.3)",
                borderWidth: 1,
                titleColor: "#e8e8ff",
                bodyColor: "#9b9bc4",
            },
        },
        scales: {
            x: {
                ticks: { color: "#5e5e8a", font: { size: 10 } },
                grid: { color: "rgba(79, 124, 255, 0.06)" },
            },
            y: {
                ticks: { color: "#5e5e8a", font: { size: 10 } },
                grid: { color: "rgba(79, 124, 255, 0.06)" },
            },
        },
    };

    const completionData = {
        labels,
        datasets: [
            {
                label: "Completion %",
                data: history.map((h) => h.completionRate),
                backgroundColor: "rgba(79, 124, 255, 0.5)",
                borderColor: "rgba(79, 124, 255, 1)",
                borderWidth: 2,
                borderRadius: 6,
            },
        ],
    };

    const xpData = {
        labels,
        datasets: [
            {
                label: "XP Earned",
                data: history.map((h) => h.totalXP),
                borderColor: "rgba(124, 58, 237, 1)",
                backgroundColor: "rgba(124, 58, 237, 0.1)",
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "rgba(124, 58, 237, 1)",
                pointRadius: 3,
            },
        ],
    };

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
            <div className="section-title">
                <BarChart3 size={20} className="section-title-icon" />
                Analytics
            </div>

            <div style={{ marginBottom: "var(--space-lg)" }}>
                <h4
                    style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "var(--space-sm)",
                    }}
                >
                    Daily Completion Rate
                </h4>
                <div className="chart-container">
                    <Bar data={completionData} options={chartOptions} />
                </div>
            </div>

            <div>
                <h4
                    style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "var(--space-sm)",
                    }}
                >
                    XP Growth
                </h4>
                <div className="chart-container">
                    <Line data={xpData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
}

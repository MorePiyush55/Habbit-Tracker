"use client";

import { useState } from "react";
import { Brain, Sparkles, BarChart3, AlertTriangle } from "lucide-react";

export default function AIInsightsPanel() {
    const [motivation, setMotivation] = useState<{
        message: string;
        type: string;
    } | null>(null);
    const [report, setReport] = useState<{
        strongHabits: string[];
        weakHabits: string[];
        suggestions: string[];
        report: string;
    } | null>(null);
    const [loadingMotivation, setLoadingMotivation] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [error, setError] = useState("");

    const fetchMotivation = async () => {
        setLoadingMotivation(true);
        setError("");
        try {
            const res = await fetch("/api/motivate");
            if (!res.ok) throw new Error("Failed to get motivation");
            const data = await res.json();
            setMotivation(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        }
        setLoadingMotivation(false);
    };

    const fetchReport = async () => {
        setLoadingReport(true);
        setError("");
        try {
            const res = await fetch("/api/analyze", { method: "POST" });
            if (!res.ok) throw new Error("Failed to generate report");
            const data = await res.json();
            setReport(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        }
        setLoadingReport(false);
    };

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
            <div className="section-title">
                <Brain size={20} className="section-title-icon" />
                AI Insights
            </div>

            {/* Motivation */}
            <div style={{ marginBottom: "var(--space-md)" }}>
                <button
                    className="btn btn-secondary"
                    onClick={fetchMotivation}
                    disabled={loadingMotivation}
                    style={{ width: "100%", marginBottom: "var(--space-sm)" }}
                    id="get-motivation-btn"
                >
                    <Sparkles size={16} />
                    {loadingMotivation ? "Channeling power..." : "Get Motivation"}
                </button>

                {motivation && (
                    <div className={`ai-message ${motivation.type}`}>
                        &quot;{motivation.message}&quot;
                    </div>
                )}
            </div>

            {/* Weekly Report */}
            <div>
                <button
                    className="btn btn-secondary"
                    onClick={fetchReport}
                    disabled={loadingReport}
                    style={{ width: "100%", marginBottom: "var(--space-sm)" }}
                    id="generate-report-btn"
                >
                    <BarChart3 size={16} />
                    {loadingReport ? "Analyzing data..." : "Weekly Report"}
                </button>

                {report && (
                    <div>
                        {report.strongHabits.length > 0 && (
                            <div style={{ marginBottom: "var(--space-sm)" }}>
                                <span
                                    style={{
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        color: "var(--accent-green)",
                                    }}
                                >
                                    💪 Strong Habits
                                </span>
                                <ul className="ai-habits-list">
                                    {report.strongHabits.map((h, i) => (
                                        <li key={i}>✅ {h}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {report.weakHabits.length > 0 && (
                            <div style={{ marginBottom: "var(--space-sm)" }}>
                                <span
                                    style={{
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        color: "var(--accent-gold)",
                                    }}
                                >
                                    <AlertTriangle
                                        size={12}
                                        style={{ display: "inline", marginRight: 4 }}
                                    />
                                    Weak Habits
                                </span>
                                <ul className="ai-habits-list">
                                    {report.weakHabits.map((h, i) => (
                                        <li key={i}>⚠️ {h}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {report.suggestions.length > 0 && (
                            <div style={{ marginBottom: "var(--space-sm)" }}>
                                <span
                                    style={{
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        color: "var(--accent-blue)",
                                    }}
                                >
                                    💡 Suggestions
                                </span>
                                <ul className="ai-habits-list">
                                    {report.suggestions.map((s, i) => (
                                        <li key={i}>→ {s}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {report.report && (
                            <div className="ai-report">{report.report}</div>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <p
                    style={{
                        color: "var(--accent-red)",
                        fontSize: "0.8rem",
                        marginTop: "var(--space-sm)",
                    }}
                >
                    {error}
                </p>
            )}
        </div>
    );
}

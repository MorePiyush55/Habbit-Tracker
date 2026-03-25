import React from "react";
import { AlertTriangle, Shield, Zap } from "lucide-react";
import { getEmotionalFeedback, shouldShowFeedback } from "@/lib/core/productLoop";

interface EmotionalFeedbackProps {
    completedCount: number;
    totalCount: number;
    streakSecured: boolean;
    majorEvent?: boolean;
}

export default function EmotionalFeedbackBanner({
    completedCount,
    totalCount,
    streakSecured,
    majorEvent = false,
}: EmotionalFeedbackProps) {
    const [lastFeedbackAt, setLastFeedbackAt] = React.useState<number | null>(null);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = window.localStorage.getItem("feedback:lastShownAt");
        setLastFeedbackAt(raw ? Number(raw) : null);
    }, []);

    const canShow = shouldShowFeedback(lastFeedbackAt, majorEvent, 3);

    React.useEffect(() => {
        if (!canShow) return;
        if (typeof window === "undefined") return;
        const now = Date.now();
        window.localStorage.setItem("feedback:lastShownAt", String(now));
    }, [canShow, completedCount, totalCount, streakSecured, majorEvent]);

    // Silence is a feature: hide feedback when user is in focused execution state (2+ tasks in last 2 hours)
    const isInFocusedSession = completedCount >= 2;
    if (!canShow || isInFocusedSession) return null;

    const feedback = getEmotionalFeedback(completedCount, totalCount, streakSecured);

    const bgColor = 
        feedback.state === "success" ? "rgba(0,255,136,0.08)" :
        feedback.state === "at-risk" ? "rgba(255,204,0,0.08)" :
        "rgba(239,68,68,0.08)";

    const borderColor =
        feedback.state === "success" ? "rgba(0,255,136,0.25)" :
        feedback.state === "at-risk" ? "rgba(255,204,0,0.25)" :
        "rgba(239,68,68,0.2)";

    const textColor =
        feedback.state === "success" ? "#00ff88" :
        feedback.state === "at-risk" ? "#ffcc00" :
        "#ff4466";

    const Icon = 
        feedback.state === "success" ? Shield :
        feedback.state === "at-risk" ? AlertTriangle :
        Zap;

    return (
        <div
            style={{
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 12,
                background: bgColor,
                border: `1px solid ${borderColor}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "0.85rem",
                fontFamily: "monospace",
            }}
        >
            <Icon size={16} style={{ color: textColor, flexShrink: 0 }} />
            <div style={{ color: textColor, flex: 1 }}>
                {feedback.message}
            </div>
        </div>
    );
}

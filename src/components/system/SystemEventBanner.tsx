"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { ShieldAlert, X, AlertTriangle, Award, Skull, TrendingDown, Zap } from "lucide-react";

interface SystemEvent {
    _id: string;
    eventType: string;
    message: string;
    read: boolean;
    createdAt: string;
}

const eventIcons: Record<string, React.ReactNode> = {
    TASK_FAILED: <AlertTriangle size={20} />,
    STREAK_BROKEN: <Skull size={20} />,
    GOAL_COMPLETED: <Award size={20} />,
    WEAK_PROGRESS: <TrendingDown size={20} />,
    BOSS_DEFEATED: <ShieldAlert size={20} />,
    LEVEL_UP: <Zap size={20} />,
    ALL_TASKS_DONE: <Award size={20} />,
};

const eventColors: Record<string, string> = {
    TASK_FAILED: "#ff4444",
    STREAK_BROKEN: "#ff2222",
    GOAL_COMPLETED: "#00ff88",
    WEAK_PROGRESS: "#ff8800",
    BOSS_DEFEATED: "#8b5cf6",
    LEVEL_UP: "#00ccff",
    ALL_TASKS_DONE: "#00ff88",
};

export default function SystemEventBanner() {
    const [dismissed, setDismissed] = useState(false);

    const fetcher = useCallback(async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) return { events: [] };
        return res.json();
    }, []);

    const { data, mutate } = useSWR("/api/system/events?unread=true", fetcher, { refreshInterval: 15000 });
    const events: SystemEvent[] = data?.events || [];
    const visible = !dismissed && events.length > 0;

    const dismissAll = async () => {
        setDismissed(true);

        try {
            await fetch("/api/system/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventIds: events.map(e => e._id) })
            });
            mutate({ events: [] }, false);
        } catch (err) {
            console.error("Failed to mark events as read:", err);
        }
    };

    const dismissOne = async (eventId: string) => {
        const remaining = events.filter(e => e._id !== eventId);
        mutate({ events: remaining }, false);

        try {
            await fetch("/api/system/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventIds: [eventId] })
            });
        } catch (err) {
            console.error("Failed to dismiss event:", err);
        }
    };

    if (!visible || events.length === 0) return null;

    return (
        <div className="system-event-container" style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "600px",
            width: "90%"
        }}>
            {events.map((event, index) => (
                <div
                    key={event._id}
                    className="system-event-banner"
                    style={{
                        background: "rgba(10, 10, 20, 0.95)",
                        border: `1px solid ${eventColors[event.eventType] || "#8b5cf6"}`,
                        borderLeft: `4px solid ${eventColors[event.eventType] || "#8b5cf6"}`,
                        borderRadius: "8px",
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        boxShadow: `0 0 20px ${eventColors[event.eventType] || "#8b5cf6"}33, 0 4px 20px rgba(0,0,0,0.5)`,
                        animation: `slideDown 0.4s ease-out ${index * 0.15}s both`,
                        backdropFilter: "blur(10px)"
                    }}
                >
                    <div style={{
                        color: eventColors[event.eventType] || "#8b5cf6",
                        flexShrink: 0,
                        marginTop: 2
                    }}>
                        {eventIcons[event.eventType] || <ShieldAlert size={20} />}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: "0.65rem",
                            letterSpacing: "3px",
                            color: eventColors[event.eventType] || "#8b5cf6",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            marginBottom: 4
                        }}>
                            ⚡ {event.eventType.replace(/_/g, " ")}
                        </div>
                        <div style={{
                            color: "#e0e0e0",
                            fontSize: "0.85rem",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            fontFamily: "'JetBrains Mono', monospace"
                        }}>
                            {event.message}
                        </div>
                    </div>

                    <button
                        onClick={() => dismissOne(event._id)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#666",
                            cursor: "pointer",
                            padding: 4,
                            flexShrink: 0
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}

            {events.length > 1 && (
                <button
                    onClick={dismissAll}
                    style={{
                        background: "rgba(139, 92, 246, 0.15)",
                        border: "1px solid rgba(139, 92, 246, 0.3)",
                        color: "#8b5cf6",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        alignSelf: "center"
                    }}
                >
                    Dismiss All
                </button>
            )}
        </div>
    );
}

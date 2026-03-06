"use client";

import { useState, useEffect, useRef } from "react";
import {
    Send, ShieldAlert, Zap, AlertTriangle,
    Brain, BarChart3, Target, GraduationCap, Eye,
    Terminal, Loader2
} from "lucide-react";

// ============================================================
// Types
// ============================================================

type AgentRole = "SYSTEM" | "ANALYST" | "STRATEGIST" | "TUTOR" | "SHADOW_COACH";

interface ConsoleMessage {
    id: string;
    role: "user" | "agent";
    agent?: AgentRole;
    content: string;
    timestamp: string;
}

// ============================================================
// Agent styling config
// ============================================================

const AGENT_CONFIG: Record<AgentRole, {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof ShieldAlert;
}> = {
    SYSTEM: {
        label: "SYSTEM",
        color: "#ef4444",
        bgColor: "rgba(239, 68, 68, 0.08)",
        borderColor: "rgba(239, 68, 68, 0.4)",
        icon: ShieldAlert,
    },
    ANALYST: {
        label: "ANALYST",
        color: "#3b82f6",
        bgColor: "rgba(59, 130, 246, 0.08)",
        borderColor: "rgba(59, 130, 246, 0.4)",
        icon: BarChart3,
    },
    STRATEGIST: {
        label: "STRATEGIST",
        color: "#a855f7",
        bgColor: "rgba(168, 85, 247, 0.08)",
        borderColor: "rgba(168, 85, 247, 0.4)",
        icon: Target,
    },
    TUTOR: {
        label: "TUTOR",
        color: "#22c55e",
        bgColor: "rgba(34, 197, 94, 0.08)",
        borderColor: "rgba(34, 197, 94, 0.4)",
        icon: GraduationCap,
    },
    SHADOW_COACH: {
        label: "SHADOW COACH",
        color: "#f59e0b",
        bgColor: "rgba(245, 158, 11, 0.08)",
        borderColor: "rgba(245, 158, 11, 0.4)",
        icon: Eye,
    },
};

// ============================================================
// Quick command suggestions
// ============================================================

const QUICK_COMMANDS = [
    { label: "Remaining tasks", command: "What tasks are remaining?" },
    { label: "My stats", command: "Show my stats" },
    { label: "Strategy", command: "Give me a strategy" },
    { label: "Predict future", command: "Predict my next 30 days" },
    { label: "Workload check", command: "Am I overloaded?" },
];

// ============================================================
// COMPONENT
// ============================================================

export default function SystemConsole() {
    const [messages, setMessages] = useState<ConsoleMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [activeAgents, setActiveAgents] = useState<AgentRole[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load history on mount
    useEffect(() => {
        fetch("/api/system/chat")
            .then((res) => res.json())
            .then((data) => {
                if (data.messages && data.messages.length > 0) {
                    const converted = data.messages.map((m: any) => {
                        // Parse agent from [AGENT] prefix in content
                        let agent: AgentRole = "SYSTEM";
                        let content = m.content || "";
                        const agentMatch = content.match(/^\[(SYSTEM|ANALYST|STRATEGIST|TUTOR|SHADOW_COACH)\]\s*/);
                        if (agentMatch) {
                            agent = agentMatch[1] as AgentRole;
                            content = content.replace(agentMatch[0], "");
                        }

                        return {
                            id: m._id || Date.now().toString(),
                            role: m.role === "user" ? "user" as const : "agent" as const,
                            agent: m.role === "user" ? undefined : agent,
                            content,
                            timestamp: m.timestamp || new Date().toISOString(),
                            autonomous: m.metadata?.autonomous || false,
                        };
                    });
                    setMessages(converted);
                }
            })
            .catch((err) => console.error("Error fetching console history:", err));
    }, []);

    // Poll for autonomous system alerts every 60 seconds
    useEffect(() => {
        const pollInterval = setInterval(() => {
            if (loading) return; // Don't poll while sending

            const lastTimestamp = messages.length > 0
                ? messages[messages.length - 1].timestamp
                : new Date(Date.now() - 60000).toISOString();

            fetch(`/api/system/chat`)
                .then((res) => res.json())
                .then((data) => {
                    if (!data.messages) return;

                    // Find messages newer than our latest
                    const existingIds = new Set(messages.map((m) => m.id));
                    const newMessages = data.messages
                        .filter((m: any) => !existingIds.has(m._id) && m.metadata?.autonomous)
                        .map((m: any) => {
                            let agent: AgentRole = "SYSTEM";
                            let content = m.content || "";
                            const agentMatch = content.match(/^\[(SYSTEM|ANALYST|STRATEGIST|TUTOR|SHADOW_COACH)\]\s*/);
                            if (agentMatch) {
                                agent = agentMatch[1] as AgentRole;
                                content = content.replace(agentMatch[0], "");
                            }
                            return {
                                id: m._id,
                                role: "agent" as const,
                                agent,
                                content,
                                timestamp: m.timestamp,
                                autonomous: true,
                            };
                        });

                    if (newMessages.length > 0) {
                        setMessages((prev) => [...prev, ...newMessages]);
                        // Flash active agents
                        const agents = newMessages
                            .map((m: ConsoleMessage & { autonomous?: boolean }) => m.agent)
                            .filter((a: AgentRole | undefined): a is AgentRole => !!a && !activeAgents.includes(a));
                        if (agents.length > 0) {
                            setActiveAgents((prev) => [...new Set([...prev, ...agents])]);
                        }
                    }
                })
                .catch(() => { /* silent */ });
        }, 60000);

        return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length, loading]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // ── Send message ─────────────────────────────────────
    const handleSend = async (messageOverride?: string) => {
        const userMsg = (messageOverride || input).trim();
        if (!userMsg || loading) return;

        setInput("");

        // Add user message
        const userMsgObj: ConsoleMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: userMsg,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsgObj]);
        setLoading(true);
        setActiveAgents([]);

        // Cycle status text
        const statusMessages = [
            "INTERPRETING COMMAND...",
            "BUILDING SYSTEM STATE...",
            "ROUTING TO BRAIN V2...",
            "GENERATING DIRECTIVE...",
            "FORMATTING RESPONSE..."
        ];
        let statusIndex = 0;
        setStatusText(statusMessages[0]);
        const statusInterval = setInterval(() => {
            statusIndex = (statusIndex + 1) % statusMessages.length;
            setStatusText(statusMessages[statusIndex]);
        }, 2000);

        try {
            const res = await fetch("/api/system/console", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg }),
            });

            const data = await res.json();
            clearInterval(statusInterval);

            if (data.messages && data.messages.length > 0) {
                const agents: AgentRole[] = [];

                const newMessages: ConsoleMessage[] = data.messages.map(
                    (m: any, i: number) => {
                        if (m.agent && !agents.includes(m.agent)) {
                            agents.push(m.agent);
                        }
                        return {
                            id: `agent-${Date.now()}-${i}`,
                            role: "agent" as const,
                            agent: m.agent || "SYSTEM",
                            content: m.text,
                            timestamp: m.timestamp || new Date().toISOString(),
                        };
                    }
                );

                setActiveAgents(agents);

                // Stagger messages for group-chat effect
                for (let i = 0; i < newMessages.length; i++) {
                    await new Promise((r) => setTimeout(r, i > 0 ? 600 : 0));
                    setMessages((prev) => [...prev, newMessages[i]]);
                }
            } else if (data.error) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `error-${Date.now()}`,
                        role: "agent",
                        agent: "SYSTEM",
                        content: `⚠ SYSTEM ERROR\n\n${data.error}`,
                        timestamp: new Date().toISOString(),
                    },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `error-${Date.now()}`,
                        role: "agent",
                        agent: "SYSTEM",
                        content: "⚠ SYSTEM NOTICE\n\nNo response generated. Retry your command, Hunter.",
                        timestamp: new Date().toISOString(),
                    },
                ]);
            }
        } catch (err) {
            clearInterval(statusInterval);
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "agent",
                    agent: "SYSTEM",
                    content: "⚠ COMMUNICATION FAILURE\n\nConnection to the System lost. Check your network and retry.",
                    timestamp: new Date().toISOString(),
                },
            ]);
        } finally {
            clearInterval(statusInterval);
            setLoading(false);
            setStatusText("");
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Render ────────────────────────────────────────────
    return (
        <div className="system-console" style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "rgba(10, 10, 20, 0.95)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{
                padding: "var(--space-md) var(--space-lg)",
                borderBottom: "1px solid rgba(239, 68, 68, 0.2)",
                background: "linear-gradient(90deg, rgba(239, 68, 68, 0.08), transparent)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                }}>
                    <Terminal size={20} style={{ color: "var(--accent-red)" }} />
                    <span style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        color: "var(--accent-red)",
                        letterSpacing: "2px",
                    }}>SYSTEM CONSOLE</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    {/* Active agents indicators */}
                    {activeAgents.map((agent) => {
                        const config = AGENT_CONFIG[agent];
                        return (
                            <div key={agent} style={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                letterSpacing: "1px",
                                color: config.color,
                                background: config.bgColor,
                                border: `1px solid ${config.borderColor}`,
                                padding: "2px 8px",
                                borderRadius: "var(--radius-sm)",
                            }}>
                                {config.label}
                            </div>
                        );
                    })}
                    <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        backgroundColor: loading ? "#ef4444" : "#00ff88",
                        boxShadow: loading ? "0 0 8px #ef4444" : "0 0 8px #00ff88",
                        animation: loading ? "pulse 1s infinite" : "none",
                    }} />
                </div>
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "var(--space-md)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-md)",
                scrollBehavior: "smooth",
            }}>
                {/* Welcome message */}
                {messages.length === 0 && !loading && (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "var(--space-xl)",
                        gap: "var(--space-lg)",
                    }}>
                        <ShieldAlert size={48} style={{
                            color: "var(--accent-red)",
                            filter: "drop-shadow(0 0 20px rgba(239, 68, 68, 0.5))",
                        }} />
                        <div style={{
                            textAlign: "center",
                            fontFamily: "var(--font-display)",
                            fontSize: "0.85rem",
                            letterSpacing: "2px",
                            color: "var(--accent-red)",
                            lineHeight: 1.8,
                        }}>
                            SYSTEM CONSOLE ACTIVE<br />
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", letterSpacing: "1px" }}>
                                Multi-Agent Intelligence Interface
                            </span>
                        </div>

                        {/* Quick commands */}
                        <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-sm)",
                            justifyContent: "center",
                            maxWidth: "400px",
                        }}>
                            {QUICK_COMMANDS.map((qc) => (
                                <button
                                    key={qc.command}
                                    onClick={() => handleSend(qc.command)}
                                    style={{
                                        background: "rgba(239, 68, 68, 0.08)",
                                        border: "1px solid rgba(239, 68, 68, 0.25)",
                                        color: "var(--text-secondary)",
                                        padding: "6px 12px",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        letterSpacing: "0.5px",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.target as HTMLButtonElement).style.borderColor = "rgba(239, 68, 68, 0.6)";
                                        (e.target as HTMLButtonElement).style.color = "#fff";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.target as HTMLButtonElement).style.borderColor = "rgba(239, 68, 68, 0.25)";
                                        (e.target as HTMLButtonElement).style.color = "var(--text-secondary)";
                                    }}
                                >
                                    {qc.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message bubbles */}
                {messages.map((msg) => {
                    if (msg.role === "user") {
                        return (
                            <div key={msg.id} style={{
                                alignSelf: "flex-end",
                                maxWidth: "85%",
                                background: "rgba(79, 124, 255, 0.12)",
                                border: "1px solid rgba(79, 124, 255, 0.3)",
                                borderRadius: "var(--radius-md)",
                                borderBottomRightRadius: "4px",
                                padding: "var(--space-sm) var(--space-md)",
                                fontSize: "0.9rem",
                                lineHeight: 1.5,
                                color: "var(--text-primary)",
                                animation: "fade-in 0.3s ease",
                            }}>
                                {msg.content}
                            </div>
                        );
                    }

                    // Agent message
                    const agent = msg.agent || "SYSTEM";
                    const config = AGENT_CONFIG[agent];
                    const Icon = config.icon;

                    return (
                        <div key={msg.id} style={{
                            alignSelf: "flex-start",
                            maxWidth: "90%",
                            animation: "fade-in 0.4s ease",
                        }}>
                            {/* Agent label */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                marginBottom: "4px",
                                paddingLeft: "4px",
                            }}>
                                <Icon size={12} style={{ color: config.color }} />
                                <span style={{
                                    fontSize: "0.65rem",
                                    fontWeight: 800,
                                    letterSpacing: "1.5px",
                                    color: config.color,
                                    textTransform: "uppercase",
                                }}>
                                    {config.label}
                                </span>
                            </div>

                            {/* Message content */}
                            <div style={{
                                background: config.bgColor,
                                border: `1px solid ${config.borderColor}`,
                                borderRadius: "var(--radius-md)",
                                borderBottomLeftRadius: "4px",
                                padding: "var(--space-sm) var(--space-md)",
                                fontSize: "0.88rem",
                                lineHeight: 1.6,
                                color: "#fff",
                                whiteSpace: "pre-wrap",
                                fontFamily: "var(--font-sans)",
                            }}>
                                {msg.content}
                            </div>
                        </div>
                    );
                })}

                {/* Loading indicator */}
                {loading && (
                    <div style={{
                        alignSelf: "flex-start",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            paddingLeft: "4px",
                        }}>
                            <Loader2 size={12} style={{ color: "var(--accent-red)", animation: "spin 1s linear infinite" }} />
                            <span style={{
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                letterSpacing: "2px",
                                color: "var(--accent-red)",
                                textTransform: "uppercase",
                            }}>
                                {statusText}
                            </span>
                        </div>
                        <div style={{
                            background: "rgba(239, 68, 68, 0.06)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            borderRadius: "var(--radius-md)",
                            padding: "var(--space-sm) var(--space-md)",
                            display: "flex",
                            gap: "4px",
                            alignItems: "center",
                        }}>
                            <span className="dot" />
                            <span className="dot" />
                            <span className="dot" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                style={{
                    padding: "var(--space-md)",
                    borderTop: "1px solid rgba(239, 68, 68, 0.2)",
                    display: "flex",
                    gap: "var(--space-sm)",
                    background: "rgba(0, 0, 0, 0.3)",
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter command or ask the System..."
                    className="game-input"
                    disabled={loading}
                    style={{
                        flex: 1,
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#fff",
                        fontSize: "0.9rem",
                    }}
                />
                <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="btn-primary"
                    style={{
                        background: "var(--accent-red)",
                        padding: "0 var(--space-md)",
                        boxShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}

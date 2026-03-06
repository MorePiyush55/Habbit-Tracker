"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Send, ShieldAlert, Zap, AlertTriangle } from "lucide-react";

const chatFetcher = (url: string) => fetch(url).then(res => res.json());

interface ChatMessage {
    _id: string;
    role: "system" | "user";
    content: string;
    timestamp: string;
}

export default function SystemChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch history via SWR
    const { data: chatData } = useSWR("/api/system/chat", chatFetcher, { revalidateOnFocus: false });

    useEffect(() => {
        if (chatData?.messages && chatData.messages.length > 0 && messages.length === 0) {
            setMessages(chatData.messages);
        }
    }, [chatData, messages.length]);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");

        // Optimistic UI
        const tempId = Date.now().toString();
        setMessages(prev => [...prev, { _id: tempId, role: "user", content: userMsg, timestamp: new Date().toISOString() }]);
        setLoading(true);
        setStatusText("SYSTEM IS ANALYZING...");

        // Cycle typing animation text
        const statusMessages = [
            "SYSTEM IS ANALYZING...",
            "PROCESSING HUNTER DATA...",
            "EVALUATING RESPONSE...",
            "GENERATING DIRECTIVE..."
        ];
        let statusIndex = 0;
        const statusInterval = setInterval(() => {
            statusIndex = (statusIndex + 1) % statusMessages.length;
            setStatusText(statusMessages[statusIndex]);
        }, 3000);

        try {
            const res = await fetch("/api/system/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg })
            });

            const data = await res.json();

            clearInterval(statusInterval);

            if (data.reply) {
                setMessages(prev => [...prev, {
                    _id: (Date.now() + 1).toString(),
                    role: "system",
                    content: data.reply,
                    timestamp: new Date().toISOString()
                }]);
            } else if (data.error) {
                // API returned an error message
                setMessages(prev => [...prev, {
                    _id: (Date.now() + 1).toString(),
                    role: "system",
                    content: `⚠ SYSTEM NOTICE\n\n${data.error}`,
                    timestamp: new Date().toISOString()
                }]);
            } else {
                // No reply and no error — total silent failure
                setMessages(prev => [...prev, {
                    _id: (Date.now() + 1).toString(),
                    role: "system",
                    content: "⚠ SYSTEM NOTICE\n\nNo response received.\nRetry your command, Hunter.",
                    timestamp: new Date().toISOString()
                }]);
            }

            if (data.penalty) {
                const penaltyMsg = `⚠️ [PENALTY ACTIVATED]\n\nReason: ${data.penalty.reason}\nXP Deducted: -${data.penalty.xpPenalty} XP\nMandatory Quest: ${data.penalty.questTitle}`;
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        _id: (Date.now() + 2).toString(),
                        role: "system",
                        content: penaltyMsg,
                        timestamp: new Date().toISOString()
                    }]);
                }, 1000);
            }
        } catch (err) {
            clearInterval(statusInterval);
            console.error("Chat error:", err);

            // Network failure fallback
            setMessages(prev => [...prev, {
                _id: (Date.now() + 1).toString(),
                role: "system",
                content: "⚠ SYSTEM NOTICE\n\nCommunication with the System failed.\nCheck your connection and retry.",
                timestamp: new Date().toISOString()
            }]);
        } finally {
            clearInterval(statusInterval);
            setLoading(false);
            setStatusText("");
        }
    };

    return (
        <div className="system-chat-window glass-card" style={{ position: "relative", width: "100%", height: "100%", bottom: 0, right: 0, padding: 0 }}>
            <div className="chat-header">
                <div className="chat-title">
                    <ShieldAlert size={18} className="system-icon" />
                    <span>THE SYSTEM</span>
                </div>
                <div className="system-status-dot" style={{
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: loading ? "#ff4444" : "#00ff88",
                    boxShadow: loading ? "0 0 8px #ff4444" : "0 0 8px #00ff88",
                    animation: loading ? "pulse 1s infinite" : "none"
                }} />
            </div>

            <div className="chat-messages" style={{ height: "calc(100vh - 250px)" }}>
                {messages.length === 0 && !loading && (
                    <div className="system-message system-announcement">
                        <AlertTriangle size={16} style={{ marginRight: 8 }} />
                        [HUNTER STATUS DETECTED: AWAITING INPUT. EXPLAIN YOUR ACTIONS.]
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg._id} className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'system-bubble'}`}>
                        {msg.role === 'system' && <Zap size={14} className="system-spark" />}
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    </div>
                ))}

                {loading && (
                    <div className="chat-bubble system-bubble typing" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ color: "var(--accent-red)", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "2px", textTransform: "uppercase" }}>
                            {statusText}
                        </div>
                        <div style={{ display: "flex", gap: "4px" }}>
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="chat-input-area" style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "var(--space-md)" }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Respond to the System..."
                    className="game-input chat-input"
                    disabled={loading}
                />
                <button type="submit" className="btn-primary chat-send-btn" disabled={!input.trim() || loading} style={{ marginLeft: "var(--space-sm)" }}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, ShieldAlert, Zap } from "lucide-react";

interface ChatMessage {
    _id: string;
    role: "system" | "user";
    content: string;
    timestamp: string;
}

export default function SystemChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch history
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            fetch("/api/system/chat")
                .then(res => res.json())
                .then(data => {
                    if (data.messages) setMessages(data.messages);
                })
                .catch(err => console.error("Error fetching chat:", err));
        }
    }, [isOpen]);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");

        // Optimistic UI
        const tempId = Date.now().toString();
        setMessages(prev => [...prev, { _id: tempId, role: "user", content: userMsg, timestamp: new Date().toISOString() }]);
        setLoading(true);

        try {
            const res = await fetch("/api/system/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg })
            });

            const data = await res.json();

            if (data.reply) {
                setMessages(prev => [...prev, {
                    _id: (Date.now() + 1).toString(),
                    role: "system",
                    content: data.reply,
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
                }, 1000); // Slight delay for dramatic effect
            }
        } catch (err) {
            console.error("Chat error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="system-chat-fab"
                    title="Open System Interface"
                >
                    <MessageSquare size={24} />
                    <span className="fab-pulse"></span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="system-chat-window glass-card">
                    <div className="chat-header">
                        <div className="chat-title">
                            <ShieldAlert size={18} className="system-icon" />
                            <span>THE SYSTEM</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="icon-btn">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="chat-messages">
                        {messages.length === 0 && !loading && (
                            <div className="system-message system-announcement">
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
                            <div className="chat-bubble system-bubble typing">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="chat-input-area">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Respond to the System..."
                            className="game-input chat-input"
                            disabled={loading}
                        />
                        <button type="submit" className="btn-primary chat-send-btn" disabled={!input.trim() || loading}>
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}

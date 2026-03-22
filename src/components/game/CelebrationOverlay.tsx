"use client";

import { useEffect, useRef, useState } from "react";

interface CelebrationOverlayProps {
    show: boolean;
    totalXP: number;
    questCount: number;
    onClose: () => void;
}

// Particle definition
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    opacity: number;
    gravity: number;
    decay: number;
    rotation: number;
    rotSpeed: number;
    shape: "square" | "circle" | "diamond";
}

const COLORS = [
    "#ff0080", "#00b4ff", "#8b5cf6", "#00ff88",
    "#ff8c00", "#ffcc00", "#ff4488", "#00ffcc",
];

function createParticle(x: number, y: number): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 10;
    return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 10,
        opacity: 1,
        gravity: 0.25,
        decay: 0.012 + Math.random() * 0.012,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        shape: (["square", "circle", "diamond"] as const)[Math.floor(Math.random() * 3)],
    };
}

export default function CelebrationOverlay({ show, totalXP, questCount, onClose }: CelebrationOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animFrameRef = useRef<number>(0);
    const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");

    // Burst particles from multiple sources
    const burst = (canvas: HTMLCanvasElement) => {
        const origins = [
            { x: 0, y: canvas.height * 0.4 },
            { x: canvas.width, y: canvas.height * 0.4 },
            { x: canvas.width * 0.5, y: -20 },
            { x: canvas.width * 0.25, y: -20 },
            { x: canvas.width * 0.75, y: -20 },
        ];
        origins.forEach(o => {
            for (let i = 0; i < 60; i++) {
                particlesRef.current.push(createParticle(o.x, o.y));
            }
        });
    };

    useEffect(() => {
        if (!show) {
            setPhase("enter");
            return;
        }
        setPhase("enter");
        const timer1 = setTimeout(() => setPhase("show"), 100);
        const timer2 = setTimeout(() => setPhase("exit"), 4500);
        const timer3 = setTimeout(() => onClose(), 5200);
        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
    }, [show, onClose]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !show) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        particlesRef.current = [];
        burst(canvas);

        // Second burst after 600ms
        const burstTimer = setTimeout(() => burst(canvas), 600);
        const burstTimer2 = setTimeout(() => burst(canvas), 1300);

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.02);

            for (const p of particlesRef.current) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.vx *= 0.99;
                p.opacity -= p.decay;
                p.rotation += p.rotSpeed;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;

                const s = p.size;
                if (p.shape === "circle") {
                    ctx.beginPath();
                    ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.shape === "diamond") {
                    ctx.beginPath();
                    ctx.moveTo(0, -s / 2);
                    ctx.lineTo(s / 2, 0);
                    ctx.lineTo(0, s / 2);
                    ctx.lineTo(-s / 2, 0);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(-s / 2, -s / 2, s, s);
                }
                ctx.restore();
            }

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            clearTimeout(burstTimer);
            clearTimeout(burstTimer2);
        };
    }, [show]);

    if (!show) return null;

    const isVisible = phase === "show";
    const isExiting = phase === "exit";

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: isExiting
                    ? "rgba(0,0,0,0)"
                    : "rgba(0,0,0,0.75)",
                backdropFilter: isExiting ? "none" : "blur(4px)",
                transition: "background 0.7s ease, backdrop-filter 0.7s ease",
                pointerEvents: isExiting ? "none" : "auto",
                cursor: "pointer",
            }}
            onClick={onClose}
        >
            {/* Canvas for particles */}
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />

            {/* Main celebration card */}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    textAlign: "center",
                    transform: isVisible && !isExiting
                        ? "scale(1) translateY(0)"
                        : isExiting ? "scale(1.1) translateY(-20px)" : "scale(0.6) translateY(60px)",
                    opacity: isVisible && !isExiting ? 1 : 0,
                    transition: "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease",
                    padding: "40px 60px",
                    borderRadius: 24,
                    background: "rgba(5, 5, 20, 0.9)",
                    border: "1px solid rgba(139, 92, 246, 0.5)",
                    boxShadow: "0 0 60px rgba(139,92,246,0.4), 0 0 120px rgba(0,180,255,0.15), inset 0 0 40px rgba(139,92,246,0.05)",
                    maxWidth: 500,
                    userSelect: "none",
                }}
            >
                {/* Top label */}
                <div style={{
                    fontSize: "0.7rem",
                    letterSpacing: 5,
                    color: "#8b5cf6",
                    fontFamily: "monospace",
                    marginBottom: 16,
                    textShadow: "0 0 12px rgba(139,92,246,0.8)",
                }}>
                    ◈ SYSTEM NOTIFICATION ◈
                </div>

                {/* Trophy emoji */}
                <div style={{
                    fontSize: "5rem",
                    lineHeight: 1,
                    marginBottom: 16,
                    filter: "drop-shadow(0 0 20px rgba(255,204,0,0.8))",
                    animation: "bounce 0.6s ease infinite alternate",
                }}>
                    🏆
                </div>

                {/* Main title */}
                <div style={{
                    fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
                    fontWeight: 900,
                    fontFamily: "monospace",
                    letterSpacing: 3,
                    background: "linear-gradient(135deg, #ff0080, #8b5cf6, #00b4ff)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: 8,
                    textShadow: "none",
                    lineHeight: 1.2,
                }}>
                    DAILY QUESTS
                    <br />COMPLETE!
                </div>

                {/* Sub line */}
                <div style={{
                    color: "#00ff88",
                    fontSize: "1rem",
                    fontFamily: "monospace",
                    letterSpacing: 2,
                    marginBottom: 24,
                    textShadow: "0 0 12px rgba(0,255,136,0.6)",
                }}>
                    ALL {questCount} MISSIONS ACCOMPLISHED
                </div>

                {/* XP reward badge */}
                <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255,204,0,0.12)",
                    border: "1px solid rgba(255,204,0,0.4)",
                    borderRadius: 50,
                    padding: "10px 24px",
                    marginBottom: 24,
                    boxShadow: "0 0 20px rgba(255,204,0,0.2)",
                }}>
                    <span style={{ fontSize: "1.4rem" }}>⚡</span>
                    <span style={{
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        color: "#ffcc00",
                        fontFamily: "monospace",
                        textShadow: "0 0 16px rgba(255,204,0,0.8)",
                    }}>
                        +{totalXP} XP EARNED
                    </span>
                </div>

                {/* Motivational line */}
                <div style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "0.78rem",
                    letterSpacing: 1,
                    fontFamily: "monospace",
                }}>
                    [ TAP ANYWHERE TO CLOSE ]
                </div>

                {/* Glowing orbs */}
                {[
                    { top: -20, left: -20, color: "#ff0080" },
                    { top: -20, right: -20, color: "#00b4ff" },
                    { bottom: -20, left: "50%", color: "#8b5cf6" },
                ].map((orb, i) => (
                    <div key={i} style={{
                        position: "absolute",
                        width: 40, height: 40,
                        borderRadius: "50%",
                        background: orb.color,
                        filter: "blur(15px)",
                        opacity: 0.7,
                        ...orb,
                    }} />
                ))}
            </div>

            {/* Bounce keyframe */}
            <style>{`
                @keyframes bounce {
                    from { transform: translateY(0); }
                    to { transform: translateY(-12px); }
                }
            `}</style>
        </div>
    );
}

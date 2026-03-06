"use client";

import { useState, useEffect } from "react";
import { Zap, X, ChevronRight } from "lucide-react";

interface TrainingQuiz {
    topic: string;
    question: string;
}

interface DailyDebrief {
    completedRatio: string;
    xpEarned: number;
    weakestQuest: string;
    recommendation: string;
}

export default function ActiveTrainingUI() {
    const [quiz, setQuiz] = useState<TrainingQuiz | null>(null);
    const [debrief, setDebrief] = useState<DailyDebrief | null>(null);
    const [answerReq, setAnswerReq] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Auto-trigger training logic
    useEffect(() => {
        // In a real app, this might trigger based on time of day (e.g. night for debrief)
        // For testing, we'll try to fetch a training quiz if there's a weak topic.
        const checkTraining = async () => {
            try {
                const res = await fetch("/api/system/training", { method: "POST" });
                const data = await res.json();
                if (data.quiz) {
                    setQuiz(data.quiz);
                    setIsOpen(true);
                }
            } catch (err) {
                console.error("Failed to fetch training", err);
            }
        };

        // Call checkTraining right away to see if there's anything to do
        checkTraining();
    }, []);

    const fetchDebrief = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/system/debrief", { method: "POST" });
            const data = await res.json();
            if (data.debrief) {
                setDebrief(data.debrief);
                setQuiz(null); // Switch view
                setIsOpen(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button className="btn btn-secondary" onClick={fetchDebrief} style={{ width: "100%", marginTop: "var(--space-md)", borderColor: "var(--accent-red)", color: "var(--accent-red)" }}>
                <Zap size={16} /> Force Nightly Debrief
            </button>
        );
    }

    return (
        <div className="active-training-overlay">
            <div className="active-training-panel glass-card">
                <button className="icon-btn close-btn" onClick={() => setIsOpen(false)}>
                    <X size={20} />
                </button>

                <div className="training-header">
                    <Zap size={24} className="system-icon" />
                    <h2 style={{ fontFamily: "var(--font-display)", color: "var(--accent-red)", letterSpacing: "2px", margin: 0 }}>
                        SYSTEM OVERRIDE
                    </h2>
                </div>

                {quiz && (
                    <div className="training-content typewriter-effect">
                        <p className="system-text">[ ACTIVE TRAINING ACTIVATED: {quiz.topic.toUpperCase()} ]</p>
                        <p className="system-text">Hunter, your knowledge in {quiz.topic} is weak.</p>
                        <div className="quiz-box">
                            <p>{quiz.question}</p>
                        </div>
                        <div className="quiz-input-area">
                            <input
                                type="text"
                                value={answerReq}
                                onChange={e => setAnswerReq(e.target.value)}
                                placeholder="State your answer..."
                                className="game-input"
                            />
                            <button className="btn btn-danger" onClick={() => {
                                setQuiz(null); // In v2, we'd send this back to AI to grade
                                setIsOpen(false);
                            }}>
                                Submit <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {debrief && (
                    <div className="training-content typewriter-effect">
                        <p className="system-text">[ DAILY DEBRIEF REPORT ]</p>

                        <div className="debrief-stats">
                            <div className="stat-row">
                                <span>Quests Completed:</span>
                                <strong style={{ color: "var(--accent-blue)" }}>{debrief.completedRatio}</strong>
                            </div>
                            <div className="stat-row">
                                <span>XP Earned Today:</span>
                                <strong style={{ color: "var(--accent-gold)" }}>+{debrief.xpEarned}</strong>
                            </div>
                            <div className="stat-row">
                                <span>Weakest Link:</span>
                                <strong style={{ color: "var(--accent-red)" }}>{debrief.weakestQuest}</strong>
                            </div>
                        </div>

                        <div className="strategic-recommendation">
                            <h4>SYSTEM DIRECTIVE FOR TOMORROW:</h4>
                            <p>{debrief.recommendation}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

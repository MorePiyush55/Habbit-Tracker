"use client";

import { useState } from "react";
import { Zap, X, ChevronRight, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface TrainingQuiz {
    topic: string;
    question: string;
    difficulty?: string;
    hint?: string;
}

interface GradeResult {
    correct: boolean;
    score: number;
    feedback: string;
    correctAnswer: string;
    skillScore: number;
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
    const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
    const [answerReq, setAnswerReq] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [grading, setGrading] = useState(false);

    const startTraining = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/system/test-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate" })
            });
            const data = await res.json();
            if (data.quiz) {
                setQuiz(data.quiz);
                setIsOpen(true);
            }
        } catch (err) {
            console.error("Failed to fetch training", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitAnswer = async () => {
        if (!answerReq.trim() || !quiz) return;

        setGrading(true);
        try {
            const res = await fetch("/api/system/test-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "grade",
                    skill: quiz.topic,
                    question: quiz.question,
                    answer: answerReq
                })
            });
            const data = await res.json();
            if (data.result) {
                setGradeResult(data.result);
            }
        } catch (err) {
            console.error("Grading failed:", err);
            setGradeResult({
                correct: false,
                score: 0,
                feedback: "SYSTEM NOTICE: Grading failed. Answer recorded.",
                correctAnswer: "Evaluation unavailable.",
                skillScore: 0
            });
        } finally {
            setGrading(false);
        }
    };

    const fetchDebrief = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/system/debrief", { method: "POST" });
            const data = await res.json();
            if (data.debrief) {
                setDebrief(data.debrief);
                setQuiz(null);
                setGradeResult(null);
                setIsOpen(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const resetQuiz = () => {
        setQuiz(null);
        setGradeResult(null);
        setAnswerReq("");
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                <button
                    className="btn btn-primary"
                    onClick={startTraining}
                    disabled={loading}
                    style={{ flex: 1 }}
                >
                    {loading ? <Loader2 size={16} className="spinning" /> : <><Zap size={16} /> Active Training</>}
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={fetchDebrief}
                    disabled={loading}
                    style={{ flex: 1, borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
                >
                    {loading ? <Loader2 size={16} className="spinning" /> : "Nightly Debrief"}
                </button>
            </div>
        );
    }

    return (
        <div className="active-training-overlay">
            <div className="active-training-panel glass-card">
                <button className="icon-btn close-btn" onClick={resetQuiz}>
                    <X size={20} />
                </button>

                <div className="training-header">
                    <Zap size={24} className="system-icon" />
                    <h2 style={{ fontFamily: "var(--font-display)", color: "var(--accent-red)", letterSpacing: "2px", margin: 0 }}>
                        SYSTEM OVERRIDE
                    </h2>
                </div>

                {quiz && !gradeResult && (
                    <div className="training-content typewriter-effect">
                        <p className="system-text">[ ACTIVE TRAINING ACTIVATED: {quiz.topic.toUpperCase()} ]</p>
                        <p className="system-text">Hunter, your knowledge in {quiz.topic} is being tested.</p>
                        {quiz.difficulty && (
                            <div style={{ fontSize: "0.7rem", color: "#888", letterSpacing: "2px", marginBottom: 8 }}>
                                DIFFICULTY: {quiz.difficulty.toUpperCase()}
                            </div>
                        )}
                        <div className="quiz-box">
                            <p>{quiz.question}</p>
                        </div>
                        {quiz.hint && (
                            <div style={{ fontSize: "0.75rem", color: "#ffaa00", fontStyle: "italic", margin: "8px 0" }}>
                                Hint: {quiz.hint}
                            </div>
                        )}
                        <div className="quiz-input-area">
                            <input
                                type="text"
                                value={answerReq}
                                onChange={e => setAnswerReq(e.target.value)}
                                placeholder="State your answer..."
                                className="game-input"
                                disabled={grading}
                                onKeyDown={e => e.key === "Enter" && handleSubmitAnswer()}
                            />
                            <button className="btn btn-danger" onClick={handleSubmitAnswer} disabled={grading || !answerReq.trim()}>
                                {grading ? <Loader2 size={16} className="spinning" /> : <>Submit <ChevronRight size={16} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {gradeResult && (
                    <div className="training-content typewriter-effect">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            {gradeResult.correct
                                ? <CheckCircle size={24} style={{ color: "#00ff88" }} />
                                : <XCircle size={24} style={{ color: "#ff4444" }} />
                            }
                            <span style={{
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                color: gradeResult.correct ? "#00ff88" : "#ff4444"
                            }}>
                                {gradeResult.correct ? "CORRECT" : "INCORRECT"}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "#888", marginLeft: "auto" }}>
                                Score: {gradeResult.score}/100
                            </span>
                        </div>

                        <div style={{
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: 8,
                            padding: 14,
                            borderLeft: `3px solid ${gradeResult.correct ? "#00ff88" : "#ff4444"}`,
                            marginBottom: 12
                        }}>
                            <div style={{ fontSize: "0.7rem", letterSpacing: "2px", color: "#8b5cf6", marginBottom: 6 }}>
                                SYSTEM VERDICT
                            </div>
                            <div style={{ color: "#d0d0d0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                {gradeResult.feedback}
                            </div>
                        </div>

                        {!gradeResult.correct && gradeResult.correctAnswer && (
                            <div style={{
                                background: "rgba(0, 255, 136, 0.05)",
                                borderRadius: 8,
                                padding: 14,
                                borderLeft: "3px solid #00ff88",
                                marginBottom: 12
                            }}>
                                <div style={{ fontSize: "0.7rem", letterSpacing: "2px", color: "#00ff88", marginBottom: 6 }}>
                                    CORRECT ANSWER
                                </div>
                                <div style={{ color: "#d0d0d0", lineHeight: 1.6 }}>
                                    {gradeResult.correctAnswer}
                                </div>
                            </div>
                        )}

                        {gradeResult.skillScore > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "#888", textAlign: "center" }}>
                                Skill Proficiency: {gradeResult.skillScore}%
                            </div>
                        )}

                        <button className="btn btn-primary" onClick={resetQuiz} style={{ width: "100%", marginTop: 12 }}>
                            Acknowledged
                        </button>
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

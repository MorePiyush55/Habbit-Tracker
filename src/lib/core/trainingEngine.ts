/**
 * Training Engine — Skill Testing & Knowledge Verification
 * =========================================================
 * Detects weak skills → generates questions → grades answers → updates scores.
 * 
 * Flow:
 *   Weak skill detected → generate question → user answers → grade → update score
 *   
 * Integrates with the Event Bus:
 *   On grade → emit(TRAINING_COMPLETED) → Brain decides next action
 */

import connectDB from "@/lib/mongodb";
import SkillScore from "@/models/SkillScore";
import SkillNode from "@/models/SkillNode";
import SystemDecision from "@/models/SystemDecision";
import { aiRouter } from "@/lib/ai/aiRouter";
import type { SystemState } from "@/types";

function extractJSON(text: string): any {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
    } catch { /* fallback */ }
    return null;
}

interface TrainingQuestion {
    topic: string;
    question: string;
    difficulty: "easy" | "medium" | "hard";
    hint: string;
}

interface GradeResult {
    correct: boolean;
    score: number;
    feedback: string;
    correctAnswer: string;
    skillScore: number;
    skillTrend: "improving" | "stable" | "declining";
}

// ============================================================
// DETECT: Find the weakest skill that needs training
// ============================================================
export async function detectWeakestSkill(userId: string): Promise<string> {
    await connectDB();

    // 1. Check existing skill scores for the worst one
    const weakest = await SkillScore.findOne({ userId }).sort({ score: 1 }).lean();
    if (weakest && (weakest as any).score < 60) {
        return (weakest as any).skill;
    }

    // 2. Check skill nodes for untested skills
    try {
        const untestedNode = await SkillNode.findOne({
            userId,
            isActive: true,
        }).lean();
        if (untestedNode) return (untestedNode as any).skill;
    } catch { /* model might not exist */ }

    // 3. Fallback
    return weakest ? (weakest as any).skill : "General Discipline";
}

// ============================================================
// GENERATE: Create a training question for a skill
// ============================================================
export async function generateQuestion(
    userId: string,
    skill?: string
): Promise<TrainingQuestion> {
    await connectDB();

    const targetSkill = skill || (await detectWeakestSkill(userId));
    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are THE SYSTEM from Solo Leveling. You are testing a Hunter's knowledge.

Skill being tested: ${targetSkill}

Generate ONE technical/practical question about this skill.
The question should test real understanding, not just memorization.
Make it challenging but fair.

Return ONLY valid JSON:
{
  "question": "The question text",
  "skill": "${targetSkill}",
  "difficulty": "easy|medium|hard",
  "hint": "A brief hint if they struggle"
}`;

    try {
        const response = await aiRouter("tutor", prompt);
        const parsed = extractJSON(response);

        if (parsed && parsed.question) {
            // Log the training decision
            await SystemDecision.create({
                userId,
                decisionType: "SKILL_TEST",
                reason: `Training: testing knowledge in ${targetSkill}`,
                context: { skill: targetSkill },
                result: { question: parsed.question },
                date: today,
            });

            return {
                topic: parsed.skill || targetSkill,
                question: parsed.question,
                difficulty: parsed.difficulty || "medium",
                hint: parsed.hint || "",
            };
        }
    } catch (err: any) {
        console.error("[Training Engine] Question generation failed:", err.message);
    }

    // Fallback question
    return {
        topic: targetSkill,
        question: `Explain the core principles of ${targetSkill} in your own words.`,
        difficulty: "medium",
        hint: "Think about the fundamentals.",
    };
}

// ============================================================
// GRADE: Evaluate a Hunter's answer
// ============================================================
async function gradeAnswer(
    userId: string,
    skill: string,
    question: string,
    answer: string
): Promise<GradeResult> {
    await connectDB();

    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are THE SYSTEM from Solo Leveling. You are evaluating a Hunter's answer.

Skill: ${skill}
Question: ${question}
Hunter's Answer: "${answer}"

Evaluate the answer. Be strict but fair.

Return ONLY valid JSON:
{
  "correct": true or false,
  "score": number from 0 to 100,
  "feedback": "Your evaluation as The System. Be cold and direct. 2-3 sentences max.",
  "correctAnswer": "The correct/ideal answer in 1-2 sentences"
}`;

    try {
        const response = await aiRouter("tutor", prompt);
        const parsed = extractJSON(response);

        if (parsed) {
            // Update skill score in DB
            const scoreUpdate = await SkillScore.findOneAndUpdate(
                { userId, skill },
                {
                    $set: {
                        category: skill,
                        lastTested: new Date(),
                        trend: parsed.score >= 60 ? "improving" : "declining",
                    },
                    $inc: {
                        testsCompleted: 1,
                        correctAnswers: parsed.correct ? 1 : 0,
                    },
                },
                { upsert: true, new: true }
            );

            // Recalculate score
            let newScore = 50;
            if (scoreUpdate.testsCompleted > 0) {
                newScore = Math.round(
                    (scoreUpdate.correctAnswers / scoreUpdate.testsCompleted) * 100
                );
                scoreUpdate.score = newScore;
                await scoreUpdate.save();
            }

            // Determine trend
            const skillTrend: "improving" | "stable" | "declining" =
                parsed.score >= 70 ? "improving" : parsed.score >= 40 ? "stable" : "declining";

            // Log the grading decision
            await SystemDecision.create({
                userId,
                decisionType: "SKILL_TEST",
                reason: `Graded ${skill}: ${parsed.correct ? "CORRECT" : "WRONG"} (${parsed.score}/100)`,
                context: { skill, question, answer },
                result: { score: parsed.score, correct: parsed.correct },
                date: today,
            });

            return {
                correct: parsed.correct,
                score: parsed.score,
                feedback: parsed.feedback,
                correctAnswer: parsed.correctAnswer,
                skillScore: newScore,
                skillTrend,
            };
        }
    } catch (err: any) {
        console.error("[Training Engine] Grading failed:", err.message);
    }

    // Fallback
    return {
        correct: false,
        score: 50,
        feedback: "SYSTEM NOTICE: Grading system unavailable. Answer recorded.",
        correctAnswer: "Evaluation unavailable.",
        skillScore: 50,
        skillTrend: "stable",
    };
}

// ============================================================
// AUTO-TRAIN: Check if any skills need training right now
// Used by the Brain on SESSION_START events
// ============================================================
export async function getTrainingRecommendations(
    state: SystemState
): Promise<{ needsTraining: boolean; skills: string[]; reason: string }> {
    const weakSkills = state.skillScores
        .filter((s) => s.score < 50)
        .map((s) => s.skill);

    // Skills not tested in 7+ days
    const staleSkills = state.skillScores
        .filter((s) => {
            if (s.lastTested === "never") return true;
            const daysSince = Math.floor(
                (Date.now() - new Date(s.lastTested).getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysSince >= 7;
        })
        .map((s) => s.skill);

    const allNeedy = [...new Set([...weakSkills, ...staleSkills])];

    if (allNeedy.length === 0) {
        return { needsTraining: false, skills: [], reason: "All skills within acceptable range." };
    }

    return {
        needsTraining: true,
        skills: allNeedy.slice(0, 3),
        reason: `${allNeedy.length} skill(s) below threshold or not tested recently.`,
    };
}

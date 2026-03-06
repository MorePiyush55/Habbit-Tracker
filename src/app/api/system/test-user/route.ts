import { getUserId } from "@/lib/auth";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import SkillNode from "@/models/SkillNode";
import SkillScore from "@/models/SkillScore";
import SystemDecision from "@/models/SystemDecision";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const AI_TIMEOUT_MS = 15000;

async function callAI(prompt: string): Promise<string> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Test AI timeout")), AI_TIMEOUT_MS)
    );

    const result = await Promise.race([
        model.generateContent(prompt),
        timeout
    ]);
    return (result as any).response.text().replace(/```[\s\S]*?```/g, "").trim();
}

function extractJSON(text: string): any {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
    } catch (e) { /* fallback */ }
    return null;
}

// POST: Generate a question OR grade an answer
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { action, skill, answer, question } = await req.json();
        if (!action) return badRequest("action is required (generate | grade)");

        await connectDB();

        const today = new Date().toISOString().split("T")[0];

        if (action === "generate") {
            // Find weakest skill to test
            let targetSkill = skill;

            if (!targetSkill) {
                const weakest = await SkillScore.findOne({ userId })
                    .sort({ score: 1 })
                    .lean();

                if (weakest) {
                    targetSkill = weakest.skill;
                } else {
                    // If no skill scores exist, pick from skill nodes
                    const anySkill = await SkillNode.findOne({ userId, isActive: true }).lean();
                    targetSkill = anySkill ? anySkill.skill : "General Knowledge";
                }
            }

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
                const response = await callAI(prompt);
                const parsed = extractJSON(response);

                if (parsed && parsed.question) {
                    // Log the decision
                    await SystemDecision.create({
                        userId,
                        decisionType: "SKILL_TEST",
                        reason: `Testing knowledge in: ${targetSkill}`,
                        context: { skill: targetSkill },
                        result: { question: parsed.question },
                        date: today
                    });

                    return Response.json({
                        quiz: {
                            topic: parsed.skill || targetSkill,
                            question: parsed.question,
                            difficulty: parsed.difficulty || "medium",
                            hint: parsed.hint || ""
                        }
                    });
                }
            } catch (err: any) {
                console.error("[Test User] Generation failed:", err.message);
                // Return the exact error as the fallback question for immediate Vercel diagnosis
                return Response.json({
                    quiz: {
                        topic: "SYSTEM ERROR",
                        question: `API Generation Failed. Please show this error to the system architect: ${err.message}`,
                        difficulty: "hard",
                        hint: "Vercel / Gemini Integration Failure"
                    }
                });
            }

            // Fallback if parsing fails but no error thrown
            return Response.json({
                quiz: {
                    topic: targetSkill,
                    question: `Explain the core principles of ${targetSkill} in your own words.`,
                    difficulty: "medium",
                    hint: "Think about the fundamentals."
                }
            });
        }

        if (action === "grade") {
            if (!answer || !question || !skill) {
                return badRequest("answer, question, and skill are required for grading");
            }

            const prompt = `You are THE SYSTEM from Solo Leveling. You are evaluating a Hunter's answer.

Skill: ${skill}
Question: ${question}
Hunter's Answer: "${answer}"

Evaluate the answer. Be strict but fair.

Return ONLY valid JSON:
{
  "correct": true or false,
  "score": number from 0 to 100 (how good the answer is),
  "feedback": "Your evaluation as The System. Be cold and direct. 2-3 sentences max.",
  "correctAnswer": "The correct/ideal answer in 1-2 sentences"
}`;

            try {
                const response = await callAI(prompt);
                const parsed = extractJSON(response);

                if (parsed) {
                    // Update skill score
                    const scoreUpdate = await SkillScore.findOneAndUpdate(
                        { userId, skill },
                        {
                            $set: {
                                category: skill,
                                lastTested: new Date(),
                                trend: parsed.score >= 60 ? "improving" : "declining"
                            },
                            $inc: {
                                testsCompleted: 1,
                                correctAnswers: parsed.correct ? 1 : 0
                            }
                        },
                        { upsert: true, new: true }
                    );

                    // Recalculate score based on history
                    if (scoreUpdate.testsCompleted > 0) {
                        const newScore = Math.round((scoreUpdate.correctAnswers / scoreUpdate.testsCompleted) * 100);
                        scoreUpdate.score = newScore;
                        await scoreUpdate.save();
                    }

                    // Log the decision
                    await SystemDecision.create({
                        userId,
                        decisionType: "SKILL_TEST",
                        reason: `Graded ${skill} answer: ${parsed.correct ? "CORRECT" : "WRONG"}`,
                        context: { skill, question, answer },
                        result: { score: parsed.score, correct: parsed.correct },
                        date: today
                    });

                    return Response.json({
                        result: {
                            correct: parsed.correct,
                            score: parsed.score,
                            feedback: parsed.feedback,
                            correctAnswer: parsed.correctAnswer,
                            skillScore: scoreUpdate.score
                        }
                    });
                }
            } catch (err: any) {
                console.error("[Test User] Grading failed:", err.message);
            }

            // Fallback
            return Response.json({
                result: {
                    correct: false,
                    score: 50,
                    feedback: "SYSTEM NOTICE: Unable to evaluate. Answer recorded. Continue training.",
                    correctAnswer: "Evaluation unavailable.",
                    skillScore: 50
                }
            });
        }

        return badRequest("Invalid action. Use 'generate' or 'grade'.");
    } catch (error) {
        return handleError(error);
    }
}

// GET: Fetch user's skill scores
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const scores = await SkillScore.find({ userId }).sort({ score: 1 }).lean();
        const skills = await SkillNode.find({ userId, isActive: true }).lean();

        return Response.json({ scores, skills });
    } catch (error) {
        return handleError(error);
    }
}

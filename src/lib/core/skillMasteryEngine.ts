/**
 * Skill Mastery Tracking Engine (SMTE) — Core Module #27
 * ========================================================
 * Tracks HOW WELL a user understands each skill over time.
 *
 * Unlike simple task completion, this engine tracks:
 *   - Mastery % (holistic understanding score)
 *   - Trend (improving / stable / declining)
 *   - Confidence (system's certainty in the score)
 *   - Component scores (quiz, practice, consistency)
 *   - Decay detection (skills not practiced)
 *
 * Mastery formula:
 *   mastery = (quizScore * 0.4) + (practiceCompletion * 0.3) +
 *             (studyConsistency * 0.2) + (recencyBonus * 0.1)
 *
 * Integration:
 *   TASK_COMPLETED → updateSkillFromTask()
 *   TRAINING_COMPLETED → updateSkillFromQuiz()
 *   Scheduler cron → checkDecay() + updateTrends()
 *   Brain v3 → getSkillReport() for /skills + /mastery
 *   Context Builder → getSkillMasteryContext() for AI prompts
 *   Strategy Generator → getWeakestSkills() for training plans
 */

import connectDB from "@/lib/mongodb";
import SkillMastery from "@/models/SkillMastery";
import { updateNodeMastery } from "./knowledgeGraph";

// ============================================================
// Types
// ============================================================

interface SkillMasteryData {
    skillId: string;
    name: string;
    category: string;
    mastery: number;
    previousMastery: number;
    trend: "improving" | "stable" | "declining";
    confidence: number;
    quizScore: number;
    practiceCompletion: number;
    studyConsistency: number;
    totalStudyMinutes: number;
    sessionsCompleted: number;
    testsCompleted: number;
    correctAnswers: number;
    lastPracticed: string | null;
    lastTested: string | null;
    streakDays: number;
    daysSinceLastPractice: number;
    decayApplied: boolean;
    linkedNodeIds: string[];
}

interface SkillMasteryReport {
    skills: SkillMasteryData[];
    totalSkills: number;
    avgMastery: number;
    improvingCount: number;
    decliningCount: number;
    stableCount: number;
    weakestSkill: SkillMasteryData | null;
    strongestSkill: SkillMasteryData | null;
    decayWarnings: string[];         // skills nearing decay
    trendSummary: string;            // "3 improving, 1 declining, 2 stable"
}

interface MasteryUpdateResult {
    skillId: string;
    previousMastery: number;
    newMastery: number;
    delta: number;
    trend: string;
    leveledUp: boolean;              // crossed a threshold (e.g. 50→60)
}

interface DecayCheckResult {
    decayedSkills: Array<{ skillId: string; name: string; mastery: number; daysInactive: number }>;
    totalDecayed: number;
    warningSkills: Array<{ skillId: string; name: string; daysInactive: number }>;
}

// ============================================================
// SKILL CRUD
// ============================================================

/** Create or retrieve a skill mastery entry */
export async function ensureSkill(
    userId: string,
    skillId: string,
    name: string,
    category = "general",
    linkedNodeIds: string[] = []
): Promise<SkillMasteryData> {
    await connectDB();
    const doc = await SkillMastery.findOneAndUpdate(
        { userId, skillId },
        {
            $setOnInsert: {
                userId,
                skillId,
                name,
                category,
                mastery: 0,
                previousMastery: 0,
                trend: "stable",
                confidence: 0,
                quizScore: 0,
                practiceCompletion: 0,
                studyConsistency: 0,
                totalStudyMinutes: 0,
                sessionsCompleted: 0,
                testsCompleted: 0,
                correctAnswers: 0,
                streakDays: 0,
                daysSinceLastPractice: 0,
                decayApplied: false,
                linkedNodeIds,
                isActive: true,
            },
        },
        { upsert: true, new: true, lean: true }
    );
    return docToSkill(doc);
}

/** Get all active skills for a user */
async function getAllSkills(userId: string): Promise<SkillMasteryData[]> {
    await connectDB();
    const docs = await SkillMastery.find({ userId, isActive: true })
        .sort({ mastery: 1 })
        .lean();
    return docs.map(docToSkill);
}

/** Get a single skill */
export async function getSkill(userId: string, skillId: string): Promise<SkillMasteryData | null> {
    await connectDB();
    const doc = await SkillMastery.findOne({ userId, skillId, isActive: true }).lean();
    return doc ? docToSkill(doc) : null;
}

// ============================================================
// MASTERY CALCULATION + UPDATE
// ============================================================

/**
 * Update mastery from task completion.
 * Called when a habit/task linked to a skill is completed.
 */
export async function updateSkillFromTask(
    userId: string,
    skillId: string,
    name: string,
    category: string,
    completionRate: number // 0-100 how much of the task was done
): Promise<MasteryUpdateResult> {
    const skill = await ensureSkill(userId, skillId, name, category);
    const previousMastery = skill.mastery;

    // Practice completion component: weighted average with existing
    const newPractice = Math.round(
        skill.sessionsCompleted > 0
            ? (skill.practiceCompletion * 0.7 + completionRate * 0.3)
            : completionRate
    );

    // Study consistency: +5 if practised today, decays otherwise
    const lastPracticeDate = skill.lastPracticed ? new Date(skill.lastPracticed).toDateString() : null;
    const today = new Date().toDateString();
    const isNewSession = lastPracticeDate !== today;
    const newConsistency = isNewSession
        ? Math.min(100, skill.studyConsistency + 5)
        : skill.studyConsistency;

    // Streak tracking
    const streakDays = isNewSession ? skill.streakDays + 1 : skill.streakDays;

    // Calculate new mastery
    const newMastery = calculateMastery(skill.quizScore, newPractice, newConsistency, true);

    const updateData: Record<string, any> = {
        previousMastery,
        mastery: newMastery,
        practiceCompletion: newPractice,
        studyConsistency: newConsistency,
        lastPracticed: new Date(),
        streakDays,
        daysSinceLastPractice: 0,
        decayApplied: false,
    };

    if (isNewSession) {
        updateData.sessionsCompleted = skill.sessionsCompleted + 1;
    }

    // Calculate trend
    updateData.trend = determineTrend(previousMastery, newMastery, skill.trend);
    // Confidence increases with more data
    updateData.confidence = Math.min(100, Math.round(
        (skill.sessionsCompleted + skill.testsCompleted) * 5 + 10
    ));

    await connectDB();
    await SkillMastery.updateOne({ userId, skillId }, { $set: updateData });

    // Sync with knowledge graph nodes
    if (skill.linkedNodeIds.length > 0) {
        const delta = newMastery - previousMastery;
        if (Math.abs(delta) >= 2) {
            for (const nodeId of skill.linkedNodeIds) {
                await updateNodeMastery(userId, nodeId, Math.round(delta * 0.5));
            }
        }
    }

    const leveledUp = Math.floor(newMastery / 10) > Math.floor(previousMastery / 10);

    return {
        skillId,
        previousMastery,
        newMastery,
        delta: newMastery - previousMastery,
        trend: updateData.trend,
        leveledUp,
    };
}

/**
 * Update mastery from quiz/test results.
 * Called after grading a training question.
 */
export async function updateSkillFromQuiz(
    userId: string,
    skillId: string,
    name: string,
    category: string,
    isCorrect: boolean,
    difficulty: number // 1-5
): Promise<MasteryUpdateResult> {
    const skill = await ensureSkill(userId, skillId, name, category);
    const previousMastery = skill.mastery;

    // Quiz score component: weighted by difficulty
    const quizDelta = isCorrect ? (difficulty * 4) : -(difficulty * 2);
    const newQuizScore = Math.max(0, Math.min(100,
        skill.testsCompleted > 0
            ? Math.round(skill.quizScore * 0.8 + (skill.quizScore + quizDelta) * 0.2)
            : isCorrect ? 50 + difficulty * 10 : 20
    ));

    const newMastery = calculateMastery(newQuizScore, skill.practiceCompletion, skill.studyConsistency, true);

    const updateData: Record<string, any> = {
        previousMastery,
        mastery: newMastery,
        quizScore: newQuizScore,
        testsCompleted: skill.testsCompleted + 1,
        correctAnswers: skill.correctAnswers + (isCorrect ? 1 : 0),
        lastTested: new Date(),
        lastPracticed: new Date(),
        daysSinceLastPractice: 0,
        decayApplied: false,
    };

    updateData.trend = determineTrend(previousMastery, newMastery, skill.trend);
    updateData.confidence = Math.min(100, Math.round(
        (skill.sessionsCompleted + skill.testsCompleted + 1) * 5 + 15
    ));

    await connectDB();
    await SkillMastery.updateOne({ userId, skillId }, { $set: updateData });

    // Sync with knowledge graph
    if (skill.linkedNodeIds.length > 0) {
        const delta = newMastery - previousMastery;
        if (Math.abs(delta) >= 2) {
            for (const nodeId of skill.linkedNodeIds) {
                await updateNodeMastery(userId, nodeId, Math.round(delta * 0.5));
            }
        }
    }

    const leveledUp = Math.floor(newMastery / 10) > Math.floor(previousMastery / 10);

    return {
        skillId,
        previousMastery,
        newMastery,
        delta: newMastery - previousMastery,
        trend: updateData.trend,
        leveledUp,
    };
}

// ============================================================
// DECAY DETECTION
// ============================================================

/**
 * Check all skills for decay. Called by scheduler.
 * Skills inactive for 7+ days lose mastery points.
 */
export async function checkDecay(
    userId: string,
    decayDays = 7,
    decayRate = 2 // points per day beyond threshold
): Promise<DecayCheckResult> {
    await connectDB();

    const skills = await SkillMastery.find({ userId, isActive: true, mastery: { $gt: 5 } }).lean();
    const now = new Date();
    const decayedSkills: DecayCheckResult["decayedSkills"] = [];
    const warningSkills: DecayCheckResult["warningSkills"] = [];

    for (const skill of skills) {
        const lastPractice = skill.lastPracticed
            ? new Date(skill.lastPracticed as Date)
            : new Date(skill.createdAt as Date);
        const daysSince = Math.floor((now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24));

        // Update daysSinceLastPractice
        await SkillMastery.updateOne(
            { _id: skill._id },
            { $set: { daysSinceLastPractice: daysSince } }
        );

        if (daysSince >= decayDays) {
            // Apply decay
            const excessDays = daysSince - decayDays;
            const decay = Math.min(
                decayRate * (1 + Math.floor(excessDays / 3)), // accelerating decay
                (skill.mastery as number) - 5 // don't go below 5
            );

            if (decay > 0) {
                const newMastery = (skill.mastery as number) - decay;
                await SkillMastery.updateOne(
                    { _id: skill._id },
                    {
                        $set: {
                            previousMastery: skill.mastery,
                            mastery: Math.max(5, newMastery),
                            trend: "declining",
                            decayApplied: true,
                        },
                    }
                );

                decayedSkills.push({
                    skillId: skill.skillId as string,
                    name: skill.name as string,
                    mastery: Math.max(5, newMastery),
                    daysInactive: daysSince,
                });

                // Sync decay to knowledge graph
                if ((skill.linkedNodeIds as string[])?.length > 0) {
                    for (const nodeId of skill.linkedNodeIds as string[]) {
                        await updateNodeMastery(userId, nodeId, -Math.round(decay * 0.5));
                    }
                }
            }
        } else if (daysSince >= decayDays - 2) {
            // Warning: approaching decay threshold
            warningSkills.push({
                skillId: skill.skillId as string,
                name: skill.name as string,
                daysInactive: daysSince,
            });
        }
    }

    return {
        decayedSkills,
        totalDecayed: decayedSkills.length,
        warningSkills,
    };
}

// ============================================================
// REPORTS + ANALYSIS
// ============================================================

/** Generate comprehensive skill mastery report */
export async function getSkillMasteryReport(userId: string): Promise<SkillMasteryReport> {
    const skills = await getAllSkills(userId);

    if (skills.length === 0) {
        return {
            skills: [],
            totalSkills: 0,
            avgMastery: 0,
            improvingCount: 0,
            decliningCount: 0,
            stableCount: 0,
            weakestSkill: null,
            strongestSkill: null,
            decayWarnings: [],
            trendSummary: "No skills tracked yet.",
        };
    }

    const avgMastery = Math.round(skills.reduce((s, sk) => s + sk.mastery, 0) / skills.length);
    const improving = skills.filter((s) => s.trend === "improving");
    const declining = skills.filter((s) => s.trend === "declining");
    const stable = skills.filter((s) => s.trend === "stable");

    const weakest = skills.reduce((min, s) => (s.mastery < (min?.mastery ?? 101) ? s : min), skills[0]);
    const strongest = skills.reduce((max, s) => (s.mastery > (max?.mastery ?? -1) ? s : max), skills[0]);

    const decayWarnings = skills
        .filter((s) => s.daysSinceLastPractice >= 5 && s.mastery > 20)
        .map((s) => `${s.name} (${s.daysSinceLastPractice} days inactive)`);

    const trendSummary = `${improving.length} improving, ${declining.length} declining, ${stable.length} stable`;

    return {
        skills,
        totalSkills: skills.length,
        avgMastery,
        improvingCount: improving.length,
        decliningCount: declining.length,
        stableCount: stable.length,
        weakestSkill: weakest,
        strongestSkill: strongest,
        decayWarnings,
        trendSummary,
    };
}

/** Get the N weakest skills (for strategy/training targeting) */
export async function getWeakestSkills(userId: string, limit = 3): Promise<SkillMasteryData[]> {
    const skills = await getAllSkills(userId);
    return skills.slice(0, limit); // already sorted by mastery ASC
}

/** Get skills that are declining */
export async function getDecliningSkills(userId: string): Promise<SkillMasteryData[]> {
    await connectDB();
    const docs = await SkillMastery.find({
        userId,
        isActive: true,
        trend: "declining",
    }).sort({ mastery: 1 }).lean();
    return docs.map(docToSkill);
}

// ============================================================
// CONTEXT FORMATTING (for AI prompts)
// ============================================================

/** Format skill mastery data as context for AI */
export function formatSkillMasteryContext(report: SkillMasteryReport): string {
    if (report.totalSkills === 0) {
        return "[SKILL MASTERY]\nNo skill mastery data tracked yet.";
    }

    const parts: string[] = [
        `[SKILL MASTERY] (${report.totalSkills} skills | Avg: ${report.avgMastery}% | ${report.trendSummary})`,
    ];

    if (report.weakestSkill) {
        parts.push(`Weakest: ${report.weakestSkill.name} (${report.weakestSkill.mastery}%)`);
    }
    if (report.strongestSkill) {
        parts.push(`Strongest: ${report.strongestSkill.name} (${report.strongestSkill.mastery}%)`);
    }

    // Individual skills
    for (const skill of report.skills.slice(0, 10)) {
        const trendIcon = skill.trend === "improving" ? "↑" : skill.trend === "declining" ? "↓" : "→";
        const decayFlag = skill.daysSinceLastPractice >= 5 ? " ⚠" : "";
        parts.push(`  ${trendIcon} ${skill.name}: ${skill.mastery}% (conf: ${skill.confidence}%)${decayFlag}`);
    }

    if (report.decayWarnings.length > 0) {
        parts.push(`Decay Warnings: ${report.decayWarnings.join(", ")}`);
    }

    return parts.join("\n");
}

/** Format a compact version for status/compact context */
export function formatSkillMasteryCompact(report: SkillMasteryReport): string {
    if (report.totalSkills === 0) return "";
    const top3Weak = report.skills.slice(0, 3).map((s) => `${s.name}:${s.mastery}%`).join(", ");
    return `Skills: ${report.totalSkills} tracked | Avg ${report.avgMastery}% | Weakest: ${top3Weak} | ${report.trendSummary}`;
}

// ============================================================
// Helpers
// ============================================================

/** Core mastery calculation formula */
function calculateMastery(
    quizScore: number,
    practiceCompletion: number,
    studyConsistency: number,
    isRecent: boolean
): number {
    const recencyBonus = isRecent ? 100 : 0;
    const raw = (quizScore * 0.4) + (practiceCompletion * 0.3) +
        (studyConsistency * 0.2) + (recencyBonus * 0.1);
    return Math.round(Math.max(0, Math.min(100, raw)));
}

/** Determine trend based on previous vs current mastery */
function determineTrend(
    previous: number,
    current: number,
    existingTrend: string
): "improving" | "stable" | "declining" {
    const delta = current - previous;
    if (delta >= 3) return "improving";
    if (delta <= -3) return "declining";
    // Small change: maintain existing trend or stable
    if (Math.abs(delta) <= 1) return existingTrend as "improving" | "stable" | "declining";
    return "stable";
}

function docToSkill(doc: Record<string, any>): SkillMasteryData {
    return {
        skillId: doc.skillId,
        name: doc.name,
        category: doc.category ?? "general",
        mastery: doc.mastery ?? 0,
        previousMastery: doc.previousMastery ?? 0,
        trend: doc.trend ?? "stable",
        confidence: doc.confidence ?? 0,
        quizScore: doc.quizScore ?? 0,
        practiceCompletion: doc.practiceCompletion ?? 0,
        studyConsistency: doc.studyConsistency ?? 0,
        totalStudyMinutes: doc.totalStudyMinutes ?? 0,
        sessionsCompleted: doc.sessionsCompleted ?? 0,
        testsCompleted: doc.testsCompleted ?? 0,
        correctAnswers: doc.correctAnswers ?? 0,
        lastPracticed: doc.lastPracticed ? new Date(doc.lastPracticed).toISOString() : null,
        lastTested: doc.lastTested ? new Date(doc.lastTested).toISOString() : null,
        streakDays: doc.streakDays ?? 0,
        daysSinceLastPractice: doc.daysSinceLastPractice ?? 0,
        decayApplied: doc.decayApplied ?? false,
        linkedNodeIds: doc.linkedNodeIds ?? [],
    };
}

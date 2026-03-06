/**
 * Skill Mastery API — /api/skill-mastery
 * =========================================
 * Skill mastery tracking endpoints.
 *
 * GET  — Get mastery report or individual skill
 * POST — Update skill from task/quiz or create new skill
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import {
    getSkillMasteryReport,
    getSkill,
    getWeakestSkills,
    getDecliningSkills,
    updateSkillFromTask,
    updateSkillFromQuiz,
    ensureSkill,
    checkDecay,
    formatSkillMasteryContext,
} from "@/lib/core/skillMasteryEngine";

export async function GET(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const view = searchParams.get("view"); // "report" | "weakest" | "declining" | "decay"
        const skillId = searchParams.get("skillId");

        if (skillId) {
            const skill = await getSkill(userId, skillId);
            if (!skill) {
                return NextResponse.json({ error: "Skill not found" }, { status: 404 });
            }
            return NextResponse.json({ skill });
        }

        if (view === "weakest") {
            const limit = parseInt(searchParams.get("limit") ?? "3");
            const skills = await getWeakestSkills(userId, limit);
            return NextResponse.json({ skills });
        }

        if (view === "declining") {
            const skills = await getDecliningSkills(userId);
            return NextResponse.json({ skills });
        }

        if (view === "decay") {
            const result = await checkDecay(userId);
            return NextResponse.json(result);
        }

        // Default: full report
        const report = await getSkillMasteryReport(userId);
        return NextResponse.json({
            report,
            formatted: formatSkillMasteryContext(report),
        });
    } catch (err) {
        console.error("[SkillMastery API] GET error:", err);
        return NextResponse.json({ error: "Failed to fetch skill mastery" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();
        const { action } = body;

        if (action === "task") {
            // Update from task completion
            const { skillId, name, category, completionRate } = body;
            if (!skillId || !name) {
                return NextResponse.json({ error: "Missing skillId or name" }, { status: 400 });
            }
            const result = await updateSkillFromTask(userId, skillId, name, category ?? "general", completionRate ?? 100);
            return NextResponse.json({ result });
        }

        if (action === "quiz") {
            // Update from quiz result
            const { skillId, name, category, isCorrect, difficulty } = body;
            if (!skillId || !name) {
                return NextResponse.json({ error: "Missing skillId or name" }, { status: 400 });
            }
            const result = await updateSkillFromQuiz(userId, skillId, name, category ?? "general", isCorrect ?? false, difficulty ?? 1);
            return NextResponse.json({ result });
        }

        if (action === "create") {
            // Create a new skill entry
            const { skillId, name, category, linkedNodeIds } = body;
            if (!skillId || !name) {
                return NextResponse.json({ error: "Missing skillId or name" }, { status: 400 });
            }
            const skill = await ensureSkill(userId, skillId, name, category ?? "general", linkedNodeIds ?? []);
            return NextResponse.json({ skill });
        }

        return NextResponse.json({ error: "Missing action: 'task', 'quiz', or 'create'" }, { status: 400 });
    } catch (err) {
        console.error("[SkillMastery API] POST error:", err);
        return NextResponse.json({ error: "Failed to update skill mastery" }, { status: 500 });
    }
}

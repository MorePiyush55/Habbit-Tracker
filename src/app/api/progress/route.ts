import { getUserId } from "@/lib/auth";
import { getTodayProgress, toggleSubtaskProgress } from "@/services/progressService";
import { seedDefaultTasks } from "@/services/habitService";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import { toggleProgressSchema } from "@/lib/validation";
import Habit from "@/models/Habit";
import ProgressEntry from "@/models/ProgressEntry";
import User from "@/models/User";
import connectDB from "@/lib/mongodb";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        // Ensure default tasks are seeded if the user has NO habits
        const count = await Habit.countDocuments({ userId });
        if (count === 0) {
            await seedDefaultTasks(userId);
        }

        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

        const progress = await getTodayProgress(userId, date);

        // Phase 13.3 — Fail Feedback System
        let failFeedback = false;
        const user = await User.findById(userId);
        if (user && user.failFeedbackShownDate !== date) {
            const yesterdayDate = new Date(new Date(date).getTime() - 86400000).toISOString().split("T")[0];
            const yesterdayCompleted = await ProgressEntry.countDocuments({
                userId,
                date: yesterdayDate,
                completed: true
            });
            // If they did > 0 but < 3 tasks yesterday, they failed to secure the streak
            const yesterdayTotal = await ProgressEntry.countDocuments({ userId, date: yesterdayDate });
            if (yesterdayTotal > 0 && yesterdayCompleted < 3) {
                failFeedback = true;
                user.failFeedbackShownDate = date;
                await user.save();
            }
        }

        return Response.json({ ...progress, failFeedback });
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();

        // Handle streak securing and snapshot freezing
        if (body.secureStreak) {
            const user = await User.findById(userId);
            if (user && user.streakSecuredDate !== body.date) {
                user.streakSecuredDate = body.date;
                user.dailySnapshotLocked = true;
                user.dailySnapshotDate = body.date;
                await user.save();
            }
            return Response.json({ success: true, locked: true });
        }

        const parsed = toggleProgressSchema.safeParse(body);
        if (!parsed.success) {
            return badRequest(parsed.error.issues[0].message);
        }

        const result = await toggleSubtaskProgress(
            userId,
            parsed.data.date,
            parsed.data.habitId,
            parsed.data.subtaskId || null,
            parsed.data.completed
        );

        return Response.json(result);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("DAILY_LOCKED")) {
            return Response.json({ error: "Daily task locked for today", locked: true }, { status: 403 });
        }
        return handleError(error);
    }
}

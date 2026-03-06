import { getUserId } from "@/lib/auth";
import { getTodayProgress, toggleSubtaskProgress } from "@/services/progressService";
import { seedDefaultTasks } from "@/services/habitService";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import { toggleProgressSchema } from "@/lib/validation";
import Habit from "@/models/Habit";
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
        return Response.json(progress);
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
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
        return handleError(error);
    }
}

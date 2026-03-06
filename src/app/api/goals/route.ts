import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Goal from "@/models/Goal";
import Habit from "@/models/Habit";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        // Fetch goals and populate linked habits to calculate real-time progress
        const goals = await Goal.find({ userId, isActive: true })
            .populate("linkedHabits", "progressPercent completedSubtasks totalSubtasks")
            .lean();

        return Response.json({ goals });
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        if (!body.title || !body.deadline) {
            return badRequest("Title and deadline are required.");
        }

        await connectDB();

        const newGoal = await Goal.create({
            userId,
            title: body.title,
            deadline: new Date(body.deadline),
            linkedHabits: body.linkedHabits || []
        });

        // Update habits to point to this goal
        if (body.linkedHabits && body.linkedHabits.length > 0) {
            await Habit.updateMany(
                { _id: { $in: body.linkedHabits }, userId },
                { $set: { linkedGoalId: newGoal._id } }
            );
        }

        return Response.json({ goal: newGoal }, { status: 201 });
    } catch (error) {
        return handleError(error);
    }
}

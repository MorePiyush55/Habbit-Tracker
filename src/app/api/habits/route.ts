import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getHabits, createHabit, seedDefaultTasks } from "@/services/habitService";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import { habitSchema } from "@/lib/validation";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    return user?._id?.toString() || null;
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // Seed default tasks on first load
        await seedDefaultTasks(userId);

        const habits = await getHabits(userId);
        return Response.json({ habits });
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const parsed = habitSchema.safeParse(body);
        if (!parsed.success) {
            return badRequest(parsed.error.issues[0].message);
        }

        const habit = await createHabit(userId, {
            ...parsed.data,
            subtasks: body.subtasks || [],
        });
        return Response.json({ habit }, { status: 201 });
    } catch (error) {
        return handleError(error);
    }
}

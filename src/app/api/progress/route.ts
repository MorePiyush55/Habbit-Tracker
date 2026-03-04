import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTodayProgress, toggleSubtaskProgress } from "@/services/progressService";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import { toggleProgressSchema } from "@/lib/validation";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    return user?._id?.toString() || null;
}

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

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
            parsed.data.subtaskId || "",
            parsed.data.completed
        );

        return Response.json(result);
    } catch (error) {
        return handleError(error);
    }
}

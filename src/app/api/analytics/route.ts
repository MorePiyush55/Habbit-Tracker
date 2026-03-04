import { getUserId } from "@/lib/auth";
import { getProgressHistory } from "@/services/progressService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get("days") || "30", 10);

        const user = await User.findById(userId).lean();
        const history = await getProgressHistory(userId, days);

        return Response.json({
            user: {
                level: user?.level,
                totalXP: user?.totalXP,
                currentStreak: user?.currentStreak,
                longestStreak: user?.longestStreak,
            },
            history,
        });
    } catch (error) {
        return handleError(error);
    }
}

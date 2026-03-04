import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateMotivation } from "@/lib/ai/analysisService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import DailyProgress from "@/models/DailyProgress";

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

        const user = await User.findById(userId).lean();
        const recentProgress = await DailyProgress.find({ userId })
            .sort({ date: -1 })
            .limit(3)
            .lean();

        const playerData = {
            name: user?.name,
            level: user?.level,
            totalXP: user?.totalXP,
            currentStreak: user?.currentStreak,
            recentCompletionRates: recentProgress.map((p: Record<string, unknown>) => ({
                date: p.date,
                rate: p.completionRate,
            })),
        };

        const motivation = await generateMotivation(userId, playerData);
        return Response.json(motivation);
    } catch (error) {
        return handleError(error);
    }
}

import { getUserId } from "@/lib/auth";
import { aiRouter } from "@/lib/ai/aiRouter";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import DailyProgress from "@/models/DailyProgress";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

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

        const prompt = `You are THE SYSTEM from Solo Leveling. Give a short 1-2 sentence motivation to the Hunter.
        
Hunter Data: ${JSON.stringify(playerData)}

Return ONLY valid JSON:
{
  "message": "The motivation string"
}`;

        const response = await aiRouter("notification", prompt);
        let motivation = { message: "System Notice: Continue the hunt." };
        try {
            motivation = JSON.parse(response);
        } catch (e) {
            console.error("[System Motivator Error]:", e);
        }
        return Response.json(motivation);
    } catch (error) {
        return handleError(error);
    }
}

import { getUserId } from "@/lib/auth";
import { aiRouter } from "@/lib/ai/aiRouter";
import { getProgressHistory } from "@/services/progressService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import WeeklyReport from "@/models/WeeklyReport";

export async function POST() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        // Get last 7 days of progress
        const history = await getProgressHistory(userId, 7);
        const user = await User.findById(userId).lean();

        const weekData = {
            playerLevel: user?.level,
            totalXP: user?.totalXP,
            currentStreak: user?.currentStreak,
            dailyProgress: history,
        };

        const prompt = `You are THE SYSTEM from Solo Leveling. Generate a weekly performance analysis for the Hunter.
        
Data: ${JSON.stringify(weekData)}

Return ONLY valid JSON:
{
  "strongHabits": ["Habit 1", "Habit 2"],
  "weakHabits": ["Habit 3"],
  "suggestions": ["Do this", "Do that"],
  "report": "A short, cold, commanding assessment of their week."
}`;

        const response = await aiRouter("analysis", prompt);
        let analysis = { strongHabits: [], weakHabits: [], suggestions: [], report: "AI parsing failed." };
        try {
            analysis = JSON.parse(response);
        } catch (e) {
            console.error("[System Analyzer Error]:", e);
        }

        // Get current ISO week
        const now = new Date();
        const weekNum = getISOWeek(now);
        const weekId = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

        // Save report
        await WeeklyReport.findOneAndUpdate(
            { userId, week: weekId },
            {
                userId,
                week: weekId,
                strongHabits: analysis.strongHabits || [],
                weakHabits: analysis.weakHabits || [],
                suggestions: analysis.suggestions || [],
                report: analysis.report || "",
                totalXP: user?.totalXP || 0,
                avgCompletion: history.length > 0
                    ? Math.round(history.reduce((sum: number, d: Record<string, number>) => sum + (d.completionRate || 0), 0) / history.length)
                    : 0,
                generatedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        return Response.json(analysis);
    } catch (error) {
        return handleError(error);
    }
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

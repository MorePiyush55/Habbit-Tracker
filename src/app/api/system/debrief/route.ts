import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { getTodayProgress } from "@/services/progressService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { dailyDebriefPrompt } from "@/lib/ai/trainingPrompts";
import { handleError, unauthorized } from "@/lib/apiError";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();
        const user = await User.findById(userId).lean();

        const date = new Date().toISOString().split("T")[0];
        const progress = await getTodayProgress(userId, date);

        // Calculate completed vs total today
        let completedSubtasks = 0;
        let totalSubtasks = 0;

        const mappedHabits = progress.habits.map((h: any) => {
            const hCompleted = h.subtasks.filter((s: any) => s.completed).length;
            const hTotal = h.subtasks.length || 1; // avoid /0

            completedSubtasks += hCompleted;
            totalSubtasks += hTotal;

            return {
                title: h.title,
                completed: `${hCompleted}/${hTotal}`
            };
        });

        const dailyData = {
            level: user?.level,
            xp: user?.totalXP,
            streak: user?.currentStreak,
            quests: mappedHabits,
            totalRatio: `${completedSubtasks}/${totalSubtasks}`,
            xpEarnedToday: progress.dailyProgress?.totalXP || 0
        };

        const prompt = dailyDebriefPrompt(JSON.stringify(dailyData, null, 2));

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        const debrief = JSON.parse(text);

        return Response.json({ debrief });
    } catch (error) {
        return handleError(error);
    }
}

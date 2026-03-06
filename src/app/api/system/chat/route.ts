import { getUserId } from "@/lib/auth";
import { systemDecision } from "@/lib/ai/systemBrain";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import SystemMessage from "@/models/SystemMessage";
import PenaltyQuest from "@/models/PenaltyQuest";
import { getTodayProgress } from "@/services/progressService";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { message } = await req.json();
        if (!message) return badRequest("Message is required.");

        await connectDB();

        // Save user message
        await SystemMessage.create({
            userId,
            role: "user",
            content: message
        });

        // Gather deep context for AI
        const user = await User.findById(userId).lean();
        const date = new Date().toISOString().split("T")[0];

        let todayQuests: any[] = [];
        try {
            const progress = await getTodayProgress(userId, date);
            todayQuests = progress.habits.map((h: any) => ({
                title: h.title,
                difficulty: h.difficulty,
                percent: h.completionPercent,
                subtasksCompleted: h.subtasks.filter((s: any) => s.completed).length,
                subtasksTotal: h.subtasks.length,
                details: h.subtasks.map((s: any) => `${s.title}: ${s.completed ? 'Done' : 'Pending'}`)
            }));
        } catch (progressError: any) {
            console.error("[System Chat] Progress fetch error (non-fatal):", progressError.message);
        }

        const hunterData = {
            level: user?.level,
            xp: user?.totalXP,
            streak: user?.currentStreak,
            todayQuests
        };

        // Fetch recent chat history for memory
        const recentMessages = await SystemMessage.find({ userId })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        const history = recentMessages.reverse().map((msg: any) => ({
            role: msg.role === 'system' ? 'assistant' : msg.role,
            content: msg.content
        }));

        // Call Gemini (with timeout + fallback built in)
        console.log("[System Chat] Calling System Brain for user:", userId);
        const aiResponse = await systemDecision(userId, "SYSTEM_CHAT", { message, history });
        console.log("[System Chat] System Brain responded successfully");

        // Save System response
        await SystemMessage.create({
            userId,
            role: "system",
            content: aiResponse.reply
        });

        return Response.json({
            reply: aiResponse.reply,
            penalty: null
        });

    } catch (error: any) {
        console.error("[System Chat API CRITICAL Error]:", error.message || error);

        // Even on total crash, return a message to the frontend
        return Response.json({
            reply: "⚠ SYSTEM NOTICE\n\nCritical system failure.\nThe System could not process your request.\nRetry your command, Hunter.",
            penalty: null
        });
    }
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const messages = await SystemMessage.find({ userId })
            .sort({ timestamp: 1 })
            .lean();

        return Response.json({ messages });
    } catch (error) {
        return handleError(error);
    }
}

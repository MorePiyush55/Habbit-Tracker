import { getUserId } from "@/lib/auth";
import { generateSystemResponse } from "@/lib/ai/analysisService";
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
        const progress = await getTodayProgress(userId, date);

        // Map habits and subtasks deeply
        const todayQuests = progress.habits.map((h: any) => ({
            title: h.title,
            difficulty: h.difficulty,
            percent: h.completionPercent,
            subtasksCompleted: h.subtasks.filter((s: any) => s.completed).length,
            subtasksTotal: h.subtasks.length,
            details: h.subtasks.map((s: any) => `${s.title}: ${s.completed ? 'Done' : 'Pending'}`)
        }));

        const hunterData = {
            level: user?.level,
            xp: user?.totalXP,
            streak: user?.currentStreak,
            todayQuests
        };

        // Fetch recent chat history
        const recentMessages = await SystemMessage.find({ userId })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        const history = recentMessages.reverse().map((msg: any) => ({
            role: msg.role === 'system' ? 'assistant' : msg.role,
            content: msg.content
        }));

        // Call Gemini
        const aiResponse = await generateSystemResponse(userId, hunterData, history, message);

        // Save System response
        await SystemMessage.create({
            userId,
            role: "system",
            content: aiResponse.reply
        });

        let penaltyData = null;

        // Apply Penalty if issued
        if (aiResponse.issuePenalty && aiResponse.penaltyQuestTitle) {
            const xpDeduct = aiResponse.penaltyXPDeduction || 25;

            // Deduct XP but don't drop below 0
            if (user) {
                const newXP = Math.max(0, user.totalXP - xpDeduct);
                await User.findByIdAndUpdate(userId, { totalXP: newXP });
            }

            // Create Penalty Quest for tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const penalty = await PenaltyQuest.create({
                userId,
                reason: aiResponse.penaltyReason || "Weak mindset",
                penaltyType: "System Assigned",
                questTitle: aiResponse.penaltyQuestTitle,
                xpReward: Math.round(xpDeduct * 1.5), // Bonus for making it up
                expires: tomorrow,
                completed: false
            });

            penaltyData = {
                reason: penalty.reason,
                questTitle: penalty.questTitle,
                xpPenalty: xpDeduct
            };
        }

        return Response.json({
            reply: aiResponse.reply,
            penalty: penaltyData
        });

    } catch (error: any) {
        console.error("System Chat API Error:", error.message || error);
        return Response.json({ error: error.message || "Failed to communicate with the System." }, { status: 500 });
    }
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const messages = await SystemMessage.find({ userId })
            .sort({ timestamp: 1 }) // Chronological order
            .lean();

        return Response.json({ messages });
    } catch (error) {
        return handleError(error);
    }
}

import { getUserId } from "@/lib/auth";
import { systemDecision } from "@/lib/ai/systemBrain";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import GeneratedQuest from "@/models/GeneratedQuest";
import { createHabit } from "@/services/habitService";

// GET: Fetch today's generated quests
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const today = new Date().toISOString().split("T")[0];
        let quests = await GeneratedQuest.find({ userId, date: today }).lean();

        // If no quests generated yet, trigger the System Brain
        if (quests.length === 0) {
            console.log("[Generate Quests] No quests for today, triggering System Brain...");
            const result = await systemDecision(userId, "GENERATE_QUESTS", {});
            quests = result.quests || [];
        }

        return Response.json({ quests });
    } catch (error) {
        return handleError(error);
    }
}

// POST: Accept or reject a generated quest
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { questId, action } = await req.json();
        if (!questId || !action) {
            return Response.json({ error: "questId and action required" }, { status: 400 });
        }

        await connectDB();

        const quest = await GeneratedQuest.findOne({ _id: questId, userId });
        if (!quest) {
            return Response.json({ error: "Quest not found" }, { status: 404 });
        }

        if (action === "accept") {
            await createHabit(userId, {
                title: quest.title,
                category: "Generative",
                rank: quest.rank || "E",
                primaryStat: quest.primaryStat || "STR",
                xpReward: quest.xpReward || 10,
                subtasks: quest.subtasks,
                isDaily: false
            });

            quest.accepted = true;
            await quest.save();

            return Response.json({ success: true, message: "Quest accepted and added to your tasks." });
        } else if (action === "reject") {
            quest.rejected = true;
            await quest.save();

            return Response.json({ success: true, message: "Quest rejected." });
        }

        return Response.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return handleError(error);
    }
}

import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { handleError, badRequest, unauthorized } from "@/lib/apiError";
import { z } from "zod";
import { evaluateJobClass } from "@/lib/game-engine/engine";

const upgradeStatSchema = z.object({
    statId: z.enum(["STR", "VIT", "INT", "AGI", "PER", "CHA"]),
});

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const parsed = upgradeStatSchema.safeParse(body);
        
        if (!parsed.success) {
            return badRequest(parsed.error.issues[0].message);
        }

        const { statId } = parsed.data;

        await connectDB();
        
        const user = await User.findById(userId);
        if (!user) return badRequest("User not found");

        if (!user.statPoints || user.statPoints <= 0) {
            return badRequest("Not enough stat points");
        }

        // Initialize stats object if missing
        if (!user.stats) {
            user.stats = {
                STR: { value: 10, xp: 0 },
                VIT: { value: 10, xp: 0 },
                INT: { value: 10, xp: 0 },
                AGI: { value: 10, xp: 0 },
                PER: { value: 10, xp: 0 },
                CHA: { value: 10, xp: 0 }
            };
        }

        if (!user.stats[statId]) {
             user.stats[statId] = { value: 10, xp: 0 };
        }

        // Deduct point, add stat
        user.statPoints -= 1;
        user.stats[statId].value += 1;

        user.markModified("stats");

        // RPG Phase 4: Job Class Evolution
        const newJob = evaluateJobClass(user.stats as any);
        if (user.jobClass !== newJob) {
            user.jobClass = newJob;
            // Optionally emit an event here in the future
        }

        await user.save();

        return Response.json({ success: true, statPoints: user.statPoints, stats: user.stats, jobClass: user.jobClass });
    } catch (error) {
        return handleError(error);
    }
}

import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { handleError, unauthorized } from "@/lib/apiError";

/** POST /api/user/add-xp
 * Awards combo XP with server-side validation.
 * Validates comboCount matches server's sessionCombo + 1.
 * Validates timestamp — gap must be <= 120 minutes from last task.
 */
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const { amount, comboCount, timestamp, reason } = body;

        if (!amount || amount <= 0) {
            return Response.json({ error: "Invalid XP amount" }, { status: 400 });
        }

        await connectDB();
        const user = await User.findById(userId);
        if (!user) return unauthorized();

        const now = new Date();
        const today = now.toISOString().split("T")[0];

        // Reset daily XP if it's a new day
        if (user.dailyXPDate !== today) {
            user.dailyXPDate = today;
            user.dailyXP = 0;
        }

        // Apply XP Soft Cap
        let adjustedAmount = amount;
        if (user.dailyXP >= 200) {
            adjustedAmount = Math.ceil(amount * 0.5); // 50% reduction when over 200 XP
        }

        // Server-side combo validation
        if (comboCount !== undefined && timestamp) {
            const clientTime = new Date(timestamp);
            const lastTask = user.lastTaskCompletedAt ? new Date(user.lastTaskCompletedAt) : null;
            const gapMinutes = lastTask ? (clientTime.getTime() - lastTask.getTime()) / 60000 : 9999;

            if (gapMinutes > 120) {
                return Response.json({ error: "Combo expired — gap too large" }, { status: 400 });
            }

            const expectedCombo = (user.sessionCombo || 0) + 1;
            if (comboCount !== expectedCombo && comboCount > 1) {
                return Response.json({ error: "Combo count mismatch" }, { status: 400 });
            }

            user.sessionCombo = comboCount;
            user.lastTaskCompletedAt = clientTime;
        }

        user.totalXP = (user.totalXP || 0) + adjustedAmount;
        user.dailyXP = (user.dailyXP || 0) + adjustedAmount;
        await user.save();

        return Response.json({
            success: true,
            totalXP: user.totalXP,
            addedXP: amount,
            reason: reason || "combo",
        });
    } catch (error) {
        return handleError(error);
    }
}

import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { handleError, unauthorized } from "@/lib/apiError";

function getISOWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${week}`;
}

function daysBetween(a: Date | null, b: Date): number {
    if (!a) return 999;
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
}

/** POST /api/habits/use-recovery
 * Consumes 1 recovery token to backfill yesterday's streak.
 * Anti-exploit: 3-day cooldown, max 1 per week, only for missed yesterday.
 */
export async function POST() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();
        const user = await User.findById(userId);
        if (!user) return unauthorized();

        const now = new Date();
        const currentWeekKey = getISOWeekKey(now);
        const yesterday = getYesterday();

        // Auto-refill on new week
        if ((user.recoveryToken?.weekRefillKey || "") !== currentWeekKey) {
            user.recoveryToken = {
                count: 1,
                lastUsedDate: user.recoveryToken?.lastUsedDate || null,
                weekRefillKey: currentWeekKey,
            };
        }

        const token = user.recoveryToken || { count: 0, lastUsedDate: null, weekRefillKey: currentWeekKey };

        // Validation checks
        if (token.count <= 0) {
            return Response.json({ error: "No recovery tokens left this week" }, { status: 400 });
        }

        const daysSinceUse = daysBetween(token.lastUsedDate, now);
        if (daysSinceUse < 3) {
            const daysLeft = 3 - daysSinceUse;
            return Response.json({ error: `Cooldown active — ${daysLeft} day(s) remaining` }, { status: 400 });
        }

        if (user.streakSecuredDate === yesterday) {
            return Response.json({ error: "Yesterday's streak was already secured" }, { status: 400 });
        }

        if (user.lastCompletedDate === yesterday) {
            return Response.json({ error: "No recovery needed — yesterday is already tracked" }, { status: 400 });
        }

        // Apply recovery — backfill yesterday
        user.streakSecuredDate = yesterday;
        user.lastCompletedDate = yesterday;
        user.currentStreak = (user.currentStreak || 0) + 1;
        if (user.currentStreak > (user.longestStreak || 0)) {
            user.longestStreak = user.currentStreak;
        }

        // Deduct token
        user.recoveryToken.count -= 1;
        user.recoveryToken.lastUsedDate = now;
        user.recoveryToken.weekRefillKey = currentWeekKey;
        user.markModified("recoveryToken");

        await user.save();

        return Response.json({
            success: true,
            newStreak: user.currentStreak,
            tokensLeft: user.recoveryToken.count,
        });
    } catch (error) {
        return handleError(error);
    }
}

/** GET /api/habits/use-recovery — returns token status */
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();
        const user = await User.findById(userId).select("recoveryToken lastCompletedDate streakSecuredDate").lean();
        if (!user) return unauthorized();

        const now = new Date();
        const currentWeekKey = getISOWeekKey(now);
        const yesterday = getYesterday();
        const token = (user as any).recoveryToken || { count: 1, lastUsedDate: null, weekRefillKey: "" };

        // Check if refill needed
        const effectiveCount = token.weekRefillKey !== currentWeekKey ? 1 : token.count;
        const daysSinceUse = daysBetween(token.lastUsedDate ? new Date(token.lastUsedDate) : null, now);
        const cooldownActive = daysSinceUse < 3;
        const cooldownDaysLeft = cooldownActive ? 3 - daysSinceUse : 0;
        const yesterdayMissed = (user as any).lastCompletedDate !== yesterday && (user as any).streakSecuredDate !== yesterday;

        return Response.json({
            count: effectiveCount,
            cooldownActive,
            cooldownDaysLeft,
            yesterdayMissed,
            canUse: effectiveCount > 0 && !cooldownActive && yesterdayMissed,
        });
    } catch (error) {
        return handleError(error);
    }
}

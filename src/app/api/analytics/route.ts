import { getUserId } from "@/lib/auth";
import { getProgressHistory } from "@/services/progressService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Habit from "@/models/Habit";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get("days") || "30", 10);
        const detail = searchParams.get("detail"); // "YYYY-MM-DD"

        // Detail mode: return a single day's data for heatmap click
        if (detail) {
            
            const entries = await ProgressEntry.find({ userId, date: detail }).lean();
            const habits = await Habit.find({ userId, isActive: true }).lean();

            const completedIds = new Set(
                entries.filter((e: any) => e.completed).map((e: any) => e.habitId?.toString())
            );

            const completedHabits = habits.filter(h => completedIds.has(h._id.toString()));
            const failedHabits = habits.filter(h => !completedIds.has(h._id.toString()));
            const totalXP = completedHabits.reduce((s, h) => s + (h.xpReward || 0), 0);

            let rate = habits.length > 0 ? Math.round((completedHabits.length / habits.length) * 100) : 0;
            if (rate > 100) rate = 100;

            return Response.json({
                date: detail,
                completedTasks: completedHabits.map(h => h.title),
                failedTasks: failedHabits.map(h => h.title),
                totalXP,
                completionRate: rate,
            });
        }

        const user = await User.findById(userId).lean();
        const history = await getProgressHistory(userId, days);

        const heatmapData = history.map((day: any) => ({
            date: day.date,
            count: Math.round((day.completionRate || 0) / 10)
        }));

        return Response.json({
            user: {
                level: user?.level,
                totalXP: user?.totalXP,
                currentStreak: user?.currentStreak,
                longestStreak: user?.longestStreak,
                gold: (user as any)?.gold || 0,
                statPoints: (user as any)?.statPoints || 0,
                stats: (user as any)?.stats || {
                    STR: { value: 10, xp: 0 }, VIT: { value: 10, xp: 0 },
                    INT: { value: 10, xp: 0 }, AGI: { value: 10, xp: 0 },
                    PER: { value: 10, xp: 0 }, CHA: { value: 10, xp: 0 }
                },
                hp: (user as any)?.hp ?? 100,
                maxHp: (user as any)?.maxHp ?? 100,
                jobClass: (user as any)?.jobClass || "F-Rank Recruit",
                disciplineScore: (user as any)?.disciplineScore || 50,
                focusScore: (user as any)?.focusScore || 50,
                skillGrowthScore: (user as any)?.skillGrowthScore || 50,
                hunterRank: (user as any)?.hunterRank || "E-Class",
                weeklyBossHP: (user as any)?.weeklyBossHP ?? 500,
                bossDefeatedThisWeek: (user as any)?.bossDefeatedThisWeek || false,
                bossRewardClaimedThisWeek: (user as any)?.bossRewardClaimedThisWeek || false,
                streakSecuredDate: (user as any)?.streakSecuredDate || "",
                recoveryToken: (user as any)?.recoveryToken || { count: 1 },
                session: (user as any)?.session || { active: false },
            },
            history,
            heatmapData
        });
    } catch (error) {
        return handleError(error);
    }
}


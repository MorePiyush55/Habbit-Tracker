import { getUserId } from "@/lib/auth";
import { getProgressHistory } from "@/services/progressService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get("days") || "30", 10);

        const user = await User.findById(userId).lean();
        const history = await getProgressHistory(userId, days);

        // Map DailyProgress history into the format required by the HeatMap component
        const heatmapData = history.map((day: any) => ({
            date: day.date, // format YYYY-MM-DD
            count: Math.round((day.completionRate || 0) / 10) // Map 0-100% to a 0-10 intensity scale
        }));

        return Response.json({
            user: {
                level: user?.level,
                totalXP: user?.totalXP,
                currentStreak: user?.currentStreak,
                longestStreak: user?.longestStreak,
                
                // RPG Phase 2
                gold: user?.gold || 0,
                statPoints: user?.statPoints || 0,
                stats: user?.stats || {
                    STR: { value: 10, xp: 0 },
                    VIT: { value: 10, xp: 0 },
                    INT: { value: 10, xp: 0 },
                    AGI: { value: 10, xp: 0 },
                    PER: { value: 10, xp: 0 },
                    CHA: { value: 10, xp: 0 }
                },
                // RPG Phase 3
                hp: user?.hp ?? 100,
                maxHp: user?.maxHp ?? 100,

                // RPG Phase 4
                jobClass: user?.jobClass || "F-Rank Recruit",

                disciplineScore: user?.disciplineScore || 50,
                focusScore: user?.focusScore || 50,
                skillGrowthScore: user?.skillGrowthScore || 50,
                hunterRank: user?.hunterRank || "E-Class",
                weeklyBossHP: user?.weeklyBossHP || 500,
                bossDefeatedThisWeek: user?.bossDefeatedThisWeek || false
            },
            history,
            heatmapData
        });
    } catch (error) {
        return handleError(error);
    }
}

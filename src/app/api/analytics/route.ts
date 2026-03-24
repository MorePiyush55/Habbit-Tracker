import { getUserId } from "@/lib/auth";
import { getProgressHistory } from "@/services/progressService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Habit from "@/models/Habit";
import ProgressEntry from "@/models/ProgressEntry";

type ProgressEntryDoc = {
    date: string;
    habitId?: { toString(): string } | string;
    completed?: boolean;
    xpEarned?: number;
};

type DaySummary = {
    completionRate: number;
    totalXP: number;
    completedTasks: string[];
    failedTasks: string[];
    count: number;
};

function normalizeId(value: { toString(): string } | string | undefined): string {
    if (!value) return "";
    return typeof value === "string" ? value : value.toString();
}

function summarizeDay(entries: ProgressEntryDoc[], habitTitleById: Record<string, string>): DaySummary {
    const completedEntries = entries.filter((entry) => Boolean(entry.completed));
    const failedEntries = entries.filter((entry) => entry.completed === false);

    const completedTaskSet = new Set(
        completedEntries.map((entry) => {
            const habitId = normalizeId(entry.habitId);
            return habitTitleById[habitId] || "Deleted task";
        })
    );

    const failedTaskSet = new Set(
        failedEntries.map((entry) => {
            const habitId = normalizeId(entry.habitId);
            return habitTitleById[habitId] || "Deleted task";
        })
    );

    const totalEntries = completedEntries.length + failedEntries.length;
    const completionRate = totalEntries > 0
        ? Math.round((completedEntries.length / totalEntries) * 100)
        : 0;

    const totalXP = completedEntries.reduce((sum, entry) => sum + (entry.xpEarned || 0), 0);
    const count = Math.round(completionRate / 10);

    return {
        completionRate,
        totalXP,
        completedTasks: Array.from(completedTaskSet),
        failedTasks: Array.from(failedTaskSet),
        count,
    };
}

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
            const [y, m, d] = detail.split('/');
            const dbDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            const entries = await ProgressEntry.find({ userId, date: dbDate })
                .select({ habitId: 1, completed: 1, xpEarned: 1, date: 1 })
                .lean<ProgressEntryDoc[]>();

            const habitIds = Array.from(
                new Set(
                    entries
                        .map((entry) => normalizeId(entry.habitId))
                        .filter(Boolean)
                )
            );

            const habits = habitIds.length > 0
                ? await Habit.find({ _id: { $in: habitIds }, userId })
                    .select({ _id: 1, title: 1 })
                    .lean<Array<{ _id: { toString(): string }; title: string }>>()
                : [];

            const habitTitleById = habits.reduce<Record<string, string>>((acc, habit) => {
                acc[habit._id.toString()] = habit.title;
                return acc;
            }, {});

            const summary = summarizeDay(entries, habitTitleById);

            return Response.json({
                date: detail,
                completedTasks: summary.completedTasks,
                failedTasks: summary.failedTasks,
                totalXP: summary.totalXP,
                completionRate: summary.completionRate,
            });
        }

        const user = await User.findById(userId).lean();
        const history = await getProgressHistory(userId, days);

        const historyDates = history.map((day: any) => day.date);
        const entries = historyDates.length > 0
            ? await ProgressEntry.find({ userId, date: { $in: historyDates } })
                .select({ habitId: 1, completed: 1, xpEarned: 1, date: 1 })
                .lean<ProgressEntryDoc[]>()
            : [];

        const entriesByDate = entries.reduce<Record<string, ProgressEntryDoc[]>>((acc, entry) => {
            if (!acc[entry.date]) {
                acc[entry.date] = [];
            }
            acc[entry.date].push(entry);
            return acc;
        }, {});

        const habitIds = Array.from(
            new Set(
                entries
                    .map((entry) => normalizeId(entry.habitId))
                    .filter(Boolean)
            )
        );

        const habits = habitIds.length > 0
            ? await Habit.find({ _id: { $in: habitIds }, userId })
                .select({ _id: 1, title: 1 })
                .lean<Array<{ _id: { toString(): string }; title: string }>>()
            : [];

        const habitTitleById = habits.reduce<Record<string, string>>((acc, habit) => {
            acc[habit._id.toString()] = habit.title;
            return acc;
        }, {});

        const heatmapData = history.map((day: any) => ({
            date: day.date,
            count: summarizeDay(entriesByDate[day.date] || [], habitTitleById).count
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


import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { unauthorized } from "@/lib/apiError";

// XP → Rank mapping (same logic as game engine)
function xpToRank(xp: number): "E" | "D" | "C" | "B" | "A" | "S" {
    if (xp >= 100) return "S";
    if (xp >= 70)  return "A";
    if (xp >= 45)  return "B";
    if (xp >= 30)  return "C";
    if (xp >= 18)  return "D";
    return "E";
}

// GET /api/habits/fix-ranks
// One-time endpoint: corrects all habits whose rank is "E" but XP suggests otherwise
export async function GET() {
    const userId = await getUserId();
    if (!userId) return unauthorized();

    await connectDB();

    const habits = await Habit.find({ userId }).lean();

    let fixed = 0;
    const updates = habits.map(async (habit) => {
        const correctRank = xpToRank(habit.xpReward || 10);
        if (habit.rank !== correctRank) {
            await Habit.findByIdAndUpdate(habit._id, { rank: correctRank });
            fixed++;
        }
    });

    await Promise.all(updates);

    return Response.json({
        message: `Rank fix complete. ${fixed} habits updated out of ${habits.length} total.`,
        fixed,
        total: habits.length
    });
}

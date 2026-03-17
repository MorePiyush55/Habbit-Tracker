import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { unauthorized } from "@/lib/apiError";

// Rank → canonical XP mapping
const RANK_XP: Record<string, number> = {
    E: 10,
    D: 20,
    C: 35,
    B: 55,
    A: 80,
    S: 120,
};

// XP value → correct rank
function xpToRank(xp: number): "E" | "D" | "C" | "B" | "A" | "S" {
    if (xp >= 100) return "S";
    if (xp >= 70)  return "A";
    if (xp >= 45)  return "B";
    if (xp >= 30)  return "C";
    if (xp >= 18)  return "D";
    return "E";
}

// GET /api/habits/fix-ranks
// Corrects rank + xpReward for all habits, based on each habit's stored xpReward.
// If xpReward looks wrong (all 10), falls back to fixing them based on their rank field
// by re-setting xpReward to the canonical value for that rank.
export async function GET() {
    const userId = await getUserId();
    if (!userId) return unauthorized();

    await connectDB();

    const habits = await Habit.find({ userId }).lean();
    let fixed = 0;

    const updates = habits.map(async (habit) => {
        const storedRank = (habit.rank as string) || "E";
        const storedXP = habit.xpReward || 10;

        // Determine what rank & XP should be:
        // If xpReward is meaningful (not all 10), derive rank from XP
        // Otherwise use the stored rank to set the canonical XP
        const correctRank = storedXP > 10 ? xpToRank(storedXP) : storedRank;
        const correctXP = RANK_XP[correctRank] || 10;

        if (habit.rank !== correctRank || habit.xpReward !== correctXP) {
            await Habit.findByIdAndUpdate(habit._id, {
                rank: correctRank,
                xpReward: correctXP,
            });
            fixed++;
        }
    });

    await Promise.all(updates);

    // If no habits needed fixing, it may mean all are stuck at E with XP=10
    // In that case, force-update based on rank field that should have been set by user
    let forceMsg = "";
    if (fixed === 0 && habits.length > 0) {
        // As a fallback: if everything is E but there are known non-E tasks by name, 
        // apply a smart title-based rank (works for default tasks)
        const titleRankMap: Record<string, { rank: "E" | "D" | "C" | "B" | "A" | "S"; xp: number }> = {
            "CompTIA Security+ Study":    { rank: "B", xp: 55 },
            "TryHackMe Practice":          { rank: "C", xp: 35 },
            "Job Applications":            { rank: "D", xp: 20 },
            "Client Outreach":             { rank: "D", xp: 20 },
            "Read Books":                  { rank: "E", xp: 10 },
            "Watch Informative Content":   { rank: "E", xp: 10 },
            "Learn Money-Making Skills":   { rank: "C", xp: 35 },
            "Improve Technical Resources": { rank: "E", xp: 10 },
            // AI-generated patterns
            "Discipline Check":    { rank: "D", xp: 20 },
            "Endurance Training":  { rank: "C", xp: 35 },
            "System Override":     { rank: "B", xp: 55 },
            "Strategy":            { rank: "C", xp: 35 },
            "Boss":                { rank: "A", xp: 80 },
        };

        for (const habit of habits) {
            // Find a match by partial title
            const match = Object.entries(titleRankMap).find(([key]) =>
                habit.title.toLowerCase().includes(key.toLowerCase())
            );
            if (match) {
                const [, { rank, xp }] = match;
                if (habit.rank !== rank || habit.xpReward !== xp) {
                    await Habit.findByIdAndUpdate(habit._id, { rank, xpReward: xp });
                    fixed++;
                }
            }
        }
        if (fixed > 0) forceMsg = " (applied title-based fallback)";
    }

    return Response.json({
        message: `Rank fix complete. ${fixed} habits updated out of ${habits.length} total.${forceMsg}`,
        fixed,
        total: habits.length,
    });
}

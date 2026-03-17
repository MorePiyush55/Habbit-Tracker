import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import { unauthorized } from "@/lib/apiError";

// The 6 core daily task titles the user wants to keep
const KEEP_TITLES = [
    "soc",
    "CompTIA Security+ Study",
    "TryHackMe Practice",
    "Job Applications",
    "Read Books",
    "Watch Informative Content",
];

// DELETE /api/habits/clean-tasks
// Removes all habits from DB that are NOT in the user's 6 core daily tasks list
export async function DELETE() {
    const userId = await getUserId();
    if (!userId) return unauthorized();

    await connectDB();

    const allHabits = await Habit.find({ userId }).lean();

    const toDelete = allHabits.filter(habit => {
        const keepMatch = KEEP_TITLES.some(keepTitle =>
            habit.title.toLowerCase().trim() === keepTitle.toLowerCase().trim()
        );
        return !keepMatch;
    });

    let deleted = 0;
    for (const habit of toDelete) {
        await Subtask.deleteMany({ habitId: habit._id });
        await Habit.findByIdAndDelete(habit._id);
        deleted++;
    }

    return Response.json({
        message: `Cleanup complete. Removed ${deleted} extra habits. ${allHabits.length - deleted} core habits kept.`,
        deleted,
        kept: allHabits.length - deleted,
        removedTitles: toDelete.map(h => h.title),
    });
}

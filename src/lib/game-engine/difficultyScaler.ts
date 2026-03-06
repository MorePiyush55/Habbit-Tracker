import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";

/**
 * Adaptive Difficulty Scaler
 * After 7+ consecutive daily completions of a habit, auto-increase its difficulty level.
 * Max difficulty level is 5.
 */
export async function incrementConsecutiveCompletion(habitId: string) {
    await connectDB();

    const habit = await Habit.findById(habitId);
    if (!habit) return null;

    habit.consecutiveCompletions = (habit.consecutiveCompletions || 0) + 1;

    // Auto-scale after 7 consecutive completions
    if (habit.consecutiveCompletions >= 7 && (habit.difficultyLevel || 1) < 5) {
        habit.difficultyLevel = (habit.difficultyLevel || 1) + 1;
        habit.consecutiveCompletions = 0;
        console.log(`[Difficulty Scaler] ${habit.title} scaled to level ${habit.difficultyLevel}`);
    }

    await habit.save();
    return habit;
}

export function resetConsecutiveCompletion(habitId: string) {
    return Habit.findByIdAndUpdate(habitId, { consecutiveCompletions: 0 });
}

export function getDifficultyLabel(level: number): string {
    const labels = ["Beginner", "Intermediate", "Advanced", "Expert", "Master"];
    return labels[Math.min(level - 1, 4)] || "Beginner";
}

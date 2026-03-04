import { StreakInfo } from "@/types";

const STREAK_MILESTONES = [
    { days: 3, label: "First Flame 🔥" },
    { days: 7, label: "Warrior Spirit ⚔️" },
    { days: 14, label: "Relentless 💪" },
    { days: 30, label: "Unstoppable 🏆" },
    { days: 60, label: "Iron Will 🛡️" },
    { days: 90, label: "Legend 💀" },
    { days: 180, label: "Immortal ✨" },
    { days: 365, label: "Shadow Monarch 👑" },
];

export function calculateStreak(
    lastCompletedDate: string,
    todayDate: string,
    currentStreak: number
): { newStreak: number; streakBroken: boolean } {
    if (!lastCompletedDate) {
        return { newStreak: 1, streakBroken: false };
    }

    const last = new Date(lastCompletedDate);
    const today = new Date(todayDate);
    const diffTime = today.getTime() - last.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Same day — no streak change
        return { newStreak: currentStreak, streakBroken: false };
    } else if (diffDays === 1) {
        // Consecutive day — streak continues
        return { newStreak: currentStreak + 1, streakBroken: false };
    } else {
        // Streak broken
        return { newStreak: 1, streakBroken: true };
    }
}

export function getStreakInfo(currentStreak: number, longestStreak: number): StreakInfo {
    return {
        current: currentStreak,
        longest: longestStreak,
        milestones: STREAK_MILESTONES.map((m) => ({
            ...m,
            reached: currentStreak >= m.days,
        })),
    };
}

export { STREAK_MILESTONES };

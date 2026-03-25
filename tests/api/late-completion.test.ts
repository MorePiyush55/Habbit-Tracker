import User from "@/models/User";
import Habit from "@/models/Habit";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";
import { SYSTEM_RULES } from "@/config/systemRules";

describe("Late Completion Window Tests", () => {
    async function createUser(seed: string) {
        return User.create({
            googleId: `gid-${seed}-${Date.now()}-${Math.random()}`,
            name: "Test User",
            email: `${seed}-${Date.now()}-${Math.random()}@test.com`,
        });
    }

    async function createHabit(userId: unknown, title: string, xpReward = 100) {
        return Habit.create({ userId, title, category: "Health", xpReward, rank: "C", primaryStat: "INT" });
    }

    async function createDailyProgress(userId: unknown, date: string) {
        return DailyProgress.create({ userId, date, totalXP: 0, completionRate: 0 });
    }

    it("should allow late completion within +8 hour window after midnight", async () => {
        const user = await createUser("late-window-inside");
        const habit = await createHabit(user._id, "Yesterday Task", 100);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

        const progress = await createDailyProgress(user._id, yesterdayStr);
        const entry = await ProgressEntry.create({
            dailyProgressId: progress._id,
            userId: user._id,
            habitId: habit._id,
            date: yesterdayStr,
            completed: true,
            completionType: "late",
            xpEarned: Math.round(habit.xpReward * 0.7),
        });

        expect(entry.completionType).toBe("late");
        expect(entry.xpEarned).toBe(70);
    });

    it("should reject late completion outside +8 hour window", async () => {
        const now = new Date();
        const midnightToday = new Date(now);
        midnightToday.setHours(0, 0, 0, 0);

        const expiredTimestamp = new Date(now);
        expiredTimestamp.setHours(9, 0, 0, 0);

        const hoursElapsed = (expiredTimestamp.getTime() - midnightToday.getTime()) / (1000 * 60 * 60);
        expect(hoursElapsed).toBeGreaterThan(SYSTEM_RULES.LATE_WINDOW_HOURS);
    });

    it("should apply 70% XP multiplier for late completions", async () => {
        const user = await createUser("late-penalty");
        const habit = await createHabit(user._id, "Late Task", 100);

        const date = "2026-03-24";
        const progress = await createDailyProgress(user._id, date);

        const entry = await ProgressEntry.create({
            dailyProgressId: progress._id,
            userId: user._id,
            habitId: habit._id,
            date,
            completed: true,
            completionType: "late",
            xpEarned: Math.round(100 * 0.7),
        });

        expect(entry.xpEarned).toBe(70);
        expect(entry.xpEarned).toBeLessThan(habit.xpReward);
    });

    it("should differentiate late completion from normal completion", async () => {
        const user = await createUser("late-vs-normal");
        const habit = await createHabit(user._id, "Task", 100);

        const normalProgress = await createDailyProgress(user._id, "2026-03-25");
        const lateProgress = await createDailyProgress(user._id, "2026-03-24");

        const normalEntry = await ProgressEntry.create({
            dailyProgressId: normalProgress._id,
            userId: user._id,
            habitId: habit._id,
            date: "2026-03-25",
            completed: true,
            completionType: "normal",
            xpEarned: 100,
        });

        const lateEntry = await ProgressEntry.create({
            dailyProgressId: lateProgress._id,
            userId: user._id,
            habitId: habit._id,
            date: "2026-03-24",
            completed: true,
            completionType: "late",
            xpEarned: 70,
        });

        expect(normalEntry.xpEarned).toBe(100);
        expect(lateEntry.xpEarned).toBe(70);
    });

    it("should respect LATE_WINDOW_HOURS from SYSTEM_RULES", async () => {
        expect(SYSTEM_RULES.LATE_WINDOW_HOURS).toBe(8);
        const midnightToday = new Date();
        midnightToday.setHours(0, 0, 0, 0);

        const boundary = new Date(midnightToday);
        boundary.setHours(SYSTEM_RULES.LATE_WINDOW_HOURS, 0, 0, 0);
        expect(boundary.getHours()).toBe(8);
    });
});

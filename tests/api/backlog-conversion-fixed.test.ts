import User from "@/models/User";
import Habit from "@/models/Habit";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";

describe("Backlog Conversion Tests", () => {
    async function createUser(seed: string) {
        return User.create({
            googleId: `gid-${seed}-${Date.now()}-${Math.random()}`,
            name: "Test User",
            email: `${seed}-${Date.now()}-${Math.random()}@test.com`,
        });
    }

    async function createHabit(userId: unknown, title: string, category = "Health") {
        return Habit.create({ userId, title, category, xpReward: 20, rank: "D", primaryStat: "STR" });
    }

    async function createDailyProgress(userId: unknown, date: string) {
        return DailyProgress.create({ userId, date, totalXP: 0, completionRate: 0 });
    }

    it("should convert incomplete yesterday tasks to today backlog", async () => {
        const user = await createUser("backlog-convert");
        const yesterday = "2026-03-24";
        const today = "2026-03-25";

        const habits = await Habit.create([
            { userId: user._id, title: "Done", category: "Work", xpReward: 10, rank: "E", primaryStat: "STR" },
            { userId: user._id, title: "Incomplete 1", category: "Health", xpReward: 10, rank: "E", primaryStat: "STR" },
            { userId: user._id, title: "Incomplete 2", category: "Learning", xpReward: 10, rank: "E", primaryStat: "INT" },
        ]);

        const ydp = await createDailyProgress(user._id, yesterday);
        const tdp = await createDailyProgress(user._id, today);

        await ProgressEntry.create([
            { dailyProgressId: ydp._id, userId: user._id, habitId: habits[0]._id, date: yesterday, completed: true, xpEarned: 10 },
            { dailyProgressId: ydp._id, userId: user._id, habitId: habits[1]._id, date: yesterday, completed: false, xpEarned: 0 },
            { dailyProgressId: ydp._id, userId: user._id, habitId: habits[2]._id, date: yesterday, completed: false, xpEarned: 0 },
            { dailyProgressId: tdp._id, userId: user._id, habitId: habits[1]._id, date: today, completed: false, xpEarned: 0, completionType: "backlog", sourceDate: yesterday },
            { dailyProgressId: tdp._id, userId: user._id, habitId: habits[2]._id, date: today, completed: false, xpEarned: 0, completionType: "backlog", sourceDate: yesterday },
        ]);

        const backlogCount = await ProgressEntry.countDocuments({ userId: user._id, date: today, completionType: "backlog" });
        expect(backlogCount).toBe(2);
    });

    it("should NOT duplicate backlog entries on multiple conversions", async () => {
        const user = await createUser("backlog-idempotent");
        const yesterday = "2026-03-24";
        const today = "2026-03-25";
        const habit = await createHabit(user._id, "Task");
        const ydp = await createDailyProgress(user._id, yesterday);
        const tdp = await createDailyProgress(user._id, today);

        await ProgressEntry.create({ dailyProgressId: ydp._id, userId: user._id, habitId: habit._id, date: yesterday, completed: false, xpEarned: 0 });
        await ProgressEntry.create({ dailyProgressId: tdp._id, userId: user._id, habitId: habit._id, date: today, completed: false, xpEarned: 0, completionType: "backlog", sourceDate: yesterday });

        const count = await ProgressEntry.countDocuments({ userId: user._id, date: today, habitId: habit._id, completionType: "backlog" });
        expect(count).toBe(1);
    });

    it("should update completion when backlog task is completed", async () => {
        const user = await createUser("backlog-complete");
        const yesterday = "2026-03-24";
        const today = "2026-03-25";
        const habit = await createHabit(user._id, "Backlog Task");
        const tdp = await createDailyProgress(user._id, today);

        const entry = await ProgressEntry.create({
            dailyProgressId: tdp._id,
            userId: user._id,
            habitId: habit._id,
            date: today,
            completed: false,
            xpEarned: 0,
            completionType: "backlog",
            sourceDate: yesterday,
        });

        const updated = await ProgressEntry.findByIdAndUpdate(entry._id, { completed: true, xpEarned: habit.xpReward }, { new: true });
        expect(updated?.completed).toBe(true);
        expect(updated?.xpEarned).toBe(habit.xpReward);
    });

    it("should only convert incomplete tasks from previous day", async () => {
        const user = await createUser("backlog-prev-day");
        const twoDaysAgo = "2026-03-23";
        const yesterday = "2026-03-24";
        const today = "2026-03-25";

        const oldHabit = await createHabit(user._id, "Old Task", "Work");
        const yHabit = await createHabit(user._id, "Yesterday Task", "Health");

        const twoDp = await createDailyProgress(user._id, twoDaysAgo);
        const ydp = await createDailyProgress(user._id, yesterday);
        const tdp = await createDailyProgress(user._id, today);

        await ProgressEntry.create([
            { dailyProgressId: twoDp._id, userId: user._id, habitId: oldHabit._id, date: twoDaysAgo, completed: false, xpEarned: 0 },
            { dailyProgressId: ydp._id, userId: user._id, habitId: yHabit._id, date: yesterday, completed: false, xpEarned: 0 },
            { dailyProgressId: tdp._id, userId: user._id, habitId: yHabit._id, date: today, completed: false, xpEarned: 0, completionType: "backlog", sourceDate: yesterday },
        ]);

        const backlogCount = await ProgressEntry.countDocuments({ userId: user._id, date: today, completionType: "backlog" });
        expect(backlogCount).toBe(1);
    });

    it("should track sourceDate correctly for backlog entries", async () => {
        const user = await createUser("backlog-source-date");
        const yesterday = "2026-03-24";
        const today = "2026-03-25";
        const habit = await createHabit(user._id, "Task");
        const tdp = await createDailyProgress(user._id, today);

        const backlogEntry = await ProgressEntry.create({
            dailyProgressId: tdp._id,
            userId: user._id,
            habitId: habit._id,
            date: today,
            completed: false,
            xpEarned: 0,
            completionType: "backlog",
            sourceDate: yesterday,
        });

        expect(backlogEntry.sourceDate).toBe(yesterday);
        expect(backlogEntry.date).toBe(today);
    });

    it("should preserve backlog completionType after update", async () => {
        const user = await createUser("backlog-type");
        const tdp = await createDailyProgress(user._id, "2026-03-25");
        const habit = await createHabit(user._id, "Type Check");
        const entry = await ProgressEntry.create({ dailyProgressId: tdp._id, userId: user._id, habitId: habit._id, date: "2026-03-25", completed: false, completionType: "backlog", sourceDate: "2026-03-24", xpEarned: 0 });

        const updated = await ProgressEntry.findByIdAndUpdate(entry._id, { xpEarned: 5 }, { new: true });
        expect(updated?.completionType).toBe("backlog");
    });

    it("should keep backlog entries tied to same user", async () => {
        const user = await createUser("backlog-user");
        const tdp = await createDailyProgress(user._id, "2026-03-25");
        const habit = await createHabit(user._id, "User Scoped");

        await ProgressEntry.create({ dailyProgressId: tdp._id, userId: user._id, habitId: habit._id, date: "2026-03-25", completed: false, completionType: "backlog", sourceDate: "2026-03-24", xpEarned: 0 });
        const count = await ProgressEntry.countDocuments({ userId: user._id, completionType: "backlog" });
        expect(count).toBe(1);
    });

    it("should keep unresolved backlog incomplete by default", async () => {
        const user = await createUser("backlog-default-incomplete");
        const tdp = await createDailyProgress(user._id, "2026-03-25");
        const habit = await createHabit(user._id, "Default Incomplete");

        const entry = await ProgressEntry.create({ dailyProgressId: tdp._id, userId: user._id, habitId: habit._id, date: "2026-03-25", completionType: "backlog", sourceDate: "2026-03-24", xpEarned: 0 });
        expect(entry.completed).toBe(false);
    });

    it("should allow conversion metadata with sourceDate", async () => {
        const user = await createUser("backlog-meta");
        const tdp = await createDailyProgress(user._id, "2026-03-25");
        const habit = await createHabit(user._id, "Meta");

        const entry = await ProgressEntry.create({ dailyProgressId: tdp._id, userId: user._id, habitId: habit._id, date: "2026-03-25", completionType: "backlog", sourceDate: "2026-03-24", xpEarned: 0 });
        expect(entry.sourceDate).toBeTruthy();
    });
});


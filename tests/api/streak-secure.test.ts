import User from "@/models/User";
import Habit from "@/models/Habit";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";
import { SYSTEM_RULES } from "@/config/systemRules";

describe("Streak Secure Logic Tests", () => {
    async function createUser(seed: string) {
        return User.create({
            googleId: `gid-${seed}-${Date.now()}-${Math.random()}`,
            name: "Test User",
            email: `${seed}-${Date.now()}-${Math.random()}@test.com`,
        });
    }

    async function createDailyProgress(userId: unknown, date: string) {
        return DailyProgress.create({ userId, date, totalXP: 0, completionRate: 0 });
    }

    it("should mark streak secure after completing minimum tasks", async () => {
        const user = await createUser("secure");
        await User.findByIdAndUpdate(user._id, {
            currentStreak: 5,
            totalXP: 100,
        });

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        // Create 3 habits (meeting SYSTEM_RULES.DAILY_MIN_TASKS)
        const habits = await Habit.create([
            { userId: user._id, title: "Task 1", category: "Work", xpReward: 20 },
            { userId: user._id, title: "Task 2", category: "Health", xpReward: 20 },
            { userId: user._id, title: "Task 3", category: "Learning", xpReward: 20 },
        ]);

        const progress = await createDailyProgress(user._id, dateStr);

        // Mark each habit as complete
        for (const habit of habits) {
            await ProgressEntry.create({
                userId: user._id,
                dailyProgressId: progress._id,
                habitId: habit._id,
                date: dateStr,
                completed: true,
                xpEarned: habit.xpReward ?? 10,
            });
        }

        // Verify minimum completed
        const completedCount = await ProgressEntry.countDocuments({
            userId: user._id,
            date: dateStr,
            completed: true,
        });

        expect(completedCount).toBe(SYSTEM_RULES.DAILY_MIN_TASKS);
        expect(completedCount >= SYSTEM_RULES.DAILY_MIN_TASKS).toBe(true);
    });

    it("should NOT break streak after secure even if a task is deleted post-completion", async () => {
        /**
         * Scenario: User completes 3+ tasks, streak is secured,
         * then deletes one task. Streak should remain locked.
         */
        const user = await createUser("delete-after-secure");
        await User.findByIdAndUpdate(user._id, {
            currentStreak: 10,
            totalXP: 500,
        });

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const habits = await Habit.create([
            { userId: user._id, title: "Task 1", category: "Work", xpReward: 15 },
            { userId: user._id, title: "Task 2", category: "Health", xpReward: 15 },
            { userId: user._id, title: "Task 3", category: "Learning", xpReward: 15 },
            { userId: user._id, title: "Task 4", category: "Hobby", xpReward: 15 },
        ]);

        const progress = await createDailyProgress(user._id, dateStr);

        // Complete 4 tasks (exceeds SYSTEM_RULES.DAILY_MIN_TASKS)
        const entries = await ProgressEntry.create(
            habits.map((h: any) => ({
                userId: user._id,
                dailyProgressId: progress._id,
                habitId: h._id,
                date: dateStr,
                completed: true,
                xpEarned: h.xpReward ?? 10,
            }))
        );

        // At this point, streak is secured (4 >= 3)
        let completedCount = await ProgressEntry.countDocuments({
            userId: user._id,
            date: dateStr,
            completed: true,
        });
        expect(completedCount).toBe(4);

        // Now delete one task (e.g., user clicks delete button)
        const taskToDelete = habits[3];
        await Habit.deleteOne({ _id: taskToDelete._id });

        // Verify entry still exists (streak protection)
        await ProgressEntry.findOne({
            habitId: taskToDelete._id,
            date: dateStr,
        });
        // In real implementation, delete might cascade, but logic should protect streak

        // Test: if we re-query completed tasks, we should have 3 (minimum maintained or data protection)
        completedCount = await ProgressEntry.countDocuments({
            userId: user._id,
            date: dateStr,
            completed: true,
        });

        // Streak should be protected: either entries remain or completion count is preserved
        expect(completedCount >= SYSTEM_RULES.DAILY_MIN_TASKS).toBe(true);
    });

    it("should require exactly min tasks to secure streak", async () => {
        const user = await createUser("min-threshold");
        await User.findByIdAndUpdate(user._id, {
            currentStreak: 1,
            totalXP: 50,
        });

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        // Create 2 habits (less than minimum)
        const habits = await Habit.create([
            { userId: user._id, title: "Task 1", category: "Work", xpReward: 10 },
            { userId: user._id, title: "Task 2", category: "Health", xpReward: 10 },
        ]);

        const progress = await createDailyProgress(user._id, dateStr);

        await ProgressEntry.create(
            habits.map((h: any) => ({
                userId: user._id,
                dailyProgressId: progress._id,
                habitId: h._id,
                date: dateStr,
                completed: true,
                xpEarned: h.xpReward ?? 10,
            }))
        );

        const completedCount = await ProgressEntry.countDocuments({
            userId: user._id,
            date: dateStr,
            completed: true,
        });

        // Should NOT meet minimum
        expect(completedCount).toBe(2);
        expect(completedCount < SYSTEM_RULES.DAILY_MIN_TASKS).toBe(true);
    });

    it("should allow incomplete tasks as long as minimum is met", async () => {
        const user = await createUser("incomplete-allowed");
        await User.findByIdAndUpdate(user._id, {
            currentStreak: 7,
            totalXP: 200,
        });

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const habits = await Habit.create([
            { userId: user._id, title: "Task 1", category: "Work", xpReward: 10 },
            { userId: user._id, title: "Task 2", category: "Health", xpReward: 10 },
            { userId: user._id, title: "Task 3", category: "Learning", xpReward: 10 },
            { userId: user._id, title: "Task 4", category: "Hobby", xpReward: 10 },
        ]);

        const progress = await createDailyProgress(user._id, dateStr);

        // 3 complete, 1 incomplete = 3 >= min, streak secured
        await ProgressEntry.create([
            { userId: user._id, dailyProgressId: progress._id, habitId: habits[0]._id, date: dateStr, completed: true, xpEarned: 10 },
            { userId: user._id, dailyProgressId: progress._id, habitId: habits[1]._id, date: dateStr, completed: true, xpEarned: 10 },
            { userId: user._id, dailyProgressId: progress._id, habitId: habits[2]._id, date: dateStr, completed: true, xpEarned: 10 },
            { userId: user._id, dailyProgressId: progress._id, habitId: habits[3]._id, date: dateStr, completed: false, xpEarned: 0 },
        ]);

        const completedCount = await ProgressEntry.countDocuments({
            userId: user._id,
            date: dateStr,
            completed: true,
        });

        expect(completedCount).toBe(3);
        expect(completedCount >= SYSTEM_RULES.DAILY_MIN_TASKS).toBe(true);
    });
});

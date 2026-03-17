import mongoose from "mongoose";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import User from "@/models/User";

// ─── QA Scenario 2: One-Time Tasks Do Not Regenerate ───────────────────────
// ─── QA Scenario 3: Deleted Tasks Never Reappear ───────────────────────────

describe("Habit Service — Task Lifecycle Tests", () => {
    let mockUserId: string;

    beforeEach(async () => {
        const user = await User.create({
            name: "QA Hunter",
            email: `qa-${Date.now()}@test.com`,
            googleId: `qa-google-id-${Date.now()}`,
            level: 1,
            xp: 0,
        });
        mockUserId = user._id.toString();
    });

    // ── QA Scenario 2: One-time task does NOT regenerate ───────────────────
    it("2. One-Time Task: should NOT reappear after deletion (isDaily = false)", async () => {
        // Create a one-time task
        const oneTimeTask = await Habit.create({
            userId: mockUserId,
            title: "One-time: Fix critical bug",
            category: "Work",
            rank: "C",
            primaryStat: "INT",
            xpReward: 35,
            isDaily: false,  // <-- one-time task
            isActive: true,
        });

        // User completes and deletes it
        await Habit.findByIdAndDelete(oneTimeTask._id);

        // Simulate midnight reset: fetch all active habits for the user
        const activeHabits = await Habit.find({ userId: mockUserId, isActive: true }).lean();

        // The deleted one-time task must NOT be in the list
        const foundTask = activeHabits.find(h => h._id.toString() === oneTimeTask._id.toString());
        expect(foundTask).toBeUndefined();
        expect(activeHabits.length).toBe(0);
    });

    // ── QA Scenario 3: Deleted repeating task never reappears ──────────────
    it("3. Deleted Task: repeating task should be absent after deletion", async () => {
        // Create a daily task
        const repeatingTask = await Habit.create({
            userId: mockUserId,
            title: "Daily: CompTIA Study",
            category: "Cybersecurity",
            rank: "B",
            primaryStat: "INT",
            xpReward: 55,
            isDaily: true,
            isActive: true,
        });

        // User soft-deletes it (sets isActive = false, as per habitService)
        await Habit.findByIdAndUpdate(repeatingTask._id, { isActive: false });

        // After midnight reset, only active habits are queried
        const activeHabits = await Habit.find({ userId: mockUserId, isActive: true }).lean();

        // Deleted task must NOT appear
        const found = activeHabits.find(h => h._id.toString() === repeatingTask._id.toString());
        expect(found).toBeUndefined();
    });

    // ── Bonus: Hard-delete removes subtasks too ─────────────────────────────
    it("3b. Hard Deletion: subtasks are cleaned up when habit is deleted", async () => {
        const habit = await Habit.create({
            userId: mockUserId,
            title: "Habit with subtasks",
            category: "Learning",
            rank: "D",
            primaryStat: "INT",
            xpReward: 20,
            isDaily: true,
            isActive: true,
            totalSubtasks: 2,
        });

        // Create 2 subtasks
        await Subtask.insertMany([
            { habitId: habit._id, title: "Step 1", order: 0 },
            { habitId: habit._id, title: "Step 2", order: 1 },
        ]);

        // Hard-delete the habit and its subtasks
        await Subtask.deleteMany({ habitId: habit._id });
        await Habit.findByIdAndDelete(habit._id);

        const remainingSubtasks = await Subtask.find({ habitId: habit._id }).lean();
        expect(remainingSubtasks.length).toBe(0);

        const deletedHabit = await Habit.findById(habit._id).lean();
        expect(deletedHabit).toBeNull();
    });

    // ── QA Scenario 8: Rank is correctly saved and stored ──────────────────
    it("8. Rank Persistence: habit created with B-rank stores correct rank and XP", async () => {
        const habit = await Habit.create({
            userId: mockUserId,
            title: "TryHackMe Session",
            category: "Cybersecurity",
            rank: "B",
            primaryStat: "INT",
            xpReward: 55,
            isDaily: true,
            isActive: true,
        });

        const saved = await Habit.findById(habit._id).lean();
        expect(saved?.rank).toBe("B");
        expect(saved?.xpReward).toBe(55);
        expect(saved?.primaryStat).toBe("INT");
    });

    // ── Rank default guard: no rank = E ────────────────────────────────────
    it("8b. Rank Default: habit created without explicit rank defaults to E", async () => {
        const habit = await Habit.create({
            userId: mockUserId,
            title: "Read for 30 mins",
            category: "Personal",
            primaryStat: "INT",
            xpReward: 10,
            isDaily: true,
            isActive: true,
        });

        const saved = await Habit.findById(habit._id).lean();
        expect(saved?.rank).toBe("E"); // Mongoose default
    });
});

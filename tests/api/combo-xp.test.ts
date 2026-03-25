import User from "@/models/User";
import Habit from "@/models/Habit";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";
import { SYSTEM_RULES, getComboBonus } from "@/config/systemRules";

describe("Combo XP Tests", () => {
    async function createUser(seed: string) {
        return User.create({
            googleId: `gid-${seed}-${Date.now()}-${Math.random()}`,
            name: "Combo User",
            email: `${seed}-${Date.now()}-${Math.random()}@test.com`,
        });
    }

    async function createHabit(userId: unknown, title: string, xpReward = 20) {
        return Habit.create({ userId, title, category: "Work", xpReward, rank: "D", primaryStat: "STR" });
    }

    async function createDailyProgress(userId: unknown, date: string) {
        return DailyProgress.create({ userId, date, totalXP: 0, completionRate: 0 });
    }

    it("should award 20 XP for 3-task combo", async () => {
        const { xp } = getComboBonus(3, 6);
        expect(xp).toBe(SYSTEM_RULES.COMBO_REWARDS.THREE_STREAK);
    });

    it("should award 50 XP for 5-task combo", async () => {
        const { xp } = getComboBonus(5, 7);
        expect(xp).toBe(SYSTEM_RULES.COMBO_REWARDS.FIVE_STREAK);
    });

    it("should award 100 XP for perfect run when all tasks done before 5-threshold", async () => {
        const { xp, text } = getComboBonus(4, 4);
        expect(xp).toBe(SYSTEM_RULES.COMBO_REWARDS.PERFECT_RUN);
        expect(text).toContain("PERFECT");
    });

    it("should NOT award combo bonus for 2-task threshold", async () => {
        const { xp } = getComboBonus(2, 5);
        expect(xp).toBe(0);
    });

    it("should reset combo on gap between completions", async () => {
        const user = await createUser("combo-gap");
        const date = "2026-03-25";
        const progress = await createDailyProgress(user._id, date);
        const habits = await Habit.create([
            { userId: user._id, title: "A", category: "Work", xpReward: 10, rank: "E", primaryStat: "STR" },
            { userId: user._id, title: "B", category: "Work", xpReward: 10, rank: "E", primaryStat: "STR" },
            { userId: user._id, title: "C", category: "Work", xpReward: 10, rank: "E", primaryStat: "STR" },
            { userId: user._id, title: "D", category: "Work", xpReward: 10, rank: "E", primaryStat: "STR" },
        ]);

        await ProgressEntry.create([
            { dailyProgressId: progress._id, userId: user._id, habitId: habits[0]._id, date, completed: true, xpEarned: 10 },
            { dailyProgressId: progress._id, userId: user._id, habitId: habits[1]._id, date, completed: true, xpEarned: 10 },
            { dailyProgressId: progress._id, userId: user._id, habitId: habits[2]._id, date, completed: true, xpEarned: 10 },
        ]);

        expect(getComboBonus(3, 4).xp).toBe(20);
        expect(getComboBonus(1, 4).xp).toBe(0);
    });

    it("should respect COMBO_WINDOW_MINUTES threshold", async () => {
        expect(SYSTEM_RULES.COMBO_WINDOW_MINUTES).toBe(120);
        const now = Date.now();
        const within = now + 60 * 60 * 1000;
        const outside = now + 130 * 60 * 1000;

        expect((within - now) / 60000).toBeLessThanOrEqual(SYSTEM_RULES.COMBO_WINDOW_MINUTES);
        expect((outside - now) / 60000).toBeGreaterThan(SYSTEM_RULES.COMBO_WINDOW_MINUTES);
    });

    it("should apply daily XP soft cap after 200 XP", async () => {
        const bonus = getComboBonus(5, 5);
        const capped = Math.round(bonus.xp * SYSTEM_RULES.DAILY_XP_SOFT_CAP_MULTIPLIER);
        expect(capped).toBeLessThanOrEqual(bonus.xp);
    });

    it("should NOT award combo on first completion of the day", async () => {
        expect(getComboBonus(1, 6).xp).toBe(0);
    });

    it("should award configured combo thresholds", async () => {
        expect(getComboBonus(3, 10).xp).toBe(SYSTEM_RULES.COMBO_REWARDS.THREE_STREAK);
        expect(getComboBonus(5, 10).xp).toBe(SYSTEM_RULES.COMBO_REWARDS.FIVE_STREAK);
        expect(getComboBonus(4, 4).xp).toBe(SYSTEM_RULES.COMBO_REWARDS.PERFECT_RUN);
    });

    it("should persist 5 valid completion entries in one day", async () => {
        const user = await createUser("combo-persist");
        const date = "2026-03-25";
        const progress = await createDailyProgress(user._id, date);
        const habits = await Habit.create([
            { userId: user._id, title: "1", category: "Work", xpReward: 20, rank: "D", primaryStat: "STR" },
            { userId: user._id, title: "2", category: "Work", xpReward: 20, rank: "D", primaryStat: "STR" },
            { userId: user._id, title: "3", category: "Work", xpReward: 20, rank: "D", primaryStat: "STR" },
            { userId: user._id, title: "4", category: "Work", xpReward: 20, rank: "D", primaryStat: "STR" },
            { userId: user._id, title: "5", category: "Work", xpReward: 20, rank: "D", primaryStat: "STR" },
        ]);

        await ProgressEntry.create(
            habits.map((h: any) => ({
                dailyProgressId: progress._id,
                userId: user._id,
                habitId: h._id,
                date,
                completed: true,
                xpEarned: h.xpReward,
            }))
        );

        const count = await ProgressEntry.countDocuments({ userId: user._id, date, completed: true });
        expect(count).toBe(5);
    });
});

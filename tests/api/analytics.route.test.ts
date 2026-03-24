import mongoose from "mongoose";
import { GET } from "@/app/api/analytics/route";
import { getUserId } from "@/lib/auth";
import User from "@/models/User";
import Habit from "@/models/Habit";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";

jest.mock("@/lib/auth", () => ({
    getUserId: jest.fn(),
}));

const mockedGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;

function makeRequest(url: string): Request {
    return new Request(url, { method: "GET" });
}

describe("Analytics API heatmap consistency", () => {
    let userId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const user = await User.create({
            googleId: `google-${Date.now()}-${Math.random()}`,
            name: "Heatmap Tester",
            email: `heatmap-${Date.now()}-${Math.random()}@test.com`,
        });
        userId = user._id;
        mockedGetUserId.mockResolvedValue(userId.toString());
    });

    it("returns heatmap count 0 for day with stale DailyProgress but no entries", async () => {
        await DailyProgress.create({
            userId,
            date: "2025-12-27",
            totalXP: 120,
            completionRate: 90,
        });

        const listRes = await GET(makeRequest("http://localhost/api/analytics?days=30"));
        const listJson = await listRes.json();

        const targetDay = (listJson.heatmapData as Array<{ date: string; count: number }>).find(
            (d) => d.date === "2025-12-27"
        );

        expect(targetDay).toBeDefined();
        expect(targetDay?.count).toBe(0);

        const detailRes = await GET(makeRequest("http://localhost/api/analytics?detail=2025/12/27"));
        const detailJson = await detailRes.json();

        expect(detailJson.completionRate).toBe(0);
        expect(detailJson.completedTasks).toEqual([]);
    });

    it("keeps heatmap and detail in sync for the same date", async () => {
        const habitA = await Habit.create({
            userId,
            title: "Study networking",
            category: "Learning",
            rank: "C",
            primaryStat: "INT",
            xpReward: 35,
            isActive: true,
        });

        const habitB = await Habit.create({
            userId,
            title: "Workout",
            category: "Health",
            rank: "D",
            primaryStat: "VIT",
            xpReward: 20,
            isActive: true,
        });

        const dailyProgress = await DailyProgress.create({
            userId,
            date: "2025-12-28",
            totalXP: 999,
            completionRate: 100,
        });

        await ProgressEntry.create({
            dailyProgressId: dailyProgress._id,
            userId,
            date: "2025-12-28",
            habitId: habitA._id,
            completed: true,
            xpEarned: 35,
        });

        await ProgressEntry.create({
            dailyProgressId: dailyProgress._id,
            userId,
            date: "2025-12-28",
            habitId: habitB._id,
            completed: false,
            xpEarned: 0,
        });

        const listRes = await GET(makeRequest("http://localhost/api/analytics?days=30"));
        const listJson = await listRes.json();
        const day = (listJson.heatmapData as Array<{ date: string; count: number }>).find(
            (d) => d.date === "2025-12-28"
        );

        expect(day).toBeDefined();
        expect(day?.count).toBe(5);

        const detailRes = await GET(makeRequest("http://localhost/api/analytics?detail=2025/12/28"));
        const detailJson = await detailRes.json();

        expect(detailJson.completionRate).toBe(50);
        expect(detailJson.totalXP).toBe(35);
        expect(detailJson.completedTasks).toEqual(["Study networking"]);
        expect(detailJson.failedTasks).toEqual(["Workout"]);
    });

    it("still shows activity after habit deletion because entries exist", async () => {
        const deletedHabit = await Habit.create({
            userId,
            title: "Temporary task",
            category: "Misc",
            rank: "E",
            primaryStat: "STR",
            xpReward: 10,
            isActive: true,
        });

        const dailyProgress = await DailyProgress.create({
            userId,
            date: "2025-12-29",
            totalXP: 0,
            completionRate: 0,
        });

        await ProgressEntry.create({
            dailyProgressId: dailyProgress._id,
            userId,
            date: "2025-12-29",
            habitId: deletedHabit._id,
            completed: true,
            xpEarned: 10,
        });

        await Habit.findByIdAndDelete(deletedHabit._id);

        const listRes = await GET(makeRequest("http://localhost/api/analytics?days=30"));
        const listJson = await listRes.json();
        const day = (listJson.heatmapData as Array<{ date: string; count: number }>).find(
            (d) => d.date === "2025-12-29"
        );

        expect(day).toBeDefined();
        expect(day?.count).toBe(10);

        const detailRes = await GET(makeRequest("http://localhost/api/analytics?detail=2025/12/29"));
        const detailJson = await detailRes.json();

        expect(detailJson.completionRate).toBe(100);
        expect(detailJson.completedTasks).toEqual(["Deleted task"]);
    });
});

import mongoose from "mongoose";
import { GET as getProgress } from "@/app/api/progress/route";
import { POST as convertBacklog } from "@/app/api/progress/convert-backlog/route";
import { getUserId } from "@/lib/auth";
import User from "@/models/User";
import Habit from "@/models/Habit";
import ProgressEntry from "@/models/ProgressEntry";

jest.mock("@/lib/auth", () => ({
    getUserId: jest.fn(),
}));

const mockedGetUserId = getUserId as jest.MockedFunction<typeof getUserId>;

function req(url: string, method: "GET" | "POST", body?: Record<string, unknown>): Request {
    return new Request(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe("Progress recovery API", () => {
    let userId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const user = await User.create({
            googleId: `google-${Date.now()}-${Math.random()}`,
            name: "Recovery Tester",
            email: `recovery-${Date.now()}-${Math.random()}@test.com`,
        });
        userId = user._id;
        mockedGetUserId.mockResolvedValue(userId.toString());
    });

    it("returns yesterday review payload in GET /api/progress", async () => {
        await Habit.create({
            userId,
            title: "Daily Reading",
            category: "Learning",
            rank: "D",
            primaryStat: "INT",
            xpReward: 20,
            isDaily: true,
            isActive: true,
        });

        const response = await getProgress(req("http://localhost/api/progress?date=2026-03-21", "GET"));
        const payload = await response.json();

        expect(payload.yesterdayReview).toBeDefined();
        expect(payload.yesterdayReview.date).toBe("2026-03-20");
        expect(payload.yesterdayReview.unresolvedCount).toBeGreaterThanOrEqual(1);
    });

    it("converts unresolved yesterday tasks into backlog entries", async () => {
        const habit = await Habit.create({
            userId,
            title: "Cyber Lab",
            category: "Learning",
            rank: "C",
            primaryStat: "INT",
            xpReward: 35,
            isDaily: true,
            isActive: true,
        });

        const response = await convertBacklog(
            req("http://localhost/api/progress/convert-backlog", "POST", { date: "2026-03-21" })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.converted).toBeGreaterThanOrEqual(1);

        const created = await ProgressEntry.findOne({
            userId,
            date: "2026-03-21",
            habitId: habit._id,
            completionType: "backlog",
            sourceDate: "2026-03-20",
        }).lean();

        expect(created).toBeTruthy();
        expect((created as any)?.completed).toBe(false);
    });
});

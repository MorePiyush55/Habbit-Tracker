import { getTodayProgress } from '@/services/progressService';
import DailyProgress from '@/models/DailyProgress';
import User from '@/models/User';
import mongoose from 'mongoose';

describe('Progress Service Edge Cases', () => {

    let mockUserId: string;

    beforeEach(async () => {
        // Create a mock user
        const user = await User.create({
            name: "Test Hunter",
            email: "hunter@test.com",
            googleId: "mock-google-id",
            level: 1,
            xp: 0
        });
        mockUserId = (user._id as mongoose.Types.ObjectId).toString();
    });

    it('1. Scheduler Failure: Should not duplicate DailyProgress on double reset', async () => {
        const todayStr = '2026-03-17';

        // Trigger first "reset" (getting progress generates the daily doc if missing)
        await getTodayProgress(mockUserId, todayStr);
        
        // Ensure one doc exists
        let docs = await DailyProgress.find({ userId: mockUserId, date: todayStr });
        expect(docs.length).toBe(1);

        // Simulate a second cron job / manual trigger happening right after
        await getTodayProgress(mockUserId, todayStr);

        // Ensure STILL only one doc exists
        docs = await DailyProgress.find({ userId: mockUserId, date: todayStr });
        expect(docs.length).toBe(1);
    });

    it('2. User Timezone Reset: Should respect the isolated date string passed from the client', async () => {
        // The server relies on the explicit date string to fetch progress, naturally separating timezones.
        const jstDate = '2026-03-18'; // Tomorrow in Japan
        const estDate = '2026-03-17'; // Today in NY

        // Fetch Japan progress (midnight passed)
        await getTodayProgress(mockUserId, jstDate);
        
        // Fetch NY progress (still today)
        await getTodayProgress(mockUserId, estDate);

        const jstDocs = await DailyProgress.find({ userId: mockUserId, date: jstDate });
        const estDocs = await DailyProgress.find({ userId: mockUserId, date: estDate });

        expect(jstDocs.length).toBe(1);
        expect(estDocs.length).toBe(1);
        expect(jstDocs[0].date).not.toBe(estDocs[0].date);
    });

    it('3. Concurrency / Unique Index: Should throw MongoServerError on simultaneous duplicate inserts', async () => {
        const dateStr = '2026-05-10';

        // Attempting to brute-force duplicate identical progress documents concurrently
        const attempt1 = DailyProgress.create({ userId: mockUserId, date: dateStr, totalXP: 0, completionRate: 0 });
        const attempt2 = DailyProgress.create({ userId: mockUserId, date: dateStr, totalXP: 0, completionRate: 0 });

        await expect(Promise.all([attempt1, attempt2])).rejects.toThrow(/E11000 duplicate key error/);

        // Verify only 1 survived
        const docs = await DailyProgress.find({ userId: mockUserId, date: dateStr });
        expect(docs.length).toBe(1);
    });
});

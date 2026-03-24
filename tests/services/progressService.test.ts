import { convertYesterdayMissesToBacklog, getTodayProgress, lateCompleteYesterdayTask } from '@/services/progressService';
import DailyProgress from '@/models/DailyProgress';
import User from '@/models/User';
import Habit from '@/models/Habit';
import ProgressEntry from '@/models/ProgressEntry';
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

    it('4. Late Completion: Should allow yesterday completion inside late window with reduced XP metadata', async () => {
        const today = '2026-03-20';
        const now = new Date('2026-03-20T07:00:00');

        const habit = await Habit.create({
            userId: mockUserId,
            title: 'Morning Study',
            category: 'Learning',
            rank: 'C',
            primaryStat: 'INT',
            xpReward: 35,
            isDaily: true,
            isActive: true,
        });

        const result = await lateCompleteYesterdayTask(mockUserId, today, habit._id.toString(), null, now);
        expect(result.appliedMultiplier).toBe(0.7);

        const entry = await ProgressEntry.findOne({ userId: mockUserId, date: '2026-03-19', habitId: habit._id }).lean();
        expect(entry).toBeTruthy();
        expect(entry?.completed).toBe(true);
        expect((entry as any)?.completionType).toBe('late');
    });

    it('5. Late Completion: Should reject when late window expired', async () => {
        const today = '2026-03-20';
        const now = new Date('2026-03-20T12:00:00');

        const habit = await Habit.create({
            userId: mockUserId,
            title: 'Workout',
            category: 'Health',
            rank: 'D',
            primaryStat: 'VIT',
            xpReward: 20,
            isDaily: true,
            isActive: true,
        });

        await expect(
            lateCompleteYesterdayTask(mockUserId, today, habit._id.toString(), null, now)
        ).rejects.toThrow(/LATE_WINDOW_EXPIRED/);
    });

    it('6. Backlog Conversion: Should convert unresolved yesterday daily habits to today backlog entries', async () => {
        const today = '2026-03-21';

        await Habit.create({
            userId: mockUserId,
            title: 'CompTIA Practice',
            category: 'Learning',
            rank: 'B',
            primaryStat: 'INT',
            xpReward: 55,
            isDaily: true,
            isActive: true,
        });

        await Habit.create({
            userId: mockUserId,
            title: 'Pushups',
            category: 'Fitness',
            rank: 'E',
            primaryStat: 'STR',
            xpReward: 10,
            isDaily: true,
            isActive: true,
        });

        const result = await convertYesterdayMissesToBacklog(mockUserId, today);
        expect(result.converted).toBe(2);

        const backlogEntries = await ProgressEntry.find({
            userId: mockUserId,
            date: today,
            completionType: 'backlog',
            sourceDate: '2026-03-20',
        }).lean();

        expect(backlogEntries.length).toBe(2);
        expect(backlogEntries.every((entry: any) => entry.completed === false)).toBe(true);
    });
});

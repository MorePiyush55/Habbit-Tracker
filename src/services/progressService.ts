import connectDB from "@/lib/mongodb";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import User from "@/models/User";
import { calculateXP } from "@/lib/game-engine/xpSystem";
import { getLevelFromXP } from "@/lib/game-engine/levelSystem";
import { calculateStreak } from "@/lib/game-engine/streakSystem";
import { checkAndFireEvents } from "@/lib/systemEventEngine";
import { Difficulty } from "@/types";

export async function getTodayProgress(userId: string, date: string) {
    await connectDB();

    let dailyProgress = await DailyProgress.findOne({ userId, date }).lean();
    if (!dailyProgress) {
        dailyProgress = await DailyProgress.create({ userId, date, totalXP: 0, completionRate: 0, bossDefeated: false });
        dailyProgress = dailyProgress.toObject();
    }

    const entries = await ProgressEntry.find({ userId, date }).lean();
    const habits = await Habit.find({ userId, isActive: true }).sort({ order: 1 }).lean();
    const subtasks = await Subtask.find({
        habitId: { $in: habits.map((h) => h._id) },
    }).lean();

    const habitsWithProgress = habits.map((habit) => {
        const habitSubtasks = subtasks.filter(
            (s) => s.habitId.toString() === habit._id.toString()
        );
        const subtasksWithProgress = habitSubtasks.map((sub) => {
            const entry = entries.find(
                (e) => e.subtaskId?.toString() === sub._id.toString()
            );
            return {
                _id: sub._id.toString(),
                title: sub.title,
                order: sub.order,
                completed: entry?.completed || false,
                xpEarned: entry?.xpEarned || 0,
            };
        });

        const completedCount = subtasksWithProgress.filter((s) => s.completed).length;
        const totalCount = subtasksWithProgress.length || 1;
        const completionPercent = Math.round((completedCount / totalCount) * 100);
        const isFullyCompleted = completionPercent === 100;

        return {
            _id: habit._id.toString(),
            title: habit.title,
            category: habit.category,
            difficulty: habit.difficulty,
            xpReward: habit.xpReward,
            order: habit.order,
            subtasks: subtasksWithProgress,
            completionPercent,
            isFullyCompleted,
        };
    });

    return {
        dailyProgress: {
            ...dailyProgress,
            _id: (dailyProgress as Record<string, unknown>)._id?.toString(),
        },
        habits: habitsWithProgress,
    };
}

export async function toggleSubtaskProgress(
    userId: string,
    date: string,
    habitId: string,
    subtaskId: string,
    completed: boolean
) {
    await connectDB();

    // Ensure daily progress exists
    let dailyProgress = await DailyProgress.findOne({ userId, date });
    if (!dailyProgress) {
        dailyProgress = await DailyProgress.create({ userId, date, totalXP: 0, completionRate: 0, bossDefeated: false });
    }

    // Get habit info for XP
    const habit = await Habit.findById(habitId).lean();
    if (!habit) throw new Error("Habit not found");

    const subtaskCount = await Subtask.countDocuments({ habitId });
    const xpPerSubtask = subtaskCount > 0 ? Math.floor(habit.xpReward / subtaskCount) : habit.xpReward;

    // Upsert entry
    const existingEntry = await ProgressEntry.findOne({
        userId, date, habitId, subtaskId,
    });

    let xpDelta = 0;

    if (existingEntry) {
        const wasCompleted = existingEntry.completed;
        existingEntry.completed = completed;
        existingEntry.xpEarned = completed ? xpPerSubtask : 0;
        await existingEntry.save();

        if (completed && !wasCompleted) xpDelta = xpPerSubtask;
        else if (!completed && wasCompleted) xpDelta = -xpPerSubtask;
    } else {
        await ProgressEntry.create({
            dailyProgressId: dailyProgress._id,
            userId,
            date,
            habitId,
            subtaskId,
            completed,
            xpEarned: completed ? xpPerSubtask : 0,
        });
        if (completed) xpDelta = xpPerSubtask;
    }

    // Update user XP and Boss Raid HP
    let raidCleared = false;
    if (xpDelta !== 0) {
        const user = await User.findById(userId);
        if (user) {
            user.totalXP = Math.max(0, user.totalXP + xpDelta);

            // Phase 5: Weekly Boss Raid Damage Logic
            if (xpDelta > 0 && !user.bossDefeatedThisWeek) {
                user.weeklyBossHP = Math.max(0, (user.weeklyBossHP || 500) - xpDelta);

                // Check if Boss is defeated (HP drained AND 5 day streak maintained)
                if (user.weeklyBossHP === 0 && user.currentStreak >= 5) {
                    user.bossDefeatedThisWeek = true;
                    raidCleared = true;
                    user.totalXP += 300; // Boss Reward
                }
            } else if (xpDelta < 0 && !user.bossDefeatedThisWeek) {
                // If they uncheck a task, boss regains HP
                user.weeklyBossHP = Math.min(500, (user.weeklyBossHP || 500) - xpDelta);
            }

            user.level = getLevelFromXP(user.totalXP);
            await user.save();
        }
    }

    // Recalculate daily progress
    const allEntries = await ProgressEntry.find({ userId, date }).lean();
    const allHabits = await Habit.find({ userId, isActive: true }).lean();
    const totalSubtasks = await Subtask.countDocuments({
        habitId: { $in: allHabits.map((h) => h._id) },
    });

    const completedEntries = allEntries.filter((e) => e.completed);
    const totalXP = completedEntries.reduce((sum, e) => sum + e.xpEarned, 0);
    const completionRate = totalSubtasks > 0
        ? Math.round((completedEntries.length / totalSubtasks) * 100)
        : 0;
    const bossDefeated = completionRate === 100;

    dailyProgress.totalXP = totalXP;
    dailyProgress.completionRate = completionRate;
    dailyProgress.bossDefeated = bossDefeated;
    await dailyProgress.save();

    // Update streak if boss defeated
    if (bossDefeated) {
        const user = await User.findById(userId);
        if (user) {
            const { newStreak } = calculateStreak(user.lastCompletedDate, date, user.currentStreak);
            user.currentStreak = newStreak;
            user.longestStreak = Math.max(user.longestStreak, newStreak);
            user.lastCompletedDate = date;
            await user.save();
        }
    }
    // Fire System Events (non-blocking — don't crash the toggle if events fail)
    try {
        const user = await User.findById(userId).lean();
        const questsCompleted = allHabits.filter(h => {
            const habitEntries = allEntries.filter(e => e.habitId.toString() === h._id.toString() && e.completed);
            const habitSubtaskCount = allEntries.filter(e => e.habitId.toString() === h._id.toString()).length || 1;
            return habitEntries.length >= habitSubtaskCount;
        }).length;

        await checkAndFireEvents(userId, date, {
            completionRate,
            bossDefeated: raidCleared,
            xpDelta,
            totalXP: user?.totalXP || 0,
            previousStreak: user?.currentStreak || 0,
            currentStreak: user?.currentStreak || 0,
            previousLevel: getLevelFromXP(Math.max(0, (user?.totalXP || 0) - xpDelta)),
            currentLevel: user?.level || 1,
            questsCompleted,
            totalQuests: allHabits.length
        });
    } catch (eventError: any) {
        console.error("[System Events] Non-fatal event processing error:", eventError.message);
    }

    return { totalXP, completionRate, bossDefeated, xpDelta };
}

export async function getProgressHistory(userId: string, days: number = 30) {
    await connectDB();
    return DailyProgress.find({ userId })
        .sort({ date: -1 })
        .limit(days)
        .lean();
}

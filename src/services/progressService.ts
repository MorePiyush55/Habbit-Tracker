import connectDB from "@/lib/mongodb";
import DailyProgress from "@/models/DailyProgress";
import ProgressEntry from "@/models/ProgressEntry";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import User from "@/models/User";
import { calculateXP } from "@/lib/game-engine/xpSystem";
import { getLevelFromXP } from "@/lib/game-engine/levelSystem";
import { calculateStreak } from "@/lib/game-engine/streakSystem";
import { incrementConsecutiveCompletion } from "@/lib/game-engine/difficultyScaler";
import BehaviorLog from "@/models/BehaviorLog";
import { Difficulty } from "@/types";
import { emit, SystemEvents } from "@/lib/core/eventBus";

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

        // Handle habits with no subtasks — use main task entry
        if (habitSubtasks.length === 0) {
            const mainEntry = entries.find(
                (e) => e.habitId?.toString() === habit._id.toString() && !e.subtaskId
            );
            const isCompleted = mainEntry?.completed || false;
            return {
                _id: habit._id.toString(),
                title: habit.title,
                category: habit.category,
                difficulty: habit.difficulty,
                xpReward: habit.xpReward,
                order: habit.order,
                isDaily: habit.isDaily ?? false,
                deadline: habit.deadline ? habit.deadline.toISOString() : undefined,
                subtasks: [],
                completionPercent: isCompleted ? 100 : 0,
                isFullyCompleted: isCompleted,
            };
        }

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
        const totalCount = subtasksWithProgress.length;
        const completionPercent = Math.round((completedCount / totalCount) * 100);
        const isFullyCompleted = completionPercent === 100;

        return {
            _id: habit._id.toString(),
            title: habit.title,
            category: habit.category,
            difficulty: habit.difficulty,
            xpReward: habit.xpReward,
            order: habit.order,
            isDaily: habit.isDaily ?? false,
            deadline: habit.deadline ? habit.deadline.toISOString() : undefined,
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
    subtaskId: string | null,
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

    // Lock: prevent unchecking completed daily tasks
    if (!completed && habit.isDaily) {
        const entryCheck: Record<string, unknown> = { userId, date, habitId };
        if (subtaskId) entryCheck.subtaskId = subtaskId;
        else entryCheck.subtaskId = null;
        const existing = await ProgressEntry.findOne(entryCheck).lean();
        if (existing?.completed) {
            throw new Error("DAILY_LOCKED: Daily tasks cannot be unchecked once completed today");
        }
    }

    const subtaskCount = await Subtask.countDocuments({ habitId });
    const xpPerSubtask = subtaskCount > 0 ? Math.floor(habit.xpReward / subtaskCount) : habit.xpReward;

    // Build query — use null for main-task entries (no subtask)
    const entryQuery: Record<string, unknown> = { userId, date, habitId };
    if (subtaskId) {
        entryQuery.subtaskId = subtaskId;
    } else {
        entryQuery.subtaskId = null;
    }

    // Upsert entry
    const existingEntry = await ProgressEntry.findOne(entryQuery);

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
            subtaskId: subtaskId || undefined,
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
    const allSubtaskCount = await Subtask.countDocuments({
        habitId: { $in: allHabits.map((h) => h._id) },
    });

    // Count habits that have NO subtasks — each counts as 1 completable item
    const habitIdsWithSubtasks = await Subtask.distinct("habitId", {
        habitId: { $in: allHabits.map((h) => h._id) },
    });
    const noSubtaskHabitCount = allHabits.filter(
        (h) => !habitIdsWithSubtasks.some((sid) => String(sid) === String(h._id))
    ).length;
    const totalTasks = allSubtaskCount + noSubtaskHabitCount;

    const completedEntries = allEntries.filter((e) => e.completed);
    const totalXP = completedEntries.reduce((sum, e) => sum + e.xpEarned, 0);
    const completionRate = totalTasks > 0
        ? Math.round((completedEntries.length / totalTasks) * 100)
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
    // ============================================================
    // EVENT BUS INTEGRATION — Fire events into the AI Discipline OS
    // ============================================================
    try {
        const user = await User.findById(userId).lean();
        const previousLevel = getLevelFromXP(Math.max(0, (user?.totalXP || 0) - xpDelta));
        const currentLevel = user?.level || 1;

        // 1. Core event: Subtask toggled
        await emit(SystemEvents.subtaskToggled(userId, habitId, subtaskId || "", completed, xpDelta));

        // 2. Check for level up
        if (currentLevel > previousLevel) {
            await emit(SystemEvents.levelUp(userId, previousLevel, currentLevel));
        }

        // 3. Check for boss defeat
        if (raidCleared) {
            await emit(SystemEvents.bossDefeated(userId));
        }

        // 4. Check completion rate thresholds
        if (completionRate === 100) {
            await emit(SystemEvents.allTasksDone(userId, user?.totalXP || 0));
        } else if (completionRate > 0 && completionRate < 50) {
            await emit(SystemEvents.weakProgress(userId, completionRate));
        }

        // 5. Check for full habit completion (all subtasks done)
        if (completed) {
            const habitEntries = allEntries.filter(
                (e) => e.habitId.toString() === habitId && e.completed
            );
            const habitSubtaskCount = await Subtask.countDocuments({ habitId });
            if (habitEntries.length >= habitSubtaskCount && habitSubtaskCount > 0) {
                await emit(SystemEvents.taskCompleted(userId, habitId, habit.title, totalXP));
            }
        }

        // 6. Check discipline score
        if ((user?.disciplineScore || 50) >= 75) {
            await emit(SystemEvents.disciplineImprovement(userId, user?.disciplineScore || 75));
        }
    } catch (eventError: any) {
        console.error("[Event Bus] Non-fatal event processing error:", eventError.message);
    }

    // Log Behavior Snapshot (non-blocking)
    try {
        const user = await User.findById(userId).lean();
        const questsCompleted2 = allEntries.filter(e => e.completed).length;
        const weakHabits = allHabits
            .filter(h => {
                const entries = allEntries.filter(e => e.habitId.toString() === h._id.toString());
                const completedCount = entries.filter(e => e.completed).length;
                return entries.length > 0 && completedCount / entries.length < 0.5;
            })
            .map(h => h.title);
        const strongHabits = allHabits
            .filter(h => {
                const entries = allEntries.filter(e => e.habitId.toString() === h._id.toString());
                const completedCount = entries.filter(e => e.completed).length;
                return entries.length > 0 && completedCount / entries.length >= 0.8;
            })
            .map(h => h.title);

        await BehaviorLog.findOneAndUpdate(
            { userId, date },
            {
                $set: {
                    tasksCompleted: questsCompleted2,
                    tasksFailed: allEntries.filter(e => !e.completed).length,
                    totalTasks: totalTasks,
                    completionRate,
                    streakStatus: user?.currentStreak || 0,
                    xpEarned: totalXP,
                    disciplineScore: user?.disciplineScore || 50,
                    focusScore: user?.focusScore || 50,
                    weakHabits,
                    strongHabits
                }
            },
            { upsert: true }
        );

        // Track consecutive completions for difficulty scaling
        if (completed && completionRate === 100) {
            await incrementConsecutiveCompletion(habitId);
        }
    } catch (behaviorError: any) {
        console.error("[Behavior Log] Non-fatal error:", behaviorError.message);
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

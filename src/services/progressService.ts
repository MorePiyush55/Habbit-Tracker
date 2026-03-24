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
import { calculateQuestCompletion, calculateRequiredXpForLevel, getHunterRankLetter, QuestDifficulty } from "@/lib/game-engine/engine";
import BehaviorLog from "@/models/BehaviorLog";
import { Difficulty } from "@/types";
import { emit, createEvent, SystemEvents } from "@/lib/core/eventBus";

export const DAILY_MINIMUM_REQUIRED = 3;
export const LATE_WINDOW_HOURS = 8;
export const LATE_XP_MULTIPLIER = 0.7;
export const BACKLOG_XP_MULTIPLIER = 0.7;
export const RECOVERY_XP_MULTIPLIER = 0.5;

export type CompletionType = "normal" | "late" | "backlog" | "recovery";

type ToggleOptions = {
    completionType?: CompletionType;
    xpMultiplier?: number;
    sourceDate?: string | null;
};

function getDateOnlyString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00`);
}

function getYesterday(date: string): string {
    const base = parseDateOnly(date);
    base.setDate(base.getDate() - 1);
    return getDateOnlyString(base);
}

function getLateWindowDeadline(todayDate: string): Date {
    const start = parseDateOnly(todayDate);
    start.setHours(LATE_WINDOW_HOURS, 0, 0, 0);
    return start;
}

function isBeforeOrAt(date: Date, deadline: Date): boolean {
    return date.getTime() <= deadline.getTime();
}

function normalizeId(value: { toString(): string } | string | undefined): string {
    if (!value) return "";
    return typeof value === "string" ? value : value.toString();
}

export async function getTodayProgress(userId: string, date: string) {
    await connectDB();

    let dailyProgress = await DailyProgress.findOne({ userId, date }).lean();
    if (!dailyProgress) {
        dailyProgress = await DailyProgress.create({
            userId,
            date,
            totalXP: 0,
            completionRate: 0,
            bossDefeated: false,
            isLocked: false,
            lateEditAllowedUntil: getLateWindowDeadline(date),
        });
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
            const isBacklog = Boolean(mainEntry?.sourceDate) && mainEntry?.completionType === "backlog";
            return {
                _id: habit._id.toString(),
                title: habit.title,
                category: habit.category,
                rank: habit.rank || "E",
                difficulty: habit.difficulty,
                xpReward: habit.xpReward,
                order: habit.order,
                isDaily: habit.isDaily ?? false,
                deadline: habit.deadline ? habit.deadline.toISOString() : undefined,
                subtasks: [],
                completionPercent: isCompleted ? 100 : 0,
                isFullyCompleted: isCompleted,
                completionType: mainEntry?.completionType || "normal",
                sourceDate: mainEntry?.sourceDate || null,
                isBacklog,
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
                completionType: (entry?.completionType as CompletionType | undefined) || "normal",
                sourceDate: entry?.sourceDate || null,
            };
        });

        const completedCount = subtasksWithProgress.filter((s) => s.completed).length;
        const totalCount = subtasksWithProgress.length;
        const completionPercent = Math.round((completedCount / totalCount) * 100);
        const isFullyCompleted = completionPercent === 100;
        const hasBacklogSubtask = subtasksWithProgress.some(
            (s) => s.completionType === "backlog" && Boolean(s.sourceDate)
        );

        return {
            _id: habit._id.toString(),
            title: habit.title,
            category: habit.category,
            rank: habit.rank || "E",
            difficulty: habit.difficulty,
            xpReward: habit.xpReward,
            order: habit.order,
            isDaily: habit.isDaily ?? false,
            deadline: habit.deadline ? habit.deadline.toISOString() : undefined,
            subtasks: subtasksWithProgress,
            completionPercent,
            isFullyCompleted,
            completionType: hasBacklogSubtask ? "backlog" : "normal",
            sourceDate: hasBacklogSubtask ? subtasksWithProgress.find((s) => s.sourceDate)?.sourceDate || null : null,
            isBacklog: hasBacklogSubtask,
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

export async function getYesterdayReview(userId: string, todayDate: string, now: Date = new Date()) {
    await connectDB();

    const yesterdayDate = getYesterday(todayDate);
    const lateDeadline = getLateWindowDeadline(todayDate);
    const canLateFix = isBeforeOrAt(now, lateDeadline);

    const habits = await Habit.find({ userId, isActive: true, isDaily: true })
        .select({ _id: 1, title: 1 })
        .lean<Array<{ _id: { toString(): string }; title: string }>>();

    const entries = await ProgressEntry.find({ userId, date: yesterdayDate, completed: true })
        .select({ habitId: 1 })
        .lean<Array<{ habitId?: { toString(): string } | string }>>();

    const completedHabitIds = new Set(entries.map((entry) => normalizeId(entry.habitId)).filter(Boolean));
    const unresolvedHabits = habits.filter((habit) => !completedHabitIds.has(habit._id.toString()));

    return {
        date: yesterdayDate,
        canLateFix,
        lateEditAllowedUntil: lateDeadline,
        unresolvedCount: unresolvedHabits.length,
        unresolvedHabits: unresolvedHabits.map((habit) => ({
            habitId: habit._id.toString(),
            title: habit.title,
        })),
    };
}

async function evaluateAndSecureYesterdayStreak(userId: string, todayDate: string, yesterdayDate: string) {
    const user = await User.findById(userId);
    if (!user) return { secured: false };

    const yesterdayCompleted = await ProgressEntry.countDocuments({
        userId,
        date: yesterdayDate,
        completed: true,
    });

    const backlogPending = await ProgressEntry.countDocuments({
        userId,
        date: todayDate,
        completionType: "backlog",
        sourceDate: yesterdayDate,
        completed: false,
    });

    if (yesterdayCompleted >= DAILY_MINIMUM_REQUIRED && backlogPending === 0) {
        if (user.streakSecuredDate !== yesterdayDate) {
            user.streakSecuredDate = yesterdayDate;
        }

        if (user.lastCompletedDate !== yesterdayDate) {
            const { newStreak } = calculateStreak(user.lastCompletedDate, yesterdayDate, user.currentStreak);
            user.currentStreak = newStreak;
            user.longestStreak = Math.max(user.longestStreak, newStreak);
            user.lastCompletedDate = yesterdayDate;
        }

        await user.save();
        return { secured: true, currentStreak: user.currentStreak };
    }

    return { secured: false, currentStreak: user.currentStreak };
}

export async function lateCompleteYesterdayTask(
    userId: string,
    todayDate: string,
    habitId: string,
    subtaskId?: string | null,
    now: Date = new Date()
) {
    const review = await getYesterdayReview(userId, todayDate, now);
    if (!review.canLateFix) {
        throw new Error("LATE_WINDOW_EXPIRED: Late completion window is closed for yesterday.");
    }

    const yesterdayDate = review.date;
    const result = await toggleSubtaskProgress(
        userId,
        yesterdayDate,
        habitId,
        subtaskId || null,
        true,
        {
            completionType: "late",
            xpMultiplier: LATE_XP_MULTIPLIER,
            sourceDate: yesterdayDate,
        }
    );

    const streakStatus = await evaluateAndSecureYesterdayStreak(userId, todayDate, yesterdayDate);
    return {
        ...result,
        appliedMultiplier: LATE_XP_MULTIPLIER,
        streakSecured: streakStatus.secured,
        currentStreak: streakStatus.currentStreak,
        date: yesterdayDate,
    };
}

export async function convertYesterdayMissesToBacklog(userId: string, todayDate: string) {
    await connectDB();
    const yesterdayDate = getYesterday(todayDate);
    const review = await getYesterdayReview(userId, todayDate);

    if (review.unresolvedCount === 0) {
        return { converted: 0, backlogDate: todayDate, sourceDate: yesterdayDate };
    }

    let todayProgress = await DailyProgress.findOne({ userId, date: todayDate });
    if (!todayProgress) {
        todayProgress = await DailyProgress.create({
            userId,
            date: todayDate,
            totalXP: 0,
            completionRate: 0,
            bossDefeated: false,
            isLocked: false,
        });
    }

    let converted = 0;
    for (const unresolved of review.unresolvedHabits) {
        const habitId = unresolved.habitId;
        const subtasks = await Subtask.find({ habitId }).select({ _id: 1 }).lean<Array<{ _id: { toString(): string } }>>();

        if (subtasks.length === 0) {
            const existing = await ProgressEntry.findOne({ userId, date: todayDate, habitId, subtaskId: null });
            if (!existing) {
                await ProgressEntry.create({
                    dailyProgressId: todayProgress._id,
                    userId,
                    date: todayDate,
                    habitId,
                    subtaskId: null,
                    completed: false,
                    xpEarned: 0,
                    completionType: "backlog",
                    sourceDate: yesterdayDate,
                });
                converted += 1;
            }
            continue;
        }

        for (const subtask of subtasks) {
            const existing = await ProgressEntry.findOne({
                userId,
                date: todayDate,
                habitId,
                subtaskId: subtask._id,
            });
            if (!existing) {
                await ProgressEntry.create({
                    dailyProgressId: todayProgress._id,
                    userId,
                    date: todayDate,
                    habitId,
                    subtaskId: subtask._id,
                    completed: false,
                    xpEarned: 0,
                    completionType: "backlog",
                    sourceDate: yesterdayDate,
                });
                converted += 1;
            }
        }
    }

    return { converted, backlogDate: todayDate, sourceDate: yesterdayDate };
}

export async function toggleSubtaskProgress(
    userId: string,
    date: string,
    habitId: string,
    subtaskId: string | null,
    completed: boolean,
    options: ToggleOptions = {}
) {
    await connectDB();

    // Ensure daily progress exists
    let dailyProgress = await DailyProgress.findOne({ userId, date });
    if (!dailyProgress) {
        dailyProgress = await DailyProgress.create({
            userId,
            date,
            totalXP: 0,
            completionRate: 0,
            bossDefeated: false,
            isLocked: false,
            lateEditAllowedUntil: getLateWindowDeadline(date),
        });
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

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Phase 13.3 — Daily Snapshot Freeze
    if (!completed && user.dailySnapshotLocked && user.dailySnapshotDate === date) {
        throw new Error("SNAPSHOT_LOCKED: Your stats for today are frozen because the daily minimum was secured.");
    }

    let isWeakestStat = false;
    if (user.stats && habit.primaryStat) {
        const statsObj = user.stats as Record<string, { value: number; xp: number }>;
        const primaryStatValue = statsObj[habit.primaryStat]?.value || 10;
        const allValues = Object.values(statsObj).map(s => s.value || 10);
        const minStat = Math.min(...allValues);
        if (primaryStatValue === minStat) {
            isWeakestStat = true;
        }
    }

    const { totalXP: calculatedXP, totalGold, statXPGained } = calculateQuestCompletion(
        (habit.rank || "E") as QuestDifficulty,
        user.currentStreak || 0,
        isWeakestStat
    );

    const multiplier = options.xpMultiplier ?? 1;
    const completionType = options.completionType;
    const sourceDateProvided = options.sourceDate !== undefined;

    const subtaskCount = await Subtask.countDocuments({ habitId });
    const xpPerSubtaskBase = subtaskCount > 0 ? Math.floor(calculatedXP / subtaskCount) : calculatedXP;
    const xpPerSubtask = Math.floor(xpPerSubtaskBase * multiplier);
    const goldPerSubtask = subtaskCount > 0 ? Math.floor(totalGold / subtaskCount) : totalGold;
    const statXpPerSubtask = subtaskCount > 0 ? Math.floor(statXPGained / subtaskCount) : statXPGained;

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
    let goldDelta = 0;
    let statXpDelta = 0;
    let backlogSourceForStreak: string | null = null;

    if (existingEntry) {
        const wasCompleted = existingEntry.completed;
        existingEntry.completed = completed;
        existingEntry.xpEarned = completed ? xpPerSubtask : 0;
        existingEntry.completionType = completionType || existingEntry.completionType || "normal";
        if (sourceDateProvided) {
            existingEntry.sourceDate = options.sourceDate;
        }
        await existingEntry.save();

        if (completed && existingEntry.completionType === "backlog" && existingEntry.sourceDate) {
            backlogSourceForStreak = String(existingEntry.sourceDate);
        }

        if (completed && !wasCompleted) {
            xpDelta = xpPerSubtask;
            goldDelta = goldPerSubtask;
            statXpDelta = statXpPerSubtask;
        } else if (!completed && wasCompleted) {
            xpDelta = -xpPerSubtask;
            goldDelta = -goldPerSubtask;
            statXpDelta = -statXpPerSubtask;
        }
    } else {
        await ProgressEntry.create({
            dailyProgressId: dailyProgress._id,
            userId,
            date,
            habitId,
            subtaskId: subtaskId || undefined,
            completed,
            xpEarned: completed ? xpPerSubtask : 0,
            completionType: completionType || "normal",
            sourceDate: sourceDateProvided ? options.sourceDate : null,
        });
        if (completed) {
            xpDelta = xpPerSubtask;
            goldDelta = goldPerSubtask;
            statXpDelta = statXpPerSubtask;
        }
    }

    // Update user XP, Gold, Stats, and Boss Raid HP
    let raidCleared = false;
    if (xpDelta !== 0) {
        user.totalXP = Math.max(0, user.totalXP + xpDelta);
        user.gold = Math.max(0, (user.gold || 0) + goldDelta);

        // Update Specific Stat XP
        if (habit.primaryStat && user.stats && user.stats[habit.primaryStat]) {
            user.stats[habit.primaryStat].xp = Math.max(0, user.stats[habit.primaryStat].xp + statXpDelta);
            
            // 100 Stat XP = 1 Stat Value Point
            while (user.stats[habit.primaryStat].xp >= 100) {
                user.stats[habit.primaryStat].xp -= 100;
                user.stats[habit.primaryStat].value += 1;
            }
        }

        // Phase 5: Weekly Boss Raid Damage Logic
        if (xpDelta > 0 && !user.bossDefeatedThisWeek) {
            user.weeklyBossHP = Math.max(0, (user.weeklyBossHP || 500) - xpDelta);

            // Check if Boss is defeated (HP drained AND 5 day streak maintained)
            if (user.weeklyBossHP === 0 && user.currentStreak >= 5) {
                user.bossDefeatedThisWeek = true;
                raidCleared = true;
                user.totalXP += 300; // Boss XP Reward
                user.gold += 100; // Boss Gold Reward
            }
        } else if (xpDelta < 0 && !user.bossDefeatedThisWeek) {
            // If they uncheck a task, boss regains HP
            user.weeklyBossHP = Math.min(500, (user.weeklyBossHP || 500) - xpDelta);
        }

        // Check for Global Level Up using new curve
        let newLevel = user.level || 1;
        while (user.totalXP >= calculateRequiredXpForLevel(newLevel + 1)) {
            newLevel++;
            user.statPoints = (user.statPoints || 0) + 3; // +3 stat points per level
        }
        user.level = newLevel;
        user.hunterRank = getHunterRankLetter(newLevel) + "-Class";
        
        // Ensure changes to stats subdocument are recorded
        user.markModified('stats');
        await user.save();
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

    if (backlogSourceForStreak) {
        await evaluateAndSecureYesterdayStreak(userId, date, backlogSourceForStreak);
    }

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

export async function processTakeDamage(userId: string, damageAmount: number) {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const maxHp = user.maxHp || 100;
    user.hp = Math.max(0, (user.hp ?? 100) - damageAmount);

    let systemPurged = false;

    // The System Purge (Death Penalty)
    if (user.hp <= 0) {
        systemPurged = true;
        user.hp = maxHp;
        
        // Lose 1 Level (minimum Level 1)
        user.level = Math.max(1, (user.level || 1) - 1);
        user.hunterRank = getHunterRankLetter(user.level) + "-Class";
        
        // XP resets to the base of their current level
        user.totalXP = calculateRequiredXpForLevel(user.level);
        
        // Lose 50% Gold
        user.gold = Math.floor((user.gold || 0) / 2);
    }

    await user.save();

    // Emit event for UI to catch
    if (systemPurged) {
        await emit(createEvent("SYSTEM_PURGE" as any, userId, { 
            message: "HP depleted. The System has purged your recent progress. Level down.",
            hp: maxHp, 
            level: user.level 
        }));
    } else {
        await emit(createEvent("DAMAGE_TAKEN" as any, userId, { 
            damage: damageAmount, 
            remainingHp: user.hp 
        }));
    }

    return { 
        hp: user.hp, 
        maxHp: user.maxHp, 
        systemPurged,
        level: user.level,
        gold: user.gold
    };
}

export async function getProgressHistory(userId: string, days: number = 30) {
    await connectDB();
    return DailyProgress.find({ userId })
        .sort({ date: -1 })
        .limit(days)
        .lean();
}


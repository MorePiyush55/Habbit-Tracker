import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import User from "@/models/User";
import { DEFAULT_TASKS } from "@/lib/defaultTasks";
import { emit, SystemEvents } from "@/lib/core/eventBus";

// Canonical XP per rank — single source of truth
const RANK_XP: Record<string, number> = {
    E: 10, D: 20, C: 35, B: 55, A: 80, S: 120
};

function xpForRank(rank?: string): number {
    return RANK_XP[rank || "E"] ?? 10;
}

export async function getHabits(userId: string) {
    await connectDB();
    const habits = await Habit.find({ userId, isActive: true }).sort({ order: 1 }).lean();
    const habitsWithSubtasks = await Promise.all(
        habits.map(async (habit) => {
            const subtasks = await Subtask.find({ habitId: habit._id }).sort({ order: 1 }).lean();
            return { ...habit, _id: habit._id.toString(), subtasks: subtasks.map(s => ({ ...s, _id: s._id.toString(), habitId: s.habitId.toString() })) };
        })
    );
    return habitsWithSubtasks;
}

export async function createHabit(userId: string, data: {
    title: string;
    category: string;
    rank?: string;
    primaryStat?: string;
    xpReward?: number;
    order?: number;
    subtasks?: string[];
    deadline?: string;
    linkedGoalId?: string;
    isDaily?: boolean;
}) {
    await connectDB();

    // Calculate total subtasks for deeper Phase 5 tracking
    const totalSubtasksCount = data.subtasks ? data.subtasks.length : 0;

    const habit = await Habit.create({
        userId,
        title: data.title,
        category: data.category,
        rank: data.rank || "E",
        primaryStat: data.primaryStat || "STR",
        xpReward: xpForRank(data.rank), // Always derive from rank
        order: data.order || 0,
        isActive: true,
        isDaily: data.isDaily ?? true,
        totalSubtasks: totalSubtasksCount,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        linkedGoalId: data.linkedGoalId || undefined
    });

    if (data.subtasks && data.subtasks.length > 0) {
        const subtaskDocs = data.subtasks.map((title, index) => ({
            habitId: habit._id,
            title,
            order: index,
        }));
        await Subtask.insertMany(subtaskDocs);
    }

    // Emit HABIT_CREATED event into the AI Discipline OS
    try {
        await emit(SystemEvents.habitCreated(userId, habit._id.toString(), data.title));
    } catch { /* non-blocking */ }

    return habit;
}

export async function seedDefaultTasks(userId: string) {
    await connectDB();

    // Phase 6 Restriction: Only seed defaults for the specific user.
    const user = await User.findById(userId).lean();
    if (!user || user.email !== "piyushmore5553@gmail.com") {
        return false;
    }

    const existingCount = await Habit.countDocuments({ userId });
    if (existingCount > 0) return false; // Already seeded

    for (const task of DEFAULT_TASKS) {
        await createHabit(userId, task);
    }
    return true;
}

export async function updateHabit(habitId: string, data: Partial<{
    title: string;
    category: string;
    rank: string;
    primaryStat: string;
    xpReward: number;
    order: number;
    isActive: boolean;
    isDaily: boolean;
    deadline: string | null;
    subtasks: string[];
}>) {
    await connectDB();

    // Extract subtasks separately — they live in a different collection
    const { subtasks: newSubtasks, deadline, ...habitFields } = data;

    // Convert deadline string to Date or unset it
    const updateFields: Record<string, unknown> = { ...habitFields };
    if (deadline !== undefined) {
        updateFields.deadline = deadline ? new Date(deadline) : null;
    }

    // Auto-derive xpReward from rank whenever rank is being updated
    if (data.rank) {
        updateFields.xpReward = xpForRank(data.rank);
    }

    const habit = await Habit.findByIdAndUpdate(habitId, updateFields, { new: true }).lean();

    // If subtasks were provided, replace them
    if (newSubtasks !== undefined) {
        await Subtask.deleteMany({ habitId });
        if (newSubtasks.length > 0) {
            const subtaskDocs = newSubtasks.map((title, index) => ({
                habitId,
                title,
                order: index,
            }));
            await Subtask.insertMany(subtaskDocs);
        }
        // Update totalSubtasks on the habit
        await Habit.findByIdAndUpdate(habitId, { totalSubtasks: newSubtasks.length });
    }

    return habit;
}

export async function deleteHabit(habitId: string, userId?: string) {
    await connectDB();
    await Subtask.deleteMany({ habitId });
    const result = await Habit.findByIdAndDelete(habitId);

    // Emit HABIT_DELETED event into the AI Discipline OS
    if (userId) {
        try {
            await emit(SystemEvents.habitDeleted(userId, habitId));
        } catch { /* non-blocking */ }
    }

    return result;
}

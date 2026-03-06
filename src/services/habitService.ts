import connectDB from "@/lib/mongodb";
import Habit from "@/models/Habit";
import Subtask from "@/models/Subtask";
import { DEFAULT_TASKS } from "@/lib/defaultTasks";

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
    difficulty: string;
    xpReward: number;
    order?: number;
    subtasks?: string[];
    deadline?: string;
    linkedGoalId?: string;
}) {
    await connectDB();

    // Calculate total subtasks for deeper Phase 5 tracking
    const totalSubtasksCount = data.subtasks ? data.subtasks.length : 0;

    const habit = await Habit.create({
        userId,
        title: data.title,
        category: data.category,
        difficulty: data.difficulty,
        xpReward: data.xpReward,
        order: data.order || 0,
        isActive: true,
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

    return habit;
}

export async function seedDefaultTasks(userId: string) {
    await connectDB();
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
    difficulty: string;
    xpReward: number;
    order: number;
    isActive: boolean;
}>) {
    await connectDB();
    return Habit.findByIdAndUpdate(habitId, data, { new: true }).lean();
}

export async function deleteHabit(habitId: string) {
    await connectDB();
    await Subtask.deleteMany({ habitId });
    return Habit.findByIdAndDelete(habitId);
}

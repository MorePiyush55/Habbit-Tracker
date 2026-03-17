import { z } from "zod";

export const habitSchema = z.object({
    title: z.string().min(1, "Title is required"),
    category: z.string().min(1, "Category is required"),
    rank: z.enum(["E", "D", "C", "B", "A", "S"]),
    primaryStat: z.enum(["STR", "VIT", "INT", "AGI", "PER", "CHA"]),
    xpReward: z.number().optional(),
    order: z.number().optional(),
    isActive: z.boolean().optional(),
    subtasks: z.array(z.string()).optional(),
    deadline: z.string().optional(),
    linkedGoalId: z.string().optional(),
    isDaily: z.boolean().optional(),
});

const subtaskSchema = z.object({
    title: z.string().min(1, "Title is required"),
    order: z.number().optional(),
});

const progressEntrySchema = z.object({
    habitId: z.string().min(1),
    subtaskId: z.string().optional(),
    completed: z.boolean(),
});

export const toggleProgressSchema = z.object({
    habitId: z.string().min(1),
    subtaskId: z.string().optional(),
    completed: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

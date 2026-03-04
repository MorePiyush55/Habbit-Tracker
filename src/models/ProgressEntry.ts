import mongoose, { Schema, models } from "mongoose";

const ProgressEntrySchema = new Schema({
    dailyProgressId: { type: Schema.Types.ObjectId, ref: "DailyProgress", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    habitId: { type: Schema.Types.ObjectId, ref: "Habit", required: true },
    subtaskId: { type: Schema.Types.ObjectId, ref: "Subtask" },
    completed: { type: Boolean, default: false },
    xpEarned: { type: Number, default: 0 },
});

ProgressEntrySchema.index({ userId: 1, date: 1 });
ProgressEntrySchema.index({ dailyProgressId: 1 });
ProgressEntrySchema.index({ habitId: 1 });

export default models.ProgressEntry || mongoose.model("ProgressEntry", ProgressEntrySchema);

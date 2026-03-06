import mongoose, { Schema, models } from "mongoose";

const BehaviorLogSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        date: { type: String, required: true },
        tasksCompleted: { type: Number, default: 0 },
        tasksFailed: { type: Number, default: 0 },
        totalTasks: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 },
        streakStatus: { type: Number, default: 0 },
        xpEarned: { type: Number, default: 0 },
        penaltiesReceived: { type: Number, default: 0 },
        disciplineScore: { type: Number, default: 50 },
        focusScore: { type: Number, default: 50 },
        weakHabits: [{ type: String }],
        strongHabits: [{ type: String }]
    },
    { timestamps: true }
);

BehaviorLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export default models.BehaviorLog || mongoose.model("BehaviorLog", BehaviorLogSchema);

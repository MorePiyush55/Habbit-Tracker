import mongoose, { Schema, models } from "mongoose";

const SystemEventSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        eventType: {
            type: String,
            enum: ["TASK_FAILED", "STREAK_BROKEN", "GOAL_COMPLETED", "WEAK_PROGRESS", "BOSS_DEFEATED", "LEVEL_UP", "ALL_TASKS_DONE", "SKILL_DEGRADATION", "INACTIVITY_WARNING", "DISCIPLINE_IMPROVEMENT"],
            required: true
        },
        message: { type: String, required: true },
        context: { type: String, default: "" },
        read: { type: Boolean, default: false },
        date: { type: String, required: true }
    },
    { timestamps: true }
);

SystemEventSchema.index({ userId: 1, date: 1 });

export default models.SystemEvent || mongoose.model("SystemEvent", SystemEventSchema);

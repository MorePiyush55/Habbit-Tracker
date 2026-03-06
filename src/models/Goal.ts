import mongoose, { Schema, models } from "mongoose";

const GoalSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true },
        deadline: { type: Date },
        progress: { type: Number, default: 0 },
        linkedHabits: [{ type: Schema.Types.ObjectId, ref: "Habit" }],
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

GoalSchema.index({ userId: 1, isActive: 1 });

export default models.Goal || mongoose.model("Goal", GoalSchema);

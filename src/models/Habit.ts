import mongoose, { Schema, models } from "mongoose";

const HabitSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true },
        category: { type: String, required: true },
        difficulty: { type: String, enum: ["small", "medium", "hard"], required: true },
        xpReward: { type: Number, required: true },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

HabitSchema.index({ userId: 1, order: 1 });

export default models.Habit || mongoose.model("Habit", HabitSchema);

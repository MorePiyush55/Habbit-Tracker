import mongoose, { Schema, models } from "mongoose";

const GeneratedQuestSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true },
        category: { type: String, required: true },
        difficulty: { type: String, enum: ["small", "medium", "hard"], default: "medium" },
        subtasks: [{ type: String }],
        reason: { type: String, default: "" },
        xpReward: { type: Number, default: 25 },
        accepted: { type: Boolean, default: false },
        rejected: { type: Boolean, default: false },
        date: { type: String, required: true }
    },
    { timestamps: true }
);

GeneratedQuestSchema.index({ userId: 1, date: 1 });

export default models.GeneratedQuest || mongoose.model("GeneratedQuest", GeneratedQuestSchema);

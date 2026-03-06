import mongoose, { Schema, models } from "mongoose";

const LearningPathSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true },
        totalSections: { type: Number, required: true },
        completedSections: { type: Number, default: 0 },
        weakTopics: [{ type: String }],
        masteredTopics: [{ type: String }],
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

LearningPathSchema.index({ userId: 1, isActive: 1 });

export default models.LearningPath || mongoose.model("LearningPath", LearningPathSchema);

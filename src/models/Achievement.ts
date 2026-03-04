import mongoose, { Schema, models } from "mongoose";

const AchievementSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    category: { type: String, default: "general" },
    unlocked: { type: Boolean, default: false },
    unlockedAt: { type: Date },
});

AchievementSchema.index({ userId: 1, title: 1 }, { unique: true });

export default models.Achievement || mongoose.model("Achievement", AchievementSchema);

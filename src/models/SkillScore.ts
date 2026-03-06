import mongoose, { Schema, models } from "mongoose";

const SkillScoreSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        skill: { type: String, required: true },
        category: { type: String, required: true },
        score: { type: Number, default: 0, min: 0, max: 100 },
        testsCompleted: { type: Number, default: 0 },
        correctAnswers: { type: Number, default: 0 },
        lastTested: { type: Date, default: null },
        trend: { type: String, enum: ["improving", "stable", "declining"], default: "stable" }
    },
    { timestamps: true }
);

SkillScoreSchema.index({ userId: 1, skill: 1 }, { unique: true });

export default models.SkillScore || mongoose.model("SkillScore", SkillScoreSchema);

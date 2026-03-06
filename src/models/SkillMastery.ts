import mongoose, { Schema, models } from "mongoose";

/**
 * Skill Mastery — Tracks how well a user understands each skill over time.
 *
 * Unlike SkillScore (which tracks test performance), SkillMastery tracks
 * the HOLISTIC understanding of a skill combining:
 *   - Task completion in related habits
 *   - Quiz/test results
 *   - Practice consistency
 *   - Time spent studying
 *   - Decay when inactive
 *
 * Formula:
 *   mastery = (quizScore * 0.4) + (practiceCompletion * 0.3) +
 *             (studyConsistency * 0.2) + (recencyBonus * 0.1)
 */
const SkillMasterySchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        skillId: { type: String, required: true },        // e.g. "cryptography"
        name: { type: String, required: true },            // e.g. "Cryptography"
        category: { type: String, default: "general" },

        // Core mastery score
        mastery: { type: Number, default: 0, min: 0, max: 100 },
        previousMastery: { type: Number, default: 0 },    // for trend detection
        trend: {
            type: String,
            enum: ["improving", "stable", "declining"],
            default: "stable",
        },
        confidence: { type: Number, default: 0, min: 0, max: 100 }, // system confidence in score

        // Component scores
        quizScore: { type: Number, default: 0, min: 0, max: 100 },
        practiceCompletion: { type: Number, default: 0, min: 0, max: 100 },
        studyConsistency: { type: Number, default: 0, min: 0, max: 100 },

        // Activity tracking
        totalStudyMinutes: { type: Number, default: 0 },
        sessionsCompleted: { type: Number, default: 0 },
        testsCompleted: { type: Number, default: 0 },
        correctAnswers: { type: Number, default: 0 },
        lastPracticed: { type: Date, default: null },
        lastTested: { type: Date, default: null },
        streakDays: { type: Number, default: 0 },         // consecutive days practiced

        // Decay tracking
        daysSinceLastPractice: { type: Number, default: 0 },
        decayApplied: { type: Boolean, default: false },   // was decay applied on last check

        // Linked knowledge nodes
        linkedNodeIds: [{ type: String }],                 // KnowledgeNode nodeIds

        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

SkillMasterySchema.index({ userId: 1, skillId: 1 }, { unique: true });
SkillMasterySchema.index({ userId: 1, mastery: 1 });
SkillMasterySchema.index({ userId: 1, trend: 1 });

export default models.SkillMastery || mongoose.model("SkillMastery", SkillMasterySchema);

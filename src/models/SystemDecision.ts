import mongoose, { Schema, models } from "mongoose";

const SystemDecisionSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        decisionType: {
            type: String,
            enum: [
                "QUEST_GENERATION", "DAILY_STRATEGY", "DIFFICULTY_SCALE",
                "PENALTY_ISSUED", "SKILL_TEST", "BEHAVIOR_ANALYSIS",
                "BOSS_ADJUSTMENT", "INACTIVITY_CHECK", "EVENT_TRIGGERED"
            ],
            required: true
        },
        reason: { type: String, required: true },
        context: { type: Schema.Types.Mixed, default: {} },
        result: { type: Schema.Types.Mixed, default: {} },
        date: { type: String, required: true }
    },
    { timestamps: true }
);

SystemDecisionSchema.index({ userId: 1, decisionType: 1 });
SystemDecisionSchema.index({ createdAt: -1 });

export default models.SystemDecision || mongoose.model("SystemDecision", SystemDecisionSchema);

import mongoose, { Schema, models } from "mongoose";

const SystemMemorySchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        // Weekly insights — summarized once per week
        weeklyInsights: {
            weakestHabit: { type: String, default: null },
            strongestHabit: { type: String, default: null },
            disciplineTrend: { type: String, default: "0%" },
            avgCompletion: { type: Number, default: 0 },
            consistencyScore: { type: Number, default: 0 },
            streakHealth: { type: String, enum: ["strong", "fragile", "broken"], default: "broken" },
            topInterventions: [{ type: String }],
            generatedAt: { type: Date, default: null },
        },
        // Last strategy text (to avoid regenerating daily)
        lastStrategy: {
            text: { type: String, default: "" },
            date: { type: String, default: "" },
            usedAI: { type: Boolean, default: false },
        },
        // Last intervention the system took
        lastIntervention: {
            type: { type: String, default: "" },
            reason: { type: String, default: "" },
            date: { type: String, default: "" },
            escalationLevel: { type: Number, default: 0 },
        },
        // Running personality calibration
        personalityCalibration: {
            responseStyle: { type: String, enum: ["cold", "balanced", "encouraging"], default: "cold" },
            interventionFrequency: { type: String, enum: ["aggressive", "moderate", "passive"], default: "moderate" },
        },
        // AI decision log summary (compressed — keeps last 50)
        recentDecisionsSummary: [
            {
                decision: { type: String },
                confidence: { type: Number },
                reason: { type: String },
                date: { type: String },
            },
        ],
        // Skill graph snapshot
        skillGraphSnapshot: {
            categories: [
                {
                    name: { type: String },
                    skills: [
                        {
                            skill: { type: String },
                            score: { type: Number },
                            trend: { type: String },
                        },
                    ],
                },
            ],
            lastUpdated: { type: Date, default: null },
        },
        // Metrics tracking
        metrics: {
            totalAICalls: { type: Number, default: 0 },
            totalDirectivesExecuted: { type: Number, default: 0 },
            totalEventsProcessed: { type: Number, default: 0 },
            aiErrorCount: { type: Number, default: 0 },
            lastActivityDate: { type: String, default: "" },
            sessionCount: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

SystemMemorySchema.index({ userId: 1 }, { unique: true });

export default models.SystemMemory || mongoose.model("SystemMemory", SystemMemorySchema);

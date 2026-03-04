import mongoose, { Schema, models } from "mongoose";

const WeeklyReportSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    week: { type: String, required: true }, // YYYY-Wnn
    strongHabits: [{ type: String }],
    weakHabits: [{ type: String }],
    suggestions: [{ type: String }],
    report: { type: String, default: "" },
    totalXP: { type: Number, default: 0 },
    avgCompletion: { type: Number, default: 0 },
    generatedAt: { type: Date, default: Date.now },
});

WeeklyReportSchema.index({ userId: 1, week: 1 }, { unique: true });

export default models.WeeklyReport || mongoose.model("WeeklyReport", WeeklyReportSchema);

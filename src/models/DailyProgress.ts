import mongoose, { Schema, models } from "mongoose";

const DailyProgressSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    totalXP: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }, // 0-100
    bossDefeated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

DailyProgressSchema.index({ userId: 1, date: 1 }, { unique: true });

export default models.DailyProgress || mongoose.model("DailyProgress", DailyProgressSchema);

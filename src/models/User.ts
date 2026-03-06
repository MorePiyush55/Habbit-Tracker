import mongoose, { Schema, models } from "mongoose";

const UserSchema = new Schema(
    {
        googleId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        photo: { type: String, default: "" },
        level: { type: Number, default: 1 },
        totalXP: { type: Number, default: 0 },
        currentStreak: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        lastCompletedDate: { type: String, default: "" },

        // Phase 5: Long-Term Analytics
        disciplineScore: { type: Number, default: 50 },  // Ranges 0-100
        focusScore: { type: Number, default: 50 },
        skillGrowthScore: { type: Number, default: 50 },
        hunterRank: { type: String, default: "E-Class" }, // Evaluated weekly

        // Boss Raid variables
        weeklyBossHP: { type: Number, default: 500 },
        bossDefeatedThisWeek: { type: Boolean, default: false }
    },
    { timestamps: true }
);

export default models.User || mongoose.model("User", UserSchema);

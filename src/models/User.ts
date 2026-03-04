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
    },
    { timestamps: true }
);

export default models.User || mongoose.model("User", UserSchema);

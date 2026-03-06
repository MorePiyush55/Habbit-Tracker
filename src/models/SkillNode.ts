import mongoose, { Schema, models } from "mongoose";

const SkillNodeSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        skill: { type: String, required: true },
        category: { type: String, required: true },
        relatedSkills: [{ type: String }],
        difficulty: { type: Number, default: 1, min: 1, max: 5 },
        linkedHabitId: { type: Schema.Types.ObjectId, ref: "Habit", default: null },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

SkillNodeSchema.index({ userId: 1, category: 1 });
SkillNodeSchema.index({ userId: 1, skill: 1 }, { unique: true });

export default models.SkillNode || mongoose.model("SkillNode", SkillNodeSchema);

import mongoose, { Schema, models } from "mongoose";

const RewardSchema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        cost: { type: Number, required: true, min: 1 },
        type: { type: String, enum: ["system_item", "custom_reward"], required: true },
        effect: { type: String, default: "none" } // Used by system items like 'heal_50'
    },
    { timestamps: true }
);

export default models.Reward || mongoose.model("Reward", RewardSchema);

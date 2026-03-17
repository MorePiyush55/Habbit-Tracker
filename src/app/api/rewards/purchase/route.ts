import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Reward from "@/models/Reward";

// System Items mapping (Must match the GET route)
const SYSTEM_ITEMS_MAP: Record<string, any> = {
    "sys_item_potion_small": { cost: 100, effect: "heal_50" },
    "sys_item_potion_large": { cost: 250, effect: "heal_max" }
};

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { rewardId, type } = body;

        if (!rewardId || !type) {
            return Response.json({ error: "Missing reward ID or type" }, { status: 400 });
        }

        await connectDB();
        const userId = (session.user as any).id || session.user.email;
        const user = await User.findById(userId);

        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        let cost = 0;
        let effect = "none";

        // 1. Identify Cost and Effect
        if (type === "system_item") {
            const sysItem = SYSTEM_ITEMS_MAP[rewardId];
            if (!sysItem) return Response.json({ error: "Invalid system item" }, { status: 400 });
            cost = sysItem.cost;
            effect = sysItem.effect;
        } else if (type === "custom_reward") {
            const customReward = await Reward.findOne({ _id: rewardId, userId });
            if (!customReward) return Response.json({ error: "Custom reward not found" }, { status: 404 });
            cost = customReward.cost;
            effect = customReward.effect;
        } else {
            return Response.json({ error: "Unknown reward type" }, { status: 400 });
        }

        // 2. Validate Funds
        if ((user.gold || 0) < cost) {
            return Response.json({ error: "Not enough gold" }, { status: 400 });
        }

        // 3. Apply Transaction
        user.gold -= cost;

        // 4. Apply Effects (e.g., Potions)
        if (effect === "heal_50") {
            user.hp = Math.min(user.maxHp || 100, (user.hp || 100) + 50);
        } else if (effect === "heal_max") {
            user.hp = user.maxHp || 100;
        }

        await user.save();

        return Response.json({
            success: true,
            gold: user.gold,
            hp: user.hp,
            maxHp: user.maxHp,
            message: `Successfully purchased reward.`
        });

    } catch (error: any) {
        console.error("Purchase error:", error.message);
        return Response.json({ error: "Failed to process purchase" }, { status: 500 });
    }
}

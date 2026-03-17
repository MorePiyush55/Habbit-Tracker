import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import Reward from "@/models/Reward";

// Hardcoded System Items to be sold in the Black Market
const SYSTEM_ITEMS = [
    {
        _id: "sys_item_potion_small",
        title: "Elixir of Life (Small)",
        description: "Restores 50 HP immediately.",
        cost: 100,
        type: "system_item",
        effect: "heal_50"
    },
    {
        _id: "sys_item_potion_large",
        title: "Elixir of Life (Large)",
        description: "Restores HP to maximum.",
        cost: 250,
        type: "system_item",
        effect: "heal_max"
    }
];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const userId = (session.user as any).id || session.user.email;

        // Fetch user's custom rewards
        const customRewards = await Reward.find({ userId }).sort({ createdAt: -1 }).lean();

        // Return both System Items and Custom Rewards
        return Response.json({
            systemItems: SYSTEM_ITEMS,
            customRewards
        });
    } catch (error: any) {
        console.error("Error fetching rewards:", error.message);
        return Response.json({ error: "Failed to fetch rewards" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, cost } = body;

        if (!title || !cost || cost < 1) {
            return Response.json({ error: "Invalid reward data" }, { status: 400 });
        }

        await connectDB();
        const userId = (session.user as any).id || session.user.email;
        const newReward = await Reward.create({
            userId,
            title,
            description: description || "",
            cost: Number(cost),
            type: "custom_reward",
            effect: "none"
        });

        return Response.json(newReward);
    } catch (error: any) {
        console.error("Error creating reward:", error.message);
        return Response.json({ error: "Failed to create reward" }, { status: 500 });
    }
}

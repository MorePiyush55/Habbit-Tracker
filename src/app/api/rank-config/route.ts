import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { handleError, unauthorized } from "@/lib/apiError";
import { DEFAULT_RANKS } from "@/lib/rankConfig";

/** GET /api/rank-config — returns the user's saved rank configs (or defaults) */
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();
        const user = await User.findById(userId).select("rankConfigs").lean();
        if (!user) return unauthorized();

        const configs =
            Array.isArray((user as any).rankConfigs) && (user as any).rankConfigs.length > 0
                ? (user as any).rankConfigs
                : DEFAULT_RANKS;

        return Response.json({ configs });
    } catch (error) {
        return handleError(error);
    }
}

/** PUT /api/rank-config — saves custom rank configs for the user */
export async function PUT(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const { configs } = body;

        if (!Array.isArray(configs) || configs.length === 0) {
            return Response.json({ error: "Invalid configs" }, { status: 400 });
        }

        await connectDB();
        await User.findByIdAndUpdate(userId, { $set: { rankConfigs: configs } });

        return Response.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}

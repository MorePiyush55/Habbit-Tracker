import { getUserId } from "@/lib/auth";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import SystemEvent from "@/models/SystemEvent";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const { searchParams } = new URL(req.url);
        const unreadOnly = searchParams.get("unread") === "true";

        const filter: any = { userId };
        if (unreadOnly) filter.read = false;

        const events = await SystemEvent.find(filter)
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return Response.json({ events });
    } catch (error) {
        return handleError(error);
    }
}

// Mark events as read
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { eventIds } = await req.json();
        if (!eventIds || !Array.isArray(eventIds)) {
            return Response.json({ error: "eventIds required" }, { status: 400 });
        }

        await connectDB();

        await SystemEvent.updateMany(
            { _id: { $in: eventIds }, userId },
            { $set: { read: true } }
        );

        return Response.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}

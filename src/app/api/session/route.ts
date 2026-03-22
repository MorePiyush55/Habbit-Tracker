import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { handleError, unauthorized } from "@/lib/apiError";

/** GET /api/session — returns current session state, auto-expires if overtime */
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();
        const user = await User.findById(userId).select("session").lean();
        if (!user) return unauthorized();

        const session = (user as any).session || { active: false };

        // Auto-expire: if session started and time elapsed >= duration
        if (session.active && session.startedAt) {
            const elapsedMinutes = (Date.now() - new Date(session.startedAt).getTime()) / 60000;
            if (elapsedMinutes >= (session.durationMinutes || 60)) {
                // Auto-end and award XP
                const completedCount = session.completedTasksDuringSession || 0;
                const bonusXP = Math.min(completedCount * 15, 150); // 15 XP per task, cap 150

                await User.findByIdAndUpdate(userId, {
                    $set: { "session.active": false },
                    $inc: { totalXP: bonusXP },
                });

                return Response.json({
                    active: false,
                    autoEnded: true,
                    completedTasks: completedCount,
                    bonusXP,
                    message: `Session auto-ended. +${bonusXP} XP earned!`,
                });
            }
        }

        return Response.json({
            active: session.active || false,
            startedAt: session.startedAt || null,
            completedTasksDuringSession: session.completedTasksDuringSession || 0,
            durationMinutes: session.durationMinutes || 60,
        });
    } catch (error) {
        return handleError(error);
    }
}

/** POST /api/session — start or end a session */
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const { action, durationMinutes } = body; // action: "start" | "end"

        await connectDB();
        const user = await User.findById(userId);
        if (!user) return unauthorized();

        if (action === "start") {
            user.session = {
                active: true,
                startedAt: new Date(),
                completedTasksDuringSession: 0,
                durationMinutes: durationMinutes || 60,
            };
            user.markModified("session");
            await user.save();
            return Response.json({ success: true, action: "started", startedAt: user.session.startedAt });
        }

        if (action === "end") {
            const completedCount = user.session?.completedTasksDuringSession || 0;
            const bonusXP = Math.min(completedCount * 15, 150);

            user.totalXP = (user.totalXP || 0) + bonusXP;
            user.session = {
                active: false,
                startedAt: null,
                completedTasksDuringSession: 0,
                durationMinutes: 60,
            };
            user.markModified("session");
            await user.save();

            return Response.json({
                success: true,
                action: "ended",
                completedTasks: completedCount,
                bonusXP,
                totalXP: user.totalXP,
            });
        }

        return Response.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return handleError(error);
    }
}

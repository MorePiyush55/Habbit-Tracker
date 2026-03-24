import { getUserId } from "@/lib/auth";
import { badRequest, handleError, unauthorized } from "@/lib/apiError";
import { lateCompleteSchema } from "@/lib/validation";
import { lateCompleteYesterdayTask } from "@/services/progressService";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const parsed = lateCompleteSchema.safeParse(body);
        if (!parsed.success) {
            return badRequest(parsed.error.issues[0].message);
        }

        const result = await lateCompleteYesterdayTask(
            userId,
            parsed.data.date,
            parsed.data.habitId,
            parsed.data.subtaskId || null
        );

        return Response.json(result);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("LATE_WINDOW_EXPIRED")) {
            return Response.json({ error: "Late completion window is closed", locked: true }, { status: 403 });
        }
        return handleError(error);
    }
}

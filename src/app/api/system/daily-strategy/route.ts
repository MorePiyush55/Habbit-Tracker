import { getUserId } from "@/lib/auth";
import { systemDecision } from "@/lib/ai/systemBrain";
import { handleError, unauthorized } from "@/lib/apiError";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const strategy = await systemDecision(userId, "DAILY_STRATEGY", {});

        return Response.json({ strategy });
    } catch (error) {
        return handleError(error);
    }
}

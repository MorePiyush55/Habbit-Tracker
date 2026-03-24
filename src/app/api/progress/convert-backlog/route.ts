import { getUserId } from "@/lib/auth";
import { badRequest, handleError, unauthorized } from "@/lib/apiError";
import { convertBacklogSchema } from "@/lib/validation";
import { convertYesterdayMissesToBacklog } from "@/services/progressService";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const parsed = convertBacklogSchema.safeParse(body);
        if (!parsed.success) {
            return badRequest(parsed.error.issues[0].message);
        }

        const result = await convertYesterdayMissesToBacklog(userId, parsed.data.date);
        return Response.json(result);
    } catch (error) {
        return handleError(error);
    }
}

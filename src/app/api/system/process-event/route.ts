/**
 * Process Event API — Manually emit events into the AI Discipline OS
 * Used for:
 *   - Session start (UI loads)
 *   - Daily reset (cron or manual)
 *   - Custom events
 */
import { getUserId } from "@/lib/auth";
import { emit, SystemEvents, createEvent } from "@/lib/core/eventBus";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import type { SystemEventType } from "@/types";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { eventType, payload } = await req.json();
        if (!eventType) return badRequest("eventType is required");

        // Map convenience names to actual events
        let event;
        switch (eventType as string) {
            case "SESSION_START":
                event = SystemEvents.sessionStart(userId);
                break;
            case "DAILY_RESET":
                event = SystemEvents.dailyReset(userId);
                break;
            default:
                event = createEvent(eventType as SystemEventType, userId, payload || {});
        }

        const result = await emit(event);

        return Response.json({
            success: true,
            event: eventType,
            directives: result?.directives.length || 0,
            notifications: result?.notifications || [],
            metadata: result?.metadata || {},
        });
    } catch (error) {
        return handleError(error);
    }
}

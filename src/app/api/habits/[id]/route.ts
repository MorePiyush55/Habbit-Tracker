import { getUserId } from "@/lib/auth";
import { updateHabit, deleteHabit } from "@/services/habitService";
import { handleError, unauthorized } from "@/lib/apiError";
import { NextRequest } from "next/server";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { id } = await context.params;
        const body = await req.json();
        const habit = await updateHabit(id, body);
        return Response.json({ habit });
    } catch (error) {
        return handleError(error);
    }
}

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { id } = await context.params;
        await deleteHabit(id, userId);
        return Response.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}

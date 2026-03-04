import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateHabit, deleteHabit } from "@/services/habitService";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { NextRequest } from "next/server";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    return user?._id?.toString() || null;
}

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
        await deleteHabit(id);
        return Response.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

/**
 * Gets the current user's MongoDB _id from the session.
 * If the user doesn't exist in MongoDB yet (e.g., DB was down during sign-in),
 * it auto-creates the user document.
 */
export async function getUserId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;

    await connectDB();

    // Try to find existing user
    let user = await User.findOne({ email: session.user.email });

    // Auto-create if not found (handles case where DB was down during sign-in)
    if (!user) {
        const googleId = (session.user as Record<string, unknown>).googleId as string || session.user.email;
        user = await User.create({
            googleId,
            name: session.user.name || "Hunter",
            email: session.user.email,
            photo: session.user.image || "",
            level: 1,
            totalXP: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastCompletedDate: "",
        });
    }

    return user._id.toString();
}

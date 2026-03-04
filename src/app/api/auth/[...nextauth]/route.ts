import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google") {
                try {
                    await connectDB();
                    const existingUser = await User.findOne({ googleId: account.providerAccountId });
                    if (!existingUser) {
                        await User.create({
                            googleId: account.providerAccountId,
                            name: user.name || "Hunter",
                            email: user.email || "",
                            photo: user.image || "",
                            level: 1,
                            totalXP: 0,
                            currentStreak: 0,
                            longestStreak: 0,
                            lastCompletedDate: "",
                        });
                    }
                } catch (error) {
                    console.error("Error during sign in (DB):", error);
                    // Don't block sign-in if DB fails — user creation will retry later
                }
            }
            return true;
        },
        async jwt({ token, account }) {
            if (account) {
                token.googleId = account.providerAccountId;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as Record<string, unknown>).googleId = token.googleId;
                try {
                    await connectDB();
                    const dbUser = await User.findOne({ googleId: token.googleId });
                    if (dbUser) {
                        (session.user as Record<string, unknown>).id = dbUser._id.toString();
                        (session.user as Record<string, unknown>).level = dbUser.level;
                        (session.user as Record<string, unknown>).totalXP = dbUser.totalXP;
                        (session.user as Record<string, unknown>).currentStreak = dbUser.currentStreak;
                        (session.user as Record<string, unknown>).longestStreak = dbUser.longestStreak;
                    }
                } catch (error) {
                    console.error("Error fetching user from DB:", error);
                }
            }
            return session;
        },
    },
    pages: {
        signIn: "/",
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

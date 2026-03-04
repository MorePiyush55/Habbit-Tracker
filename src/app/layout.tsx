import type { Metadata } from "next";
import AuthProvider from "@/contexts/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solo Leveling Habit Tracker",
  description:
    "Level up your life. Track habits, earn XP, defeat daily bosses, and climb the ranks from E-Rank Hunter to Shadow Monarch.",
  keywords: "habit tracker, solo leveling, productivity, gamification, discipline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a1a" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

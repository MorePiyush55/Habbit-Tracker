"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import SystemConsole from "@/components/system/SystemConsole";
import AppNav from "@/components/AppNav";

export default function ConsolePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") router.push("/");
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="loading-spinner" style={{ minHeight: "100vh" }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            <AppNav />
            <div className="console-page">
                <SystemConsole />
            </div>
        </div>
    );
}

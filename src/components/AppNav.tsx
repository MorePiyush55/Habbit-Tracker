"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, Terminal, Shield, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function AppNav() {
    const pathname = usePathname();

    return (
        <nav className="app-nav">
            <div className="nav-brand">
                <span className="nav-logo">⚔</span>
                <span className="nav-title">SOLO SYSTEM</span>
            </div>
            <div className="nav-links">
                <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
                    <LayoutDashboard size={16} />
                    Dashboard
                </Link>
                <Link href="/tasks" className={`nav-link ${pathname === "/tasks" ? "active" : ""}`}>
                    <CheckSquare size={16} />
                    Tasks
                </Link>
                <Link href="/console" className={`nav-link ${pathname === "/console" ? "active" : ""}`}>
                    <Terminal size={16} />
                    System Console
                </Link>
                <Link href="/profile" className={`nav-link ${pathname === "/profile" ? "active" : ""}`}>
                    <Shield size={16} />
                    Profile
                </Link>
            </div>
            <button
                className="nav-signout"
                onClick={() => signOut()}
                title="Sign Out"
            >
                <LogOut size={16} />
            </button>
        </nav>
    );
}

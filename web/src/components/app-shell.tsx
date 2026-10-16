"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string; global_name?: string | null } | null>(null);
  useEffect(() => { fetch("/api/auth/me").then((response) => response.json()).then((payload) => setUser(payload.user)).catch(() => undefined); }, []);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A2</div>
          <div>
            <div className="brand-name">AION 2 Announce</div>
            <div className="brand-subtitle">Instance control center</div>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav" aria-label="Primary navigation">
          <Link className={`nav-link ${pathname === "/" ? "active" : ""}`} href="/">
            <LayoutDashboard size={16} /> Overview
          </Link>
          <Link className={`nav-link ${pathname.startsWith("/settings") ? "active" : ""}`} href="/settings">
            <Settings2 size={16} /> Bot configuration
          </Link>
        </nav>
        <div className="sidebar-footer">{user && <div className="account"><div className="account-avatar">{(user.global_name || user.username).slice(0, 1).toUpperCase()}</div><div className="account-name">{user.global_name || user.username}</div><a href="/api/auth/logout" aria-label="Sign out"><LogOut size={13} /></a></div>}<a className="change-server" href="/select">Change server</a><span>Private control panel<br />for one bot instance</span></div>
      </aside>
      <main className="main"><div className="content">{children}</div></main>
    </div>
  );
}

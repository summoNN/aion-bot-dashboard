"use client";

import Link from "next/link";
import { LayoutDashboard, Settings2 } from "lucide-react";
import { usePathname } from "next/navigation";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
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
        <div className="sidebar-footer">Private control panel<br />for one bot instance</div>
      </aside>
      <main className="main"><div className="content">{children}</div></main>
    </div>
  );
}

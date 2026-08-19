"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Radio,
  Search,
  Settings,
  Shield,
  Sun,
  X,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; admin?: boolean };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/history", label: "Access history", icon: History },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/activity", label: "Activity log", icon: ClipboardList, admin: true },
      { href: "/events", label: "Webhook log", icon: Radio, admin: true },
      { href: "/settings", label: "Settings", icon: Settings, admin: true },
    ],
  },
];

const titles: Record<string, { crumb: string; title: string }> = {
  "/": { crumb: "Monitor", title: "Overview" },
  "/history": { crumb: "Monitor", title: "Access history" },
  "/alerts": { crumb: "Monitor", title: "Alerts" },
  "/activity": { crumb: "System", title: "Activity log" },
  "/events": { crumb: "System", title: "Webhook log" },
  "/settings": { crumb: "System", title: "Settings" },
};

export function AppShell({
  username,
  role,
  children,
}: {
  username: string;
  role: "admin" | "operator";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const page = titles[pathname] || { crumb: APP_NAME, title: "Overview" };

  useEffect(() => {
    const saved = localStorage.getItem("lockwatch-theme");
    const next = saved === "dark";
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("lockwatch-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/history?q=${encodeURIComponent(q)}` : "/history");
  }

  const initials = useMemo(() => username.slice(0, 2).toUpperCase(), [username]);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.admin || role === "admin"),
    }))
    .filter((group) => group.items.length > 0);

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-text-2 uppercase">{group.label}</p>
          ) : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-[8px] px-2.5 py-2 text-sm transition duration-150 ${
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-text-2 hover:bg-surface-2 hover:text-text"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <span className={`h-4 w-0.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-transparent"} ${collapsed ? "hidden" : ""}`} />
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg">
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-text/20 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-200 ${
          collapsed ? "w-[72px]" : "w-[248px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className={`flex h-14 items-center gap-2 border-b border-line px-3 ${collapsed ? "justify-center" : ""}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-white">
            <Shield className="h-4 w-4" />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{APP_NAME}</p>
              <p className="truncate text-[11px] text-text-2">{APP_TAGLINE}</p>
            </div>
          ) : null}
          <button
            className="ml-auto hidden h-8 w-8 items-center justify-center rounded-[8px] text-text-2 hover:bg-surface-2 lg:flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-[8px] text-text-2 hover:bg-surface-2 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {nav}
      </aside>

      <div className={`min-w-0 transition-[padding] duration-200 ${collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"}`}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-6">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-text-2 hover:bg-surface-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] text-text-2">
              {page.crumb} <span className="text-line">/</span> {page.title}
            </p>
            <p className="truncate text-sm font-semibold">{page.title}</p>
          </div>
          <form onSubmit={onSearch} className="relative mx-auto hidden max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users in history"
              className="input pl-9"
            />
          </form>
          <div className="relative ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-[8px] text-text-2 transition hover:bg-surface-2"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-[8px] py-1 pr-1 pl-2 text-sm transition hover:bg-surface-2"
            >
              <span className="hidden text-text-2 sm:inline">{username}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                {initials}
              </span>
            </button>
            {menuOpen ? (
              <div className="absolute top-11 right-0 w-48 rounded-[10px] border border-line bg-surface py-1 shadow-[var(--shadow)]">
                <p className="px-3 py-2 text-xs text-text-2">
                  Signed in as {username}
                  <span className="mt-1 block capitalize">{role}</span>
                </p>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { logout } from "@/app/(app)/actions";

type NavItem = { href: string; label: string; icon: string; managerOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "📊" },
      { href: "/pos", label: "Point of Sale", icon: "🧾" },
      { href: "/debtors", label: "Debtors", icon: "🪙" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/drugs", label: "Drugs", icon: "💊" },
      { href: "/stock", label: "Stock", icon: "📦" },
      { href: "/suppliers", label: "Suppliers", icon: "🚚", managerOnly: true },
    ],
  },
  {
    title: "Insights & Admin",
    items: [
      { href: "/reports", label: "Reports", icon: "📈" },
      { href: "/staff", label: "Staff", icon: "👥", managerOnly: true },
    ],
  },
];

export function Sidebar({
  role,
  name,
}: {
  role: "MANAGER" | "PHARMACIST";
  name: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden no-print">
        <span className="flex items-center gap-2 font-semibold">
          <span className="text-xl">💊</span> Pharmacy POS
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-1.5 text-2xl hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      <aside
        className={clsx(
          "no-print flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:sticky md:top-0 md:h-screen",
          open ? "block" : "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl shadow-sm">
            💊
          </div>
          <div>
            <p className="font-semibold leading-tight text-gray-900">Pharmacy POS</p>
            <p className="text-xs text-gray-400">Inventory & Sales</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {GROUPS.map((group) => {
            const items = group.items.filter(
              (i) => !i.managerOnly || role === "MANAGER",
            );
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-brand-50 text-brand-700"
                            : "text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r border-l-2 border-brand-600" />
                        )}
                        <span className="text-base">{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-400">
                {role === "MANAGER" ? "Manager" : "Pharmacist"}
              </p>
            </div>
          </div>
          <form action={logout}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">
              <span>⏏</span> Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

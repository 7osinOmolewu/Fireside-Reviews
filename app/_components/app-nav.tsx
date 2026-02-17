"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: "inbox" | "admin";
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  { label: "Reviews", href: "/reviews", icon: "inbox" },
  { label: "Admin", href: "/admin", icon: "admin", adminOnly: true },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ name }: { name: NavItem["icon"] }) {
  if (name === "inbox") {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
        <path
          d="M3.5 4.5h13v8h-3.2a3 3 0 0 1-2.7 1.7H9.4a3 3 0 0 1-2.7-1.7H3.5v-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M3.5 12.5l2.2-3h2.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
      <path
        d="M4.5 16V8.5h11V16M7 8.5V6.2A2.2 2.2 0 0 1 9.2 4h1.6A2.2 2.2 0 0 1 13 6.2v2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items = nav.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-orange-200/50 text-slate-900 ring-1 ring-inset ring-orange-200"
                : "text-slate-700 hover:bg-orange-100/40"
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

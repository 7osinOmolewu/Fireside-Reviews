"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "performance"
    | "admin"
    | "cycles"
    | "employees"
    | "assignments"
    | "jobFamilies"
    | "archives";
  adminOnly?: boolean;
};

type PendingReviewItem = {
  id: string;
  label: string;
  href: string;
};

const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/reviews", icon: "dashboard" },
  { label: "My Performance Review", href: "/employee", icon: "performance" },
  { label: "Admin", href: "/admin", icon: "admin", adminOnly: true },
];

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "admin", adminOnly: true },
  { label: "Job Families", href: "/admin/job-families", icon: "jobFamilies", adminOnly: true },
  { label: "Cycles", href: "/admin/cycles", icon: "cycles", adminOnly: true },
  { label: "Employees", href: "/admin/employees", icon: "employees", adminOnly: true },
  { label: "Review Operations", href: "/admin/assignments", icon: "assignments", adminOnly: true },
  { label: "Archives", href: "/admin/archives", icon: "archives", adminOnly: true },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ name }: { name: NavItem["icon"] }) {
  switch (name) {
    case "dashboard":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M4.75 4.75h4.5v4.5h-4.5v-4.5ZM10.75 4.75h4.5v6.5h-4.5v-6.5ZM4.75 10.75h4.5v4.5h-4.5v-4.5ZM10.75 13.25h4.5v2h-4.5v-2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "performance":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M4.75 15.25V10.5M8.25 15.25V7.75M11.75 15.25V9.25M15.25 15.25V5.75"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3.75 15.25h12.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case "admin":
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

    case "assignments":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M6 4.75h8M6 8.75h8M6 12.75h5M4.75 3.75h10.5a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "cycles":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M6 2.75v2.5M14 2.75v2.5M3.75 7h12.5M5.25 4.25h9.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-8.5a1.5 1.5 0 0 1 1.5-1.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "employees":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 16.25a5.5 5.5 0 0 1 11 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "jobFamilies":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M4.75 4.75h4.5v4.5h-4.5v-4.5ZM10.75 4.75h4.5v4.5h-4.5v-4.5ZM4.75 10.75h4.5v4.5h-4.5v-4.5ZM10.75 10.75h4.5v4.5h-4.5v-4.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "archives":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-600">
          <path
            d="M4.25 5.25h11.5v2.5H4.25v-2.5ZM5.25 7.75h9.5v7a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-7ZM8 10h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return null;
  }
}

function NavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
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
}

export function AppNav({
  isAdmin,
  pendingReviews = [],
}: {
  isAdmin: boolean;
  pendingReviews?: PendingReviewItem[];
}) {
  const pathname = usePathname();

  const topItems = primaryNav.filter((i) => !i.adminOnly || isAdmin);
  const showAdminSection = isAdmin && pathname.startsWith("/admin");

  return (
    <nav className="space-y-4">
      <div className="space-y-1">
        {topItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>

      {!showAdminSection ? (
        <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/80 p-2">
          <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Pending Reviews
          </div>

          {pendingReviews.length > 0 ? (
            <div className="space-y-1">
              {pendingReviews.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "block rounded-xl px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-orange-200/50 text-slate-900 ring-1 ring-inset ring-orange-200"
                        : "text-slate-700 hover:bg-orange-100/40"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-2 py-2 text-sm text-slate-500">
              No pending reviews
            </div>
          )}
        </div>
      ) : null}

      {showAdminSection ? (
        <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/80 p-2">
          <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Admin
          </div>
          <div className="space-y-1">
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
import Image from "next/image";
import Link from "next/link";
import { AppNav } from "./app-nav";
import { UserMenu } from "./user-menu";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function RolePill({ label }: { label: "Admin" | "Reviewer" | "Employee" }) {
  const tone =
    label === "Admin"
      ? "bg-slate-900 text-white ring-slate-900/10"
      : label === "Reviewer"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        tone
      )}
      title="Current role"
    >
      {label}
    </span>
  );
}

export function AppShell({
  children,
  isAuthenticated,
  userName,
  roleLabel,
  isAdmin,
}: {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  userName?: string | null;
  roleLabel: "Admin" | "Reviewer" | "Employee";
  isAdmin: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#fbf4ec] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-orange-100/60 bg-[#fff7f0]/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Image
              src="/brand/fireside-mark.png"
              alt="Fireside"
              width={26}
              height={26}
              priority
            />
            <span>Fireside Reviews</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated ? <RolePill label={roleLabel} /> : null}
            <UserMenu isAuthenticated={!!isAuthenticated} userName={userName ?? null} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-3 shadow-sm">
          <AppNav isAdmin={isAdmin} />
        </aside>

        <main className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/70 p-5 shadow-sm md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}

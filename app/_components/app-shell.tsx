import Image from "next/image";
import Link from "next/link";
import { AppNav } from "./app-nav";
import { UserMenu } from "./user-menu"; // keep if you’re using it now

export function AppShell({
  children,
  isAuthenticated,
  userName,
}: {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  userName?: string | null;
}) {
  return (
    <div className="min-h-screen bg-[#fbf4ec] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-orange-100/60 bg-[#fff7f0]/80 backdrop-blur">
        {/* ✅ was max-w-6xl; this is the main reason you had a ton of wasted space */}
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

          {/* ✅ replace “Signed in” with your dropdown */}
          <UserMenu isAuthenticated={!!isAuthenticated} userName={userName ?? null} />
        </div>
      </header>

      {/* ✅ was max-w-6xl; increase width + shift nav to RIGHT */}
      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-3 shadow-sm">
            <AppNav />
        </aside>
        <main className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/70 p-5 shadow-sm md:p-7">
        {children}
        </main>
      </div>
    </div>
  );
}

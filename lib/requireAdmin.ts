// lib/requireAdmin.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function requireAdmin() {
  const cookieStore = await cookies(); // ✅ MUST await in your setup

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!userData.user) throw new Error("Auth session missing");

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("id", userData.user.id)
    .single();

  if (profErr) throw new Error(profErr.message);
  if (profile.user_role !== "admin") throw new Error("Forbidden");

  return { userId: userData.user.id };
}

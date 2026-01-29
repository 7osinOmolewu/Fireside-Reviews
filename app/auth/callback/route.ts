// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Default redirect if something is off
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Ensure profile exists, but do NOT overwrite user_role if it already exists.
  // (Role source of truth is profiles.user_role, set by your invite/admin flows.)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("user_role, full_name")
    .eq("id", user.id)
    .single();

  const fullName =
    existingProfile?.full_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    null;

  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
        // NOTE: intentionally not setting user_role here
      },
      { onConflict: "id" }
    );

  if (upsertErr) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(upsertErr.message)}`, request.url)
    );
  }

  // Redirect based on profiles.user_role (truth)
  const role = existingProfile?.user_role ?? "employee";
  return NextResponse.redirect(new URL(role === "admin" ? "/admin" : "/", request.url));
}

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
   // 1) Read profile if it exists (don't throw if missing)
  const { data: existingProfile, error: existingErr } = await supabase
    .from("profiles")
    .select("user_role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(existingErr.message)}`, request.url)
    );
  }

  const fullName =
    existingProfile?.full_name ??
    (user.user_metadata as any)?.full_name ??
    (user.user_metadata as any)?.name ??
    user.email ??
    null;

  // 2) Upsert identity fields only (do NOT overwrite user_role)
  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
      },
      { onConflict: "id" }
    );

  if (upsertErr) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(upsertErr.message)}`, request.url)
    );
  }

  // 3) Re-fetch role AFTER upsert (authoritative)
  const { data: profileAfter, error: afterErr } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("id", user.id)
    .single();

  if (afterErr) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(afterErr.message)}`, request.url)
    );
  }

  const role = profileAfter?.user_role ?? "employee";

  // 4) Route by role
  const target =
    role === "admin" ? "/admin" : role === "reviewer" ? "/reviews" : "/employee";

  return NextResponse.redirect(new URL(target, request.url));
}

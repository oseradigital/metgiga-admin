import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Standard Supabase SSR session-refresh proxy (formerly "middleware" —
// renamed per this Next.js version, see node_modules/next/dist/docs/
// .../file-conventions/proxy.md). Without this, a Server Component's
// cookie-based client (lib/supabase/server.ts) can see a stale/expired
// access token, since nothing else in the request pipeline calls
// supabase.auth.getUser() to refresh it. Every route in this app depends
// on an authenticated session (there's no pre-auth/token-based phase like
// the client portal's onboarding links), so this runs everywhere.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshing the token is the point of this call — the return value
  // itself isn't used here (each page still checks auth for itself).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation — nothing there depends
    // on auth state, and running the refresh on every asset request
    // would be pure overhead.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

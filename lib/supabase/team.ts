import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: "owner" | "sales" | "account_manager" | "production";
  is_active: boolean;
};

// Being a valid Supabase Auth user is necessary but NOT sufficient for
// admin access — this app shares one Supabase project (and one
// auth.users table) with the client-facing onboarding portal, so an
// authenticated session alone doesn't tell you which audience it belongs
// to. Every protected page/action calls this and treats null exactly
// like "not signed in" — whether that's because there's no session at
// all, or because the session belongs to an account that was never added
// to crm.team_members (or was deactivated), or because a genuine error
// occurred. Fails closed in all three cases, deliberately: never throws
// out to a page that assumes a member exists.
// Wrapped in React's cache() so the layout's auth gate and a page's own
// call within the same request share one DB round trip instead of two.
export const getActiveTeamMember = cache(async (): Promise<TeamMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("crm")
    .from("team_members")
    .select("id, full_name, email, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    // Logged, not thrown — a real misconfiguration (or a future bug in
    // the crm.* RLS policies, as already happened once with an
    // infinite-recursion policy) should read as "not authorised" to the
    // page, not surface a 500 to an already-authenticated person.
    console.error("[getActiveTeamMember]", error.message);
    return null;
  }

  return data;
});

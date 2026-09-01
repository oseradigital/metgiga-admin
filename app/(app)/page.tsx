import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveTeamMember } from "@/lib/supabase/team";

export default async function AdminHome() {
  const member = await getActiveTeamMember();
  // The (app) layout already gates this route, so this should be
  // unreachable with member === null — but a bare `!` assertion crashing
  // with a raw TypeError instead of a clean redirect is exactly the kind
  // of "silent failure" this build's own standard rules out, and a dev-
  // mode fast-refresh artifact already showed this path can be hit in
  // practice. Redirect, don't assume.
  if (!member) redirect("/login");

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-2">
        Welcome, {member.full_name.split(" ")[0]}.
      </h1>
      <p className="text-sm text-grey-on-light mb-8">Release 1 — internal CRM.</p>

      <Link
        href="/organisations"
        className="block bg-bone rounded-2xl border border-midnight/10 shadow-[0_12px_30px_-18px_rgba(16,21,31,0.25)] p-6 sm:p-8 hover:border-midnight/20 transition-colors max-w-sm"
      >
        <p className="text-sm font-medium text-midnight mb-1">Organisations</p>
        <p className="text-sm text-grey-on-light">Clinics and businesses, prospect through client.</p>
      </Link>
    </div>
  );
}

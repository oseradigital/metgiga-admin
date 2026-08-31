import Link from "next/link";
import { getActiveTeamMember } from "@/lib/supabase/team";

export default async function AdminHome() {
  const member = await getActiveTeamMember();

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-2">
        {/* Layout already redirected if this were null — non-null here. */}
        Welcome, {member!.full_name.split(" ")[0]}.
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

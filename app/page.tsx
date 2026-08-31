import { redirect } from "next/navigation";
import { getActiveTeamMember } from "@/lib/supabase/team";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";

// The authenticated landing page — deliberately not a dashboard yet.
// Confirms the auth wiring actually works end to end (sign in -> land
// here as a verified crm.team_members row, not just a Supabase session)
// before any real CRM screen gets built on top of it.
export default async function AdminHome() {
  const member = await getActiveTeamMember();
  if (!member) redirect("/login");

  return (
    <main className="min-h-screen bg-bone-2 px-4 py-12">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <BrandMark className="w-7 h-7" />
          <LogoutButton />
        </div>

        <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-2">
          Signed in as {member.full_name}
        </h1>
        <p className="text-sm text-grey-on-light mb-8">
          {member.email} · {member.role}
        </p>

        <div className="bg-bone rounded-2xl border border-midnight/10 shadow-[0_12px_30px_-18px_rgba(16,21,31,0.25)] p-6 sm:p-8">
          <p className="text-sm text-grey-on-light leading-relaxed">
            Auth is wired up and confirmed working. Organisations, deals, the pipeline, and tasks
            are the next Release 1 pieces — not built yet.
          </p>
        </div>
      </div>
    </main>
  );
}

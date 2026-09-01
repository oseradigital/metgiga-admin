import { redirect } from "next/navigation";
import { getActiveTeamMember } from "@/lib/supabase/team";

export default async function ProfilePage() {
  const member = await getActiveTeamMember();
  // The (app) layout already gates this route — see app/(app)/page.tsx
  // for why this is a redirect, not a bare `!` assertion.
  if (!member) redirect("/login");

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl mb-6">Profile</h1>
      <div className="bg-bone rounded-xl border border-midnight/10 p-5">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Name</dt>
            <dd className="text-midnight">{member.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Email</dt>
            <dd className="text-midnight">{member.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Role</dt>
            <dd className="text-midnight capitalize">{member.role}</dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-grey-on-light mt-4">
        Editing your own profile isn&apos;t built yet — contact Saif or Abubakar directly for changes.
      </p>
    </div>
  );
}

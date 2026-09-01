import { listTeamMembers } from "@/lib/crm/team-members";

export default async function TeamPage() {
  const members = await listTeamMembers();

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl mb-6">Team</h1>
      <div className="bg-bone rounded-xl border border-midnight/10 divide-y divide-midnight/10">
        {members.map((m) => (
          <div key={m.id} className="px-5 py-3 text-sm text-midnight">
            {m.full_name}
          </div>
        ))}
      </div>
      <p className="text-xs text-grey-on-light mt-4">
        Adding new team members isn&apos;t self-service yet — ask Saif or Abubakar to add you directly.
      </p>
    </div>
  );
}

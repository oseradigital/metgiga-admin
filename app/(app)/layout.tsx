import { redirect } from "next/navigation";
import { getActiveTeamMember } from "@/lib/supabase/team";
import { AdminHeader } from "@/components/AdminHeader";

// The one place every authenticated route's access check lives — a page
// under here never needs to repeat the "am I an active team member"
// gate itself. getActiveTeamMember() is request-memoised (React cache),
// so a page that also calls it for its own data doesn't cost a second
// round trip.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getActiveTeamMember();
  if (!member) redirect("/login");

  return (
    <div className="min-h-screen bg-bone-2">
      <AdminHeader member={member} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

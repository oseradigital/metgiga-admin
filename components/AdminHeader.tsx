import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AccountMenu } from "@/components/AccountMenu";
import { NavLinks } from "@/components/NavLinks";
import type { TeamMember } from "@/lib/supabase/team";

// Shared chrome for every authenticated screen. Nav only lists what's
// actually built — new sections get added here when those screens
// exist, not before, so there's never a dead link.
export function AdminHeader({ member }: { member: TeamMember }) {
  return (
    <header className="border-b border-midnight/10 bg-bone">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="w-5 h-5" />
            <span className="font-display text-base">Metgiga Admin</span>
          </Link>
          <NavLinks />
        </div>
        <AccountMenu member={member} />
      </div>
    </header>
  );
}

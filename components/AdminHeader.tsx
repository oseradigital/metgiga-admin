import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";
import type { TeamMember } from "@/lib/supabase/team";

// Shared chrome for every authenticated screen. Nav only lists what's
// actually built — Deals/Tasks get added here when those screens exist,
// not before, so there's never a dead link.
export function AdminHeader({ member }: { member: TeamMember }) {
  return (
    <header className="border-b border-midnight/10 bg-bone">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="w-6 h-6" />
            <span className="font-display text-lg">Metgiga Admin</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            <Link href="/organisations" className="text-grey-on-light hover:text-midnight transition-colors">
              Organisations
            </Link>
            <Link href="/deals" className="text-grey-on-light hover:text-midnight transition-colors">
              Deals
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs text-grey-on-light">
            {member.full_name} · {member.role}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

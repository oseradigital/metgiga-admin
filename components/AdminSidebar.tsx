import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AccountMenu } from "@/components/AccountMenu";
import { NavLinks } from "@/components/NavLinks";
import type { TeamMember } from "@/lib/supabase/team";

// Replaces the old top AdminHeader (renamed from AdminHeader.tsx) —
// left sidebar per the founder-supplied mockup, explicitly approved to
// supersede the top-navy-bar design from the previous pass, not an
// incremental tweak of it. Same navy/bone/copper palette, just a
// different shape: full-height, brand + nav at top, account menu
// pinned to the bottom. Hidden below sm (matches the nav's own
// pre-existing mobile behaviour — nav links were already invisible
// below that breakpoint, this isn't a new mobile regression), replaced
// by a compact top bar with just the brand mark and account menu.
export function AdminSidebar({ member }: { member: TeamMember }) {
  return (
    <>
      <aside className="hidden sm:flex sm:flex-col sm:w-60 sm:shrink-0 sm:h-screen sm:sticky sm:top-0 bg-midnight border-r border-black/20">
        <div className="px-5 pt-6 pb-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="w-5 h-5 shrink-0" />
            <span className="font-display text-base text-bone leading-tight">Metgiga Admin</span>
          </Link>
        </div>
        <nav className="flex-1 px-3">
          <NavLinks />
        </nav>
        <div className="px-3 pb-4 border-t border-bone/10 pt-3">
          <AccountMenu member={member} placement="sidebar" />
        </div>
      </aside>

      {/* Mobile fallback — same navy/bone treatment, just horizontal and
          without the nav links (unchanged from the previous header's
          own mobile behaviour). */}
      <header className="sm:hidden border-b border-black/20 bg-midnight">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="w-5 h-5" />
            <span className="font-display text-base text-bone">Metgiga Admin</span>
          </Link>
          <AccountMenu member={member} placement="header" />
        </div>
      </header>
    </>
  );
}

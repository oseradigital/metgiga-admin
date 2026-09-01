"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TeamMember } from "@/lib/supabase/team";

// Two placements: "sidebar" (pinned to the bottom of the left nav —
// name/role stacked, per the approved mockup, dropdown opens upward
// since there's no room below it) and "header" (the mobile fallback top
// bar — compact single-line trigger, dropdown opens downward, same as
// the original top-header design).
export function AccountMenu({ member, placement = "header" }: { member: TeamMember; placement?: "sidebar" | "header" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const menu = (
    <div
      role="menu"
      className={`absolute w-44 bg-bone rounded-lg border border-midnight/10 shadow-[0_12px_30px_-18px_rgba(16,21,31,0.35)] py-1.5 z-10 ${
        placement === "sidebar" ? "left-0 bottom-full mb-2" : "right-0 top-full mt-2"
      }`}
    >
      <Link
        href="/profile"
        role="menuitem"
        onClick={() => setOpen(false)}
        className="block px-3.5 py-2 text-sm text-midnight hover:bg-midnight/5 transition-colors"
      >
        Profile
      </Link>
      <Link
        href="/team"
        role="menuitem"
        onClick={() => setOpen(false)}
        className="block px-3.5 py-2 text-sm text-midnight hover:bg-midnight/5 transition-colors"
      >
        Team
      </Link>
      <Link
        href="/settings"
        role="menuitem"
        onClick={() => setOpen(false)}
        className="block px-3.5 py-2 text-sm text-midnight hover:bg-midnight/5 transition-colors"
      >
        Settings
      </Link>
      <div className="my-1.5 border-t border-midnight/10" />
      <button
        type="button"
        role="menuitem"
        onClick={handleLogout}
        disabled={loggingOut}
        className="block w-full text-left px-3.5 py-2 text-sm text-midnight hover:bg-midnight/5 transition-colors disabled:opacity-50"
      >
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
    </div>
  );

  if (placement === "sidebar") {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-left hover:bg-bone/[0.06] transition-colors"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-bone truncate">{member.full_name}</span>
            <span className="block text-xs text-grey-on-dark capitalize">{member.role}</span>
          </span>
          <svg
            viewBox="0 0 12 8"
            width="10"
            height="7"
            fill="none"
            aria-hidden="true"
            className={`shrink-0 text-grey-on-dark transition-transform ${open ? "" : "rotate-180"}`}
          >
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open ? menu : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-grey-on-dark hover:text-bone transition-colors"
      >
        <span>
          {member.full_name} · {member.role}
        </span>
        <svg viewBox="0 0 12 8" width="10" height="7" fill="none" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? menu : null}
    </div>
  );
}

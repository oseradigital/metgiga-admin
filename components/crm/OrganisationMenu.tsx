"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Tab-independent quick actions for an organisation — right now just
// "Edit", but structured as a menu (not a bare button) since more items
// (archive, delete) are a reasonable future addition. Lets a typo get
// fixed from any tab in one click, not just after navigating to
// Overview first. Same dropdown pattern as AccountMenu.tsx.
export function OrganisationMenu({ organisationId }: { organisationId: string }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Organisation actions"
        className="size-7 rounded-md flex items-center justify-center text-grey-on-light hover:text-midnight hover:bg-midnight/5 transition-colors"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="2.5" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13.5" r="1.4" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-36 bg-bone rounded-lg border border-midnight/10 shadow-[0_12px_30px_-18px_rgba(16,21,31,0.35)] py-1.5 z-20"
        >
          <Link
            href={`/organisations/${organisationId}?tab=overview&edit=1`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-sm text-midnight hover:bg-midnight/5 transition-colors"
          >
            Edit
          </Link>
        </div>
      ) : null}
    </div>
  );
}

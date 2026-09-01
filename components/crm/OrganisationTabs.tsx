"use client";

import { useEffect, useState, type ReactNode } from "react";

const TABS = ["Overview", "Contacts", "Deals", "Tasks", "Onboarding", "Activity"] as const;
export type Tab = (typeof TABS)[number];

// All five panels are fetched and rendered server-side up front (the
// data volumes here are tiny — no reason to round-trip per tab click);
// this just controls which one is visible. Keeps switching instant and
// avoids a loading flicker on every click.
export function OrganisationTabs({ panels, initialTab }: { panels: Record<Tab, ReactNode>; initialTab?: Tab }) {
  const [active, setActive] = useState<Tab>(initialTab ?? "Overview");

  // Same reasoning as OrganisationEditor's startInEditMode effect:
  // useState(initialTab) only fires on first mount, and navigating here
  // via a Link that only changes ?tab= (same route segment) doesn't
  // remount this component, so the prop update needs an effect to
  // actually take.
  useEffect(() => {
    if (initialTab) setActive(initialTab);
    // Deliberately only reacts to initialTab, not every render — this
    // is a one-way sync from the URL, not a two-way binding that would
    // fight the user's own tab clicks afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-midnight/10 mb-4 -mx-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === tab
                ? "border-copper text-midnight"
                : "border-transparent text-grey-on-light hover:text-midnight"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {panels[active]}
    </div>
  );
}

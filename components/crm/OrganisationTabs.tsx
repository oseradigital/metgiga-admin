"use client";

import { useState, type ReactNode } from "react";

const TABS = ["Overview", "Contacts", "Deals", "Tasks", "Activity"] as const;
type Tab = (typeof TABS)[number];

// All five panels are fetched and rendered server-side up front (the
// data volumes here are tiny — no reason to round-trip per tab click);
// this just controls which one is visible. Keeps switching instant and
// avoids a loading flicker on every click.
export function OrganisationTabs({ panels }: { panels: Record<Tab, ReactNode> }) {
  const [active, setActive] = useState<Tab>("Overview");

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

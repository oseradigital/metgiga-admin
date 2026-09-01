"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ORGANISATION_STATUSES, type OrganisationListItem, type OrganisationStatus } from "@/lib/crm/organisation-types";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE: Record<OrganisationStatus, "neutral" | "copper" | "success"> = {
  prospect: "neutral",
  activating: "copper",
  active: "success",
  paused: "neutral",
  cancelled: "neutral",
  lost: "neutral",
};

// The explicit filter set from the spec — deliberately doesn't include
// "cancelled" as its own tab (only 5 named + All), even though it's a
// valid status; cancelled organisations still show up under "All".
const FILTERS: { label: string; value: "all" | OrganisationStatus }[] = [
  { label: "All", value: "all" },
  { label: "Prospect", value: "prospect" },
  { label: "Activating", value: "activating" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Lost", value: "lost" },
];

function formatMoney(value: number | null, currency: string) {
  if (value === null) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function matchesSearch(org: OrganisationListItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    org.name.toLowerCase().includes(q) ||
    (org.primaryContactName?.toLowerCase().includes(q) ?? false) ||
    (org.primaryContactEmail?.toLowerCase().includes(q) ?? false)
  );
}

export function OrganisationsTable({ organisations }: { organisations: OrganisationListItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrganisationStatus>("all");

  const searched = useMemo(() => organisations.filter((org) => matchesSearch(org, query)), [organisations, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: searched.length };
    for (const s of ORGANISATION_STATUSES) c[s] = 0;
    for (const org of searched) c[org.status] = (c[org.status] ?? 0) + 1;
    return c;
  }, [searched]);

  const visible = useMemo(
    () => (status === "all" ? searched : searched.filter((org) => org.status === status)),
    [searched, status],
  );

  // Truly empty (no organisations exist at all) vs. empty because of an
  // active search/filter — these need different messages, not the same
  // blank-page treatment.
  if (organisations.length === 0) {
    return (
      <div className="bg-bone rounded-xl border border-midnight/10 py-16 px-6 text-center">
        <p className="text-sm text-grey-on-light mb-4">
          No organisations yet — create your first organisation to begin building your pipeline.
        </p>
        <Link
          href="/organisations/new"
          className="inline-flex h-10 px-5 rounded-lg bg-midnight text-bone text-sm font-medium items-center hover:bg-midnight-2 transition-colors"
        >
          New organisation
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, contact, or email…"
          aria-label="Search organisations"
          className="h-9 px-3 rounded-md border border-midnight/15 bg-bone text-sm placeholder:text-grey-on-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:border-copper transition-colors w-full sm:w-72"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors ${
                status === f.value
                  ? "bg-midnight text-bone"
                  : "bg-midnight/5 text-grey-on-light hover:bg-midnight/10"
              }`}
            >
              {f.label} {counts[f.value] ?? 0}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-bone rounded-xl border border-midnight/10 py-12 px-6 text-center">
          <p className="text-sm text-grey-on-light">
            {/* Real bug found via Playwright, not just reviewed: this used
                to key off whether the search box had text, not whether the
                search itself found nothing. That meant a name that matched
                but got excluded by the active status filter still showed
                "No organisations match your search" — wrong message, since
                the search actually worked and the status filter was the
                actual reason. Keying off searched.length (pre-status-filter)
                fixes it. */}
            {query.trim() && searched.length === 0
              ? "No organisations match your search."
              : "No organisations in this status."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: a real table. */}
          <div className="hidden sm:block bg-bone rounded-xl border border-midnight/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-midnight/10 text-left">
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Organisation</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Primary contact</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Status</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Active deal</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium text-right">MRR</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((org) => (
                  <tr key={org.id} className="border-b border-midnight/10 last:border-b-0 hover:bg-midnight/[0.02]">
                    <td className="px-4 py-2.5">
                      <Link href={`/organisations/${org.id}`} className="text-midnight font-medium hover:underline">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-grey-on-light">{org.primaryContactName || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[org.status]}>{org.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-grey-on-light">
                      {org.activeDeal ? `${org.activeDeal.title} · ${org.activeDeal.stageLabel}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-midnight tabular-nums">
                      {org.activeDeal ? formatMoney(org.activeDeal.monthlyValue, org.activeDeal.currency) ?? "—" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: a compact stacked list, not a horizontally scrolled table. */}
          <ul className="sm:hidden space-y-2">
            {visible.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/organisations/${org.id}`}
                  className="block bg-bone rounded-xl border border-midnight/10 px-4 py-3 hover:border-midnight/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-midnight truncate">{org.name}</span>
                    <Badge tone={STATUS_TONE[org.status]}>{org.status}</Badge>
                  </div>
                  <p className="text-xs text-grey-on-light truncate">{org.primaryContactName || "No contact yet"}</p>
                  {org.activeDeal ? (
                    <p className="text-xs text-grey-on-light truncate mt-0.5">
                      {org.activeDeal.title} · {org.activeDeal.stageLabel}
                      {formatMoney(org.activeDeal.monthlyValue, org.activeDeal.currency)
                        ? ` · ${formatMoney(org.activeDeal.monthlyValue, org.activeDeal.currency)}`
                        : ""}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

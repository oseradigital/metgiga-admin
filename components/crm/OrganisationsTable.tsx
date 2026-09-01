"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ORGANISATION_STATUSES, type OrganisationListItem, type OrganisationStatus } from "@/lib/crm/organisation-types";
import { createTask } from "@/lib/crm/actions";
import { formatMoney, formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
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

function isOrgStatus(value: string): value is OrganisationStatus {
  return (ORGANISATION_STATUSES as readonly string[]).includes(value);
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

// The deal's package (e.g. "Full Funnel") is the name worth showing
// next to its stage — falls back to the deal's own title only if no
// package was set, rather than showing both.
function dealLabel(deal: NonNullable<OrganisationListItem["activeDeal"]>) {
  return `${deal.package || deal.title} · ${deal.stageLabel}`;
}

// Relative-time text with the exact timestamp on hover — a plain
// title attribute, not a custom tooltip component; native, accessible,
// and exactly "available on hover" as asked.
function LastActivity({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-grey-on-light/60">—</span>;
  return (
    <span title={formatDateTime(iso)} className="text-grey-on-light">
      {formatRelativeTime(iso)}
    </span>
  );
}

// Shows the next open task's title (+ due date if it has one), or —
// when there isn't one — a muted state with an inline one-field way to
// add one right there, without leaving the list. Wrapped in `relative
// z-10` by the caller so it sits above the row's full-width stretched
// link (see the table body below) and stays independently clickable.
function NextActionCell({ org }: { org: OrganisationListItem }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  if (org.nextAction) {
    return (
      <span className="text-grey-on-light">
        {org.nextAction.title}
        {org.nextAction.dueAt ? <span className="text-grey-on-light/70"> · {formatDate(org.nextAction.dueAt)}</span> : null}
      </span>
    );
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="text-grey-on-light/60 hover:text-copper-text transition-colors text-left"
      >
        No next action <span className="text-copper-text">+ Add</span>
      </button>
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const result = await createTask({ title, organisationId: org.id });
    setSaving(false);
    if (result.ok) {
      setTitle("");
      setAdding(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleAdd} className="flex items-center gap-1.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) setAdding(false);
        }}
        placeholder="Task title, Enter to add"
        className="h-7 px-2 rounded-md border border-midnight/15 bg-bone text-xs w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:border-copper"
        disabled={saving}
      />
    </form>
  );
}

export function OrganisationsTable({ organisations }: { organisations: OrganisationListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search/filter state lives in the URL (?q=&status=), not just
  // useState — a plain local-state version loses everything the moment
  // you navigate into an organisation and back, since that unmounts and
  // remounts this component. Reading the initial value from the URL and
  // writing every change back to it (via replace, not push, so typing
  // doesn't spam browser history) means the URL the user lands on when
  // they click into a row already carries the live state, so browser/
  // router "back" restores it for free.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState<"all" | OrganisationStatus>(() => {
    const s = searchParams.get("status");
    return s && isOrgStatus(s) ? s : "all";
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Deliberately excludes router/pathname from deps — including them
    // (both effectively stable, but Next.js returns new function/string
    // identities across renders) would re-run this on every navigation
    // rather than only on actual query/status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

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

  // Carried on every row link as ?from=, so the detail page's "←
  // Organisations" link returns to exactly this filtered/searched view
  // — see app/(app)/organisations/[id]/page.tsx. Empty when there's no
  // search/filter active, since plain "/organisations" already is that
  // view.
  const returnQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (status !== "all") qs.set("status", status);
    const s = qs.toString();
    return s ? `?from=${encodeURIComponent(`/organisations?${s}`)}` : "";
  }, [query, status]);

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
            {query.trim() && searched.length === 0
              ? "No organisations match your search."
              : "No organisations in this status."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: a real table. Each row is fully clickable via a
              stretched link — a Link absolutely positioned to cover the
              whole <tr> (relative), with sr-only text for its accessible
              name and the actually-visible name rendered as a separate,
              non-interactive span so it isn't doubled up for screen
              readers. Other interactive cells (Next action) sit in a
              `relative z-10` wrapper so they stay clickable above the
              z-0 stretched link instead of the row swallowing their
              clicks. */}
          <div className="hidden sm:block bg-bone rounded-xl border border-midnight/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-midnight/10 text-left">
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Organisation</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Primary contact</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Status</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Active deal</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Next action</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium">Last activity</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wide text-grey-on-light font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((org) => (
                  <tr
                    key={org.id}
                    className="group relative border-b border-midnight/10 last:border-b-0 hover:bg-midnight/[0.02] focus-within:bg-midnight/[0.02]"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/organisations/${org.id}${returnQuery}`}
                        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper/50"
                      >
                        <span className="sr-only">{org.name}</span>
                      </Link>
                      {/* pointer-events-none is load-bearing: without it
                          this span (painted after the Link in DOM order,
                          so it sits on top) swallows clicks landing
                          directly on the visible text, and the row stops
                          navigating exactly where a user is most likely
                          to click. Found by testing the click, not
                          assumed. */}
                      <span className="relative pointer-events-none text-midnight font-medium group-hover:underline">
                        {org.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-grey-on-light">{org.primaryContactName || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[org.status]}>{org.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-grey-on-light">{org.activeDeal ? dealLabel(org.activeDeal) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs relative z-10">
                      <NextActionCell org={org} />
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <LastActivity iso={org.lastActivityAt} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-midnight tabular-nums">
                      {org.activeDeal ? formatMoney(org.activeDeal.monthlyValue, org.activeDeal.currency) ?? "—" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: a compact card, not a squeezed table — organisation,
              status, contact, active deal/value, next action. Last
              activity is deliberately left off this card (shown on
              desktop only) to keep it to exactly those five things. */}
          <ul className="sm:hidden space-y-2">
            {visible.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/organisations/${org.id}${returnQuery}`}
                  className="block bg-bone rounded-xl border border-midnight/10 px-4 py-3 hover:border-midnight/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-midnight truncate">{org.name}</span>
                    <Badge tone={STATUS_TONE[org.status]}>{org.status}</Badge>
                  </div>
                  <p className="text-xs text-grey-on-light truncate">{org.primaryContactName || "No contact yet"}</p>
                  {org.activeDeal ? (
                    <p className="text-xs text-grey-on-light truncate mt-0.5">
                      {dealLabel(org.activeDeal)}
                      {formatMoney(org.activeDeal.monthlyValue, org.activeDeal.currency)
                        ? ` · ${formatMoney(org.activeDeal.monthlyValue, org.activeDeal.currency)}`
                        : ""}
                    </p>
                  ) : null}
                  <p className="text-xs text-grey-on-light/80 truncate mt-1.5">
                    {org.nextAction ? `Next: ${org.nextAction.title}` : "No next action"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

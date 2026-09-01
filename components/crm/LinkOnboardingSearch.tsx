"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchUnlinkedOnboardingRecordsAction, linkOnboardingRecord } from "@/lib/crm/onboarding-actions";
import type { UnlinkedOnboardingRecord } from "@/lib/crm/onboarding-types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";

// Shown on the Onboarding tab when no onboarding_records row is linked
// yet. Deliberately a search-and-link flow, not an auto-match — the
// portal doesn't collect anything guaranteed unique enough to safely
// auto-link (business names can collide, a client can fill in a
// different email than the one on the CRM contact), so a human
// confirms the match.
//
// This is the RECOVERY path, meant to stay — for onboarding records that
// predate this integration, or a client who somehow started onboarding
// without going through the CRM. It is NOT the intended normal path
// going forward: once Release 2's client-activation flow exists (an
// admin converts a won deal into a client, which generates the
// onboarding invite), that flow should set organisation_id itself at
// creation time, and most organisations should arrive on this tab
// already linked. Search & Link keeps working after that lands — for
// exactly the recovery cases above — it just stops being the common
// case.
export function LinkOnboardingSearch({ organisationId }: { organisationId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnlinkedOnboardingRecord[]>([]);
  const [searching, startSearch] = useTransition();
  const [linking, setLinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    // No synchronous setState here for the empty-query case — `results`
    // is only ever rendered via `displayResults` below, which already
    // treats an empty query as "nothing to show" without needing to
    // clobber state mid-effect.
    if (!q) return;
    const handle = setTimeout(() => {
      startSearch(async () => {
        const data = await searchUnlinkedOnboardingRecordsAction(q);
        setResults(data);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const displayResults = query.trim() ? results : [];

  async function handleLink(onboardingId: string) {
    setLinking(onboardingId);
    setError(null);
    const result = await linkOnboardingRecord(organisationId, onboardingId);
    setLinking(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      <p className="text-sm text-grey-on-light mb-4">
        No onboarding record is linked to this organisation yet. Search by business name or contact email to find one.
      </p>
      <Input
        placeholder="Search onboarding submissions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching ? <p className="text-sm text-grey-on-light mt-3">Searching…</p> : null}

      {!searching && query.trim() && displayResults.length === 0 ? (
        <p className="text-sm text-grey-on-light mt-3">No unlinked onboarding submissions match “{query.trim()}”.</p>
      ) : null}

      {displayResults.length > 0 ? (
        <ul className="mt-4 divide-y divide-midnight/10">
          {displayResults.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-midnight font-medium">{r.business_name || "(no business name yet)"}</p>
                <p className="text-xs text-grey-on-light">
                  {[r.primary_contact_name, r.primary_contact_email].filter(Boolean).join(" · ") || "No contact details yet"}
                  {" · started "}
                  {formatDate(r.created_at)}
                </p>
              </div>
              <Button variant="ghost" onClick={() => handleLink(r.id)} loading={linking === r.id}>
                Link
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-error mt-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateOrganisation } from "@/lib/crm/actions";
import { ORGANISATION_STATUSES, type Organisation, type OrganisationStatus } from "@/lib/crm/organisation-types";
import { formatMoney } from "@/lib/format";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

// The Overview tab: a compact summary (status/website/primary contact/
// active deal/value) with an inline edit form for the organisation's own
// fields (name/status/legal name/website/industry). Primary contact and
// active deal aren't editable from here — those come from the Contacts
// and Deals tabs respectively, this just reflects them.
export function OrganisationEditor({
  organisation,
  primaryContactName,
  activeDeal,
  startInEditMode = false,
}: {
  organisation: Organisation;
  primaryContactName: string | null;
  activeDeal: { title: string; package: string | null; stageLabel: string; monthlyValue: number | null; currency: string } | null;
  // Driven by ?edit=1 in the URL — the header's "Edit" menu item links
  // there directly (see app/(app)/organisations/[id]/page.tsx) so
  // fixing a typo works from any tab, not just after first clicking
  // into Overview.
  startInEditMode?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startInEditMode);

  // useState(startInEditMode) only applies on this component's first
  // mount — clicking the header's "•••" → Edit changes the URL
  // (?edit=1) but doesn't remount this component (same route segment,
  // only searchParams changed), so without this the prop update was
  // silently ignored and edit mode never actually opened. Found by
  // testing the click, not assumed: the URL was correct, the tab was
  // correct, but the read-only view stayed on screen.
  useEffect(() => {
    if (startInEditMode) setEditing(true);
  }, [startInEditMode]);
  const [name, setName] = useState(organisation.name);
  const [legalName, setLegalName] = useState(organisation.legal_name ?? "");
  const [website, setWebsite] = useState(organisation.website ?? "");
  const [industry, setIndustry] = useState(organisation.industry ?? "");
  const [status, setStatus] = useState<OrganisationStatus>(organisation.status);
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setNameError("Enter an organisation name.");
      document.getElementById("edit-name")?.focus();
      return;
    }
    setNameError(undefined);

    setSaving(true);
    const result = await updateOrganisation(organisation.id, { name, legalName, website, industry, status });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="bg-bone rounded-xl border border-midnight/10 p-5">
        <div className="flex items-center justify-end mb-3">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Website</dt>
            <dd className="text-midnight">
              {organisation.website ? (
                <a href={organisation.website} target="_blank" rel="noreferrer" className="text-copper-text hover:underline">
                  {organisation.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Primary contact</dt>
            <dd className="text-midnight">{primaryContactName || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Active deal</dt>
            <dd className="text-midnight">
              {activeDeal ? `${activeDeal.package || activeDeal.title} · ${activeDeal.stageLabel}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Potential / active value</dt>
            <dd className="text-midnight tabular-nums">
              {activeDeal ? formatMoney(activeDeal.monthlyValue, activeDeal.currency) ?? "—" : "—"}
            </dd>
          </div>
          {organisation.legal_name ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Legal name</dt>
              <dd className="text-midnight">{organisation.legal_name}</dd>
            </div>
          ) : null}
          {organisation.industry ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Industry</dt>
              <dd className="text-midnight">{organisation.industry}</dd>
            </div>
          ) : null}
          {organisation.source ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Lead source</dt>
              <dd className="text-midnight">{organisation.source}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-bone rounded-xl border border-midnight/10 p-5 space-y-4" noValidate>
      <Field label="Name" htmlFor="edit-name" required error={nameError}>
        <Input
          id="edit-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(undefined);
          }}
        />
      </Field>

      <Field label="Status" htmlFor="edit-status">
        <Select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as OrganisationStatus)}>
          {ORGANISATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Legal name" htmlFor="edit-legalName" optional>
        <Input id="edit-legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
      </Field>

      <Field label="Website" htmlFor="edit-website" optional>
        <Input id="edit-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </Field>

      <Field label="Industry" htmlFor="edit-industry" optional>
        <Input id="edit-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setError(null);
            setName(organisation.name);
            setLegalName(organisation.legal_name ?? "");
            setWebsite(organisation.website ?? "");
            setIndustry(organisation.industry ?? "");
            setStatus(organisation.status);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

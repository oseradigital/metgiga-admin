"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOrganisation } from "@/lib/crm/actions";
import { ORGANISATION_STATUSES, type Organisation, type OrganisationStatus } from "@/lib/crm/organisation-types";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE: Record<OrganisationStatus, "neutral" | "copper" | "success"> = {
  prospect: "neutral",
  activating: "copper",
  active: "success",
  paused: "neutral",
  cancelled: "neutral",
  lost: "neutral",
};

export function OrganisationEditor({ organisation }: { organisation: Organisation }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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
      <div className="bg-bone rounded-2xl border border-midnight/10 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-2">{organisation.name}</h1>
            <Badge tone={STATUS_TONE[organisation.status]}>{organisation.status}</Badge>
          </div>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Legal name</dt>
            <dd className="text-midnight">{organisation.legal_name || "—"}</dd>
          </div>
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
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Industry</dt>
            <dd className="text-midnight">{organisation.industry || "—"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-bone rounded-2xl border border-midnight/10 p-6 sm:p-8 space-y-5" noValidate>
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

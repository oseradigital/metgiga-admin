"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDeal } from "@/lib/crm/actions";
import type { Organisation } from "@/lib/crm/organisation-types";
import type { DealStage, TeamMemberOption } from "@/lib/crm/deal-types";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function NewDealForm({
  organisations,
  stages,
  teamMembers,
  defaultOrganisationId,
}: {
  organisations: Organisation[];
  stages: DealStage[];
  teamMembers: TeamMemberOption[];
  defaultOrganisationId?: string;
}) {
  const router = useRouter();
  const [organisationId, setOrganisationId] = useState(defaultOrganisationId ?? "");
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState(stages[0]?.id ?? "");
  const [pkg, setPkg] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [expectedStartDate, setExpectedStartDate] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [source, setSource] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ organisationId?: string; title?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const next: typeof fieldErrors = {};
    if (!organisationId) next.organisationId = "Choose an organisation.";
    if (!title.trim()) next.title = "Enter a deal title.";
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      document.getElementById(next.organisationId ? "organisationId" : "title")?.focus();
      return;
    }
    setFieldErrors({});

    setLoading(true);
    const result = await createDeal({
      organisationId,
      title,
      stage,
      package: pkg,
      monthlyValue,
      expectedStartDate,
      ownerUserId,
      source,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/deals/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label="Organisation" htmlFor="organisationId" required error={fieldErrors.organisationId}>
        <Select
          id="organisationId"
          value={organisationId}
          onChange={(e) => {
            setOrganisationId(e.target.value);
            if (fieldErrors.organisationId) setFieldErrors((prev) => ({ ...prev, organisationId: undefined }));
          }}
        >
          <option value="">Choose an organisation…</option>
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Title" htmlFor="title" required error={fieldErrors.title}>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="Aurora Aesthetics — Full Funnel"
        />
      </Field>

      <Field label="Stage" htmlFor="stage">
        <Select id="stage" value={stage} onChange={(e) => setStage(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Package" htmlFor="package" optional>
          <Input id="package" value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="Full Funnel" />
        </Field>
        <Field label="Monthly value" htmlFor="monthlyValue" optional hint="GBP">
          <Input
            id="monthlyValue"
            type="number"
            min="0"
            step="1"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
            placeholder="1800"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Expected start date" htmlFor="expectedStartDate" optional>
          <Input
            id="expectedStartDate"
            type="date"
            value={expectedStartDate}
            onChange={(e) => setExpectedStartDate(e.target.value)}
          />
        </Field>
        <Field label="Owner" htmlFor="ownerUserId" optional>
          <Select id="ownerUserId" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Source" htmlFor="source" optional>
        <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral" />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={loading}>
          {loading ? "Creating…" : "Create deal"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

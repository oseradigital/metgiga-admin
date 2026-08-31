"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateDeal } from "@/lib/crm/actions";
import type { Deal, DealStage, TeamMemberOption } from "@/lib/crm/deal-types";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function DealEditor({
  deal,
  stages,
  teamMembers,
}: {
  deal: Deal;
  stages: DealStage[];
  teamMembers: TeamMemberOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(deal.title);
  const [stage, setStage] = useState(deal.stage);
  const [pkg, setPkg] = useState(deal.package ?? "");
  const [monthlyValue, setMonthlyValue] = useState(deal.monthly_value?.toString() ?? "");
  const [expectedStartDate, setExpectedStartDate] = useState(deal.expected_start_date ?? "");
  const [ownerUserId, setOwnerUserId] = useState(deal.owner_user_id ?? "");
  const [source, setSource] = useState(deal.source ?? "");
  const [nextAction, setNextAction] = useState(deal.next_action ?? "");
  const [lostReason, setLostReason] = useState(deal.lost_reason ?? "");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedStage = stages.find((s) => s.id === stage);
  const currentStage = stages.find((s) => s.id === deal.stage);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setTitleError("Enter a deal title.");
      document.getElementById("deal-title")?.focus();
      return;
    }
    setTitleError(undefined);

    setSaving(true);
    const result = await updateDeal(deal.id, {
      title,
      stage,
      package: pkg,
      monthlyValue,
      expectedStartDate,
      ownerUserId,
      source,
      nextAction,
      lostReason,
    });
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
            <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-2">{deal.title}</h1>
            <p className="text-sm text-grey-on-light">{deal.organisation_name}</p>
          </div>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Stage</dt>
            <dd className="text-midnight">{currentStage?.label ?? deal.stage}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Package</dt>
            <dd className="text-midnight">{deal.package || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Monthly value</dt>
            <dd className="text-midnight">
              {deal.monthly_value !== null ? `£${deal.monthly_value.toLocaleString("en-GB")}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Expected start</dt>
            <dd className="text-midnight">
              {deal.expected_start_date
                ? new Date(deal.expected_start_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Owner</dt>
            <dd className="text-midnight">{deal.owner_name || "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Source</dt>
            <dd className="text-midnight">{deal.source || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Next action</dt>
            <dd className="text-midnight">{deal.next_action || "—"}</dd>
          </div>
          {currentStage?.is_lost ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">Lost reason</dt>
              <dd className="text-midnight">{deal.lost_reason || "—"}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-bone rounded-2xl border border-midnight/10 p-6 sm:p-8 space-y-5" noValidate>
      <Field label="Title" htmlFor="deal-title" required error={titleError}>
        <Input
          id="deal-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError(undefined);
          }}
        />
      </Field>

      <Field label="Stage" htmlFor="deal-stage">
        <Select id="deal-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Package" htmlFor="deal-package" optional>
          <Input id="deal-package" value={pkg} onChange={(e) => setPkg(e.target.value)} />
        </Field>
        <Field label="Monthly value" htmlFor="deal-monthlyValue" optional hint="GBP">
          <Input
            id="deal-monthlyValue"
            type="number"
            min="0"
            step="1"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Expected start date" htmlFor="deal-expectedStartDate" optional>
          <Input
            id="deal-expectedStartDate"
            type="date"
            value={expectedStartDate}
            onChange={(e) => setExpectedStartDate(e.target.value)}
          />
        </Field>
        <Field label="Owner" htmlFor="deal-owner" optional>
          <Select id="deal-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Source" htmlFor="deal-source" optional>
        <Input id="deal-source" value={source} onChange={(e) => setSource(e.target.value)} />
      </Field>

      <Field label="Next action" htmlFor="deal-nextAction" optional>
        <Input id="deal-nextAction" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      </Field>

      {selectedStage?.is_lost ? (
        <Field label="Lost reason" htmlFor="deal-lostReason" optional>
          <Input id="deal-lostReason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
        </Field>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addNote } from "@/lib/crm/actions";
import type { ActivityEvent, DealStage } from "@/lib/crm/deal-types";
import { Button } from "@/components/ui/Button";

function describe(event: ActivityEvent, stages: DealStage[]): string {
  const actor = event.actor_name ?? "Someone";
  switch (event.event_type) {
    case "deal.created":
      return `${actor} created this deal`;
    case "deal.stage_changed": {
      const from = stages.find((s) => s.id === event.metadata.from)?.label ?? String(event.metadata.from ?? "");
      const to = stages.find((s) => s.id === event.metadata.to)?.label ?? String(event.metadata.to ?? "");
      return `${actor} moved this deal from ${from} to ${to}`;
    }
    case "note.added":
      return String(event.metadata.text ?? "");
    default:
      return `${actor} — ${event.event_type}`;
  }
}

export function ActivityTimeline({
  entityType,
  entityId,
  organisationId,
  events,
  stages,
  showHeading = true,
}: {
  entityType: "deal" | "organisation";
  entityId: string;
  organisationId: string;
  events: ActivityEvent[];
  stages: DealStage[];
  // Redundant when this sits inside a page's own "Activity" tab (the tab
  // label already says it) — but the deal detail page isn't tabbed, so
  // it still needs its own heading there.
  showHeading?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!note.trim()) return;

    setSaving(true);
    const result = await addNote(entityType, entityId, note, organisationId);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      {showHeading ? <h2 className="font-display text-xl mb-4">Activity</h2> : null}

      <form onSubmit={handleAddNote} className="mb-5">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-lg border border-midnight/15 bg-bone text-midnight text-sm placeholder:text-grey-on-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:border-copper transition-colors resize-none"
        />
        {error ? (
          <p role="alert" className="text-sm text-error mt-1.5">
            {error}
          </p>
        ) : null}
        <div className="mt-2">
          <Button type="submit" variant="ghost" loading={saving} disabled={!note.trim()}>
            {saving ? "Adding…" : "Add note"}
          </Button>
        </div>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-grey-on-light">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="text-sm border-t border-midnight/10 pt-3 first:border-t-0 first:pt-0">
              <p className="text-midnight leading-relaxed">{describe(event, stages)}</p>
              <p className="text-xs text-grey-on-light mt-0.5">
                {new Date(event.created_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

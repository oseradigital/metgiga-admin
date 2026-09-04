import type { DealStage } from "@/lib/crm/deal-types";

// Shared between the deal/organisation Activity tabs and the Overview
// page's recent-activity feed — one place that turns an event_type +
// metadata into readable text, so the two don't drift apart.
export function describeActivityEvent(
  eventType: string,
  actorName: string | null,
  metadata: Record<string, unknown>,
  stages: DealStage[],
): string {
  const actor = actorName ?? "Someone";
  switch (eventType) {
    case "deal.created":
      return `${actor} created this deal`;
    case "deal.stage_changed": {
      const from = stages.find((s) => s.id === metadata.from)?.label ?? String(metadata.from ?? "");
      const to = stages.find((s) => s.id === metadata.to)?.label ?? String(metadata.to ?? "");
      return `${actor} moved this deal from ${from} to ${to}`;
    }
    case "note.added":
      return String(metadata.text ?? "");
    case "organisation.created":
      return `${actor} created this organisation`;
    case "onboarding.completed":
      // actor is always null here (crm.log_onboarding_completed logs it
      // as system-generated, not attributed to whichever session's
      // update happened to fire the trigger — very often the client's
      // own), so this deliberately doesn't use `actor`.
      return "Onboarding completed";
    case "document.uploaded":
      return `${actor} shared "${String(metadata.title ?? "a document")}"`;
    default:
      return `${actor} — ${eventType}`;
  }
}

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
    default:
      return `${actor} — ${eventType}`;
  }
}

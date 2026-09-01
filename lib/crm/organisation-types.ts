// Split out from organisations.ts so client components (OrganisationEditor,
// the organisations table) can import the types/constants without pulling
// in that file's "server-only" data-fetching code.

export const ORGANISATION_STATUSES = [
  "prospect",
  "activating",
  "active",
  "paused",
  "cancelled",
  "lost",
] as const;
export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];

export type Organisation = {
  id: string;
  name: string;
  legal_name: string | null;
  website: string | null;
  industry: string | null;
  source: string | null;
  status: OrganisationStatus;
  created_at: string;
};

// The organisations list is a table, not a card grid — each row needs
// more than the bare organisation record: who to contact, and where
// the relationship actually stands. Computed in lib/crm/organisations.ts
// by joining in JS (contacts + deals + tasks + activity are a handful
// of rows each for a two-person team; not worth a DB view for this yet).
export type OrganisationListItem = Organisation & {
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  activeDeal: {
    id: string;
    title: string;
    package: string | null;
    stage: string;
    stageLabel: string;
    monthlyValue: number | null;
    currency: string;
  } | null;
  // The earliest-due open task tied to this organisation (org-level or
  // any of its deals) — literally "what's in the tasks table", not a
  // computed priority. Null means no open task exists at all.
  nextAction: {
    id: string;
    title: string;
    dueAt: string | null;
  } | null;
  // Timestamp of the most recent activity_events row tied to this
  // organisation (its own notes + every deal belonging to it). Null
  // means no activity has ever been logged.
  lastActivityAt: string | null;
};

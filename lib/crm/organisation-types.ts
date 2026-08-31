// Split out from organisations.ts so client components (OrganisationEditor)
// can import the types/constants without pulling in that file's
// "server-only" data-fetching code.

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
  status: OrganisationStatus;
  created_at: string;
};

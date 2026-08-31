// Split from deals.ts so client components can import types without
// pulling in server-only data-fetching code (same reason as
// organisation-types.ts).

export type TeamMemberOption = { id: string; full_name: string };

export type DealStage = {
  id: string;
  label: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
};

export type Deal = {
  id: string;
  organisation_id: string;
  organisation_name: string;
  primary_contact_id: string | null;
  title: string;
  stage: string;
  package: string | null;
  monthly_value: number | null;
  currency: string;
  expected_start_date: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  source: string | null;
  next_action: string | null;
  lost_reason: string | null;
  created_at: string;
};

export type ActivityEvent = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

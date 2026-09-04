export const CLIENT_REQUEST_STATUSES = ["open", "in_progress", "resolved"] as const;
export type ClientRequestStatus = (typeof CLIENT_REQUEST_STATUSES)[number];

export type ClientRequest = {
  id: string;
  organisation_id: string;
  organisation_name: string | null;
  subject: string;
  message: string;
  status: ClientRequestStatus;
  response: string | null;
  responded_at: string | null;
  created_at: string;
};

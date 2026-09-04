"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondToClientRequest } from "@/lib/crm/actions";
import type { ClientRequest, ClientRequestStatus } from "@/lib/crm/request-types";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

const STATUS_LABEL: Record<ClientRequestStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};
const STATUS_TONE: Record<ClientRequestStatus, "neutral" | "copper" | "success"> = {
  open: "copper",
  in_progress: "neutral",
  resolved: "success",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// showOrganisation: the global /requests list needs it (a request can
// belong to any org); the organisation detail page's own tab already
// has that context, same reasoning as TaskItem's showOrganisation.
export function RequestItem({ request, showOrganisation = true }: { request: ClientRequest; showOrganisation?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientRequestStatus>(request.status);
  const [response, setResponse] = useState(request.response ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await respondToClientRequest(request.id, request.organisation_id, { status, response });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <li className="py-3 border-t border-midnight/10 first:border-t-0 first:pt-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-midnight truncate">{request.subject}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-grey-on-light">
              <span>{formatDate(request.created_at)}</span>
              {showOrganisation && request.organisation_name ? (
                <Link
                  href={`/organisations/${request.organisation_id}?tab=requests`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-copper-text hover:underline"
                >
                  {request.organisation_name}
                </Link>
              ) : null}
            </div>
          </div>
          <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
        </div>
      </button>

      {open ? (
        <div className="mt-3 pl-0">
          <p className="text-sm text-midnight whitespace-pre-wrap mb-4">{request.message}</p>
          <form onSubmit={handleSave} className="space-y-3">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ClientRequestStatus)}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </Select>
            <Textarea
              placeholder="Reply to the client (optional)…"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
            {error ? (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </li>
  );
}

import { RequestItem } from "@/components/crm/RequestItem";
import type { ClientRequest } from "@/lib/crm/request-types";

// No "add" affordance here, unlike TasksPanel/DocumentsPanel — a
// request always originates from the client's own /support page, never
// from the team on their behalf. This tab is read-and-respond only.
export function RequestsPanel({ requests }: { requests: ClientRequest[] }) {
  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      {requests.length === 0 ? (
        <p className="text-sm text-grey-on-light">No requests from this client yet.</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <RequestItem key={request.id} request={request} showOrganisation={false} />
          ))}
        </ul>
      )}
    </div>
  );
}

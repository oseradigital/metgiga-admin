import { listClientRequests } from "@/lib/crm/requests";
import { RequestItem } from "@/components/crm/RequestItem";

export default async function RequestsPage() {
  const requests = await listClientRequests();
  const openCount = requests.filter((r) => r.status !== "resolved").length;

  return (
    <div className="max-w-2xl">
      <div className="mb-2">
        <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-1">Requests</h1>
        <p className="text-sm text-grey-on-light">
          {openCount} open request{openCount === 1 ? "" : "s"}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-bone rounded-2xl border border-midnight/10 p-8 text-center mt-6">
          <p className="text-sm text-grey-on-light">No requests yet.</p>
        </div>
      ) : (
        <div className="bg-bone rounded-2xl border border-midnight/10 px-6 mt-6">
          <ul>
            {requests.map((request) => (
              <RequestItem key={request.id} request={request} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

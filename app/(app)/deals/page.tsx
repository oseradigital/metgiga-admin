import Link from "next/link";
import { listDeals, listDealStages } from "@/lib/crm/deals";
import { DealStageSelect } from "@/components/crm/DealStageSelect";
import { formatMoney } from "@/lib/format";

export default async function DealsPage() {
  const [deals, stages] = await Promise.all([listDeals(), listDealStages()]);

  const openDeals = deals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stage);
    return stage && !stage.is_won && !stage.is_lost;
  });
  // "Value", not "MRR" — a prospect's proposed price isn't realised
  // recurring revenue yet.
  const potentialValue = openDeals.reduce((sum, d) => sum + (d.monthly_value ?? 0), 0);

  const byStage = new Map<string, typeof deals>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const deal of deals) byStage.get(deal.stage)?.push(deal);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-1">Deals</h1>
          <p className="text-sm text-grey-on-light">
            Potential value: {formatMoney(potentialValue, "GBP") ?? "£0"} across {openDeals.length} open deal
            {openDeals.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/deals/new"
          className="h-11 px-5 rounded-lg bg-midnight text-bone text-sm font-medium inline-flex items-center hover:bg-midnight-2 transition-colors"
        >
          New deal
        </Link>
      </div>

      <div className="mt-8 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {stages.map((stage) => {
            const stageDeals = byStage.get(stage.id) ?? [];
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-xs uppercase tracking-wide text-grey-on-light font-medium">{stage.label}</p>
                  <span className="text-xs text-grey-on-light">{stageDeals.length}</span>
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block bg-bone rounded-xl border border-midnight/10 p-4 hover:border-midnight/20 transition-colors"
                    >
                      <p className="text-sm font-medium text-midnight truncate mb-0.5">{deal.title}</p>
                      <p className="text-xs text-grey-on-light truncate mb-3">{deal.organisation_name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-grey-on-light">
                          {formatMoney(deal.monthly_value, deal.currency) ?? "—"}
                        </span>
                        <DealStageSelect dealId={deal.id} currentStage={deal.stage} stages={stages} />
                      </div>
                    </Link>
                  ))}
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-grey-on-light/70 px-1 py-2">—</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

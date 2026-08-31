"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeDealStage } from "@/lib/crm/actions";
import type { DealStage } from "@/lib/crm/deal-types";

// The pipeline board's quick per-card stage move — a plain <select>, not
// drag-and-drop. Two people don't need a drag-and-drop kanban to know
// where a deal sits; a select is faster to build, faster to use on
// mobile, and doesn't need its own library.
export function DealStageSelect({
  dealId,
  currentStage,
  stages,
}: {
  dealId: string;
  currentStage: string;
  stages: DealStage[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value;
    setError(null);
    setSaving(true);
    const result = await changeDealStage(dealId, stage);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    // stopPropagation, not preventDefault — this sits inside a card that's
    // also a <Link>; without stopping the click from bubbling, using the
    // select would also navigate to the deal detail page underneath it.
    <div onClick={(e) => e.stopPropagation()}>
      <select
        value={currentStage}
        onChange={handleChange}
        disabled={saving}
        className="text-xs h-8 px-2 rounded-md border border-midnight/15 bg-bone text-midnight disabled:opacity-50"
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-error mt-1">{error}</p> : null}
    </div>
  );
}

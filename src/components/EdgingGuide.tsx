import { useMemo } from 'react';
import { toolName } from '../core/tool';
import { computePlankTrim, edgingPlanForPlank } from '../core/trim';
import type { EdgingPlan } from '../core/trim';
import type { PlacedPlank, PlanState } from '../core/types';

interface Props {
  plan: PlanState;
  /** Planks still to be cut from the log. */
  remainingPlanks: PlacedPlank[];
}

/**
 * Rows shown in the edging guide: a plank + its computed edging plan +
 * whether it's already sawn out or still in the log.
 */
interface Row {
  key: string;
  plank: PlacedPlank;
  plan: EdgingPlan;
  /** true if this plank has already been sawn off the log. */
  produced: boolean;
  /** Sequence number for stable ordering. */
  sequence: number;
}

/**
 * Two-cut edging guide. After a plank has been sawn off the log, the
 * sawyer stands it vertically on the mill and trims the wane edges down
 * to the target width. This panel lists every plank (both already-cut
 * and still-to-cut) that needs edging, with the recommended blade
 * heights for each cut and whether the plank has to be flipped halfway
 * through.
 *
 * Rendered as the body of a `<Collapsible>` in App.tsx.
 */
export function EdgingGuide({ plan, remainingPlanks }: Props) {
  const tool = toolName(plan.settings);
  const rows = useMemo<Row[]>(() => {
    const remainingSequences = new Set(remainingPlanks.map((p) => p.sequence));
    const out: Row[] = [];
    for (const p of plan.planks) {
      const trim = computePlankTrim(plan.shape, p);
      const eplan = edgingPlanForPlank(trim, p);
      out.push({
        key: `plank-${p.sequence}`,
        plank: p,
        plan: eplan,
        // If the plank isn't in the remaining list, it's already been sawn.
        produced: !remainingSequences.has(p.sequence),
        sequence: p.sequence
      });
    }
    // Sort by sequence so the list follows the cutting order.
    out.sort((a, b) => a.sequence - b.sequence);
    return out;
  }, [plan.planks, plan.shape, remainingPlanks]);

  const needsEdging = rows.filter((r) => !r.plan.clean);
  const clean = rows.filter((r) => r.plan.clean);

  // Pre-compute a "not going to need to edge anything" state so we show a
  // friendly message instead of an empty list.
  if (rows.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        No planks planned yet — enter log measurements to see the layout.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-stone-600 leading-relaxed">
        After each plank is sawn off the log, stand it vertically on the mill with
        its wane edges pointing up and down. The {tool} cuts horizontally, so the
        <b> {tool}-height</b> values below are the numbers you crank in — measured
        from the bed to the {tool}.
      </p>

      {needsEdging.length === 0 ? (
        <p className="rounded-md bg-forest-50 border border-forest-200 px-3 py-2 text-xs text-forest-800">
          ✓ None of your planned planks need edging — all inside the squared
          cant. Any wane comes off with the slab cuts.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-stone-500 border-b border-stone-200">
                <th className="py-1.5 pl-1 text-left">Plank</th>
                <th className="py-1.5 text-right">Rough</th>
                <th className="py-1.5 text-right">Cut 1</th>
                <th className="py-1.5 text-right">Cut 2</th>
                <th className="py-1.5 pr-1 text-left pl-2">Workflow</th>
              </tr>
            </thead>
            <tbody>
              {needsEdging.map((r) => (
                <tr
                  key={r.key}
                  className={`border-b border-stone-100 ${
                    r.produced ? 'bg-forest-50/50' : ''
                  }`}
                >
                  <td className="py-1.5 pl-1">
                    <div className="font-medium text-stone-800">
                      {r.sequence}. {r.plank.label}
                    </div>
                    <div className="text-[10px] text-stone-500">
                      {r.produced ? '✓ sawn' : '◯ still to cut'}
                    </div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-stone-700">
                    {r.plan.roughWidth.toFixed(0)} mm
                    <div className="text-[10px] text-stone-500">
                      L +{r.plan.trimLeft.toFixed(0)} · R +{r.plan.trimRight.toFixed(0)}
                    </div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-brand-700">
                    {r.plan.cut1?.toFixed(0)} mm
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-brand-700">
                    {r.plan.cut2 != null ? `${r.plan.cut2.toFixed(0)} mm` : '—'}
                  </td>
                  <td className="py-1.5 pr-1 pl-2 text-[11px] text-stone-600 leading-tight">
                    {r.plan.requiresFlip ? (
                      <>
                        Stand on wane, cut 1,{' '}
                        <b className="text-motor-700">flip 180°</b>, cut 2.
                      </>
                    ) : (
                      <>Flat face down, one cut to {r.plan.targetWidth.toFixed(0)} mm.</>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {clean.length > 0 && (
        <details className="text-xs">
          <summary className="text-stone-500 cursor-pointer hover:text-brand-600 select-none">
            {clean.length} plank{clean.length === 1 ? '' : 's'} need{clean.length === 1 ? 's' : ''}{' '}
            no edging
          </summary>
          <ul className="mt-1 pl-4 space-y-0.5 text-stone-600">
            {clean.map((r) => (
              <li key={r.key}>
                {r.sequence}. {r.plank.label} — already rectangular (inside cant).
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[10px] text-stone-500 leading-relaxed">
        Trim amounts are the worst case at the log's narrowest cross-section —
        the bigger root end will have slightly more wane, so add a few mm of
        margin on cut 1 if in doubt. Cut 2 always equals the target width and
        gives you exactly the right dimension.
      </p>
    </div>
  );
}

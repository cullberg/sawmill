import { rootEndDiameter, designDiameter, logVolumeM3, taperPerMetre } from '../core/taper';
import type { PlanState } from '../core/types';

interface Props {
  plan: PlanState;
}

export function Summary({ plan }: Props) {
  const taper = taperPerMetre(plan.log);
  const root = rootEndDiameter(plan.log);
  const top = designDiameter(plan.log);
  const vol = logVolumeM3(plan.log);

  const totalPlankArea = plan.planks.reduce((a, p) => a + p.width * p.thickness, 0);
  const circleArea = Math.PI * Math.pow(top / 2, 2);
  const yieldPct = circleArea > 0 ? (totalPlankArea / circleArea) * 100 : 0;

  // Group all planned planks.
  const planned = new Map<string, { label: string; count: number }>();
  for (const p of plan.planks) {
    const key = `${p.width}x${p.thickness}`;
    const g = planned.get(key);
    if (g) g.count++;
    else planned.set(key, { label: `${p.width} × ${p.thickness}`, count: 1 });
  }
  // Group produced planks.
  const produced = new Map<string, number>();
  for (const p of plan.produced) {
    produced.set(p.label, (produced.get(p.label) ?? 0) + 1);
  }

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-stone-500">Taper</dt>
        <dd className="tabular-nums">{taper.toFixed(1)} mm/m</dd>
        <dt className="text-stone-500">Root Ø</dt>
        <dd className="tabular-nums">{(root / 10).toFixed(1)} cm</dd>
        <dt className="text-stone-500">Top Ø (design)</dt>
        <dd className="tabular-nums">{(top / 10).toFixed(1)} cm</dd>
        <dt className="text-stone-500">Volume</dt>
        <dd className="tabular-nums">{vol.toFixed(3)} m³</dd>
        <dt className="text-stone-500">End-view yield</dt>
        <dd className="tabular-nums">{yieldPct.toFixed(1)} %</dd>
        <dt className="text-stone-500">Cuts made</dt>
        <dd className="tabular-nums">{plan.cuts.length}</dd>
      </dl>

      {planned.size > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-1">Planned plank yield</h3>
          <ul className="text-sm divide-y divide-stone-100">
            {[...planned.entries()].map(([key, g]) => {
              const pCount = [...plan.produced].filter(
                (p) => p.label.replace('×', 'x').replace(' ', '') === key
              ).length;
              return (
                <li key={key} className="flex justify-between py-1">
                  <span>{g.label}</span>
                  <span className="tabular-nums font-medium">
                    {pCount > 0 && <span className="text-forest-700 mr-1">✓ {pCount}</span>}
                    {g.count - pCount > 0 && <span className="text-stone-500">◯ {g.count - pCount}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-stone-500 mt-1">✓ sawn · ◯ still to cut</p>
        </div>
      )}

      {plan.cuts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-1">Cut log</h3>
          <ol className="text-xs text-stone-600 list-decimal list-inside space-y-0.5 max-h-36 overflow-y-auto">
            {plan.cuts.map((c, i) => (
              <li key={i}>{c.note}</li>
            ))}
          </ol>
        </div>
      )}

      {produced.size === 0 && (
        <p className="text-xs text-stone-500 italic">
          No cuts yet. Set rotation, read blade height, make your cut on the mill,
          then tap ▼ Step cut to record it.
        </p>
      )}
    </section>
  );
}

import { useMemo } from 'react';
import type { ArchivedLog } from '../core/archive';
import { archiveToCsv, downloadCsv } from '../core/archiveCsv';
import { designDiameter, logVolumeM3, rootEndDiameter } from '../core/taper';

interface Props {
  archive: ArchivedLog[];
  /** Remove a single entry by id. */
  onRemove: (id: string) => void;
  /** Drop the whole archive. */
  onClear: () => void;
  /** Open an archived log's PlanState in the planner. */
  onReopen: (log: ArchivedLog) => void;
}

/**
 * Sidebar panel contents: aggregate stats across the whole archive,
 * followed by a scrollable newest-first list of every completed log
 * with per-row Reopen / Delete actions, and a footer with Clear-all
 * and CSV-export affordances.
 *
 * Designed to work offline — the CSV export uses a Blob URL, no
 * server calls.
 */
export function LogHistory({ archive, onRemove, onClear, onReopen }: Props) {
  const stats = useMemo(() => computeAggregateStats(archive), [archive]);

  if (archive.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        No completed logs yet. When you tap <b>Start next log</b> at the end
        of a job, that log is archived here — including its cuts, yield and
        produced planks. The list is capped at the 50 most-recent entries
        and stored in this browser only.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Aggregate stats — compact grid of the numbers people usually
          want in a yearly report. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
        <dt className="text-stone-500">Logs archived</dt>
        <dd className="tabular-nums">{stats.count}</dd>
        <dt className="text-stone-500">Total volume</dt>
        <dd className="tabular-nums">{stats.totalVolumeM3.toFixed(3)} m³</dd>
        <dt className="text-stone-500">Total cuts</dt>
        <dd className="tabular-nums">{stats.totalCuts}</dd>
        <dt className="text-stone-500">Total planks sawn</dt>
        <dd className="tabular-nums">{stats.totalPlanks}</dd>
        <dt className="text-stone-500">Average yield</dt>
        <dd className="tabular-nums">{stats.avgYieldPct.toFixed(1)} %</dd>
      </dl>

      {stats.sizeTotals.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-stone-700 mb-1">
            Planks produced, all logs
          </h4>
          <ul className="text-xs divide-y divide-stone-100">
            {stats.sizeTotals.map(({ label, count }) => (
              <li key={label} className="flex justify-between py-0.5">
                <span>{label}</span>
                <span className="tabular-nums font-medium text-forest-700">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-log list. Newest first because that's how archive is
          already ordered. Scrollable so a 50-entry archive doesn't
          blow the panel's height; the sidebar itself scrolls beyond. */}
      <div>
        <h4 className="text-xs font-semibold text-stone-700 mb-1">
          Completed logs
        </h4>
        <ul className="divide-y divide-stone-100 max-h-64 overflow-y-auto rounded-md border border-stone-200">
          {archive.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              onReopen={() => onReopen(entry)}
              onRemove={() => onRemove(entry.id)}
            />
          ))}
        </ul>
      </div>

      {/* Footer: bulk actions. Export is harmless, Clear is destructive
          behind a confirm. */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            const csv = archiveToCsv(archive);
            downloadCsv(csv);
          }}
          className="px-3 py-1.5 text-sm rounded-md border border-forest-300 text-forest-800 hover:bg-forest-50"
          title="Download all archived logs as a CSV file"
        >
          ⬇ Export CSV
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `Delete all ${archive.length} archived log${archive.length === 1 ? '' : 's'}? This can't be undone.`
              )
            ) {
              onClear();
            }
          }}
          className="ml-auto px-3 py-1.5 text-sm rounded-md border border-stone-300 text-stone-600 hover:text-brand-700 hover:border-brand-300"
          title="Remove every archived log"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  entry: ArchivedLog;
  onReopen: () => void;
  onRemove: () => void;
}

/**
 * One row per archived log. Shows the completion timestamp (date +
 * HH:MM), log dimensions, volume, cuts/planks, yield, and a compact
 * Reopen / Delete action cluster.
 */
function LogRow({ entry, onReopen, onRemove }: RowProps) {
  const { plan, completedAt } = entry;
  const root = rootEndDiameter(plan.log);
  const top = designDiameter(plan.log);
  const vol = logVolumeM3(plan.log);
  const plankArea = plan.planks.reduce((a, p) => a + p.width * p.thickness, 0);
  const circleArea = Math.PI * Math.pow(top / 2, 2);
  const yieldPct = circleArea > 0 ? (plankArea / circleArea) * 100 : 0;
  const when = formatTimestamp(completedAt);

  return (
    <li className="px-2 py-2 flex items-start gap-2 text-xs">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-steel-800">{when}</span>
          <span className="text-stone-500 truncate">
            Ø {(root / 10).toFixed(0)} → {(top / 10).toFixed(0)} cm ·{' '}
            {(plan.log.length / 1000).toFixed(2)} m
          </span>
        </div>
        <div className="text-stone-600 tabular-nums">
          {vol.toFixed(3)} m³ · {plan.cuts.length} cuts · {plan.produced.length}{' '}
          planks · {yieldPct.toFixed(0)}% yield
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                'Reopen this log? Your current plan will be replaced. Archive and settings stay.'
              )
            ) {
              onReopen();
            }
          }}
          className="px-2 py-0.5 rounded-md border border-forest-300 text-forest-800 hover:bg-forest-50 text-[11px]"
          title="Load this log back into the planner"
        >
          Reopen
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete this archived log?')) onRemove();
          }}
          className="px-2 py-0.5 rounded-md border border-stone-300 text-stone-500 hover:text-brand-700 hover:border-brand-300 text-[11px]"
          title="Remove this entry"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Pure helpers — exported so tests can drive them directly           */
/* ------------------------------------------------------------------ */

export interface AggregateStats {
  count: number;
  totalVolumeM3: number;
  totalCuts: number;
  totalPlanks: number;
  avgYieldPct: number;
  /** Per-size totals across all logs, sorted by count descending. */
  sizeTotals: Array<{ label: string; count: number }>;
}

export function computeAggregateStats(archive: ArchivedLog[]): AggregateStats {
  if (archive.length === 0) {
    return {
      count: 0,
      totalVolumeM3: 0,
      totalCuts: 0,
      totalPlanks: 0,
      avgYieldPct: 0,
      sizeTotals: []
    };
  }
  let totalVolumeM3 = 0;
  let totalCuts = 0;
  let totalPlanks = 0;
  let yieldSum = 0;
  const bySize = new Map<string, number>();
  for (const entry of archive) {
    const { plan } = entry;
    totalVolumeM3 += logVolumeM3(plan.log);
    totalCuts += plan.cuts.length;
    totalPlanks += plan.produced.length;
    const top = designDiameter(plan.log);
    const plankArea = plan.planks.reduce((a, p) => a + p.width * p.thickness, 0);
    const circleArea = Math.PI * Math.pow(top / 2, 2);
    if (circleArea > 0) {
      yieldSum += (plankArea / circleArea) * 100;
    }
    for (const p of plan.produced) {
      bySize.set(p.label, (bySize.get(p.label) ?? 0) + 1);
    }
  }
  const sizeTotals = [...bySize.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    count: archive.length,
    totalVolumeM3,
    totalCuts,
    totalPlanks,
    avgYieldPct: yieldSum / archive.length,
    sizeTotals
  };
}

/** `Jun 14, 09:32` — short, locale-agnostic enough for a row label. */
function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  // Intl.DateTimeFormat with `en-GB` locale gives us a stable
  // "14 Jun 09:32" kind of shape; we further compress to save space.
  const date = d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short'
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${date} ${time}`;
}

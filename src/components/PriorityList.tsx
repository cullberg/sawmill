import { useMemo, useState } from 'react';
import { makeDefaultPriority } from '../core/storage';
import type { PlankSpec } from '../core/types';

interface Props {
  list: PlankSpec[];
  strategy: 'priority' | 'value' | 'min-waste';
  onChange: (list: PlankSpec[]) => void;
}

export function PriorityList({ list, strategy, onChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hideDisabled, setHideDisabled] = useState(false);

  const update = (id: string, patch: Partial<PlankSpec>) => {
    onChange(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const remove = (id: string) => onChange(list.filter((s) => s.id !== id));
  const add = () => {
    const id = `p${Date.now().toString(36)}`;
    // Seed the label to match the canonical "width×thickness" form
    // used by `layout.ts`, so the new row's text input is pre-filled
    // with the same string the produced plank will carry. Sawyers
    // can still rename it (e.g. to "decking" or "60-cm shelves") and
    // the custom label flows all the way through to the end-view
    // illustration.
    const width = 100;
    const thickness = 25;
    onChange([
      ...list,
      {
        id,
        width,
        thickness,
        enabled: true,
        label: `${width}×${thickness}`
      }
    ]);
  };
  const move = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= list.length) return;
    const copy = [...list];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    onChange(copy);
  };
  const enableAll = (v: boolean) => onChange(list.map((s) => ({ ...s, enabled: v })));
  const restoreDefaults = () => {
    if (
      window.confirm(
        'Restore the default preferred-dimensions list? Your current customisations (order, enabled state, custom rows) will be replaced.'
      )
    ) {
      onChange(makeDefaultPriority());
    }
  };

  // Pre-compute indices so drag/drop / move keep absolute positions consistent
  // when the list is filtered.
  const indexedList = useMemo(
    () => list.map((spec, i) => ({ spec, absoluteIndex: i })),
    [list]
  );
  const visible = hideDisabled
    ? indexedList.filter((x) => x.spec.enabled)
    : indexedList;

  /**
   * Move a row to its previous / next *visible* sibling. When the
   * "Hide disabled" filter is on, swapping with the absolute neighbour
   * (i ± 1) can move the row past a hidden disabled row that the
   * sawyer can't see — so visually nothing changes and they think
   * the button is broken. Walking the visible list instead keeps the
   * arrow buttons predictable: each click moves the row exactly one
   * step in the displayed order, regardless of any hidden rows
   * sitting between visible siblings.
   *
   * `direction` is -1 for up, +1 for down. No-op at the ends.
   */
  const moveVisible = (absoluteIndex: number, direction: -1 | 1) => {
    const visiblePos = visible.findIndex((x) => x.absoluteIndex === absoluteIndex);
    if (visiblePos < 0) return;
    const targetVisiblePos = visiblePos + direction;
    if (targetVisiblePos < 0 || targetVisiblePos >= visible.length) return;
    move(absoluteIndex, visible[targetVisiblePos].absoluteIndex);
  };

  const enabledCount = list.filter((s) => s.enabled).length;

  /**
   * Map of "thickness×width" → ids of every spec that shares those
   * dimensions. Any key with more than one id contains duplicates;
   * the first id (lowest priority position) is the "winner" and the
   * others are flagged in the UI as redundant. Computed up-front so
   * each row can do an O(1) lookup during render.
   *
   * Why warn instead of block? Sawyers occasionally want two rows
   * with the same dimensions but different labels or value scores
   * (e.g. "studs" vs "decking" both being 50×100). A soft warning
   * preserves that flexibility while still flagging the more common
   * case where the duplicate is an honest mistake.
   */
  const dimKey = (s: PlankSpec) => `${s.thickness}x${s.width}`;
  const duplicateGroups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of list) {
      const k = dimKey(s);
      const arr = m.get(k);
      if (arr) arr.push(s.id);
      else m.set(k, [s.id]);
    }
    return m;
  }, [list]);
  const isDuplicate = (s: PlankSpec): boolean => {
    const ids = duplicateGroups.get(dimKey(s));
    return !!ids && ids.length > 1 && ids[0] !== s.id;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">
          Drag to reorder. Higher = higher priority. {enabledCount}/{list.length} enabled.
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setHideDisabled((v) => !v)}
            className="px-2 py-1 text-xs text-stone-600 hover:text-forest-700 border border-stone-300 rounded-md"
            title={hideDisabled ? 'Show all rows' : 'Hide disabled rows'}
          >
            {hideDisabled ? `Show all (${list.length})` : `Hide disabled`}
          </button>
          <button
            onClick={add}
            className="px-2 py-1 text-sm bg-forest-500 text-white rounded-md hover:bg-forest-600"
          >
            + Add
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-stone-500">
        <button
          onClick={restoreDefaults}
          className="hover:text-forest-700 underline"
          title="Replace the list with the built-in default dimensions"
        >
          ↺ Restore defaults
        </button>
        <div className="flex gap-2">
          <button onClick={() => enableAll(true)} className="hover:text-forest-700 underline">
            enable all
          </button>
          <button onClick={() => enableAll(false)} className="hover:text-forest-700 underline">
            none
          </button>
        </div>
      </div>
      <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {visible.map(({ spec, absoluteIndex: i }) => {
          const dup = isDuplicate(spec);
          return (
          <li
            key={spec.id}
            draggable
            onDragStart={() => setDragId(spec.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId) return;
              const from = list.findIndex((s) => s.id === dragId);
              move(from, i);
              setDragId(null);
            }}
            className={`border rounded-lg p-2.5 transition ${
              dup
                ? 'border-amber-300 bg-amber-50'
                : spec.enabled
                  ? 'border-stone-200 bg-stone-50'
                  : 'border-stone-100 bg-white opacity-60'
            }`}
          >
            {/* ── Top row: position, enabled toggle, label, remove ── */}
            <div className="flex items-center gap-2">
              {/* Big up/down stack — generous tap targets, both
                  arrows visible at the same time so the sawyer's
                  finger doesn't have to scroll. */}
              <div
                className="flex flex-col items-center select-none cursor-grab"
                aria-hidden
              >
                <button
                  onClick={() => moveVisible(i, -1)}
                  className="h-7 w-7 flex items-center justify-center text-stone-500 hover:text-forest-700 hover:bg-stone-100 rounded text-base"
                  aria-label="Move up"
                  type="button"
                >
                  ▲
                </button>
                <span className="text-[11px] tabular-nums leading-none text-stone-500 my-0.5">
                  {i + 1}
                </span>
                <button
                  onClick={() => moveVisible(i, 1)}
                  className="h-7 w-7 flex items-center justify-center text-stone-500 hover:text-forest-700 hover:bg-stone-100 rounded text-base"
                  aria-label="Move down"
                  type="button"
                >
                  ▼
                </button>
              </div>
              <input
                type="checkbox"
                checked={spec.enabled}
                onChange={(e) => update(spec.id, { enabled: e.target.checked })}
                className="h-5 w-5 text-forest-500 rounded border-stone-300"
                aria-label="Enabled"
              />
              <input
                type="text"
                value={spec.label ?? ''}
                placeholder="label (optional)"
                onChange={(e) => update(spec.id, { label: e.target.value })}
                className="flex-1 min-w-0 rounded-md border-stone-300 bg-white px-2 py-1.5 text-sm border"
              />
              {dup && (
                <span
                  className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300"
                  title="Another row earlier in the list has the same thickness × width. The layout will treat them as interchangeable candidates — usually you want only one row per dimension."
                >
                  dup
                </span>
              )}
              <button
                onClick={() => remove(spec.id)}
                className="h-8 w-8 flex items-center justify-center text-stone-400 hover:text-brand-600 hover:bg-stone-100 rounded text-sm"
                aria-label="Remove"
                type="button"
              >
                ✕
              </button>
            </div>

            {/* ── Bottom row: thickness × width (× value) with steppers ── */}
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              {/* min=10 for thickness/width: smaller than that and the
                  layout silently drops the spec (zero-area rectangles
                  never get picked) which looks like a broken row to
                  the sawyer. 10 mm is well below any realistic plank
                  spec and serves only as a "you typed something
                  meaningless" guard. */}
              <DimStepper
                label="thickness (mm)"
                value={spec.thickness}
                onChange={(v) => update(spec.id, { thickness: v })}
                step={5}
                min={10}
              />
              <span className="text-stone-400 text-lg font-semibold">×</span>
              <DimStepper
                label="width (mm)"
                value={spec.width}
                onChange={(v) => update(spec.id, { width: v })}
                step={5}
                min={10}
              />
              {strategy === 'value' && (
                <>
                  <span className="text-stone-400 text-sm ml-2">value</span>
                  <DimStepper
                    label="value score"
                    value={spec.value ?? 0}
                    onChange={(v) => update(spec.id, { value: v })}
                    step={1}
                    min={0}
                  />
                </>
              )}
            </div>
          </li>
          );
        })}
        {visible.length === 0 && (
          <li className="text-sm text-stone-400 italic py-4 text-center">
            No entries visible. Toggle "Show all" to see disabled rows.
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Big numeric stepper with − / + flanking the input on BOTH sides.
 * Used for thickness, width, and (in value-strategy mode) the value
 * score in the preferred-dimensions list.
 *
 * Why not a single − before / + after? On a small tablet the priority
 * list lives in a side panel, so each row gets a generous horizontal
 * footprint. Putting the steppers on both sides means the sawyer's
 * thumb doesn't have to travel across the row — left thumb decreases,
 * right thumb increases, regardless of which hand is holding the
 * tablet. The native browser stepper is hidden (`no-spinner`) because
 * its placement varies by browser; the explicit buttons are uniform.
 *
 * Steps snap to the nearest whole step before adding the increment so
 * repeated taps from a fractional start (e.g. 27 mm) don't leave the
 * value stuck at 32 / 37 / etc. for a 5-mm step.
 */
function DimStepper({
  label,
  value,
  onChange,
  step,
  min = 0
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
}) {
  const btnCls =
    'shrink-0 h-10 w-10 flex items-center justify-center text-xl font-semibold bg-stone-100 hover:bg-stone-200 active:bg-stone-300 border border-stone-300 text-stone-700 disabled:text-stone-300 disabled:bg-stone-50 transition select-none';

  const stepBy = (direction: -1 | 1) => {
    const snapped = Math.round(value / step) * step;
    const next = Math.max(min, snapped + direction * step);
    onChange(next);
  };
  const decDisabled = value <= min;

  return (
    <div className="inline-flex items-stretch" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => stepBy(-1)}
        disabled={decDisabled}
        aria-label={`Decrease ${label} by ${step}`}
        className={`${btnCls} rounded-l-md border-r-0`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(min, Math.round(n)));
        }}
        aria-label={label}
        className="w-16 h-10 px-1 text-center text-base font-semibold tabular-nums border-y border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:z-10 no-spinner"
      />
      <button
        type="button"
        onClick={() => stepBy(1)}
        aria-label={`Increase ${label} by ${step}`}
        className={`${btnCls} rounded-r-md border-l-0`}
      >
        +
      </button>
    </div>
  );
}

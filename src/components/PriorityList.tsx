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
    onChange([...list, { id, width: 100, thickness: 25, enabled: true }]);
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

  const enabledCount = list.filter((s) => s.enabled).length;

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
      <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {visible.map(({ spec, absoluteIndex: i }) => (
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
            className={`border rounded-lg p-1.5 flex items-center gap-1.5 transition ${
              spec.enabled
                ? 'border-stone-200 bg-stone-50'
                : 'border-stone-100 bg-white opacity-60'
            }`}
          >
            <div
              className="flex flex-col items-center gap-0 text-stone-400 select-none cursor-grab"
              aria-hidden
            >
              <button
                onClick={() => move(i, i - 1)}
                className="hover:text-stone-600 text-[10px] leading-none"
              >
                ▲
              </button>
              <span className="text-[10px] tabular-nums leading-none">{i + 1}</span>
              <button
                onClick={() => move(i, i + 1)}
                className="hover:text-stone-600 text-[10px] leading-none"
              >
                ▼
              </button>
            </div>
            <input
              type="checkbox"
              checked={spec.enabled}
              onChange={(e) => update(spec.id, { enabled: e.target.checked })}
              className="h-4 w-4 text-forest-500 rounded border-stone-300"
              aria-label="Enabled"
            />
            <NumberBox
              value={spec.thickness}
              onChange={(v) => update(spec.id, { thickness: v })}
              label="t"
            />
            <span className="text-stone-400 text-xs">×</span>
            <NumberBox
              value={spec.width}
              onChange={(v) => update(spec.id, { width: v })}
              label="w"
            />
            {strategy === 'value' && (
              <NumberBox
                value={spec.value ?? 0}
                onChange={(v) => update(spec.id, { value: v })}
                label="value"
                className="w-16"
              />
            )}
            <input
              type="text"
              value={spec.label ?? ''}
              placeholder="label"
              onChange={(e) => update(spec.id, { label: e.target.value })}
              className="flex-1 min-w-0 rounded-md border-stone-300 bg-white px-2 py-0.5 text-xs border"
            />
            <button
              onClick={() => remove(spec.id)}
              className="text-stone-400 hover:text-brand-600 px-1 text-xs"
              aria-label="Remove"
            >
              ✕
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-sm text-stone-400 italic py-4 text-center">
            No entries visible. Toggle "Show all" to see disabled rows.
          </li>
        )}
      </ul>
    </div>
  );
}

function NumberBox({
  value,
  onChange,
  label,
  className = 'w-14'
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className="text-xs">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${className} rounded-md border-stone-300 bg-white px-1.5 py-0.5 text-xs border tabular-nums`}
      />
    </label>
  );
}

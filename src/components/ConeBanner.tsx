import type { ConeState } from '../state/usePlan';

interface Props {
  cone: ConeState;
}

/**
 * Compact taper-compensation notice. Signal red while the log is still
 * round and a drop is actually needed; neutral grey when the taper is
 * zero / inverted (no compensation required yet); forest green once the
 * cone is resolved by cutting two faces 180° apart.
 */
export function ConeBanner({ cone }: Props) {
  if (cone.resolved) {
    return (
      <div className="rounded-lg border border-forest-300 bg-forest-50 px-3 py-2 flex items-center gap-2 text-sm">
        <span className="text-forest-600" aria-hidden>
          ✓
        </span>
        <span className="font-medium text-forest-800">Cone resolved</span>
        <span className="text-forest-700 hidden sm:inline">
          — top and bottom parallel, cut horizontally.
        </span>
      </div>
    );
  }

  // Drop of zero only really happens when the extrapolated ends are equal
  // (parallel log, or inverse taper where the butt support is smaller than
  // the top support, or degenerate measurements with zero support spacing).
  // Either way: nothing useful to tell the sawyer about butt lowering yet,
  // so keep the banner neutral instead of shouting "lower butt by 0 mm".
  if (cone.buttDropMm <= 0) {
    return (
      <div className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 flex items-center gap-2 text-sm">
        <span className="text-stone-500" aria-hidden>
          ◯
        </span>
        <span className="font-medium text-stone-700">No butt drop needed</span>
        <span className="text-stone-600 hidden sm:inline text-xs">
          — ends are equal or butt is smaller. Cut a reference face on each side to resolve the cone.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-400 bg-brand-50 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-brand-600" aria-hidden>
          ▼
        </span>
        <span className="font-medium text-brand-800">Cone compensation:</span>
        <span className="text-brand-700">
          lower butt by{' '}
          <span className="font-bold tabular-nums">{cone.buttDropMm.toFixed(0)} mm</span>
        </span>
        <span className="text-xs text-brand-600/80 hidden md:inline">
          — auto-resolves after two cuts 180° apart.
        </span>
      </div>
    </div>
  );
}

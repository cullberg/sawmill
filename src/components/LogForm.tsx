import { rootEndDiameter, topEndDiameter } from '../core/taper';
import type { LogInput, Species } from '../core/types';

interface Props {
  log: LogInput;
  onChange: (log: LogInput) => void;
  /**
   * Optional "I'm done with this panel" handler. When supplied, the
   * form renders a forest-green OK button at the bottom. The parent
   * is expected to close the Log-measurements collapsible and scroll
   * back up to the Controls card so the sawyer can reach for the
   * Cut button without hunting — mirror image of the "Start next log"
   * flow that scrolls the other way.
   *
   * Disabled while the spacing input is invalid so the sawyer can't
   * confirm an unusable log. Leaving it undefined hides the button
   * entirely (keeps the form reusable in isolation, e.g. in tests).
   */
  onDone?: () => void;
}

const speciesOptions: Species[] = ['pine', 'spruce', 'birch'];

export function LogForm({ log, onChange, onDone }: Props) {
  const update = <K extends keyof LogInput>(key: K, value: LogInput[K]) => {
    onChange({ ...log, [key]: value });
  };

  const root = rootEndDiameter(log);
  const top = topEndDiameter(log);

  /**
   * Users think in terms of "how far apart are the two supports", not
   * "how far is each support from its nearest end". Internally we still
   * store `supportInset` (distance from each end to its support) because
   * the taper math keys off it — but we present the spacing and derive
   * the inset: inset = (length − spacing) / 2.
   */
  const spacingMm = Math.max(0, log.length - 2 * log.supportInset);
  const updateSpacing = (newSpacingMm: number) => {
    const spacing = Math.max(0, Math.min(newSpacingMm, log.length));
    const inset = Math.round((log.length - spacing) / 2);
    onChange({ ...log, supportInset: inset });
  };
  /**
   * Changing the log length does NOT touch `supportInset`. Historically
   * this handler recomputed the inset to preserve the current spacing,
   * but that clobbered the user's support-spacing input as they typed
   * the length digit-by-digit (e.g. going 5 → 50 → 500 would first push
   * spacing down to 5 mm on the first keystroke). The physically stable
   * quantity to keep across a length edit is the inset — how far each
   * support sits in from the nearest end — not the spacing.
   *
   * If the new length ends up smaller than 2×inset the spacing goes
   * negative; we surface that as a warning in the `hint` below rather
   * than silently correcting it.
   */
  const updateLength = (newLengthMm: number) => {
    onChange({ ...log, length: Math.max(0, newLengthMm) });
  };

  const spacingInvalid = spacingMm <= 0;
  const insetCm = log.supportInset / 10;

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        Measure the log diameter at each of the two supports underneath it. The
        app extrapolates the taper to the log ends.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* All log measurements are entered in centimetres — that's how
            sawyers work with tape measures in the field. Planks, kerf, bark
            and blade height remain in mm; we convert at the UI boundary and
            round to whole mm on write to avoid floating-point drift. */}
        <CmField
          label="Root-side Ø at support (cm)"
          valueMm={log.rootSideDiameter}
          onChangeMm={(v) => update('rootSideDiameter', v)}
        />
        <CmField
          label="Top-side Ø at support (cm)"
          valueMm={log.topSideDiameter}
          onChangeMm={(v) => update('topSideDiameter', v)}
        />
        <CmField
          label="Distance between supports (cm)"
          valueMm={spacingMm}
          onChangeMm={updateSpacing}
          hint={
            spacingInvalid
              ? '⚠ must be > 0 and < log length'
              : `${insetCm.toFixed(0)} cm sticks out past each support.`
          }
          hintTone={spacingInvalid ? 'warn' : 'default'}
          wholeCm
        />
        <CmField
          label="Log length (cm)"
          valueMm={log.length}
          onChangeMm={updateLength}
          wholeCm
        />
      </div>
      <div
        className={`rounded-md px-3 py-2 text-xs flex items-center justify-between border ${
          spacingInvalid
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-stone-50 border-stone-200 text-stone-600'
        }`}
      >
        <span>Extrapolated ends:</span>
        <span className="tabular-nums">
          {spacingInvalid
            ? 'need support spacing > 0'
            : `root ${(root / 10).toFixed(1)} cm · top ${(top / 10).toFixed(1)} cm`}
        </span>
      </div>
      <label className="block text-sm">
        <span className="text-stone-600">Species</span>
        <select
          value={log.species}
          onChange={(e) => update('species', e.target.value as Species)}
          className="mt-1 block w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-forest-500 focus:ring-forest-500"
        >
          {speciesOptions.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
      {/* "OK, back to cutting" — closes this panel and scrolls the
          Controls card into view so the sawyer lands on the Cut
          button. The parent owns the actual scroll / close behaviour
          (via App.tsx) so LogForm stays purely presentational. */}
      {onDone && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onDone}
            disabled={spacingInvalid}
            className={`w-full rounded-md py-2 font-semibold text-sm transition flex items-center justify-center gap-1.5 shadow-sm ${
              spacingInvalid
                ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                : 'bg-forest-500 hover:bg-forest-600 text-white'
            }`}
            style={
              spacingInvalid
                ? { backgroundColor: '#e7e5e4', color: '#78716c' }
                : { backgroundColor: '#35671e', color: '#ffffff' }
            }
            title={
              spacingInvalid
                ? 'Fix the support spacing first'
                : 'Close this panel and jump back to the Cut button'
            }
          >
            <span aria-hidden className="text-base leading-none">✓</span>
            OK, back to cutting
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Number input that displays centimetres while the underlying model is
 * millimetres. By default accepts one decimal place (1 mm resolution); pass
 * `wholeCm` for fields like support spacing / log length where sub-cm is
 * meaningless. Values are always rounded to whole mm on write so the stored
 * value never drifts (e.g. 40.1 cm → exactly 401 mm rather than 400.9999…).
 */
function CmField({
  label,
  valueMm,
  onChangeMm,
  hint,
  hintTone = 'default',
  wholeCm = false
}: {
  label: string;
  valueMm: number;
  onChangeMm: (mm: number) => void;
  hint?: string;
  hintTone?: 'default' | 'warn';
  wholeCm?: boolean;
}) {
  // Show one decimal only when needed so whole-cm values stay clean (e.g.
  // "40" not "40.0"). `Number()`'s round-trip strips the trailing zero.
  const display = wholeCm
    ? Math.round(valueMm / 10)
    : Number((valueMm / 10).toFixed(1));
  return (
    <label className="block text-sm">
      <span className="text-stone-600">{label}</span>
      <input
        type="number"
        inputMode={wholeCm ? 'numeric' : 'decimal'}
        step={wholeCm ? '1' : '0.1'}
        value={display}
        onChange={(e) => {
          const cm = Number(e.target.value);
          if (!Number.isFinite(cm)) return;
          const mm = wholeCm ? Math.round(cm) * 10 : Math.round(cm * 10);
          onChangeMm(mm);
        }}
        className="mt-1 block w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-forest-500 focus:ring-forest-500"
      />
      {hint && (
        <span
          className={`text-xs ${
            hintTone === 'warn' ? 'text-amber-800 font-medium' : 'text-stone-500'
          }`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

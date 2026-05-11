import { buttEndDiameter, topEndDiameter } from '../core/taper';
import type { LogInput, Species } from '../core/types';

interface Props {
  log: LogInput;
  onChange: (log: LogInput) => void;
}

const speciesOptions: Species[] = ['pine', 'spruce', 'birch'];

export function LogForm({ log, onChange }: Props) {
  const update = <K extends keyof LogInput>(key: K, value: LogInput[K]) => {
    onChange({ ...log, [key]: value });
  };

  const butt = buttEndDiameter(log);
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
   * When length changes we preserve the current spacing by recomputing the
   * inset. If the new length is smaller than the current spacing we clamp
   * spacing to the new length (inset → 0).
   */
  const updateLength = (newLengthMm: number) => {
    const length = Math.max(0, newLengthMm);
    const clampedSpacing = Math.min(spacingMm, length);
    const inset = Math.round((length - clampedSpacing) / 2);
    onChange({ ...log, length, supportInset: inset });
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
          label="Butt-side Ø at support (cm)"
          valueMm={log.buttSideDiameter}
          onChangeMm={(v) => update('buttSideDiameter', v)}
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
            ? 'bg-brand-50 border-brand-200 text-brand-800'
            : 'bg-stone-50 border-stone-200 text-stone-600'
        }`}
      >
        <span>Extrapolated ends:</span>
        <span className="tabular-nums">
          {spacingInvalid
            ? 'need support spacing > 0'
            : `butt ${(butt / 10).toFixed(1)} cm · top ${(top / 10).toFixed(1)} cm`}
        </span>
      </div>
      <label className="block text-sm">
        <span className="text-stone-600">Species</span>
        <select
          value={log.species}
          onChange={(e) => update('species', e.target.value as Species)}
          className="mt-1 block w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-brand-500 focus:ring-brand-500"
        >
          {speciesOptions.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
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
        className="mt-1 block w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-brand-500 focus:ring-brand-500"
      />
      {hint && (
        <span
          className={`text-xs ${
            hintTone === 'warn' ? 'text-brand-700 font-medium' : 'text-stone-500'
          }`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

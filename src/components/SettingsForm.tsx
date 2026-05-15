import type { MillSettings } from '../core/types';

interface Props {
  settings: MillSettings;
  onChange: (s: MillSettings) => void;
}

export function SettingsForm({ settings, onChange }: Props) {
  const update = <K extends keyof MillSettings>(key: K, value: MillSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StepperField
          label="Kerf (mm)"
          value={settings.kerf}
          onChange={(v) => update('kerf', v)}
          step={1}
          min={0}
        />
        <StepperField
          label="Min slab (mm)"
          value={settings.minSlab}
          onChange={(v) => update('minSlab', v)}
          step={1}
          min={0}
        />
        <StepperField
          label="Edge clearance (mm)"
          hint="Extra inset from bark to avoid wane"
          value={settings.edgeClearance}
          onChange={(v) => update('edgeClearance', v)}
          step={1}
          min={0}
        />
        <Field
          label="Cutting tool"
          hint="Cosmetic only — label used in the UI for your saw"
        >
          <select
            value={settings.cuttingTool}
            onChange={(e) =>
              update('cuttingTool', e.target.value as MillSettings['cuttingTool'])
            }
            className="w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border"
          >
            <option value="chain">Chain (chainsaw mill)</option>
            <option value="blade">Blade (bandsaw mill)</option>
          </select>
        </Field>
      </div>
      {/* Full-width so the longer explanatory label has room to breathe. */}
      <label className="flex items-start gap-2 text-sm pt-1">
        <input
          type="checkbox"
          checked={settings.autoRotateForSquaring}
          onChange={(e) => update('autoRotateForSquaring', e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-stone-400 text-forest-600 focus:ring-forest-500"
        />
        <span className="flex-1">
          <span className="text-stone-700 font-medium">Auto-rotate during squaring</span>
          <span className="block text-xs text-stone-500">
            After each of the first four squaring slabs, the log spins
            automatically to the next face (0° → 90° → 180° → 270°) so the
            NEXT pill and height readout preview the next setup. Uncheck
            to rotate manually — the planner will then hint{' '}
            <i>"Rotate to X° first"</i> when you're off the recommended face.
          </span>
        </span>
      </label>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-stone-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

/**
 * Numeric settings field with a − / + stepper either side of a
 * centred input — same look-and-feel as the prominent variant of
 * `CmField` in LogForm so all mill-relevant numbers share one
 * touch-friendly UI on a tablet. Values are integers in the field's
 * native unit (mm here); typed entries round to the nearest integer
 * on write so the persisted value never drifts.
 *
 * The stepper buttons always snap to the nearest whole step before
 * adding the increment, so repeated taps from a fractional starting
 * point (e.g. 5.4) don't leave the value stuck at 6.4 / 7.4 / etc.
 */
function StepperField({
  label,
  value,
  onChange,
  hint,
  step = 1,
  min
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  step?: number;
  min?: number;
}) {
  const baseInputCls =
    'block w-full border-stone-300 bg-stone-50 border focus:border-forest-500 focus:ring-forest-500';
  const sizeCls = 'px-2 py-2.5 text-lg font-semibold tabular-nums';
  const btnCls =
    'shrink-0 h-full w-11 flex items-center justify-center text-xl font-semibold bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 disabled:text-stone-300 disabled:bg-stone-50 transition';

  const stepBy = (direction: -1 | 1) => {
    const snapped = Math.round(value / step) * step;
    let next = snapped + direction * step;
    if (min != null) next = Math.max(min, next);
    onChange(next);
  };
  const decDisabled = min != null && value <= min;

  return (
    <label className="block text-sm">
      <span className="text-stone-700 font-medium">{label}</span>
      <div className="mt-1 flex items-stretch">
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
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            const clamped = min != null ? Math.max(min, n) : n;
            onChange(clamped);
          }}
          className={`${baseInputCls} ${sizeCls} text-center no-spinner`}
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
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

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
        <Field label="Kerf (mm)">
          <input
            type="number"
            step="0.5"
            value={settings.kerf}
            onChange={(e) => update('kerf', Number(e.target.value) || 0)}
            className="w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border"
          />
        </Field>
        <Field label="Min slab (mm)">
          <input
            type="number"
            value={settings.minSlab}
            onChange={(e) => update('minSlab', Number(e.target.value) || 0)}
            className="w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border"
          />
        </Field>
        <Field label="Edge clearance (mm)" hint="Extra inset from bark to avoid wane">
          <input
            type="number"
            value={settings.edgeClearance}
            onChange={(e) => update('edgeClearance', Number(e.target.value) || 0)}
            className="w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border"
          />
        </Field>
        <Field label="Bark thickness (mm)" hint="Shown on uncut (round) sides">
          <input
            type="number"
            value={settings.barkThickness}
            onChange={(e) => update('barkThickness', Number(e.target.value) || 0)}
            className="w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border"
          />
        </Field>
        <Field label="Strategy">
          <select
            value={settings.strategy}
            onChange={(e) => update('strategy', e.target.value as MillSettings['strategy'])}
            className="w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border"
          >
            <option value="priority">Strict priority</option>
            <option value="value">Maximize value</option>
            <option value="min-waste">Minimize waste</option>
          </select>
        </Field>
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

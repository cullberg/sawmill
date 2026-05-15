import { rootEndDiameter, topEndDiameter, designDiameter, sweepMm } from '../core/taper';
import { barkThicknessForSpecies } from '../core/species';
import type { LogInput, MillSettings, Species } from '../core/types';

interface Props {
  log: LogInput;
  onChange: (log: LogInput) => void;
  /**
   * Mill settings — needed because Bark thickness lives in the log
   * panel rather than under "Mill settings": bark is a property of
   * the wood, not of the saw, so it belongs alongside species. The
   * underlying data still lives on `MillSettings.barkThickness`
   * (where layout/EndView read it) so this is purely a UI
   * relocation; we accept the full settings object plus an
   * `onSettingsChange` so the bark stepper can write through.
   */
  settings: MillSettings;
  onSettingsChange: (s: MillSettings) => void;
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

const speciesOptions: Species[] = [
  // Conifers first, ordered widest-default-bark to thinnest, then
  // hardwoods. The grid wraps to 3 cols so this ordering keeps the
  // conifer / hardwood split on row boundaries.
  'pine',
  'spruce',
  'larch',
  'fir',
  'birch',
  'aspen',
  'alder',
  'oak',
  'beech'
];

export function LogForm({ log, onChange, settings, onSettingsChange, onDone }: Props) {
  const update = <K extends keyof LogInput>(key: K, value: LogInput[K]) => {
    onChange({ ...log, [key]: value });
  };

  /**
   * Picking a species rewrites the log species AND resets bark
   * thickness to that species' default (12 / 8 / 6 mm for pine /
   * spruce / birch). The reset is unconditional: the simplest UX
   * contract is "species selector ⇒ species defaults", and a sawyer
   * who wants a non-default bark just edits the bark stepper after
   * picking the species. Always-overwrite avoids a "did this carry
   * over from the last log?" footgun.
   */
  const updateSpecies = (s: Species) => {
    onChange({ ...log, species: s });
    onSettingsChange({ ...settings, barkThickness: barkThicknessForSpecies(s) });
  };

  const updateBark = (mm: number) => {
    onSettingsChange({ ...settings, barkThickness: Math.max(0, mm) });
  };

  const root = rootEndDiameter(log);
  const top = topEndDiameter(log);
  const sweep = sweepMm(log);
  const effective = designDiameter(log);
  const straightMin = Math.min(root, top);

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
            round to whole mm on write to avoid floating-point drift.

            The two diameter fields are marked `prominent` because they
            change on every log while support spacing / length / species
            stay put for runs of similar logs — and on the workshop
            tablet the sawyer needs to see these numbers from a step or
            two back. Bigger input, bolder label, but same grid cell so
            the two-column layout is preserved. */}
        <CmField
          label="Root-side Ø at support (cm)"
          valueMm={log.rootSideDiameter}
          onChangeMm={(v) => update('rootSideDiameter', v)}
          prominent
        />
        <CmField
          label="Top-side Ø at support (cm)"
          valueMm={log.topSideDiameter}
          onChangeMm={(v) => update('topSideDiameter', v)}
          prominent
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
          prominent
        />
        <CmField
          label="Log length (cm)"
          valueMm={log.length}
          onChangeMm={updateLength}
          wholeCm
          prominent
        />
      </div>
      {/* Sweep / curvature row — sits in its own line under the main
          grid because it's a different kind of measurement (taken with
          a string line stretched between the two ends, not with a tape
          around the log) and most logs leave it at 0. Defaulting the
          field to 0 cm matches the "assume straight unless told
          otherwise" contract: a fresh install or a freshly-loaded log
          with no `sweepMm` set reads 0 here and behaves exactly as
          before sweep handling existed.

          Marked `prominent` so it gets the same big ± buttons as the
          two diameter fields — sweep is the kind of thing a sawyer
          dials in by tapping +/− while eyeballing the string line, so
          the buttons matter even more here than the keyboard. */}
      <CmField
        label="Worst sweep / curvature (cm)"
        valueMm={sweep}
        onChangeMm={(v) => update('sweepMm', Math.max(0, v))}
        hint={
          sweep > 0
            ? `Effective design Ø shrinks to ${(effective / 10).toFixed(1)} cm (was ${(straightMin / 10).toFixed(1)} cm).`
            : 'String-line offset at the worst point. Leave 0 for straight logs.'
        }
        prominent
        wholeCm
      />
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
      {/* Sweep advisory — only shown when the sawyer has entered a
          non-zero sweep. The wording avoids the "horns up" jargon (which
          inverts in different milling traditions) in favour of a strictly
          physical description: highest point of the bow on top, ends
          drooping toward the bed. A small inline icon shows the same
          shape so any remaining word ambiguity is settled by the
          picture. The first cut then takes the apex off and subsequent
          cuts work on a near-straight cant. */}
      {!spacingInvalid && sweep > 0 && (
        <div className="rounded-md px-3 py-2 text-xs border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2.5">
          <svg
            width={44}
            height={22}
            viewBox="0 0 44 22"
            aria-hidden
            className="flex-none"
          >
            {/* Curved-log silhouette: arc on top, flat-ish base on
                supports. Mirrors the convention used in the cone
                banner figure. */}
            <path
              d="M 4 16 Q 22 -2 40 16 L 40 19 Q 22 7 4 19 Z"
              fill="#fcd9b6"
              stroke="#92400e"
              strokeWidth={1}
              strokeLinejoin="round"
            />
            {/* Two support tips under the arc. */}
            <path d="M 9 19 L 7 22 L 11 22 Z" fill="#57534e" />
            <path d="M 35 19 L 33 22 L 37 22 Z" fill="#57534e" />
          </svg>
          <span>
            <span className="font-medium">Curved log:</span> roll it so the
            highest point of the bow is on{' '}
            <span className="font-semibold">top</span> (ends drooping toward
            the bed) before the first cut. The first slab will shave off the
            apex and leave a flat reference face.
          </span>
        </div>
      )}
      {/* Species + Bark thickness share a 2-column row again now
          that Species is back to a compact dropdown. The selected
          species icon sits next to the dropdown so the picker still
          carries a visual cue for the wood type — but the row no
          longer eats vertical space when there are many species to
          choose from. */}
      <div className="grid grid-cols-2 gap-3">
        <SpeciesPicker value={log.species} onChange={updateSpecies} />
        <BarkField
          valueMm={settings.barkThickness}
          onChangeMm={updateBark}
          speciesDefault={barkThicknessForSpecies(log.species)}
        />
      </div>
      {/* Strategy lives in the Log panel because it answers the
          question "what do I want OUT of THIS log?" rather than "how
          is the saw configured?". The same physical mill can be used
          for a strict-priority job on one log and a minimise-waste
          job on the next — strategy is per-log intent, not a saw
          property. Full-width because the option labels ("Strict
          priority" / "Maximize value" / "Minimize waste") need
          breathing room and the row already shares a panel with two
          dropdowns above. */}
      <label className="block text-sm">
        <span className="text-stone-600">Strategy</span>
        <select
          value={settings.strategy}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              strategy: e.target.value as MillSettings['strategy']
            })
          }
          className="mt-1 block w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-forest-500 focus:ring-forest-500"
        >
          <option value="priority">Strict priority — fill #1 first, then #2, …</option>
          <option value="value">Maximize value — pick the highest-scoring set</option>
          <option value="min-waste">Minimize waste — pick the tightest-fitting set</option>
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
 *
 * Pass `prominent` for fields that change on every log (the two Ø
 * fields) — renders with a taller input, bolder label, and a pair of
 * big − / + buttons flanking the input that step by 1 cm. The buttons
 * always snap to the nearest whole cm on press so repeated taps don't
 * accumulate fractional drift (41.3 → + → 42, not 42.3). Users can
 * still type fractional values directly (e.g. 41.3) for the rare
 * case where they measured to the millimetre. Designed to sit in a
 * 2-column grid alongside non-prominent peers; the grid row grows to
 * fit the prominent cells and the non-prominent ones in that row just
 * get extra white space below the input, which looks fine.
 */
function CmField({
  label,
  valueMm,
  onChangeMm,
  hint,
  hintTone = 'default',
  wholeCm = false,
  prominent = false
}: {
  label: string;
  valueMm: number;
  onChangeMm: (mm: number) => void;
  hint?: string;
  hintTone?: 'default' | 'warn';
  wholeCm?: boolean;
  prominent?: boolean;
}) {
  // Show one decimal only when needed so whole-cm values stay clean (e.g.
  // "40" not "40.0"). `Number()`'s round-trip strips the trailing zero.
  const display = wholeCm
    ? Math.round(valueMm / 10)
    : Number((valueMm / 10).toFixed(1));
  const labelCls = prominent ? 'text-stone-700 font-medium' : 'text-stone-600';
  // Shared base for the <input>; prominent variants and stepper variants
  // tweak the rounded corners so the input visually fuses with the − / +
  // buttons flanking it.
  const baseInputCls =
    'block w-full border-stone-300 bg-stone-50 border focus:border-forest-500 focus:ring-forest-500';
  const sizeCls = prominent
    ? 'px-2 py-2.5 text-lg font-semibold tabular-nums'
    : 'px-2 py-1.5';

  /**
   * − / + handlers. Always snap to the nearest whole cm so repeated
   * taps from a fractional starting point (41.3 cm) don't leave the
   * value stuck at 42.3 / 43.3 / etc. — the sawyer almost certainly
   * wants round-cm values when they're using the buttons at all.
   */
  const stepCm = (direction: -1 | 1) => {
    const currentCm = valueMm / 10;
    const nextCm = Math.max(0, Math.round(currentCm) + direction);
    onChangeMm(Math.round(nextCm) * 10);
  };
  const decDisabled = valueMm <= 0;

  if (!prominent) {
    // Compact variant: unchanged, no stepper.
    return (
      <label className="block text-sm">
        <span className={labelCls}>{label}</span>
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
          className={`mt-1 rounded-md ${baseInputCls} ${sizeCls}`}
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

  // Prominent variant: − button · input · + button, all same height,
  // fused into a single visual unit with rounded outer corners only.
  // Native browser stepper is hidden (`no-spinner`) because its size
  // and placement varies by browser — the explicit buttons are more
  // consistent on the workshop tablet.
  const btnCls =
    'shrink-0 h-full w-11 flex items-center justify-center text-xl font-semibold bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 disabled:text-stone-300 disabled:bg-stone-50 transition';
  return (
    <label className="block text-sm">
      <span className={labelCls}>{label}</span>
      <div className="mt-1 flex items-stretch">
        <button
          type="button"
          onClick={() => stepCm(-1)}
          disabled={decDisabled}
          aria-label={`Decrease ${label} by 1 cm`}
          className={`${btnCls} rounded-l-md border-r-0`}
        >
          −
        </button>
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
          className={`${baseInputCls} ${sizeCls} text-center no-spinner`}
        />
        <button
          type="button"
          onClick={() => stepCm(1)}
          aria-label={`Increase ${label} by 1 cm`}
          className={`${btnCls} rounded-r-md border-l-0`}
        >
          +
        </button>
      </div>
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

/**
 * Bark thickness stepper (mm). Visually matches the prominent variant
 * of `CmField` so it sits naturally next to the Species selector, but
 * works in millimetres directly because bark is a small dimension
 * where centimetre granularity would be too coarse and decimal
 * centimetres would be confusing (sawyers think of bark in mm —
 * "thirty-eights of an inch" maps cleanly to "10 mm").
 *
 * The hint shows the species default ("Pine default 12 mm") so the
 * sawyer has visual confirmation of which species' default is in
 * play, and so an unusual override stays self-documenting.
 */
function BarkField({
  valueMm,
  onChangeMm,
  speciesDefault
}: {
  valueMm: number;
  onChangeMm: (mm: number) => void;
  speciesDefault: number;
}) {
  const baseInputCls =
    'block w-full border-stone-300 bg-stone-50 border focus:border-forest-500 focus:ring-forest-500';
  const sizeCls = 'px-2 py-2.5 text-lg font-semibold tabular-nums';
  const btnCls =
    'shrink-0 h-full w-11 flex items-center justify-center text-xl font-semibold bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 disabled:text-stone-300 disabled:bg-stone-50 transition';

  // Steps in 1 mm for fine control — bark thickness is small enough
  // that taps add up quickly even at 1 mm resolution. Snap-to-step
  // before adding the increment, same idea as the cm stepper.
  const stepBy = (direction: -1 | 1) => {
    const next = Math.max(0, Math.round(valueMm) + direction);
    onChangeMm(next);
  };
  const decDisabled = valueMm <= 0;
  const matchesDefault = Math.abs(valueMm - speciesDefault) < 0.5;

  return (
    <label className="block text-sm">
      <span className="text-stone-700 font-medium">Bark thickness (mm)</span>
      <div className="mt-1 flex items-stretch">
        <button
          type="button"
          onClick={() => stepBy(-1)}
          disabled={decDisabled}
          aria-label="Decrease bark thickness by 1 mm"
          className={`${btnCls} rounded-l-md border-r-0`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          step="1"
          value={Math.round(valueMm)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChangeMm(Math.max(0, Math.round(n)));
          }}
          className={`${baseInputCls} ${sizeCls} text-center no-spinner`}
        />
        <button
          type="button"
          onClick={() => stepBy(1)}
          aria-label="Increase bark thickness by 1 mm"
          className={`${btnCls} rounded-r-md border-l-0`}
        >
          +
        </button>
      </div>
      <span className="text-xs text-stone-500">
        {matchesDefault
          ? `Species default: ${speciesDefault} mm`
          : `Species default ${speciesDefault} mm — overridden.`}
      </span>
    </label>
  );
}

/**
 * Compact species picker — native `<select>` for the option list (so
 * we don't have to reinvent dropdown a11y, scrolling, and keyboard
 * navigation) plus the selected species' icon shown immediately to
 * its left as a visual cue. Replaces the earlier 3×3 button grid
 * because that grid took too much vertical space on small tablets
 * once the species list grew past three entries.
 *
 * Native `<option>` elements can't render SVG inline reliably across
 * browsers, so the icon is drawn outside the select rather than per-
 * option. The dropdown still scales to N species with no layout
 * changes — adding a tenth species only requires extending the
 * literal union and the icon switch.
 */
function SpeciesPicker({
  value,
  onChange
}: {
  value: Species;
  onChange: (s: Species) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-stone-600">Species</span>
      <div className="mt-1 flex items-stretch gap-2">
        {/* Icon tile — same forest-50 background as the selected
            state of the old grid, so the visual language carries
            over. Fixed width so the dropdown lines up consistently
            with neighbouring fields in the 2-column grid. */}
        <div
          className="shrink-0 flex items-center justify-center w-11 rounded-md border border-stone-300 bg-stone-50"
          aria-hidden
        >
          <SpeciesIcon species={value} selected />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Species)}
          className="flex-1 min-w-0 rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-forest-500 focus:ring-forest-500"
        >
          {speciesOptions.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

/**
 * Tiny tree silhouette used inside `SpeciesPicker`. Flat-colour SVGs
 * sized 28×32 — small enough to tuck above a one-line label without
 * dominating the row, large enough to read at arm's length.
 *
 * Drawing conventions:
 *   - Conifers always taper to a point on top; hardwoods always have
 *     a rounded crown. That's the single strongest "kind of tree"
 *     visual cue and lets a tablet user navigate by silhouette
 *     before reading the label.
 *   - Trunk colour key:
 *       pine    — warm red-brown, narrow
 *       spruce  — dark brown, very short under dense foliage
 *       fir     — like spruce but slimmer, cooler crown
 *       larch   — orangey-brown trunk, sparse layered crown
 *       birch   — near-white with a few dark hashmarks
 *       aspen   — grey-green smooth trunk
 *       alder   — mid grey-brown trunk, slightly squat
 *       oak     — thick gnarled brown trunk, broad crown
 *       beech   — silver-grey smooth trunk, full crown
 *   - Crown colour ramps from pine's sage green through spruce/fir's
 *     dark forest green to the deciduous mid- and spring-greens.
 *   - All icons share the same baseline (y = 32) so the row reads as
 *     a unit.
 */
function SpeciesIcon({ species, selected }: { species: Species; selected: boolean }) {
  // Slight opacity bump for the selected variant so the active icon
  // pops against the forest-50 panel; non-selected variants stay a
  // touch muted to make the selection state obvious.
  const opacity = selected ? 1 : 0.85;
  const W = 28;
  const H = 32;
  const sharedSvgProps = {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    'aria-hidden': true as const,
    style: { opacity }
  };
  if (species === 'pine') {
    return (
      <svg {...sharedSvgProps}>
        {/* Trunk — reddish brown, narrows slightly upward. */}
        <path d="M 12 32 L 12 18 L 16 18 L 16 32 Z" fill="#a0522d" />
        {/* Three sparse umbrella-like crown layers at the top. */}
        <ellipse cx={14} cy={6} rx={6} ry={3.2} fill="#7fa46b" />
        <ellipse cx={14} cy={11} rx={8} ry={3.5} fill="#7fa46b" />
        <ellipse cx={14} cy={16} rx={7} ry={3} fill="#7fa46b" />
      </svg>
    );
  }
  if (species === 'spruce') {
    return (
      <svg {...sharedSvgProps}>
        {/* Short brown trunk peeking out from under the dense crown. */}
        <path d="M 12 32 L 12 28 L 16 28 L 16 32 Z" fill="#6b4423" />
        {/* Stacked triangular crown — three tiers, dark forest green,
            dense from low to high. */}
        <path d="M 14 2 L 7 12 L 21 12 Z" fill="#2f5d2a" />
        <path d="M 14 8 L 5 20 L 23 20 Z" fill="#2f5d2a" />
        <path d="M 14 14 L 3 28 L 25 28 Z" fill="#2f5d2a" />
      </svg>
    );
  }
  if (species === 'fir') {
    return (
      <svg {...sharedSvgProps}>
        {/* Short trunk, slightly cooler colour than spruce. */}
        <path d="M 12.5 32 L 12.5 28 L 15.5 28 L 15.5 32 Z" fill="#5a3a1f" />
        {/* Tall narrow triangular crown — single sweep, blue-tinged
            green so it reads cooler than spruce's warm forest green. */}
        <path
          d="M 14 1 L 8 14 L 11 14 L 6 24 L 9 24 L 4 28 L 24 28 L 19 24 L 22 24 L 17 14 L 20 14 Z"
          fill="#3d6948"
        />
      </svg>
    );
  }
  if (species === 'larch') {
    return (
      <svg {...sharedSvgProps}>
        {/* Tall slim orangey-brown trunk visible the full height. */}
        <path d="M 13 32 L 13 8 L 15 8 L 15 32 Z" fill="#b87333" />
        {/* Sparse, soft, layered foliage in autumn yellow-green —
            larch is deciduous-conifer so a slightly warmer green
            suits it. */}
        <ellipse cx={14} cy={7} rx={4.5} ry={2} fill="#bcb14e" />
        <ellipse cx={14} cy={13} rx={6.5} ry={2.2} fill="#bcb14e" />
        <ellipse cx={14} cy={19} rx={8} ry={2.5} fill="#bcb14e" />
        <ellipse cx={14} cy={25} rx={6} ry={2.2} fill="#bcb14e" />
      </svg>
    );
  }
  if (species === 'birch') {
    return (
      <svg {...sharedSvgProps}>
        {/* White trunk with characteristic dark horizontal hashmarks. */}
        <path
          d="M 12 32 L 12 14 L 16 14 L 16 32 Z"
          fill="#f5f5f4"
          stroke="#78716c"
          strokeWidth={0.6}
        />
        <line x1={12} y1={20} x2={16} y2={20} stroke="#1c1917" strokeWidth={0.8} />
        <line x1={12} y1={26} x2={14} y2={26} stroke="#1c1917" strokeWidth={0.8} />
        <line x1={14} y1={23} x2={16} y2={23} stroke="#1c1917" strokeWidth={0.8} />
        {/* Soft rounded crown — lighter spring green to contrast with
            the conifers' darker triangles. */}
        <ellipse cx={14} cy={9} rx={9} ry={7} fill="#9bbf6e" />
      </svg>
    );
  }
  if (species === 'aspen') {
    return (
      <svg {...sharedSvgProps}>
        {/* Slim grey-green smooth trunk. */}
        <path d="M 13 32 L 13 16 L 15 16 L 15 32 Z" fill="#a8a89a" />
        {/* Tall narrow oval crown — aspen has a more upright, slightly
            shimmering look than birch. */}
        <ellipse cx={14} cy={9} rx={6} ry={9} fill="#b5d36a" />
      </svg>
    );
  }
  if (species === 'alder') {
    return (
      <svg {...sharedSvgProps}>
        {/* Mid grey-brown squat trunk. */}
        <path d="M 12 32 L 12 18 L 16 18 L 16 32 Z" fill="#7a6553" />
        {/* Slightly irregular round-cone crown, mid-green. */}
        <ellipse cx={14} cy={11} rx={9} ry={9} fill="#6e9457" />
        <ellipse cx={11} cy={6} rx={3} ry={3} fill="#6e9457" />
        <ellipse cx={18} cy={5} rx={3} ry={3} fill="#6e9457" />
      </svg>
    );
  }
  if (species === 'oak') {
    return (
      <svg {...sharedSvgProps}>
        {/* Thick gnarled trunk — wider than the conifers to hint at
            oak's bulk. */}
        <path d="M 11 32 L 11 18 L 17 18 L 17 32 Z" fill="#705038" />
        {/* Broad bumpy crown — a row of overlapping circles to evoke
            oak's lobed silhouette. */}
        <circle cx={8} cy={12} r={5} fill="#5e7e3b" />
        <circle cx={14} cy={7} r={6} fill="#5e7e3b" />
        <circle cx={20} cy={12} r={5} fill="#5e7e3b" />
        <circle cx={11} cy={16} r={4} fill="#5e7e3b" />
        <circle cx={17} cy={16} r={4} fill="#5e7e3b" />
      </svg>
    );
  }
  // Beech
  return (
    <svg {...sharedSvgProps}>
      {/* Smooth silver-grey trunk. */}
      <path d="M 12 32 L 12 17 L 16 17 L 16 32 Z" fill="#9ba0a0" />
      {/* Full domed crown, slightly bronze-tinted summer green. */}
      <ellipse cx={14} cy={10} rx={11} ry={8} fill="#85a05d" />
    </svg>
  );
}

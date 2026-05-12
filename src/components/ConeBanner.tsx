import { rootEndDiameter, topEndDiameter } from '../core/taper';
import type { LogInput } from '../core/types';
import type { ConeState } from '../state/usePlan';

interface Props {
  cone: ConeState;
  log: LogInput;
}

/**
 * Compact taper-compensation notice. Renders in one of four states,
 * but ALWAYS occupies the same vertical footprint so the EndView below
 * never jumps up or down when the cone state changes (e.g. the sawyer
 * rotates the log onto a flat face and `bedFlat` flips). Jumping
 * content is actively irritating on a workshop tablet where the
 * sawyer's eye is locked on the EndView between cuts.
 *
 * States:
 *   - active   : a positive root-side lowering is required (log still
 *                rolls freely on round wood). Amber accent + side-view
 *                figure of the log tilted on level supports, amber
 *                arrow under the root support showing the drop.
 *                Amber is distinct from forest (primaries) and signal-
 *                red (physical-saw drawings).
 *   - noDrop   : measurements match or root is smaller — no drop
 *                needed, but the sawyer still hasn't cut a reference
 *                face to close the matter. Neutral stone-grey.
 *   - bedFlat  : log currently rests on a flat cut face and can't
 *                roll. Cone question suspended. Neutral stone-grey.
 *   - resolved : two cuts 180° apart have been made — the pith is
 *                formally horizontal. Forest-green confirmation so the
 *                sawyer gets positive feedback that the cone work is
 *                done and can stop worrying about it.
 *
 * The taper of the drawn log (active / noDrop variants) is
 * proportional to the actual `rootSideDiameter` / `topSideDiameter`
 * so the illustration reads consistently with what the sawyer
 * measured.
 */
export function ConeBanner({ cone, log }: Props) {
  // Decide which state we're in. Order matters when more than one
  // condition is true simultaneously:
  //   - `resolved` trumps `bedFlat` because "you finished the cone
  //     work" is strictly more informative than "the log happens to
  //     rest flat right now".
  //   - Between the two unresolved states (active / noDrop), a
  //     positive drop requirement is the only actionable one.
  const state: 'active' | 'noDrop' | 'bedFlat' | 'resolved' = cone.resolved
    ? 'resolved'
    : cone.bedFlat
      ? 'bedFlat'
      : cone.rootDropMm > 0
        ? 'active'
        : 'noDrop';

  // Tailwind class tuples per state. `min-h-[52px]` keeps the
  // footprint identical across all four so layout-shift vanishes.
  // The arbitrary value is picked to match the active variant's
  // intrinsic height (py-2 + figure SVG + line-height).
  const shell = 'rounded-lg border px-3 py-2 text-sm min-h-[52px] flex items-center';
  const body = 'flex items-center gap-2.5 flex-wrap w-full';

  if (state === 'active') {
    return (
      <div className={`${shell} border-amber-400 bg-amber-50`}>
        <div className={body}>
          <ConeFigure variant="active" log={log} rootDropMm={cone.rootDropMm} />
          <span className="font-medium text-amber-900">Cone compensation:</span>
          <span className="text-amber-800">
            lower root-side support by{' '}
            <span className="font-bold tabular-nums">{cone.rootDropMm.toFixed(0)} mm</span>
          </span>
        </div>
      </div>
    );
  }

  if (state === 'noDrop') {
    return (
      <div className={`${shell} border-stone-300 bg-stone-50`}>
        <div className={body}>
          <ConeFigure variant="noDrop" log={log} rootDropMm={0} />
          <span className="font-medium text-stone-700">No support drop needed</span>
          <span className="text-stone-600 hidden sm:inline text-xs">
            — measurements match or root is smaller. Cut a reference face on each side to resolve the cone.
          </span>
        </div>
      </div>
    );
  }

  if (state === 'bedFlat') {
    return (
      <div className={`${shell} border-stone-300 bg-stone-50`}>
        <div className={body}>
          <span aria-hidden className="text-stone-500 text-lg leading-none">⚖</span>
          <span className="font-medium text-stone-700">Log resting flat</span>
          <span className="text-stone-600 hidden sm:inline text-xs">
            — it can't roll, so cone compensation is paused at this rotation.
          </span>
        </div>
      </div>
    );
  }

  // state === 'resolved'
  return (
    <div className={`${shell} border-forest-300 bg-forest-50`}>
      <div className={body}>
        <span aria-hidden className="text-forest-600 text-lg leading-none">✓</span>
        <span className="font-medium text-forest-800">Cone resolved</span>
        <span className="text-forest-700 hidden sm:inline text-xs">
          — two cuts 180° apart, the pith is now horizontal between the supports.
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Side-view log illustration                                          */
/* ------------------------------------------------------------------ */

type Variant = 'active' | 'noDrop';

interface FigureProps {
  variant: Variant;
  log: LogInput;
  rootDropMm: number;
}

/**
 * Small side-view figure showing the whole log resting on its two
 * supports. The log silhouette runs the full length of the log from
 * root end (left) to top end (right); the supports sit `supportInset`
 * in from each end, matching the sawyer's physical setup.
 *
 * Coordinate system inside the SVG:
 *   - The log axis runs horizontally; root end is at the left, top end
 *     at the right. Half-diameters drive the silhouette thickness at
 *     four known points (root end, root support, top support, top end)
 *     and the silhouette is a linear trapezoid between them (the cone
 *     is a true cone, i.e. linear in z).
 *   - Support tips are at fixed y (both level) in the `active`
 *     variant — so the root-side of the log rides higher because the
 *     root is physically thicker, giving the pith axis its tell-tale
 *     downward-to-the-top slope. A red down-arrow under the root
 *     support underlines the compensation action.
 *   - For the `noDrop` variant both supports stay level too, but the
 *     log is near-cylindrical so the pith is near-horizontal.
 *
 * The resolved / bed-flat states don't use this figure at all — the
 * parent component renders a smaller confirmation banner for those
 * states (same footprint so layout doesn't shift, but no need for a
 * proportional log drawing when the question is settled or paused).
 *
 * Nothing in this figure is meant to be measurable — it's a
 * proportional schematic so the banner state reads at a glance.
 */
function ConeFigure({ variant, log, rootDropMm }: FigureProps) {
  const W = 96;
  const H = 36;

  // Log axis runs across the figure with a small margin on each side.
  const xMargin = 4;
  const xLogRoot = xMargin;
  const xLogTop = W - xMargin;
  const logSpan = xLogTop - xLogRoot;

  // Fraction of the log length that sits past each support. Both
  // supports sit at `supportInset` from their respective log end.
  const len = Math.max(1, log.length);
  const fSupport = Math.min(0.45, log.supportInset / len); // clamp so the supports are always visibly inside the log
  const xRootSup = xLogRoot + fSupport * logSpan;
  const xTopSup = xLogTop - fSupport * logSpan;

  // Four half-diameters in figure space, all scaled together so the
  // taper proportions are preserved. mmPerPx chosen so a typical
  // 300–400 mm log maps to a comfortable 8–11 px radius; scale down
  // further if a measurement would push past `rMax`.
  const dRootEnd = Math.max(1, rootEndDiameter(log));
  const dTopEnd = Math.max(1, topEndDiameter(log));
  const dRootSup = Math.max(1, log.rootSideDiameter);
  const dTopSup = Math.max(1, log.topSideDiameter);
  const mmPerPx = 0.055;
  const raw = [dRootEnd, dTopEnd, dRootSup, dTopSup].map((d) => (d / 2) * mmPerPx);
  const rMax = 9;
  const rMin = 2.5;
  const scale = Math.min(1, rMax / Math.max(...raw));
  const [rRootEnd, rTopEnd, rRootSup, rTopSup] = raw.map((r) => Math.max(rMin, r * scale));

  // Supports share one y baseline in both active and noDrop variants:
  // the sawyer hasn't yet dropped the root support, so the two tips
  // are level. The pith is then forced to slope down-to-the-right
  // when the root is thicker than the top (`active`), or stays
  // (nearly) horizontal when the diameters are equal (`noDrop`).
  const supportHeight = 5;
  const ySupportTip = H - supportHeight - 7; // 7 px under the support base for the arrow

  // Supports are under the log, tips pointing up; the log's bottom
  // profile rests on the support tip. So pith_y = support tip y − r
  // (SVG y grows downwards, so "up from the support" is subtracting).
  const yPithRootSup = ySupportTip - rRootSup;
  const yPithTopSup = ySupportTip - rTopSup;

  // Linearly extrapolate the pith to the two log ends so the
  // silhouette spans the full log length.
  const pithSlope = (yPithTopSup - yPithRootSup) / (xTopSup - xRootSup);
  const pithAt = (x: number): number => yPithRootSup + pithSlope * (x - xRootSup);
  const yPithLogRoot = pithAt(xLogRoot);
  const yPithLogTop = pithAt(xLogTop);

  const accent = variant === 'active' ? '#b45309' : '#78716c';
  const axisColor = accent;

  // Log silhouette (four points of the trapezoid, walking CW in SVG):
  // top-root → top-top → bottom-top → bottom-root.
  const logPath =
    `M ${xLogRoot} ${yPithLogRoot - rRootEnd}` +
    ` L ${xLogTop} ${yPithLogTop - rTopEnd}` +
    ` L ${xLogTop} ${yPithLogTop + rTopEnd}` +
    ` L ${xLogRoot} ${yPithLogRoot + rRootEnd}` +
    ' Z';

  const supportHalf = 4;
  const supportPath = (x: number, yTip: number): string =>
    `M ${x} ${yTip}` +
    ` L ${x - supportHalf} ${yTip + supportHeight}` +
    ` L ${x + supportHalf} ${yTip + supportHeight}` +
    ' Z';

  // Drop arrow under the root support (active variant only).
  const arrowY1 = ySupportTip + supportHeight + 1;
  const arrowY2 = H - 1;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={
        variant === 'noDrop'
          ? 'Log on supports, both ends equal'
          : `Log on supports, lower root by ${rootDropMm.toFixed(0)} millimetres`
      }
      className="flex-none"
    >
      {/* Log body — subtle wood-tone fill with a darker outline. */}
      <path
        d={logPath}
        fill="#efe1cf"
        stroke="#8b5e34"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      {/* Pith axis — spans the full log length, dashed; slope encodes
          whether the log is tilted. */}
      <line
        x1={xLogRoot}
        y1={yPithLogRoot}
        x2={xLogTop}
        y2={yPithLogTop}
        stroke={axisColor}
        strokeWidth={0.9}
        strokeDasharray="2 2"
        opacity={0.85}
      />

      {/* Support blocks. */}
      <path d={supportPath(xRootSup, ySupportTip)} fill="#57534e" />
      <path d={supportPath(xTopSup, ySupportTip)} fill="#57534e" />

      {/* Active-variant drop arrow. */}
      {variant === 'active' && (
        <g stroke={accent} fill={accent} strokeWidth={1}>
          <line x1={xRootSup} y1={arrowY1} x2={xRootSup} y2={arrowY2} />
          <polygon
            points={`${xRootSup - 2.5},${arrowY2 - 2.5} ${xRootSup + 2.5},${arrowY2 - 2.5} ${xRootSup},${arrowY2 + 0.5}`}
            stroke="none"
          />
        </g>
      )}
    </svg>
  );
}

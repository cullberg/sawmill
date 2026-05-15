import { rootEndDiameter, sweepMm, topEndDiameter } from '../core/taper';
import type { LogInput } from '../core/types';
import type { ConeState } from '../state/usePlan';

interface Props {
  cone: ConeState;
  log: LogInput;
}

/**
 * Compact taper-compensation notice. Two user-visible states —
 * "compensation needed" (amber) and "cone OK" (forest green) —
 * driven by four internal cone-state signals. Three of those four
 * signals (`resolved`, `bedFlat`, `noDrop`) all mean the same thing
 * from the sawyer's perspective — "no drop needed right now" — and
 * collapse into the same green confirmation badge. Only `active`
 * (round log, positive drop) stands apart, because it's the only
 * one with an action attached.
 *
 * The four-signal state machine is still visible to anyone hovering
 * the card via the `title` tooltip, so the distinction is not lost
 * for debugging; it's just hidden from the primary read.
 *
 * ALWAYS occupies the same vertical footprint so the layout around
 * it never jumps when the state changes. Jumping content is
 * actively irritating on a workshop tablet where the sawyer's eye
 * is locked on the EndView above between cuts.
 *
 * Precedence when multiple conditions are true: resolved > bedFlat
 * > active > noDrop. `bedFlat` trumping `active` is what fixes the
 * "claims 10 mm compensation when the log is already flat on the
 * bed" bug — a flat cut face already compensates for the taper, so
 * telling the sawyer to ALSO lower the support would
 * over-compensate.
 */
export function ConeBanner({ cone, log }: Props) {
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
          <span className="text-amber-800">
            Lower root-side support by{' '}
            <span className="font-bold tabular-nums text-amber-900">
              {cone.rootDropMm.toFixed(0)} mm
            </span>
          </span>
        </div>
      </div>
    );
  }

  // resolved / bedFlat / noDrop — all read as "cone OK" to the sawyer.
  // The tooltip preserves the underlying distinction for anyone who
  // wants to know exactly why.
  const tooltip =
    state === 'resolved'
      ? 'Cone resolved — two cuts 180° apart, the pith is horizontal between the supports.'
      : state === 'bedFlat'
        ? 'Log rests on a flat cut face — the taper is already compensated at this rotation, so no further drop is needed here.'
        : 'Measured diameters match (or root is smaller) — no support drop needed yet.';
  return (
    <div
      className={`${shell} border-forest-300 bg-forest-50`}
      title={tooltip}
    >
      <div className={body}>
        <span aria-hidden className="text-forest-600 text-lg leading-none">✓</span>
        <span className="font-medium text-forest-800">Cone resolved</span>
        <span className="text-forest-700 hidden sm:inline text-xs">
          — no support drop needed at this rotation.
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Side-view log illustration                                          */
/* ------------------------------------------------------------------ */

/**
 * `active` = amber accent + drop arrow under the root support.
 * `noDrop` = grey accent, no arrow, log drawn near-horizontal.
 *
 * Only the `active` variant is used by the current banner — the
 * no-drop / bed-flat states collapsed into a single compact card
 * without the figure. The `'noDrop'` case is kept in the union so
 * the figure is still available if a future redesign wants to
 * re-introduce it inside the neutral banner.
 */
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
 * parent component renders a smaller confirmation banner for each
 * (same footprint so layout doesn't shift, but no need for a
 * proportional log drawing once the cone is either resolved or
 * physically neutralised by the flat face on the bed).
 *
 * Nothing in this figure is meant to be measurable — it's a
 * proportional schematic so the banner state reads at a glance.
 */
function ConeFigure({ variant, log, rootDropMm }: FigureProps) {
  // Grown from the earlier 96×36 since the banner no longer carries
  // a "Cone compensation:" label — the figure now claims that space.
  // All downstream sizes (logPath, support blocks, drop arrow, pith
  // stroke) derive from W / H / mmPerPx / rMax so tuning those four
  // numbers alone scales the whole schematic uniformly.
  //
  // Width is fixed; height grows to make room for the bow when sweep
  // is present, so a horns-up arch never clips against the top edge
  // of the SVG. The headroom is computed below from the same
  // exaggeration factor used to draw the bow.
  const W = 160;

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
  // 300–400 mm log maps to a comfortable 13–17 px radius; scale down
  // further if a measurement would push past `rMax`.
  const dRootEnd = Math.max(1, rootEndDiameter(log));
  const dTopEnd = Math.max(1, topEndDiameter(log));
  const dRootSup = Math.max(1, log.rootSideDiameter);
  const dTopSup = Math.max(1, log.topSideDiameter);
  const mmPerPx = 0.085;
  const raw = [dRootEnd, dTopEnd, dRootSup, dTopSup].map((d) => (d / 2) * mmPerPx);
  const rMax = 13;
  const rMin = 3;
  const scale = Math.min(1, rMax / Math.max(...raw));
  const [rRootEnd, rTopEnd, rRootSup, rTopSup] = raw.map((r) => Math.max(rMin, r * scale));

  // Curvature offset in figure space. Scaled by the same factor as the
  // diameters so a sawyer who reads "30 mm sweep on a 400 mm log" can
  // see roughly correct proportions: the bow is small relative to the
  // log's thickness but large enough to be visible. Sweep is the
  // perpendicular offset between the pith and the chord at midspan;
  // we render that as a quadratic bow in the side view (peak at the
  // halfway point) which is a fair approximation of a circular-arc
  // sweep at small offsets.
  const sweepFigPx = sweepMm(log) * mmPerPx * scale;
  // Bow exaggeration — see the longer comment near `bowFactor`. We
  // compute it here so it can also size the SVG headroom.
  const bowExaggeration = 1.6;
  const sweepDrawPx = sweepFigPx * bowExaggeration;

  // Figure height: 40 px is the straight-log baseline, plus headroom
  // for the bow apex so a horns-up arch never clips the top edge of
  // the SVG when sweep is large.
  const H = 40 + Math.ceil(sweepDrawPx);

  // Supports share one y baseline in both active and noDrop variants:
  // the sawyer hasn't yet dropped the root support, so the two tips
  // are level. The pith is then forced to slope down-to-the-right
  // when the root is thicker than the top (`active`), or stays
  // (nearly) horizontal when the diameters are equal (`noDrop`).
  const supportHeight = 6;
  const ySupportTip = H - supportHeight - 8; // leaves room for the drop arrow

  // Supports are under the log, tips pointing up; the log's bottom
  // profile rests on the support tip. So pith_y = support tip y − r
  // (SVG y grows downwards, so "up from the support" is subtracting).
  const yPithRootSup = ySupportTip - rRootSup;
  const yPithTopSup = ySupportTip - rTopSup;

  // Linearly extrapolate the pith chord to the two log ends so the
  // straight-log silhouette spans the full log length. With sweep
  // present, this line is the chord between the SUPPORT POINTS and
  // the actual pith bows AWAY from it. The bow is anchored at the
  // two supports (zero offset there) so the log is shown physically
  // resting on its supports — the ends overhanging past the supports
  // continue the same parabola and droop slightly below the chord,
  // which matches reality for a horns-up log on two supports.
  const pithSlope = (yPithTopSup - yPithRootSup) / (xTopSup - xRootSup);
  const chordAt = (x: number): number => yPithRootSup + pithSlope * (x - xRootSup);

  // Horns-up bow factor:
  //   - 0 at xRootSup and xTopSup (log touches each support)
  //   - 1 at the midpoint between the supports (apex of the bow)
  //   - slightly negative past the supports (ends droop below the chord)
  // SVG y grows downward, so "up on screen" means smaller y; the bow
  // is subtracted from the chord so a positive bow factor lifts the
  // pith upward = horns up.
  //
  // The shape is a parabola through (xRootSup, 0), (xTopSup, 0) with
  // peak 1 at the midpoint: bow(x) = 1 − ((2(x − xMid) / span))².
  // Past the supports this naturally goes negative; we clamp the
  // negative tail to −0.4 so the overhanging ends droop a little but
  // don't dive off the bottom of the figure for short support spans.
  //
  // We additionally apply a 1.6× visibility exaggeration (see
  // `sweepDrawPx` above): small numerical sweep values (a few mm)
  // only translate to ~2 px of bow at this figure scale, which is
  // too subtle to read. The exaggeration is a schematic license —
  // same kind of license the diameter scaling already uses
  // (mmPerPx = 0.085) — so the curvature reads at a glance. The
  // taper math elsewhere in the app remains unscaled.
  const xMidSup = (xRootSup + xTopSup) / 2;
  const halfSpanSup = Math.max(1, (xTopSup - xRootSup) / 2);
  const bowFactor = (x: number): number => {
    const u = (x - xMidSup) / halfSpanSup;
    return Math.max(-0.4, 1 - u * u);
  };
  const pithAt = (x: number): number => chordAt(x) - sweepDrawPx * bowFactor(x);

  // For taper, linearly interpolate the half-diameter along the chord
  // independent of the bow — radius is along-axis so it doesn't change
  // when the log bends. Endpoints: rRootEnd at xLogRoot, rTopEnd at
  // xLogTop.
  const rAt = (x: number): number => {
    const t = (x - xLogRoot) / Math.max(1, xLogTop - xLogRoot);
    return rRootEnd + (rTopEnd - rRootEnd) * t;
  };

  const accent = variant === 'active' ? '#b45309' : '#78716c';
  const axisColor = accent;

  // Log silhouette. For a straight log we'd draw a 4-point trapezoid;
  // for a curved log we sample top AND bottom edges along the pith bow
  // so the curvature is visible on both sides — a real horns-up log
  // viewed from the side has a curved bottom too, it's just lifted
  // off any surface between the two support points. Sampling 9 points
  // keeps the path light while still rendering a smooth curve. When
  // sweep = 0 the bow term is zero and the silhouette collapses to
  // the same trapezoid the figure used to draw before sweep handling
  // existed.
  //
  // The bow factor is zero at xRootSup and xTopSup (see `bowFactor`
  // above), so the bottom edge automatically touches each support
  // tip at its support x-position regardless of curvature — i.e. the
  // log visibly rests on its supports while still curving away from
  // them between the contact points. This is the geometrically true
  // rendering for a horns-up log on two trestles.
  const samples = 9;
  const xs: number[] = [];
  for (let i = 0; i < samples; i++) {
    xs.push(xLogRoot + ((xLogTop - xLogRoot) * i) / (samples - 1));
  }
  const topEdge = xs.map((x) => `${x.toFixed(2)} ${(pithAt(x) - rAt(x)).toFixed(2)}`);
  const botEdge = xs
    .slice()
    .reverse()
    .map((x) => `${x.toFixed(2)} ${(pithAt(x) + rAt(x)).toFixed(2)}`);
  const logPath = `M ${topEdge.join(' L ')} L ${botEdge.join(' L ')} Z`;

  const supportHalf = 5;
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
          ? sweepMm(log) > 0
            ? 'Curved log on supports, both ends equal'
            : 'Log on supports, both ends equal'
          : sweepMm(log) > 0
            ? `Curved log on supports, lower root by ${rootDropMm.toFixed(0)} millimetres`
            : `Log on supports, lower root by ${rootDropMm.toFixed(0)} millimetres`
      }
      className="flex-none"
    >
      {/* Log body — subtle wood-tone fill with a darker outline. */}
      <path
        d={logPath}
        fill="#efe1cf"
        stroke="#8b5e34"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* Pith axis — spans the full log length, dashed; slope encodes
          whether the log is tilted, and the bow encodes sweep. For
          straight logs (sweep = 0) the path collapses to a line. */}
      <path
        d={`M ${xs.map((x) => `${x.toFixed(2)} ${pithAt(x).toFixed(2)}`).join(' L ')}`}
        fill="none"
        stroke={axisColor}
        strokeWidth={1.1}
        strokeDasharray="3 2"
        opacity={0.85}
      />

      {/* Support blocks. */}
      <path d={supportPath(xRootSup, ySupportTip)} fill="#57534e" />
      <path d={supportPath(xTopSup, ySupportTip)} fill="#57534e" />

      {/* Active-variant drop arrow. */}
      {variant === 'active' && (
        <g stroke={accent} fill={accent} strokeWidth={1.2}>
          <line x1={xRootSup} y1={arrowY1} x2={xRootSup} y2={arrowY2} />
          <polygon
            points={`${xRootSup - 3.2},${arrowY2 - 3.2} ${xRootSup + 3.2},${arrowY2 - 3.2} ${xRootSup},${arrowY2 + 0.8}`}
            stroke="none"
          />
        </g>
      )}
    </svg>
  );
}

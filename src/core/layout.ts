import type { MillSettings, PlacedPlank, PlankSpec, Species } from './types';
import { cupFactorForSpecies } from './species';

/**
 * Build the user-facing label for a plank produced from a given spec.
 * Prefers the spec's `label` when the user has typed one, falling back
 * to the canonical "width×thickness" form used by `layout.ts` (and
 * therefore visible on every produced plank in the end-view today).
 * This is the single chokepoint that makes user-typed labels actually
 * flow through to the produced planks; without it, layout would
 * always overwrite the label with the geometric form, leaving the
 * label text input in `PriorityList` purely cosmetic.
 *
 * Whitespace-only labels are treated as "not set" so a sawyer who
 * accidentally tabs a space in doesn't get blank labels in the
 * end-view illustration. (Note: the seed labels in `storage.ts`
 * happen to read "thickness×width" — the opposite order — but that
 * cosmetic mismatch is older than this helper and keeping the seed
 * labels untouched avoids forcing every existing saved plan to
 * re-render with new strings.)
 */
function plankLabel(spec: PlankSpec): string {
  const trimmed = spec.label?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : `${spec.width}×${spec.thickness}`;
}

/**
 * Geometry helpers and the auto-layout algorithm.
 *
 * The log cross-section is treated as a circle of the DESIGN diameter
 * (the smaller of the two end diameters) centred at (0,0). Planks are
 * axis-aligned rectangles inside this circle at the current rotation.
 *
 * Layout strategy (cant sawing):
 *   1. Pick a central cant spanning the pith. Which spec becomes the
 *      cant depends on the Mill strategy:
 *        - 'priority': the top-scoring spec whose larger side fits.
 *        - 'value' / 'min-waste' / 'min-cup': every enabled spec is
 *          trialled as a cant; the candidate whose whole-log layout
 *          scores best wins.
 *   2. Fill a stack above and below the cant, greedy per slot, picking
 *      the best (spec, orientation) pair that still fits.
 *   3. Fill one side board per side (left / right) with its own stack.
 *
 * The 'min-cup' strategy is a quartersawn-friendly variant of
 * 'min-waste': it ranks layouts by used area like 'min-waste', then
 * uses a small per-plank cup-risk penalty (driven by distance from
 * the pith, plank width / thickness, and the species' tangential /
 * radial shrinkage ratio) plus a pith-zone penalty as a soft
 * tiebreaker. So yield comes first, cup-resistance breaks ties.
 *
 * The layout is purely geometric; the sawyer then chooses the physical
 * order of cuts at runtime via the Rotate + Step controls.
 *
 * Weaknesses addressed in this revision (vs `layout.legacy.ts`):
 *  - Orientation-aware scoring: each slot picks the best-fitting
 *    (spec, orientation) rather than locking orientation in by spec.
 *  - 'value' uses value DENSITY (value per mm²) so a high-value plank
 *    that eats the whole slot can lose to several smaller planks that
 *    together earn more per unit of log.
 *  - 'min-waste' and 'value' try every candidate cant and keep the
 *    layout that scores best; 'priority' keeps the old behaviour by
 *    design (the user ranked specs for a reason — strict priority
 *    must respect that).
 *  - Dropped the dead area tiebreaker in strict-priority scoring
 *    (specs have unique indices, so it never fired).
 */

export interface LayoutInput {
  designDiameterMm: number;
  settings: MillSettings;
  priority: PlankSpec[];
  /**
   * Log species — only consulted by the `min-cup` strategy, which
   * weights its cup-risk score by the species-specific tangential /
   * radial shrinkage ratio. Other strategies ignore this field.
   * Optional with a `pine` default so callers (and existing tests)
   * that don't yet supply it keep working.
   */
  species?: Species;
}

export interface LayoutResult {
  planks: PlacedPlank[];
  /** Summary counts per plank-spec id. */
  counts: Record<string, number>;
  /** Summary of material used vs total, mm^2 (end-view). */
  usedArea: number;
  totalArea: number;
}

const EPS = 1e-6;

/**
 * Returns true if an axis-aligned rectangle fits entirely inside a
 * circle of radius r centred at (0,0).
 */
export function rectFitsInCircle(
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number
): boolean {
  // All four corners must be within r.
  const hx = w / 2;
  const hy = h / 2;
  const corners = [
    [cx - hx, cy - hy],
    [cx + hx, cy - hy],
    [cx - hx, cy + hy],
    [cx + hx, cy + hy]
  ];
  const r2 = r * r + EPS;
  return corners.every(([x, y]) => x * x + y * y <= r2);
}

/**
 * Compute the auto-layout.
 *
 * All planks are placed as axis-aligned rectangles in the plan frame.
 * A plank spec may be used in either orientation (width×thickness or
 * thickness×width); the slot-filler chooses whichever fits best.
 */
export function computeLayout(input: LayoutInput): LayoutResult {
  const { designDiameterMm, settings, priority, species = 'pine' } = input;
  // Planks must stay inside the usable wood: design radius minus bark minus
  // edge clearance (wane avoidance).
  const r = designDiameterMm / 2 - settings.edgeClearance - settings.barkThickness;
  const kerf = settings.kerf;
  const specs = priority.filter((p) => p.enabled);
  const totalArea = Math.PI * r * r;

  if (r <= 0 || specs.length === 0) {
    return { planks: [], counts: {}, usedArea: 0, totalArea };
  }

  const maxCountOf = (spec: PlankSpec) => spec.maxCount ?? Number.POSITIVE_INFINITY;

  /**
   * Per-plank cup-risk score (used by `min-cup` strategy).
   *
   * Drying cup is driven by the difference between tangential and
   * radial shrinkage in a plank's wide face. Two factors dominate:
   *
   *   1. **Distance from the pith** (`d`). A plank centred on the
   *      pith has its wide face running radially → quartersawn →
   *      negligible cup. A plank far from the pith has its wide face
   *      tangent to the rings → flat-sawn → strong cup. Risk grows
   *      ~linearly with `d`.
   *
   *   2. **Width** (`w`). Cup magnitude scales with the differential
   *      shrinkage spanning the plank's wide face. A wide flat-sawn
   *      plank cups noticeably more than a narrow one of the same
   *      thickness; risk grows ~quadratically with `w` (cup is
   *      roughly proportional to width × differential shrinkage,
   *      and visible cup magnitude scales with width again because
   *      of geometry).
   *
   *   3. **Thickness** (`t`). Thick planks resist cupping mechanically.
   *      Risk shrinks ~linearly with `t`.
   *
   *   4. **Species cup factor** (~tangential/radial ratio). Birch
   *      and aspen cup harder than pine for the same geometry.
   *
   * Combined formula:
   *
   *     cupRisk = (w² · d) / t · (cupFactor − 1)
   *
   * The (cupFactor − 1) term collapses isotropic species (ratio = 1)
   * to zero risk, which is the geometrically correct limit.
   *
   * Returned as a non-negative number; lower is better. Units are
   * arbitrary — the strategy ranks layouts by *relative* risk.
   */
  const cupFactor = cupFactorForSpecies(species);
  const cupRisk = (w: number, t: number, dFromPith: number): number => {
    if (t <= 0) return 0;
    return ((w * w) * dFromPith * (cupFactor - 1)) / t;
  };

  /**
   * Pith-zone penalty (used by `min-cup` strategy).
   *
   * The pith centre is unstable wood — juvenile, often containing
   * pith checks and reaction wood — so a sawyer pursuing a cup-
   * minimising layout typically also wants to AVOID placing a plank
   * directly across the pith (geometrically tempting because the
   * cant is naturally quartersawn, but practically risky for any
   * plank meant to stay flat in service).
   *
   * Penalty kicks in when a plank's bounding box covers the pith
   * (i.e. (0,0) is inside the plank rectangle), and scales with how
   * "central" the plank is — a plank exactly centred on the pith
   * gets the full penalty; one whose edge just grazes the pith gets
   * almost none. The penalty units are chosen to be the same order
   * of magnitude as `cupRisk` for typical (w, t, d) values so it
   * naturally combines into the total `min-cup` score.
   */
  const PITH_RADIUS_MM = 25; // ≈ 50 mm Ø juvenile-wood zone, conservative
  const pithPenalty = (cx: number, cy: number, w: number, t: number): number => {
    const hx = w / 2;
    const hy = t / 2;
    const coversPith =
      Math.abs(cx) < hx + EPS && Math.abs(cy) < hy + EPS;
    if (!coversPith) return 0;
    // How deep into the plank the pith sits, normalised to the
    // half-extents. 1.0 = pith dead-centre, 0.0 = pith on the edge.
    const fx = 1 - Math.abs(cx) / hx;
    const fy = 1 - Math.abs(cy) / hy;
    const centrality = Math.min(fx, fy);
    return PITH_RADIUS_MM * w * t * centrality * (cupFactor - 1);
  };

  /**
   * Strategy-specific score for a candidate (spec, orientation, position).
   * Orientation is handled by the caller (see the slot-filler), because
   * for 'min-waste' the slot's actual plank area matters more than the
   * spec's nominal area.
   *
   * 'priority': tier number × 1e6 dominates everything. No area
   * tiebreaker — specs are unique in the priority list so the
   * tiebreaker from the legacy version never fired.
   *
   * 'value': absolute spec value (falls back to cross-section area
   * when the user hasn't filled in a `value`), minus a tiny anti-
   * repeat term so equal-value specs take turns instead of one
   * hogging every slot. Absolute (not per-mm²) because density
   * greedy-fills tend to pack many small planks that, in total, earn
   * less than one big plank — an artefact of the rigid cant-saw
   * geometry we use. See the `value @ 500mm` regression reproducer
   * in layout.test.ts for the failure mode.
   *
   * 'min-waste': raw area. Biggest plank wins; ties broken downstream
   * by the slot-filler's orientation preference.
   *
   * 'min-cup': area minus a small cup-risk penalty. The "softer
   * tiebreaker over total area" interpretation: yield comes first,
   * cup-resistance breaks ties between near-equal-area candidates,
   * and pith-crossing planks are quietly demoted. Implemented as
   * `area − ε · (cupRisk + pithPenalty)` with ε small enough that
   * a meaningfully bigger plank always wins on raw area, but two
   * specs with similar area diverge on cup risk.
   */
  const CUP_TIEBREAK_EPS = 1e-3;
  const scoreSpec = (
    spec: PlankSpec,
    counts: Record<string, number>,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): number => {
    switch (settings.strategy) {
      case 'value': {
        const raw = spec.value ?? spec.width * spec.thickness;
        return raw - (counts[spec.id] ?? 0) * 1e-3;
      }
      case 'min-waste':
        return spec.width * spec.thickness;
      case 'min-cup': {
        const area = w * h;
        // Distance from pith of the plank centre.
        const dFromPith = Math.hypot(cx, cy);
        const risk = cupRisk(w, h, dFromPith) + pithPenalty(cx, cy, w, h);
        return area - CUP_TIEBREAK_EPS * risk;
      }
      case 'priority':
      default:
        return (specs.length - specs.indexOf(spec)) * 1e6;
    }
  };

  /**
   * Trial layout for a given cant choice. `counts` is passed in so
   * maxCount constraints accumulate across one trial but reset
   * between trials.
   */
  interface Trial {
    planks: PlacedPlank[];
    counts: Record<string, number>;
    cantSpec: PlankSpec;
    cantSize: { w: number; h: number };
  }

  /**
   * Greedy slot filler used for both the main stack above/below the
   * cant and for the side-board corridors. Walks from `yStart` in
   * `direction` placing the best-fitting (spec, orientation) pair at
   * each step. Respects an optional `xHalfLimit` so side-board stacks
   * can't ooze back into the central column.
   *
   * Returns the updated sequence counter.
   */
  const fillStack = (
    placed: PlacedPlank[],
    counts: Record<string, number>,
    cx: number,
    yStart: number,
    direction: 1 | -1,
    xHalfLimit: number | null,
    sequenceStart: number
  ): number => {
    let y = yStart;
    let seq = sequenceStart;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Build every (spec, orientation) that still fits this slot, then
      // pick the one with the highest score. This is the orientation-
      // aware scoring fix: we no longer lock orientation based on spec
      // identity — if the slot favours portrait over landscape for the
      // same spec, we pick portrait.
      type Candidate = {
        spec: PlankSpec;
        w: number;
        h: number;
        score: number;
      };
      const candidates: Candidate[] = [];
      for (const spec of specs) {
        if ((counts[spec.id] ?? 0) >= maxCountOf(spec)) continue;
        const orientations: Array<{ w: number; h: number }> =
          spec.width === spec.thickness
            ? [{ w: spec.width, h: spec.thickness }]
            : [
                { w: spec.width, h: spec.thickness },
                { w: spec.thickness, h: spec.width }
              ];
        for (const { w, h } of orientations) {
          if (xHalfLimit !== null && w / 2 > xHalfLimit + EPS) continue;
          const rectBottom = direction === 1 ? y : y - h;
          const rectTop = rectBottom + h;
          const cy = (rectBottom + rectTop) / 2;
          if (!rectFitsInCircle(cx, cy, w, h, r)) continue;
          candidates.push({ spec, w, h, score: scoreSpec(spec, counts, cx, cy, w, h) });
        }
      }
      if (candidates.length === 0) break;
      // Highest score wins. When tied, prefer the orientation whose
      // larger dimension aligns with the slot's long axis (= x here):
      // that keeps the plank flat in the stack and tends to use the
      // slot better.
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Secondary: larger area wins (relevant for min-waste ties).
        const aArea = a.w * a.h;
        const bArea = b.w * b.h;
        if (bArea !== aArea) return bArea - aArea;
        // Tertiary: prefer landscape (w >= h).
        return Number(b.w >= b.h) - Number(a.w >= a.h);
      });
      const pick = candidates[0];
      const rectBottom = direction === 1 ? y : y - pick.h;
      const rectTop = rectBottom + pick.h;
      seq += 1;
      placed.push({
        specId: pick.spec.id,
        x: cx,
        y: (rectBottom + rectTop) / 2,
        width: pick.w,
        thickness: pick.h,
        sequence: seq,
        label: plankLabel(pick.spec)
      });
      counts[pick.spec.id] = (counts[pick.spec.id] ?? 0) + 1;
      y = direction === 1 ? rectTop + kerf : rectBottom - kerf;
    }
    return seq;
  };

  /**
   * Side-board filler: places one anchor plank centred vertically at
   * cx = sign·(cantHalfWidth + kerf + anchorHalfWidth), then stacks
   * above and below it within the same corridor. Anchor is chosen as
   * the widest spec that fits into the remaining corridor width; this
   * is a small but noticeable improvement on the legacy version,
   * which picked the first spec in score order even if a wider spec
   * would have covered more corridor.
   */
  const trySide = (
    placed: PlacedPlank[],
    counts: Record<string, number>,
    cantHalfWidth: number,
    sign: 1 | -1,
    sequence: number
  ): number => {
    if (cantHalfWidth === 0) return sequence;
    const xInner = cantHalfWidth + kerf;
    const corridorWidth = r - xInner;
    if (corridorWidth <= 0) return sequence;

    type Candidate = { spec: PlankSpec; w: number; h: number; score: number };
    const candidates: Candidate[] = [];
    for (const spec of specs) {
      if ((counts[spec.id] ?? 0) >= maxCountOf(spec)) continue;
      const orientations: Array<{ w: number; h: number }> =
        spec.width === spec.thickness
          ? [{ w: spec.width, h: spec.thickness }]
          : [
              { w: spec.thickness, h: spec.width },
              { w: spec.width, h: spec.thickness }
            ];
      for (const { w, h } of orientations) {
        if (w > corridorWidth + EPS) continue;
        const cx = sign * (xInner + w / 2);
        if (!rectFitsInCircle(cx, 0, w, h, r)) continue;
        candidates.push({ spec, w, h, score: scoreSpec(spec, counts, cx, 0, w, h) });
      }
    }
    if (candidates.length === 0) return sequence;
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Prefer the orientation that best fills the corridor width:
      // leaves less unused wood next to the circle's curve.
      if (a.w !== b.w) return b.w - a.w;
      const aArea = a.w * a.h;
      const bArea = b.w * b.h;
      return bArea - aArea;
    });
    const pick = candidates[0];
    const cx = sign * (xInner + pick.w / 2);
    sequence += 1;
    placed.push({
      specId: pick.spec.id,
      x: cx,
      y: 0,
      width: pick.w,
      thickness: pick.h,
      sequence,
      label: plankLabel(pick.spec)
    });
    counts[pick.spec.id] = (counts[pick.spec.id] ?? 0) + 1;
    const sideHalf = pick.w / 2;
    sequence = fillStack(placed, counts, cx, pick.h / 2 + kerf, 1, sideHalf, sequence);
    sequence = fillStack(placed, counts, cx, -pick.h / 2 - kerf, -1, sideHalf, sequence);
    return sequence;
  };

  /**
   * Full layout pipeline for one chosen cant candidate. Returns an
   * independent Trial so the caller can compare candidates.
   */
  const layoutForCant = (cantSpec: PlankSpec, cantSize: { w: number; h: number }): Trial => {
    const placed: PlacedPlank[] = [];
    const counts: Record<string, number> = {};
    // Place the cant first.
    placed.push({
      specId: cantSpec.id,
      x: 0,
      y: 0,
      width: cantSize.w,
      thickness: cantSize.h,
      sequence: 1,
      label: plankLabel(cantSpec)
    });
    counts[cantSpec.id] = 1;
    let sequence = 1;
    const cantHalfWidth = cantSize.w / 2;
    const cantTop = cantSize.h / 2;
    const cantBottom = -cantSize.h / 2;
    // Main stacks above and below the cant. The xHalfLimit caps stack
    // plank widths at the cant's half-width so a wide stack plank
    // can't leak past the cant's side edges into the side-board
    // corridor — that was the source of the overlap bug with the
    // 'value' and 'min-waste' strategies, where `try every cant`
    // could pick a cant narrower than the best stack plank.
    sequence = fillStack(placed, counts, 0, cantTop + kerf, 1, cantHalfWidth, sequence);
    sequence = fillStack(placed, counts, 0, cantBottom - kerf, -1, cantHalfWidth, sequence);
    // Side-board corridors.
    sequence = trySide(placed, counts, cantHalfWidth, 1, sequence);
    sequence = trySide(placed, counts, cantHalfWidth, -1, sequence);
    return { planks: placed, counts, cantSpec, cantSize };
  };

  /**
   * Enumerate viable cant candidates. Each spec gets up to two
   * entries — landscape (long side horizontal) and portrait (long
   * side vertical) — any that actually fit inside the usable circle
   * at (0,0).
   */
  interface CantOption {
    spec: PlankSpec;
    size: { w: number; h: number };
  }
  const cantOptions: CantOption[] = [];
  for (const spec of specs) {
    const long = Math.max(spec.width, spec.thickness);
    const short = Math.min(spec.width, spec.thickness);
    const orientations: Array<{ w: number; h: number }> =
      long === short
        ? [{ w: long, h: long }]
        : [
            { w: long, h: short },
            { w: short, h: long }
          ];
    for (const o of orientations) {
      if (rectFitsInCircle(0, 0, o.w, o.h, r)) {
        cantOptions.push({ spec, size: o });
      }
    }
  }

  if (cantOptions.length === 0) {
    return { planks: [], counts: {}, usedArea: 0, totalArea };
  }

  /**
   * Cant selection rule:
   *  - 'priority': keep the legacy behaviour — the highest-priority
   *    enabled spec that fits becomes the cant, in its landscape
   *    orientation if possible. The user ranked specs on purpose;
   *    strict-priority must honour that. Still upgrades to
   *    orientation-aware slot-filling downstream.
   *  - 'value' / 'min-waste' / 'min-cup': trial every candidate
   *    cant, keep the layout whose TOTAL score is highest. For
   *    'min-cup' the trial score is `usedArea − ε · totalCupRisk`,
   *    so yield (area) leads and cup risk only breaks ties between
   *    near-equal-area trials. This matches the "softer tiebreaker
   *    over total area" interpretation: we don't sacrifice a sliver
   *    of yield to dodge a tiny bit of cup, but for two layouts
   *    that produce equally much wood we pick the more cup-resistant
   *    one.
   */
  let winner: Trial;
  if (settings.strategy === 'priority') {
    // Pick the highest-priority cantOption; within a spec prefer
    // landscape (first orientation we enumerated above).
    const bestOption = cantOptions
      .slice()
      .sort((a, b) => specs.indexOf(a.spec) - specs.indexOf(b.spec))[0];
    winner = layoutForCant(bestOption.spec, bestOption.size);
  } else {
    const trials = cantOptions.map((opt) => layoutForCant(opt.spec, opt.size));
    const trialScore = (t: Trial): number => {
      if (settings.strategy === 'value') {
        let total = 0;
        for (const p of t.planks) {
          const spec = specs.find((s) => s.id === p.specId);
          if (!spec) continue;
          total += spec.value ?? p.width * p.thickness;
        }
        return total;
      }
      if (settings.strategy === 'min-cup') {
        // Soft tiebreaker over area: total used area, minus a small
        // fraction of the total cup risk (per-plank cup + pith
        // penalty summed across the layout). The same epsilon that
        // governs per-slot scoring also governs trial scoring so a
        // sawyer can reason about both with one mental model.
        let area = 0;
        let risk = 0;
        for (const p of t.planks) {
          area += p.width * p.thickness;
          const dFromPith = Math.hypot(p.x, p.y);
          risk += cupRisk(p.width, p.thickness, dFromPith);
          risk += pithPenalty(p.x, p.y, p.width, p.thickness);
        }
        return area - CUP_TIEBREAK_EPS * risk;
      }
      // 'min-waste' → usedArea
      return t.planks.reduce((acc, p) => acc + p.width * p.thickness, 0);
    };
    trials.sort((a, b) => {
      const diff = trialScore(b) - trialScore(a);
      if (Math.abs(diff) > 1e-6) return diff;
      // Tiebreaker: fewer planks = simpler cut sequence for the sawyer.
      return a.planks.length - b.planks.length;
    });
    winner = trials[0];
  }

  const usedArea = winner.planks.reduce((acc, p) => acc + p.width * p.thickness, 0);
  return { planks: winner.planks, counts: winner.counts, usedArea, totalArea };
}

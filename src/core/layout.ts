import type { MillSettings, PlacedPlank, PlankSpec } from './types';

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
 *        - 'value' / 'min-waste': every enabled spec is trialled as a
 *          cant; the candidate whose whole-log layout scores best wins.
 *   2. Fill a stack above and below the cant, greedy per slot, picking
 *      the best (spec, orientation) pair that still fits.
 *   3. Fill one side board per side (left / right) with its own stack.
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
  const { designDiameterMm, settings, priority } = input;
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
   * Strategy-specific score for a spec. Orientation is handled by the
   * caller (see the slot-filler), because for 'min-waste' the slot's
   * actual plank area matters more than the spec's nominal area.
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
   */
  const scoreSpec = (spec: PlankSpec, counts: Record<string, number>): number => {
    switch (settings.strategy) {
      case 'value': {
        const raw = spec.value ?? spec.width * spec.thickness;
        return raw - (counts[spec.id] ?? 0) * 1e-3;
      }
      case 'min-waste':
        return spec.width * spec.thickness;
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
          if (!rectFitsInCircle(cx, (rectBottom + rectTop) / 2, w, h, r)) continue;
          candidates.push({ spec, w, h, score: scoreSpec(spec, counts) });
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
        candidates.push({ spec, w, h, score: scoreSpec(spec, counts) });
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
   *  - 'value' / 'min-waste': trial every candidate cant, keep the
   *    layout whose TOTAL score is highest (value for 'value',
   *    usedArea for 'min-waste'). This is the "try multiple cants"
   *    improvement.
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

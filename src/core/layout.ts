import type { MillSettings, PlacedPlank, PlankSpec } from './types';

/**
 * Geometry helpers and the auto-layout algorithm.
 *
 * The log cross-section is treated as a circle of the DESIGN diameter
 * (the smaller of the two end diameters) centred at (0,0). Planks are
 * axis-aligned rectangles inside this circle at the current rotation.
 *
 * Layout strategy (cant sawing):
 *   1. Place the LARGEST prioritized plank (or the highest-value one) as
 *      a central cant running through the pith.
 *   2. Fill above and below the cant with a stack of planks from the
 *      priority list, largest-first, with kerf between them.
 *   3. Fill left and right side boards that can fit next to the cant,
 *      stacking from the cant outwards.
 *
 * The layout is purely geometric; the sawyer then chooses the physical
 * order of cuts at runtime via the Rotate + Step controls.
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
 * All planks are placed with `width` along x and `thickness` along y.
 * A plank spec may be used in either orientation (width×thickness or
 * thickness×width) at the optimizer's discretion when exploring fits.
 */
export function computeLayout(input: LayoutInput): LayoutResult {
  const { designDiameterMm, settings, priority } = input;
  // Planks must stay inside the usable wood: design radius minus bark minus
  // edge clearance (wane avoidance).
  const r = designDiameterMm / 2 - settings.edgeClearance - settings.barkThickness;
  const kerf = settings.kerf;
  const specs = priority.filter((p) => p.enabled);

  const totalArea = Math.PI * r * r;
  const placed: PlacedPlank[] = [];
  const counts: Record<string, number> = {};

  if (r <= 0 || specs.length === 0) {
    return { planks: placed, counts, usedArea: 0, totalArea };
  }

  const maxCountOf = (spec: PlankSpec) => spec.maxCount ?? Number.POSITIVE_INFINITY;
  const canPlace = (specId: string): boolean => {
    const spec = specs.find((s) => s.id === specId);
    if (!spec) return false;
    return (counts[specId] ?? 0) < maxCountOf(spec);
  };

  const score = (spec: PlankSpec): number => {
    switch (settings.strategy) {
      case 'value':
        return (spec.value ?? spec.width * spec.thickness) - (counts[spec.id] ?? 0) * 1e-3;
      case 'min-waste':
        return spec.width * spec.thickness;
      case 'priority':
      default:
        // Earlier in the list = higher score; but prefer larger within the same tier.
        return (specs.length - specs.indexOf(spec)) * 1e6 + spec.width * spec.thickness;
    }
  };

  /**
   * Try to place a horizontal stack of planks starting from yStart going
   * in direction +1 (up) or -1 (down), constrained to fit inside the circle.
   * Planks are chosen greedily from the priority list, respecting counts.
   */
  const fillStack = (
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
      // Pick the best spec that still fits.
      const candidates = [...specs].sort((a, b) => score(b) - score(a));
      let placedOne = false;
      for (const spec of candidates) {
        if (!canPlace(spec.id)) continue;
        // Try both orientations (width×thickness) and (thickness×width).
        const orientations: Array<{ w: number; h: number }> = [
          { w: spec.width, h: spec.thickness },
          { w: spec.thickness, h: spec.width }
        ];
        // If width exactly equals thickness we'd duplicate; unique them.
        if (spec.width === spec.thickness) orientations.pop();

        for (const { w, h } of orientations) {
          if (xHalfLimit !== null && w / 2 > xHalfLimit + EPS) continue;
          const rectBottom = direction === 1 ? y : y - h;
          const rectTop = rectBottom + h;
          // Check fit inside circle at x = cx.
          if (!rectFitsInCircle(cx, (rectBottom + rectTop) / 2, w, h, r)) continue;
          // Place it.
          seq += 1;
          placed.push({
            specId: spec.id,
            x: cx,
            y: (rectBottom + rectTop) / 2,
            width: w,
            thickness: h,
            sequence: seq,
            label: `${spec.width}×${spec.thickness}`
          });
          counts[spec.id] = (counts[spec.id] ?? 0) + 1;
          y = direction === 1 ? rectTop + kerf : rectBottom - kerf;
          placedOne = true;
          break;
        }
        if (placedOne) break;
      }
      if (!placedOne) break;
    }
    return seq;
  };

  // Step 1. Choose the best "central cant" from the priority list. This is the
  // top-scoring spec whose LARGER dimension can still fit horizontally inside
  // the circle (so that its width spans across the pith).
  const centreCandidates = specs
    .filter((s) => canPlace(s.id))
    .sort((a, b) => score(b) - score(a));

  let sequence = 0;
  let cantHalfWidth = 0;
  let cantTop = 0;
  let cantBottom = 0;

  for (const spec of centreCandidates) {
    const orientations: Array<{ w: number; h: number }> = [
      { w: Math.max(spec.width, spec.thickness), h: Math.min(spec.width, spec.thickness) },
      { w: Math.min(spec.width, spec.thickness), h: Math.max(spec.width, spec.thickness) }
    ];
    let chosen: { w: number; h: number } | null = null;
    for (const o of orientations) {
      if (rectFitsInCircle(0, 0, o.w, o.h, r)) {
        chosen = o;
        break;
      }
    }
    if (!chosen) continue;
    sequence += 1;
    placed.push({
      specId: spec.id,
      x: 0,
      y: 0,
      width: chosen.w,
      thickness: chosen.h,
      sequence,
      label: `${spec.width}×${spec.thickness}`
    });
    counts[spec.id] = (counts[spec.id] ?? 0) + 1;
    cantHalfWidth = chosen.w / 2;
    cantTop = chosen.h / 2;
    cantBottom = -chosen.h / 2;
    break;
  }

  // Step 2. Fill above and below the central cant.
  sequence = fillStack(0, cantTop + kerf, 1, null, sequence);
  sequence = fillStack(0, cantBottom - kerf, -1, null, sequence);

  // Step 3. Side boards: try to place thin boards left and right of the cant.
  // The side-board zone is a vertical strip from x = cantHalfWidth + kerf to r.
  const trySide = (sign: 1 | -1) => {
    if (cantHalfWidth === 0) return;
    // Find the widest spec that fits as a side board.
    const sideSpecs = [...specs].sort((a, b) => score(b) - score(a));
    for (const spec of sideSpecs) {
      const orientations: Array<{ w: number; h: number }> = [
        { w: spec.thickness, h: spec.width },
        { w: spec.width, h: spec.thickness }
      ];
      for (const o of orientations) {
        if (!canPlace(spec.id)) break;
        // Side board width (x) must fit between cant edge and circle edge at y=0.
        const xInner = cantHalfWidth + kerf;
        const xOuter = xInner + o.w;
        if (xOuter > r) continue;
        const cx = sign * (xInner + o.w / 2);
        // Check that at this cx, the plank of height o.h fits vertically at y=0.
        if (!rectFitsInCircle(cx, 0, o.w, o.h, r)) continue;
        sequence += 1;
        placed.push({
          specId: spec.id,
          x: cx,
          y: 0,
          width: o.w,
          thickness: o.h,
          sequence,
          label: `${spec.width}×${spec.thickness}`
        });
        counts[spec.id] = (counts[spec.id] ?? 0) + 1;
        // Stack above and below this side board. Stacked planks are
        // centred at `cx` and must not extend back into the central
        // column — their half-width is capped at the side board's own
        // half-width so they stay inside the side-board corridor
        // between `cantHalfWidth + kerf` and the circle edge.
        const sideHalf = o.w / 2;
        sequence = fillStack(cx, o.h / 2 + kerf, 1, sideHalf, sequence);
        sequence = fillStack(cx, -o.h / 2 - kerf, -1, sideHalf, sequence);
        return;
      }
    }
  };

  trySide(1);
  trySide(-1);

  const usedArea = placed.reduce((acc, p) => acc + p.width * p.thickness, 0);
  return { planks: placed, counts, usedArea, totalArea };
}

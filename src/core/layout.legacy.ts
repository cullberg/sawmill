import type { MillSettings, PlacedPlank, PlankSpec } from './types';
import { rectFitsInCircle } from './layout';

/**
 * Snapshot of the pre-improvement layout algorithm.
 *
 * Kept alongside the live layout purely as a regression oracle: the
 * test `layout.test.ts > no-regression guard` asserts that for every
 * (log diameter × strategy) pair in a representative sweep, the new
 * `computeLayout` uses at least as much area as this legacy routine.
 *
 * Do NOT import this from the app. It is intentionally not re-exported
 * from a barrel file. When a further optimisation lands, re-snapshot
 * by copying the then-current `computeLayout` body here and run the
 * guard again — that way a single pass never silently regresses even
 * as the algorithm evolves.
 */

const EPS = 1e-6;

export interface LayoutInput {
  designDiameterMm: number;
  settings: MillSettings;
  priority: PlankSpec[];
}

export interface LayoutResult {
  planks: PlacedPlank[];
  counts: Record<string, number>;
  usedArea: number;
  totalArea: number;
}

export function computeLayoutLegacy(input: LayoutInput): LayoutResult {
  const { designDiameterMm, settings, priority } = input;
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
        return (specs.length - specs.indexOf(spec)) * 1e6 + spec.width * spec.thickness;
    }
  };

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
      const candidates = [...specs].sort((a, b) => score(b) - score(a));
      let placedOne = false;
      for (const spec of candidates) {
        if (!canPlace(spec.id)) continue;
        const orientations: Array<{ w: number; h: number }> = [
          { w: spec.width, h: spec.thickness },
          { w: spec.thickness, h: spec.width }
        ];
        if (spec.width === spec.thickness) orientations.pop();

        for (const { w, h } of orientations) {
          if (xHalfLimit !== null && w / 2 > xHalfLimit + EPS) continue;
          const rectBottom = direction === 1 ? y : y - h;
          const rectTop = rectBottom + h;
          if (!rectFitsInCircle(cx, (rectBottom + rectTop) / 2, w, h, r)) continue;
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

  sequence = fillStack(0, cantTop + kerf, 1, null, sequence);
  sequence = fillStack(0, cantBottom - kerf, -1, null, sequence);

  const trySide = (sign: 1 | -1) => {
    if (cantHalfWidth === 0) return;
    const sideSpecs = [...specs].sort((a, b) => score(b) - score(a));
    for (const spec of sideSpecs) {
      const orientations: Array<{ w: number; h: number }> = [
        { w: spec.thickness, h: spec.width },
        { w: spec.width, h: spec.thickness }
      ];
      for (const o of orientations) {
        if (!canPlace(spec.id)) break;
        const xInner = cantHalfWidth + kerf;
        const xOuter = xInner + o.w;
        if (xOuter > r) continue;
        const cx = sign * (xInner + o.w / 2);
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

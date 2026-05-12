import { describe, expect, it } from 'vitest';
import {
  SQUARING_ROTATIONS,
  bestPlankingRotation,
  nextSquaringRotation,
  squaringProgress
} from './usePlan';
import { circlePolygon } from '../core/geometry';
import type { Cut, PlacedPlank } from '../core/types';

/**
 * These tests exercise the pure helpers that drive the two-phase
 * cut-ordering logic. The helpers are the interesting bit: the React
 * hook `usePlan` wires them up, but each helper is a plain function
 * of (cuts | planks | shape) and can be verified without any rendering.
 */

const mkCut = (rotationDeg: number): Cut => ({
  y: 0,
  rotationDeg,
  note: 'test',
  producedPlankIds: []
});

const mkPlank = (
  x: number,
  y: number,
  width: number,
  thickness: number,
  sequence: number
): PlacedPlank => ({
  specId: 'test',
  x,
  y,
  width,
  thickness,
  sequence,
  label: `${thickness}×${width}`
});

describe('squaringProgress', () => {
  it('returns 0 for an empty cut list', () => {
    const { doneCount, doneSet } = squaringProgress([]);
    expect(doneCount).toBe(0);
    expect(doneSet.size).toBe(0);
  });

  it('maps each cut rotation to the closest squaring face', () => {
    const cuts = [mkCut(0), mkCut(90), mkCut(180)];
    const { doneCount, doneSet } = squaringProgress(cuts);
    expect(doneCount).toBe(3);
    expect(doneSet.has(0)).toBe(true);
    expect(doneSet.has(90)).toBe(true);
    expect(doneSet.has(180)).toBe(true);
    expect(doneSet.has(270)).toBe(false);
  });

  it('deduplicates repeated cuts at the same face', () => {
    const cuts = [mkCut(0), mkCut(0), mkCut(90)];
    const { doneCount } = squaringProgress(cuts);
    expect(doneCount).toBe(2);
  });

  it('tolerates tiny rotation jitter (±1°)', () => {
    const { doneCount } = squaringProgress([mkCut(0.5), mkCut(89.7), mkCut(359.6)]);
    // 0.5 → 0°, 89.7 → 90°, 359.6 → 0° (within ±1° of 0°, via wrap)
    expect(doneCount).toBe(2);
  });
});

describe('nextSquaringRotation', () => {
  it('starts at 0° for a fresh log', () => {
    expect(nextSquaringRotation([])).toBe(0);
  });

  it('advances 0 → 90 → 180 → 270', () => {
    // The helper only looks at which faces are done, not at the order the
    // sawyer performed them — exercising the full happy-path sequence
    // confirms both the advancement rule and the canonical ordering.
    expect(nextSquaringRotation([mkCut(0)])).toBe(90);
    expect(nextSquaringRotation([mkCut(0), mkCut(90)])).toBe(180);
    expect(nextSquaringRotation([mkCut(0), mkCut(90), mkCut(180)])).toBe(270);
  });

  it('returns undefined once all four faces are slabbed', () => {
    const cuts = SQUARING_ROTATIONS.map((r) => mkCut(r));
    expect(nextSquaringRotation(cuts)).toBeUndefined();
  });

  it('skips already-done faces no matter what order they were cut in', () => {
    // Sawyer cut 180° first (e.g. they rotated manually before their first cut).
    // Planner should now want 0° (the first un-done face in the canonical order).
    expect(nextSquaringRotation([mkCut(180)])).toBe(0);
  });
});

describe('bestPlankingRotation', () => {
  // A generous round log so all test planks still fit geometrically.
  const shape = circlePolygon(0, 0, 200, 48);

  it('returns undefined when there are no remaining planks', () => {
    expect(bestPlankingRotation([], shape)).toBeUndefined();
  });

  it('prefers the face with the most stack planks above the pith', () => {
    const planks: PlacedPlank[] = [
      // Three planks stacked above the pith (reachable from 0° up)
      mkPlank(0, 50, 150, 25, 1),
      mkPlank(0, 80, 150, 25, 2),
      mkPlank(0, 110, 150, 25, 3),
      // One plank on the +x side (reachable from 90° up)
      mkPlank(60, 0, 40, 100, 4)
    ];
    expect(bestPlankingRotation(planks, shape)).toBe(0);
  });

  it('picks the +x side when the main stack is exhausted', () => {
    const planks: PlacedPlank[] = [
      // Two planks on the +x side, none above the cant
      mkPlank(60, 10, 40, 60, 1),
      mkPlank(60, -10, 40, 60, 2)
    ];
    expect(bestPlankingRotation(planks, shape)).toBe(90);
  });

  it('returns undefined when every remaining plank straddles the pith', () => {
    // A lone cant centred at the pith has centreProj == 0 for every
    // rotation, so no face is "better" than another.
    const planks: PlacedPlank[] = [mkPlank(0, 0, 200, 80, 1)];
    expect(bestPlankingRotation(planks, shape)).toBeUndefined();
  });

  it('breaks ties in favour of 0°', () => {
    // Equal-sized planks placed symmetrically above +y and +x. Both
    // faces score the same stack-count (1) and area; by tiebreaker rule
    // the helper must pick 0°.
    const planks: PlacedPlank[] = [
      mkPlank(0, 60, 80, 40, 1), // above pith → reachable from 0°
      mkPlank(60, 0, 40, 80, 2) // right of pith → reachable from 90°
    ];
    expect(bestPlankingRotation(planks, shape)).toBe(0);
  });
});

/**
 * These tests exercise the composition the planner relies on to make the
 * squaring → planking transition seamless: after the 4th squaring cut,
 * `nextSquaringRotation` returns undefined (triggering the "we're done
 * squaring" branch in commitStep) and `bestPlankingRotation` returns the
 * face the log should be auto-rotated to so the sawyer can keep cutting
 * without a manual rotation.
 */
describe('squaring → planking hand-off', () => {
  it('4th squaring cut opens the planking phase with a known face', () => {
    // Arbitrary: after slabs at 0°/90°/180°/270°, the helpers together
    // should supply a non-undefined planking rotation. We assert on the
    // composition rather than a specific angle because the planking
    // choice depends on the plank fixture — the point is just that the
    // hand-off is wired.
    const cuts = SQUARING_ROTATIONS.map((r) => mkCut(r));
    expect(nextSquaringRotation(cuts)).toBeUndefined();

    const shape = circlePolygon(0, 0, 200, 48);
    const planks: PlacedPlank[] = [
      mkPlank(0, 50, 150, 25, 1),
      mkPlank(0, 80, 150, 25, 2)
    ];
    const planking = bestPlankingRotation(planks, shape);
    expect(planking).toBe(0);
  });

  it('respects the planking face even when the user squared in a non-canonical order', () => {
    // Sawyer rotated 180° first (rare, but allowed). After four cuts,
    // the squaring phase is still over regardless of the order.
    const cuts = [mkCut(180), mkCut(90), mkCut(270), mkCut(0)];
    expect(nextSquaringRotation(cuts)).toBeUndefined();

    const shape = circlePolygon(0, 0, 200, 48);
    const planks: PlacedPlank[] = [
      // Stack above the cant → planking face is 0° no matter how we
      // arrived there.
      mkPlank(0, 60, 150, 25, 1)
    ];
    expect(bestPlankingRotation(planks, shape)).toBe(0);
  });
});

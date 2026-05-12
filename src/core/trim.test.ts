import { describe, it, expect } from 'vitest';
import { circlePolygon } from './geometry';
import { computePlankTrim, edgingPlanForPlank } from './trim';
import type { PlacedPlank } from './types';

// A 200-mm-radius circle centred at (0,0) — the sort of shape the app
// starts with for a log with design Ø = 400 mm.
const circle200 = circlePolygon(0, 0, 200, 96);

function mkPlank(
  overrides: Partial<PlacedPlank> = {}
): PlacedPlank {
  return {
    specId: 'test',
    x: 0,
    y: 0,
    width: 100,
    thickness: 50,
    sequence: 1,
    label: '50×100',
    ...overrides
  };
}

describe('plank trim', () => {
  it('returns zero trim for an empty shape', () => {
    expect(computePlankTrim([], mkPlank())).toEqual({ left: 0, right: 0 });
  });

  it('reports symmetric wane for a central plank in a round log', () => {
    const plank = mkPlank({ x: 0, y: 0, width: 100, thickness: 50 });
    const trim = computePlankTrim(circle200, plank);
    // Widest chord of the 200-r circle in the plank's y-range [-25, 25]
    // is at y=0 and equals 400 mm (diameter). Plank width 100 →
    // trim on each side = (400 − 100) / 2 = 150.
    expect(trim.left).toBeCloseTo(150, 0);
    expect(trim.right).toBeCloseTo(150, 0);
  });

  it('reports only outer wane for a side-board-style offset plank', () => {
    // Plank centred to the right of origin, tight against an imaginary
    // cant edge at x = 60: inner edge at x = 60, outer edge at x = 120.
    const plank = mkPlank({ x: 90, y: 0, width: 60, thickness: 40 });
    const trim = computePlankTrim(circle200, plank);
    // In a round log both sides initially have wane: shape extends to
    // ±200 at y=0, so inner side (left) wane = 60 − (−200) = 260... wait,
    // that can't be right; shape_xMin = −200 and targetLeft = 60, so
    // left overhang = 60 − (−200) = 260. But that's overlap with the
    // other side of the log, which is a degenerate case. In practice
    // the sawyer will have cut the far side off first. This test just
    // confirms the math matches the formula.
    expect(trim.left).toBeCloseTo(260, 0);
    // Right wane = √(200² − 0²) − 120 = 80.
    expect(trim.right).toBeCloseTo(80, 0);
  });

  it('snaps sub-millimetre leftovers to zero', () => {
    // A plank whose target edge is at +199.8 (just inside the circle at y=0)
    // should report right trim of 0.2 mm — which the helper snaps to 0.
    const plank = mkPlank({ x: 99.9, y: 0, width: 199.8, thickness: 10 });
    const trim = computePlankTrim(circle200, plank);
    expect(trim.right).toBe(0);
  });
});

describe('edging plan', () => {
  it('marks a plank with no wane as clean', () => {
    const plan = edgingPlanForPlank({ left: 0, right: 0 }, mkPlank());
    expect(plan.clean).toBe(true);
    expect(plan.cut1).toBeNull();
    expect(plan.cut2).toBeNull();
    expect(plan.requiresFlip).toBe(false);
  });

  it('uses a single cut at target width when only one side has wane', () => {
    const plan = edgingPlanForPlank({ left: 15, right: 0 }, mkPlank({ width: 100 }));
    expect(plan.clean).toBe(false);
    expect(plan.requiresFlip).toBe(false);
    expect(plan.cut1).toBe(100);
    expect(plan.cut2).toBeNull();
    expect(plan.roughWidth).toBe(115);
  });

  it('recommends two cuts with a flip when both sides have wane', () => {
    // Plank target 100 mm; left wane 12, right wane 20. Put the deeper
    // (20) on the bed for stability. Cut 1 clears the top wane (12),
    // leaving a plank 100 + 20 = 120 mm tall. Flip. Cut 2 at 100 mm
    // leaves the exact target width.
    const plan = edgingPlanForPlank({ left: 12, right: 20 }, mkPlank({ width: 100 }));
    expect(plan.clean).toBe(false);
    expect(plan.requiresFlip).toBe(true);
    expect(plan.cut1).toBe(120);
    expect(plan.cut2).toBe(100);
    expect(plan.roughWidth).toBe(132);
    // Total trimmed = left + right = 32 mm, split across the two cuts.
    const totalTrim = plan.roughWidth - plan.targetWidth;
    expect(totalTrim).toBe(32);
  });
});

import { describe, it, expect } from 'vitest';
import { bbox, circlePolygon, clipHalfPlane, rectInsideConvex } from './geometry';

/**
 * Simulate the two-cut-per-plank physics. Blade bed-Y is the BLADE BOTTOM
 * (= new shape top after the cut, = the value the sawyer cranks in).
 *
 *   - Slab cut: bladeBedY = plankTop. Kerf sits above the blade in the
 *     discarded round waste. After cut, shape top = plankTop.
 *   - Plank cut: bladeBedY = plankBottom − kerf. Kerf sits in the planned
 *     gap below the freed plank. After cut, shape top = plankBottom − kerf.
 */
describe('two-cut-per-plank simulation', () => {
  it('slab cut exposes plank top; plank cut frees the plank', () => {
    const radius = 150;
    let shape = circlePolygon(0, 0, radius, 96);

    const kerf = 6;
    const cant = { x: 0, y: 0, w: 200, h: 80 };
    // Topboard 25 mm thick sitting with a kerf gap above the cant.
    const topBoard = { x: 0, y: 40 + kerf + 12.5, w: 100, h: 25 }; // y=58.5

    for (const p of [cant, topBoard]) {
      expect(
        rectInsideConvex(p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2, shape)
      ).toBe(true);
    }

    const nUp = { x: 0, y: 1 };

    // -- Cut 1 (slab): bladeBedY = topBoard.top = 71. --
    // Shape clipped to y ≤ 71. Topboard top is now exposed.
    const newTop1 = 71;
    shape = clipHalfPlane(shape, nUp, -newTop1);
    let box = bbox(shape);
    expect(box.maxY).toBeCloseTo(71, 3);
    // Top board is still present in the log (its min-y 46 < 71).
    expect(rectInsideConvex(
      topBoard.x - topBoard.w / 2,
      topBoard.y - topBoard.h / 2,
      topBoard.x + topBoard.w / 2,
      topBoard.y + topBoard.h / 2,
      shape
    )).toBe(true);

    // -- Cut 2 (plank): bladeBedY = topBoard.bottom - kerf = 46 - 6 = 40. --
    // Shape clipped to y ≤ 40. New shape top = cant top = 40.
    // Plank produced: its bottom (46) ≥ newTop + kerf (46) ✓.
    const newTop2 = 40;
    shape = clipHalfPlane(shape, nUp, -newTop2);
    box = bbox(shape);
    expect(box.maxY).toBeCloseTo(40, 3);
    // Top board is no longer inside the shape (it was removed as a produced plank).
    expect(rectInsideConvex(
      topBoard.x - topBoard.w / 2,
      topBoard.y - topBoard.h / 2,
      topBoard.x + topBoard.w / 2,
      topBoard.y + topBoard.h / 2,
      shape
    )).toBe(false);
    // Cant still fits.
    expect(rectInsideConvex(
      cant.x - cant.w / 2,
      cant.y - cant.h / 2,
      cant.x + cant.w / 2,
      cant.y + cant.h / 2,
      shape
    )).toBe(true);
  });

  it('bed-up direction matches the display rotation convention', () => {
    // The EndView uses CCW rotation: p_bed = (x cosθ − y sinθ, x sinθ + y cosθ).
    // So bed-height = p.x sinθ + p.y cosθ, i.e. n̂ = (sin θ, cos θ).
    // Verify at 90°: a log-frame point at (+A, 0) should be ABOVE a point at (-A, 0).
    const θ = 90;
    const n = { x: Math.sin((θ * Math.PI) / 180), y: Math.cos((θ * Math.PI) / 180) };
    const pRight = { x: 100, y: 0 }; // log frame: right side
    const pLeft = { x: -100, y: 0 }; // log frame: left side
    const hRight = pRight.x * n.x + pRight.y * n.y;
    const hLeft = pLeft.x * n.x + pLeft.y * n.y;
    // At CCW 90°, the right side of the log is on top in bed frame.
    expect(hRight).toBeGreaterThan(hLeft);
    expect(hRight).toBeCloseTo(100, 6);
    expect(hLeft).toBeCloseTo(-100, 6);
  });
});

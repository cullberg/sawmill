import { describe, it, expect } from 'vitest';
import {
  bbox,
  circlePolygon,
  clipHalfPlane,
  clipHorizontal,
  convexChord,
  pointInPolygon,
  polygonHasFlatFace,
  rectInsideConvex
} from './geometry';

describe('circlePolygon', () => {
  it('has requested vertex count and approximately matches radius', () => {
    const poly = circlePolygon(0, 0, 100, 64);
    expect(poly.length).toBe(64);
    for (const p of poly) {
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeCloseTo(100, 4);
    }
  });
});

describe('bbox', () => {
  it('finds mins and maxes', () => {
    const b = bbox([
      { x: -3, y: -1 },
      { x: 5, y: 2 },
      { x: 0, y: 7 }
    ]);
    expect(b).toEqual({ minX: -3, maxX: 5, minY: -1, maxY: 7 });
  });
});

describe('clipHorizontal', () => {
  it('keeps the below portion when all points are below', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    expect(clipHorizontal(sq, 20, 'below').length).toBe(4);
  });
  it('returns empty when nothing is kept', () => {
    const sq = [
      { x: 0, y: 20 },
      { x: 10, y: 20 },
      { x: 10, y: 30 },
      { x: 0, y: 30 }
    ];
    expect(clipHorizontal(sq, 5, 'below')).toEqual([]);
  });
  it('cuts a square in half horizontally', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    const below = clipHorizontal(sq, 5, 'below');
    expect(below.length).toBeGreaterThanOrEqual(4);
    const b = bbox(below);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxY).toBeCloseTo(5);
  });
});

describe('pointInPolygon / rectInsideConvex', () => {
  const circle = circlePolygon(0, 0, 100, 64);
  it('centre is inside the circle', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, circle)).toBe(true);
  });
  it('far outside is outside', () => {
    expect(pointInPolygon({ x: 200, y: 0 }, circle)).toBe(false);
  });
  it('axis-aligned square fits inside circle iff corners fit', () => {
    expect(rectInsideConvex(-50, -50, 50, 50, circle)).toBe(true);
    expect(rectInsideConvex(-80, -80, 80, 80, circle)).toBe(false);
  });
});

describe('polygonHasFlatFace', () => {
  // Bed-up direction for an unrotated log is +y in log frame.
  const up = { x: 0, y: 1 };

  it('reports no flat face on an untouched circle (all sizes)', () => {
    for (const r of [80, 150, 300, 500]) {
      for (const n of [48, 64, 96, 128]) {
        const poly = circlePolygon(0, 0, r, n);
        expect(polygonHasFlatFace(poly, up)).toBe(false);
      }
    }
  });

  it('reports a flat face after clipping the bottom off a circle', () => {
    const poly = circlePolygon(0, 0, 150, 96);
    // Clip away the bottom third: keep points where y >= -50, i.e.
    // where -y <= 50 ⇒ clipHalfPlane with n=(0,-1), offset=-50.
    const cut = clipHalfPlane(poly, { x: 0, y: -1 }, -50);
    expect(polygonHasFlatFace(cut, up)).toBe(true);
  });

  it('only reports flat face on the current bed side (rotation matters)', () => {
    const poly = circlePolygon(0, 0, 150, 96);
    const cut = clipHalfPlane(poly, { x: 0, y: -1 }, -50); // flat edge along y=-50
    // Flat edge is on the -y side, so bed-up=(0,1) sees it. Bed-up=(0,-1)
    // looks at the opposite (still-round) side and should not see it.
    expect(polygonHasFlatFace(cut, { x: 0, y: 1 })).toBe(true);
    expect(polygonHasFlatFace(cut, { x: 0, y: -1 })).toBe(false);
  });

  it('reports flat face regardless of polygon winding / starting vertex', () => {
    const poly = circlePolygon(0, 0, 200, 96);
    const cut = clipHalfPlane(poly, { x: 0, y: -1 }, -80);
    // Cycle start index a few times — behaviour should be invariant.
    for (let k = 0; k < cut.length; k += Math.max(1, Math.floor(cut.length / 5))) {
      const rotated = [...cut.slice(k), ...cut.slice(0, k)];
      expect(polygonHasFlatFace(rotated, up)).toBe(true);
    }
  });
});

describe('convexChord', () => {
  it('returns the horizontal chord of a circle at a given height', () => {
    const r = 150;
    const poly = circlePolygon(0, 0, r, 96);
    // Line y = 50 ⇒ p·(0,1) = 50.
    const chord = convexChord(poly, { x: 0, y: 1 }, 50);
    expect(chord).not.toBeNull();
    const [a, b] = chord!;
    // Both endpoints on the line y=50.
    expect(a.y).toBeCloseTo(50, 3);
    expect(b.y).toBeCloseTo(50, 3);
    // x = ±sqrt(r² − 50²) = ±sqrt(17500) ≈ ±132.29. The 96-vertex polygon
    // inscribes the true circle so the chord lands a fraction of a mm
    // short — well within 1 mm tolerance.
    const expected = Math.sqrt(r * r - 50 * 50);
    const xs = [a.x, b.x].sort((p, q) => p - q);
    expect(xs[0]).toBeCloseTo(-expected, 0);
    expect(xs[1]).toBeCloseTo(expected, 0);
  });

  it('returns null when the line misses the polygon', () => {
    const poly = circlePolygon(0, 0, 100, 64);
    // Line y = 200 is way above the circle.
    expect(convexChord(poly, { x: 0, y: 1 }, 200)).toBeNull();
  });

  it('handles rotated cut directions', () => {
    const poly = circlePolygon(0, 0, 100, 96);
    // Line along the direction (1, 0) at offset 50: x = 50.
    const chord = convexChord(poly, { x: 1, y: 0 }, 50);
    expect(chord).not.toBeNull();
    const [a, b] = chord!;
    expect(a.x).toBeCloseTo(50, 3);
    expect(b.x).toBeCloseTo(50, 3);
    const expected = Math.sqrt(100 * 100 - 50 * 50);
    const ys = [a.y, b.y].sort((p, q) => p - q);
    expect(ys[0]).toBeCloseTo(-expected, 0);
    expect(ys[1]).toBeCloseTo(expected, 0);
  });
});

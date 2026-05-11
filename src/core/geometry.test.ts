import { describe, it, expect } from 'vitest';
import { bbox, circlePolygon, clipHorizontal, pointInPolygon, rectInsideConvex } from './geometry';

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

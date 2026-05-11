import type { Vec2 } from './types';

/** Approximate a circle of radius r centred at (cx, cy) by an n-vertex polygon (CCW in math frame). */
export function circlePolygon(cx: number, cy: number, r: number, n = 96): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Axis-aligned bounding box of a polygon. */
export function bbox(poly: Vec2[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Clip a polygon against a half-plane defined by the inequality
 *   p·n + offset <= 0            (i.e. keep points where n·p <= -offset)
 * Equivalently: keep points whose signed distance from the plane is <= 0,
 * where the plane is { p : p·n + offset = 0 } with normal `n` (need not be
 * unit length as long as it's used consistently).
 *
 * Using Sutherland–Hodgman against a single edge.
 */
export function clipHalfPlane(poly: Vec2[], n: Vec2, offset: number): Vec2[] {
  if (poly.length < 3) return [];
  const side = (p: Vec2) => p.x * n.x + p.y * n.y + offset;
  const intersect = (a: Vec2, b: Vec2): Vec2 => {
    const sa = side(a);
    const sb = side(b);
    const t = sa / (sa - sb);
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  };
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const currIn = side(curr) <= 1e-9;
    const prevIn = side(prev) <= 1e-9;
    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

/**
 * Clip a polygon against a horizontal half-plane.
 * If `side === 'below'` keeps the portion with y <= cutY.
 * If `side === 'above'` keeps the portion with y >= cutY.
 */
export function clipHorizontal(poly: Vec2[], cutY: number, side: 'below' | 'above'): Vec2[] {
  // keep y <= cutY: n=(0,1), offset=-cutY → y - cutY <= 0.
  // keep y >= cutY: n=(0,-1), offset=cutY → -y + cutY <= 0.
  return side === 'below'
    ? clipHalfPlane(poly, { x: 0, y: 1 }, -cutY)
    : clipHalfPlane(poly, { x: 0, y: -1 }, cutY);
}

/** True if point p is inside the (possibly non-convex) polygon. Ray-cast. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Test whether an axis-aligned rectangle (x1..x2, y1..y2) is fully inside a
 * convex polygon. For our use the shape starts as a circle polygon and gets
 * clipped by horizontal lines, so it remains convex. Corner containment is
 * sufficient for convex shapes.
 */
export function rectInsideConvex(x1: number, y1: number, x2: number, y2: number, poly: Vec2[]): boolean {
  if (poly.length < 3) return false;
  const corners: Vec2[] = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x1, y: y2 },
    { x: x2, y: y2 }
  ];
  return corners.every((c) => pointInPolygon(c, poly));
}

/** Rotate a point by angle (degrees) around origin using SVG convention: positive = clockwise on screen (y-down). In math frame with y-up, positive = counter-clockwise. */
export function rotateVec2Math(p: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Inverse rotation of the above. */
export function inverseRotateVec2Math(p: Vec2, deg: number): Vec2 {
  return rotateVec2Math(p, -deg);
}

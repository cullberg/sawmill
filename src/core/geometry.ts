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

/**
 * Intersect the line `p·n = offset` with a convex polygon's boundary
 * and return the two intersection points (the chord), or `null` if the
 * line misses the polygon entirely. The polygon must be convex; the
 * line intersects a convex polygon's boundary in at most two places.
 *
 * Used to compute the cut-face chord on a log cross-section at the
 * moment of a cut: given the pre-clip shape, the bed-up direction
 * `n` and the cut height `offset` in bed frame, the chord marks the
 * straight edge that the cut adds to the polygon.
 *
 * Points are returned in the order they appear walking the polygon
 * boundary, so a stable orientation for drawing.
 */
export function convexChord(poly: Vec2[], n: Vec2, offset: number): [Vec2, Vec2] | null {
  if (poly.length < 3) return null;
  const side = (p: Vec2) => p.x * n.x + p.y * n.y - offset;
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    // Edge crosses the line iff the two endpoints are on opposite
    // sides (product ≤ 0). Use a strict-ish test so endpoints exactly
    // on the line don't register twice from their two incident edges.
    if ((sa > 0 && sb <= 0) || (sa <= 0 && sb > 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      if (out.length === 2) break;
    }
  }
  return out.length === 2 ? [out[0], out[1]] : null;
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
 *
 * Uses a half-plane test against each polygon edge instead of the
 * generic ray-cast `pointInPolygon`, so that corners lying **exactly**
 * on a polygon edge (common after `clipHalfPlane`: the rectangle that
 * triggered the cut has its far edge flush with the new cut line) are
 * still reported as inside. The ray-cast version would be sensitive
 * to the exact orientation of horizontal edges and classify such
 * boundary points as outside.
 *
 * Works for either winding order.
 */
export function rectInsideConvex(x1: number, y1: number, x2: number, y2: number, poly: Vec2[]): boolean {
  if (poly.length < 3) return false;
  const corners: Vec2[] = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x1, y: y2 },
    { x: x2, y: y2 }
  ];

  // Determine the polygon's winding sign from its signed area. For a
  // convex polygon with CCW winding (math convention), every edge has
  // the interior on its left; for CW, on its right. The half-plane
  // test is `sign * cross >= 0` with a small tolerance for FP noise.
  let area2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  // Degenerate polygon (collinear points) — treat as empty.
  if (Math.abs(area2) < 1e-9) return false;
  const windingSign = area2 > 0 ? 1 : -1;
  // Tolerance scales with the polygon size so the test isn't flaky on
  // large shapes. `1e-6` of the polygon's bounding area-side length is
  // plenty to paper over clip-introduced FP drift without ever
  // admitting a truly outside point.
  const b = bbox(poly);
  const scale = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
  const eps = scale * 1e-6;

  for (const c of corners) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const d = poly[(i + 1) % poly.length];
      // Cross-product of (edge direction) × (edge→corner). Positive =
      // corner is on the left of the edge when traversed a→d.
      const cross = (d.x - a.x) * (c.y - a.y) - (d.y - a.y) * (c.x - a.x);
      if (windingSign * cross < -eps) return false;
    }
  }
  return true;
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

/**
 * Does the polygon have a flat face in the direction of the unit vector
 * `n̂`? I.e. is there an edge on the "low" side (smallest projections
 * onto `n̂`) that is perpendicular to `n̂` — meaning the shape is resting
 * on a straight cut face and no longer curves against whatever surface
 * `n̂` points away from.
 *
 * Used to detect that the log is resting on a flat cut face against the
 * mill bed, in which case it can no longer roll and cone-compensation
 * advice is moot. `n̂` must point "up from the bed" in the polygon's
 * coordinate frame.
 *
 * Algorithm: look at every edge on the polygon; take the edge midpoint's
 * projection onto `n̂` to decide how close that edge is to the "bottom"
 * of the shape, and take the edge direction vs. perpendicular-to-`n̂` to
 * decide how flat it is. A face counts as flat-against-the-bed if:
 *   1. it is within `depthTolerance` of the minimum projection (so it's
 *      actually the bit that would touch the bed, not a random side cut), and
 *   2. its direction is within `angleTolerance` radians of perpendicular
 *      to `n̂` (so it's a real straight face, not just two adjacent
 *      vertices on a circle approximation whose projections happen to
 *      coincide within a millimetre).
 *
 * The angular gate is what makes this robust against the 96-vertex
 * circle polygon we start with: the arc step there is 2π/96 ≈ 3.75°, so
 * a 1° tolerance comfortably excludes all circle edges but lets through
 * any real cut face.
 */
export function polygonHasFlatFace(
  poly: Vec2[],
  n: Vec2,
  depthTolerance = 0.5,
  angleTolerance = (1 * Math.PI) / 180
): boolean {
  if (poly.length < 3) return false;
  // Minimum projection onto n̂ across all vertices.
  let minProj = Infinity;
  const projections: number[] = new Array(poly.length);
  for (let i = 0; i < poly.length; i++) {
    const p = (projections[i] = poly[i].x * n.x + poly[i].y * n.y);
    if (p < minProj) minProj = p;
  }

  // For each edge, check both depth and angle.
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const projA = projections[i];
    const projB = projections[(i + 1) % poly.length];

    // Both endpoints close to the minimum → edge lies at the bottom.
    if (Math.abs(projA - minProj) > depthTolerance) continue;
    if (Math.abs(projB - minProj) > depthTolerance) continue;

    // Edge direction; skip degenerate zero-length edges.
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;

    // Component of the edge along n̂. For a flat face perpendicular to
    // n̂ this is zero. We bound it by sin(angleTolerance) · len so that
    // the threshold scales with edge length (robust to long edges
    // wobbling a micrometer).
    const alongN = Math.abs(ex * n.x + ey * n.y);
    if (alongN <= len * Math.sin(angleTolerance)) return true;
  }
  return false;
}

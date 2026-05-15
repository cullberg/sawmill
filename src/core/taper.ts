import type { LogInput } from './types';

/**
 * Distance between the two support measurements, mm.
 * Equals length − 2·supportInset; clamped to be non-negative.
 */
export function supportGap(log: LogInput): number {
  return Math.max(0, log.length - 2 * log.supportInset);
}

/**
 * Taper per metre of log length (mm/m).
 * Positive value means the root is wider than the top.
 */
export function taperPerMetre(log: LogInput): number {
  const gap = supportGap(log);
  if (gap <= 0) return 0;
  return ((log.rootSideDiameter - log.topSideDiameter) * 1000) / gap;
}

/**
 * Diameter of the log at a distance `z` mm from the root end.
 * Assumes linear taper extrapolated from the two support measurements.
 * Clamps to >= 0.
 */
export function diameterAt(log: LogInput, zFromRoot: number): number {
  // At z = supportInset, diameter = rootSideDiameter.
  // Slope per mm = -(taperPerMetre)/1000 (y decreases as z grows).
  const t = taperPerMetre(log);
  const d = log.rootSideDiameter - (t * (zFromRoot - log.supportInset)) / 1000;
  return Math.max(0, d);
}

/**
 * Diameter at the root end (z = 0).
 */
export function rootEndDiameter(log: LogInput): number {
  return diameterAt(log, 0);
}

/**
 * Diameter at the top end (z = length).
 */
export function topEndDiameter(log: LogInput): number {
  return diameterAt(log, log.length);
}

/**
 * Worst-case sweep offset of the log, mm. Reads `LogInput.sweepMm`
 * with a 0 default so older saved plans (and tests) that don't carry
 * the field are treated as perfectly straight logs.
 *
 * Clamped to be non-negative — a negative sweep would make
 * `designDiameter` grow above the smaller end circle, which is never
 * physically meaningful.
 */
export function sweepMm(log: LogInput): number {
  return Math.max(0, log.sweepMm ?? 0);
}

/**
 * The smallest diameter that the mill can rely on for planks that must run
 * the full length of the log. For a tapered log this is the diameter at the
 * far end (top end). For a curved log we additionally subtract 2·sweep:
 * the pith deviates from the chord between the two ends by up to `sweep`
 * mm at the worst point, so on the concave side of the bow a full-length
 * plank loses `sweep` of clearance — and the same on the convex side
 * relative to the design circle, totalling 2·sweep diameter loss.
 *
 * Clamped to >= 0 so an absurd sweep input can't drive the design
 * diameter negative; downstream layout will simply produce no planks
 * if the effective circle is too small.
 */
export function designDiameter(log: LogInput): number {
  const a = rootEndDiameter(log);
  const b = topEndDiameter(log);
  const straightMin = Math.min(a, b);
  return Math.max(0, straightMin - 2 * sweepMm(log));
}

/**
 * How much the root-side support must be lowered (or the top-side support
 * raised) so the pith line lies horizontal BETWEEN THE SUPPORTS, putting
 * the first cut parallel to the pith rather than the bark.
 *
 * This is a direct reading off the two diameters the sawyer actually
 * measured at the supports — no extrapolation to the log ends. Physically,
 * you shim the root-side support down (or raise the top side) by this
 * amount.
 *
 * Clamps to >= 0: if the root-side support measures smaller than the top
 * support (inverse taper at the root flare), no lowering is needed on the
 * root side.
 */
export function rootLowering(log: LogInput): number {
  return Math.max(0, (log.rootSideDiameter - log.topSideDiameter) / 2);
}

/**
 * Volume estimate of the log using the frustum-of-a-cone formula, in m^3.
 */
export function logVolumeM3(log: LogInput): number {
  const r1 = rootEndDiameter(log) / 2 / 1000;
  const r2 = topEndDiameter(log) / 2 / 1000;
  const h = log.length / 1000;
  return (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
}

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
 * Positive value means the butt is wider than the top.
 */
export function taperPerMetre(log: LogInput): number {
  const gap = supportGap(log);
  if (gap <= 0) return 0;
  return ((log.buttSideDiameter - log.topSideDiameter) * 1000) / gap;
}

/**
 * Diameter of the log at a distance `z` mm from the butt end.
 * Assumes linear taper extrapolated from the two support measurements.
 * Clamps to >= 0.
 */
export function diameterAt(log: LogInput, zFromButt: number): number {
  // At z = supportInset, diameter = buttSideDiameter.
  // Slope per mm = -(taperPerMetre)/1000 (y decreases as z grows).
  const t = taperPerMetre(log);
  const d = log.buttSideDiameter - (t * (zFromButt - log.supportInset)) / 1000;
  return Math.max(0, d);
}

/**
 * Diameter at the butt end (z = 0).
 */
export function buttEndDiameter(log: LogInput): number {
  return diameterAt(log, 0);
}

/**
 * Diameter at the top end (z = length).
 */
export function topEndDiameter(log: LogInput): number {
  return diameterAt(log, log.length);
}

/**
 * The smallest diameter that the mill can rely on for planks that must run
 * the full length of the log. For a tapered log this is the diameter at the
 * far end (top end).
 */
export function designDiameter(log: LogInput): number {
  const a = buttEndDiameter(log);
  const b = topEndDiameter(log);
  return Math.min(a, b);
}

/**
 * How much the butt end must be lowered (or the top raised) so the pith line
 * lies horizontal, putting the first cut parallel to the pith rather than the
 * bark. Equivalent to half the difference of the two END diameters, computed
 * by extrapolating the support measurements to the log ends.
 */
export function buttLowering(log: LogInput): number {
  const dButt = buttEndDiameter(log);
  const dTop = topEndDiameter(log);
  return Math.max(0, (dButt - dTop) / 2);
}

/**
 * Volume estimate of the log using the frustum-of-a-cone formula, in m^3.
 */
export function logVolumeM3(log: LogInput): number {
  const r1 = buttEndDiameter(log) / 2 / 1000;
  const r2 = topEndDiameter(log) / 2 / 1000;
  const h = log.length / 1000;
  return (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
}

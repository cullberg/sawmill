import { describe, it, expect } from 'vitest';
import {
  rootEndDiameter,
  rootLowering,
  designDiameter,
  diameterAt,
  logVolumeM3,
  supportGap,
  sweepMm,
  taperPerMetre,
  topEndDiameter
} from './taper';
import type { LogInput } from './types';

// Supports sit 1250 mm from each end on a 5000 mm log → 2500 mm apart.
// Root-side support Ø = 400, top-side support Ø = 350.
// Taper = 50 mm / 2.5 m = 20 mm/m.
// Extrapolated end diameters:
//   root end (z=0):    400 + 20*1.25 = 425 mm
//   top end  (z=5000): 350 - 20*1.25 = 325 mm
const sample: LogInput = {
  rootSideDiameter: 400,
  topSideDiameter: 350,
  supportInset: 1250,
  length: 5000,
  species: 'pine'
};

describe('taper math', () => {
  it('support gap is total length minus 2x inset', () => {
    expect(supportGap(sample)).toBe(2500);
  });

  it('taper per metre uses the gap between supports', () => {
    expect(taperPerMetre(sample)).toBeCloseTo(20, 6);
  });

  it('returns the measured diameters at the support positions', () => {
    expect(diameterAt(sample, 1250)).toBeCloseTo(400, 6);
    expect(diameterAt(sample, 3750)).toBeCloseTo(350, 6);
  });

  it('extrapolates to the log ends', () => {
    expect(rootEndDiameter(sample)).toBeCloseTo(425, 6);
    expect(topEndDiameter(sample)).toBeCloseTo(325, 6);
  });

  it('clamps negative diameters to zero', () => {
    const steep: LogInput = { ...sample, topSideDiameter: 100, supportInset: 100, length: 6000 };
    expect(diameterAt(steep, 10000)).toBe(0);
  });

  it('design diameter is the smaller end', () => {
    expect(designDiameter(sample)).toBeCloseTo(325, 6);
  });

  it('root-lowering is half the diameter difference at the supports', () => {
    // Directly from the two support measurements: (400 - 350) / 2 = 25
    // (This is what the sawyer shims the root-side support down by.)
    expect(rootLowering(sample)).toBeCloseTo(25, 6);
  });

  it('handles parallel logs (no taper)', () => {
    const even: LogInput = { ...sample, topSideDiameter: 400 };
    expect(taperPerMetre(even)).toBe(0);
    expect(rootLowering(even)).toBe(0);
    expect(designDiameter(even)).toBeCloseTo(400, 6);
  });

  it('handles zero support gap gracefully', () => {
    const bad: LogInput = { ...sample, supportInset: 2500, length: 5000 };
    expect(supportGap(bad)).toBe(0);
    expect(taperPerMetre(bad)).toBe(0);
  });

  it('volume is within plausible range', () => {
    const v = logVolumeM3(sample);
    // End diameters 425 and 325, length 5 m; average r ~ 0.1875 m.
    // Cylinder ≈ π·0.1875²·5 ≈ 0.552 m³; frustum should be close.
    expect(v).toBeGreaterThan(0.4);
    expect(v).toBeLessThan(0.7);
  });

  it('treats a missing sweep field as a perfectly straight log', () => {
    // sweepMm helper falls back to 0 so existing saved plans (which
    // never had the field) keep their old design-diameter behaviour.
    expect(sweepMm(sample)).toBe(0);
    expect(designDiameter(sample)).toBeCloseTo(325, 6);
  });

  it('clamps a negative sweep to zero', () => {
    const wonky: LogInput = { ...sample, sweepMm: -5 };
    expect(sweepMm(wonky)).toBe(0);
    expect(designDiameter(wonky)).toBeCloseTo(325, 6);
  });

  it('shrinks the design diameter by 2× sweep on a curved log', () => {
    // 30 mm of sweep ⇒ design Ø drops from 325 to 325 − 60 = 265 mm.
    const bowed: LogInput = { ...sample, sweepMm: 30 };
    expect(designDiameter(bowed)).toBeCloseTo(265, 6);
  });

  it('clamps the design diameter to zero if sweep exceeds half the smaller end Ø', () => {
    // 200 mm of sweep on a 325 mm top Ø would mathematically take the
    // design diameter negative; physically that's just "no full-length
    // plank fits", which we represent as 0.
    const absurd: LogInput = { ...sample, sweepMm: 200 };
    expect(designDiameter(absurd)).toBe(0);
  });

  it('does not affect taper, end diameters, or root-lowering', () => {
    // Sweep is independent of the cone math: it changes the design
    // circle but not the diameter readings or the support-shim drop.
    const bowed: LogInput = { ...sample, sweepMm: 30 };
    expect(rootEndDiameter(bowed)).toBeCloseTo(425, 6);
    expect(topEndDiameter(bowed)).toBeCloseTo(325, 6);
    expect(rootLowering(bowed)).toBeCloseTo(25, 6);
    expect(taperPerMetre(bowed)).toBeCloseTo(20, 6);
  });
});

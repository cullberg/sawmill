import { describe, it, expect } from 'vitest';
import {
  buttEndDiameter,
  buttLowering,
  designDiameter,
  diameterAt,
  logVolumeM3,
  supportGap,
  taperPerMetre,
  topEndDiameter
} from './taper';
import type { LogInput } from './types';

// Supports sit 1250 mm from each end on a 5000 mm log → 2500 mm apart.
// Butt-side support Ø = 400, top-side support Ø = 350.
// Taper = 50 mm / 2.5 m = 20 mm/m.
// Extrapolated end diameters:
//   butt end (z=0):    400 + 20*1.25 = 425 mm
//   top end (z=5000):  350 - 20*1.25 = 325 mm
const sample: LogInput = {
  buttSideDiameter: 400,
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
    expect(buttEndDiameter(sample)).toBeCloseTo(425, 6);
    expect(topEndDiameter(sample)).toBeCloseTo(325, 6);
  });

  it('clamps negative diameters to zero', () => {
    const steep: LogInput = { ...sample, topSideDiameter: 100, supportInset: 100, length: 6000 };
    expect(diameterAt(steep, 10000)).toBe(0);
  });

  it('design diameter is the smaller end', () => {
    expect(designDiameter(sample)).toBeCloseTo(325, 6);
  });

  it('butt-lowering is half the diameter difference at the ends', () => {
    // (425 - 325) / 2 = 50
    expect(buttLowering(sample)).toBeCloseTo(50, 6);
  });

  it('handles parallel logs (no taper)', () => {
    const even: LogInput = { ...sample, topSideDiameter: 400 };
    expect(taperPerMetre(even)).toBe(0);
    expect(buttLowering(even)).toBe(0);
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
});

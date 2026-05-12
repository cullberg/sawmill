import { describe, it, expect } from 'vitest';
import { computeLayout, rectFitsInCircle } from './layout';
import type { MillSettings, PlankSpec } from './types';

const settings: MillSettings = {
  kerf: 6,
  minSlab: 15,
  strategy: 'priority',
  edgeClearance: 5,
  barkThickness: 0, // disabled in tests to preserve existing geometry expectations
  cuttingTool: 'chain'
};

const specs: PlankSpec[] = [
  { id: 'a', width: 150, thickness: 50, enabled: true },
  { id: 'b', width: 100, thickness: 25, enabled: true },
  { id: 'c', width: 50, thickness: 25, enabled: true }
];

describe('rectFitsInCircle', () => {
  it('true when all corners are inside the circle', () => {
    expect(rectFitsInCircle(0, 0, 100, 100, 80)).toBe(true); // diag=~70.7 < 80
  });
  it('false when a corner pokes out', () => {
    expect(rectFitsInCircle(0, 0, 100, 100, 50)).toBe(false);
  });
});

describe('computeLayout', () => {
  it('produces a central cant and fills above/below', () => {
    const res = computeLayout({ designDiameterMm: 300, settings, priority: specs });
    expect(res.planks.length).toBeGreaterThan(1);
    const cant = res.planks.find((p) => p.specId === 'a');
    expect(cant).toBeDefined();
    expect(cant?.x).toBe(0);
    expect(cant?.y).toBe(0);
    // No plank overlaps the circle boundary.
    for (const p of res.planks) {
      expect(rectFitsInCircle(p.x, p.y, p.width, p.thickness, 150 - settings.edgeClearance)).toBe(true);
    }
  });

  it('returns empty layout when no specs are enabled', () => {
    const res = computeLayout({
      designDiameterMm: 300,
      settings,
      priority: specs.map((s) => ({ ...s, enabled: false }))
    });
    expect(res.planks).toEqual([]);
  });

  it('returns empty layout when the log is too small', () => {
    const res = computeLayout({ designDiameterMm: 10, settings, priority: specs });
    expect(res.planks).toEqual([]);
  });

  it('respects maxCount', () => {
    const capped = specs.map((s) => (s.id === 'a' ? { ...s, maxCount: 1 } : s));
    const res = computeLayout({ designDiameterMm: 400, settings, priority: capped });
    const countA = res.planks.filter((p) => p.specId === 'a').length;
    expect(countA).toBeLessThanOrEqual(1);
  });

  it('places no overlapping planks (bounding boxes)', () => {
    const res = computeLayout({ designDiameterMm: 400, settings, priority: specs });
    const rects = res.planks.map((p) => ({
      x1: p.x - p.width / 2,
      x2: p.x + p.width / 2,
      y1: p.y - p.thickness / 2,
      y2: p.y + p.thickness / 2
    }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap =
          a.x1 < b.x2 - 1e-6 &&
          a.x2 > b.x1 + 1e-6 &&
          a.y1 < b.y2 - 1e-6 &&
          a.y2 > b.y1 + 1e-6;
        expect(overlap).toBe(false);
      }
    }
  });
});

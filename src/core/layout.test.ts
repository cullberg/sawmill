import { describe, it, expect } from 'vitest';
import { computeLayout, rectFitsInCircle } from './layout';
import { computeLayoutLegacy } from './layout.legacy';
import type { MillSettings, PlacedPlank, PlankSpec } from './types';

/** Returns true if any two planks overlap (bounding box test). */
function hasOverlap(planks: PlacedPlank[]): boolean {
  const rects = planks.map((p) => ({
    x1: p.x - p.width / 2,
    x2: p.x + p.width / 2,
    y1: p.y - p.thickness / 2,
    y2: p.y + p.thickness / 2
  }));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (
        a.x1 < b.x2 - 1e-6 &&
        a.x2 > b.x1 + 1e-6 &&
        a.y1 < b.y2 - 1e-6 &&
        a.y2 > b.y1 + 1e-6
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Throws a descriptive error if any two planks overlap. Used by the
 * sweep tests so a regression prints the offending pair instead of a
 * generic `expected false to be true`.
 */
function assertNoOverlap(planks: PlacedPlank[], label: string): void {
  const rects = planks.map((p) => ({
    x1: p.x - p.width / 2,
    x2: p.x + p.width / 2,
    y1: p.y - p.thickness / 2,
    y2: p.y + p.thickness / 2,
    id: p.specId,
    seq: p.sequence
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
      if (overlap) {
        throw new Error(
          `overlap in ${label} between plank #${a.seq} (${a.id}) and #${b.seq} (${b.id}):\n` +
            `  a = [${a.x1.toFixed(1)},${a.x2.toFixed(1)}] × [${a.y1.toFixed(1)},${a.y2.toFixed(1)}]\n` +
            `  b = [${b.x1.toFixed(1)},${b.x2.toFixed(1)}] × [${b.y1.toFixed(1)},${b.y2.toFixed(1)}]`
        );
      }
    }
  }
}

const settings: MillSettings = {
  kerf: 6,
  minSlab: 15,
  strategy: 'priority',
  edgeClearance: 5,
  barkThickness: 0, // disabled in tests to preserve existing geometry expectations
  cuttingTool: 'chain',
  autoRotateForSquaring: true
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
    assertNoOverlap(res.planks, 'priority@400mm');
  });

  // The single-strategy check above is too narrow; the overlap bug
  // reported after the value / min-waste rewrite only showed up with
  // non-priority strategies and specific log / spec combinations. This
  // sweep runs the overlap assertion across every strategy at a few
  // diameters with a richer priority list so regressions are caught
  // earlier.
  it('places no overlapping planks across all strategies + diameters', () => {
    const sweepSpecs: PlankSpec[] = [
      { id: 's200x50', width: 200, thickness: 50, enabled: true, value: 12 },
      { id: 's150x50', width: 150, thickness: 50, enabled: true, value: 9 },
      { id: 's100x25', width: 100, thickness: 25, enabled: true, value: 3 },
      { id: 's50x25', width: 50, thickness: 25, enabled: true, value: 1 },
      { id: 's100x100', width: 100, thickness: 100, enabled: true, value: 14 },
      { id: 's80x40', width: 80, thickness: 40, enabled: true, value: 5 }
    ];
    const diameters = [250, 300, 400, 500];
    const strategies: MillSettings['strategy'][] = ['priority', 'value', 'min-waste'];
    for (const d of diameters) {
      for (const strategy of strategies) {
        const s: MillSettings = { ...settings, strategy };
        const res = computeLayout({ designDiameterMm: d, settings: s, priority: sweepSpecs });
        assertNoOverlap(res.planks, `new @ ${strategy}@${d}mm`);
      }
    }
  });

  // Verify the same overlap bug existed in the legacy algorithm but
  // was silently tolerated (no test covered it). We capture it here so
  // the failure mode is documented and can't silently return. This
  // test EXPECTS overlaps in the legacy output — if it ever passes, it
  // means the legacy algorithm itself got fixed in-place (which would
  // be wrong; it's meant to be an immutable snapshot) OR the fixture
  // no longer triggers the bug.
  it('documents: legacy algorithm did produce overlaps on value@500mm', () => {
    const sweepSpecs: PlankSpec[] = [
      { id: 's200x50', width: 200, thickness: 50, enabled: true, value: 12 },
      { id: 's150x50', width: 150, thickness: 50, enabled: true, value: 9 },
      { id: 's100x25', width: 100, thickness: 25, enabled: true, value: 3 },
      { id: 's50x25', width: 50, thickness: 25, enabled: true, value: 1 },
      { id: 's100x100', width: 100, thickness: 100, enabled: true, value: 14 },
      { id: 's80x40', width: 80, thickness: 40, enabled: true, value: 5 }
    ];
    const s: MillSettings = { ...settings, strategy: 'value' };
    const resLegacy = computeLayoutLegacy({ designDiameterMm: 500, settings: s, priority: sweepSpecs });
    const hadOverlap = hasOverlap(resLegacy.planks);
    expect(hadOverlap).toBe(true);
  });
});

/**
 * No-regression guard: the improved layout algorithm must never
 * produce LESS used area than the legacy snapshot for any realistic
 * combination of log diameter, strategy and priority list. The
 * legacy algorithm is frozen in `layout.legacy.ts` precisely for
 * this purpose; when the next optimisation lands, re-snapshot the
 * legacy file and re-run this guard.
 */
describe('computeLayout — no-regression guard vs legacy', () => {
  // A small but representative priority list spanning a range of
  // plank sizes. Includes a square spec to exercise the
  // no-duplicate-orientation code path.
  const sweepSpecs: PlankSpec[] = [
    { id: 's200x50', width: 200, thickness: 50, enabled: true, value: 12 },
    { id: 's150x50', width: 150, thickness: 50, enabled: true, value: 9 },
    { id: 's100x25', width: 100, thickness: 25, enabled: true, value: 3 },
    { id: 's50x25', width: 50, thickness: 25, enabled: true, value: 1 },
    { id: 's100x100', width: 100, thickness: 100, enabled: true, value: 14 }
  ];

  const diameters = [250, 300, 400, 500];
  const strategies: MillSettings['strategy'][] = ['priority', 'value', 'min-waste'];

  for (const d of diameters) {
    for (const strategy of strategies) {
      it(`${strategy} @ ${d}mm uses >= legacy area`, () => {
        const s: MillSettings = { ...settings, strategy };
        const neu = computeLayout({ designDiameterMm: d, settings: s, priority: sweepSpecs });
        const old = computeLayoutLegacy({ designDiameterMm: d, settings: s, priority: sweepSpecs });
        // The legacy algorithm could produce overlapping planks in
        // some (strategy, diameter) combinations — see the
        // 'documents: legacy algorithm did produce overlaps ...' test
        // below. When that happens, legacy's `usedArea` double-counts
        // overlapping material and is NOT a valid baseline. Skip the
        // area comparison in those cases; the new algorithm's guarantee
        // is "no overlaps + area >= any valid legacy layout".
        if (hasOverlap(old.planks)) {
          // eslint-disable-next-line no-console
          console.log(
            `[regression guard] legacy ${strategy}@${d}mm produced overlapping planks (area ${old.usedArea} is invalid); skipping area comparison.`
          );
          return;
        }
        expect(neu.usedArea + 1e-3).toBeGreaterThanOrEqual(old.usedArea);
      });
    }
  }

  it("'value' strategy trials every candidate cant, not just the top scorer", () => {
    // Construct a fixture where the legacy (pick-top-scorer-as-cant)
    // choice blocks out slots and loses total value:
    //  - "giant": highest per-plank value (50), but cross-section so
    //    big it consumes nearly the whole log; legacy picks this as
    //    the cant, which leaves almost no room for anything else.
    //  - "small": modest per-plank value (20) with a small cross-
    //    section; making this the cant leaves generous corridors
    //    that fit many more "small" planks, so total value wins.
    const trialSpecs: PlankSpec[] = [
      { id: 'giant', width: 300, thickness: 180, enabled: true, value: 50 },
      { id: 'small', width: 80, thickness: 40, enabled: true, value: 20 }
    ];
    const s: MillSettings = { ...settings, strategy: 'value' };
    const res = computeLayout({ designDiameterMm: 400, settings: s, priority: trialSpecs });
    const resLegacy = computeLayoutLegacy({ designDiameterMm: 400, settings: s, priority: trialSpecs });

    // Legacy picks giant as the cant and stops there.
    const legacyCant = resLegacy.planks.find((p) => p.x === 0 && p.y === 0);
    expect(legacyCant?.specId).toBe('giant');

    // The new algorithm trials both cants and keeps the winner.
    // Compute total value of each and assert new ≥ legacy.
    const valueOf = (planks: typeof res.planks) =>
      planks.reduce((acc, p) => {
        const spec = trialSpecs.find((t) => t.id === p.specId);
        return acc + (spec?.value ?? 0);
      }, 0);
    expect(valueOf(res.planks)).toBeGreaterThanOrEqual(valueOf(resLegacy.planks));
  });
});

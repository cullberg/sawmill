import { describe, it, expect, beforeEach } from 'vitest';
import {
  ARCHIVE_LIMIT_FOR_TESTS,
  addToArchive,
  loadArchive,
  makeArchiveId,
  removeFromArchive,
  saveArchive,
  type ArchivedLog
} from './archive';
import { archiveToCsv } from './archiveCsv';
import type { PlanState } from './types';
import { initialPlan } from './storage';

/**
 * Minimal in-memory localStorage shim so the archive module's
 * `loadArchive` / `saveArchive` can run inside Node-based vitest
 * (jsdom is not enabled by default — see vite.config.ts which only
 * sets `environment: 'node'`).
 */
function installFakeLocalStorage() {
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear()
    }
  };
  return store;
}

/**
 * Build a minimally-populated PlanState for archive tests: one log,
 * a couple of cuts, and two produced planks with labels so CSV size
 * columns have something interesting to aggregate.
 */
function mkPlan(overrides: Partial<PlanState> = {}): PlanState {
  return {
    ...initialPlan,
    cuts: [
      { y: 100, rotationDeg: 0, note: 'cut 1', producedPlankIds: [] },
      { y: 50, rotationDeg: 0, note: 'cut 2', producedPlankIds: ['p1'] }
    ],
    produced: [
      {
        id: 'p1',
        specId: 'x',
        label: '50×150',
        sequence: 1,
        polygon: []
      },
      {
        id: 'p2',
        specId: 'y',
        label: '25×100',
        sequence: 2,
        polygon: []
      }
    ],
    ...overrides
  };
}

describe('archive storage', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it('returns an empty list when nothing is persisted', () => {
    expect(loadArchive()).toEqual([]);
  });

  it('round-trips entries through localStorage', () => {
    const entry: ArchivedLog = { id: 'a', completedAt: 1, plan: mkPlan() };
    saveArchive([entry]);
    const loaded = loadArchive();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('a');
    expect(loaded[0].plan.produced).toHaveLength(2);
  });

  it('drops malformed entries instead of throwing', () => {
    const store = installFakeLocalStorage();
    // Partially-valid JSON: one entry missing .plan, one valid.
    store.set(
      'sawmill.logs.v1',
      JSON.stringify([
        { id: 'bad', completedAt: 1 },
        { id: 'good', completedAt: 2, plan: mkPlan() }
      ])
    );
    const loaded = loadArchive();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });

  it('returns empty on corrupted JSON', () => {
    const store = installFakeLocalStorage();
    store.set('sawmill.logs.v1', '{not json');
    expect(loadArchive()).toEqual([]);
  });

  it('prepends new entries so the most recent sits at index 0', () => {
    let archive: ArchivedLog[] = [];
    archive = addToArchive(archive, { id: 'a', completedAt: 1, plan: mkPlan() });
    archive = addToArchive(archive, { id: 'b', completedAt: 2, plan: mkPlan() });
    expect(archive.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('evicts oldest entries once the cap is exceeded', () => {
    let archive: ArchivedLog[] = [];
    for (let i = 0; i < ARCHIVE_LIMIT_FOR_TESTS + 5; i++) {
      archive = addToArchive(archive, { id: `e${i}`, completedAt: i, plan: mkPlan() });
    }
    expect(archive).toHaveLength(ARCHIVE_LIMIT_FOR_TESTS);
    // Newest 50 stay (e54 down to e5); oldest five (e0..e4) are evicted.
    expect(archive[0].id).toBe(`e${ARCHIVE_LIMIT_FOR_TESTS + 4}`);
    expect(archive[archive.length - 1].id).toBe('e5');
  });

  it('removes a single entry by id without disturbing others', () => {
    const archive: ArchivedLog[] = [
      { id: 'a', completedAt: 1, plan: mkPlan() },
      { id: 'b', completedAt: 2, plan: mkPlan() },
      { id: 'c', completedAt: 3, plan: mkPlan() }
    ];
    const next = removeFromArchive(archive, 'b');
    expect(next.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('removeFromArchive is a no-op when the id is unknown', () => {
    const archive: ArchivedLog[] = [{ id: 'a', completedAt: 1, plan: mkPlan() }];
    expect(removeFromArchive(archive, 'missing')).toEqual(archive);
  });

  it('makeArchiveId produces unique ids even within the same millisecond', () => {
    const t = Date.now();
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(makeArchiveId(t));
    expect(ids.size).toBeGreaterThan(90);
  });
});

describe('archive CSV export', () => {
  it('emits a header then one row per log, with a column per unique plank size', () => {
    const archive: ArchivedLog[] = [
      { id: 'a', completedAt: Date.UTC(2025, 0, 15, 9, 0, 0), plan: mkPlan() },
      { id: 'b', completedAt: Date.UTC(2025, 0, 16, 10, 30, 0), plan: mkPlan() }
    ];
    const csv = archiveToCsv(archive);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    const header = lines[0].split(',');
    expect(header).toContain('completedAt');
    expect(header).toContain('rootDiameterCm');
    expect(header).toContain('volumeM3');
    expect(header).toContain('strategy');
    // Size columns are derived from produced plank labels.
    expect(header).toContain('25×100');
    expect(header).toContain('50×150');
  });

  it('treats logs with different plank-size sets as one union of columns', () => {
    const archive: ArchivedLog[] = [
      {
        id: 'a',
        completedAt: 1,
        plan: mkPlan({
          produced: [
            {
              id: 'p1',
              specId: 's',
              label: '50×150',
              sequence: 1,
              polygon: []
            }
          ]
        })
      },
      {
        id: 'b',
        completedAt: 2,
        plan: mkPlan({
          produced: [
            {
              id: 'p2',
              specId: 's',
              label: '25×100',
              sequence: 1,
              polygon: []
            }
          ]
        })
      }
    ];
    const csv = archiveToCsv(archive);
    const header = csv.split('\r\n')[0].split(',');
    // Both labels appear in the header even though each log only
    // contains one of them.
    expect(header.filter((h) => h === '50×150')).toHaveLength(1);
    expect(header.filter((h) => h === '25×100')).toHaveLength(1);
    // Log A has 1 of "50×150" and 0 of "25×100"; verify by finding
    // the indexes of both columns and checking the first data row.
    const firstRow = csv.split('\r\n')[1].split(',');
    const i150 = header.indexOf('50×150');
    const i100 = header.indexOf('25×100');
    expect(firstRow[i150]).toBe('1');
    expect(firstRow[i100]).toBe('0');
  });

  it('escapes values that contain commas, quotes or newlines', () => {
    const archive: ArchivedLog[] = [
      {
        id: 'a',
        completedAt: 1,
        plan: mkPlan({
          produced: [
            {
              id: 'p1',
              specId: 's',
              // A label containing a comma and a quote.
              label: 'Custom, "fancy" plank',
              sequence: 1,
              polygon: []
            }
          ]
        })
      }
    ];
    const csv = archiveToCsv(archive);
    // The label shows up in the header and must be double-quoted with
    // internal quotes doubled per RFC 4180.
    expect(csv).toContain('"Custom, ""fancy"" plank"');
  });
});

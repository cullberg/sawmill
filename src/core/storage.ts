import type { LogInput, MillSettings, PlanState, PlankSpec } from './types';

const STORAGE_KEY = 'sawmill.plan.v13';

export const defaultLog: LogInput = {
  rootSideDiameter: 400,
  topSideDiameter: 350,
  supportInset: 1250,
  length: 5000,
  species: 'pine'
};

export const defaultSettings: MillSettings = {
  kerf: 6,
  minSlab: 15,
  strategy: 'priority',
  edgeClearance: 5,
  barkThickness: 10,
  cuttingTool: 'chain',
  autoRotateForSquaring: true
};

/**
 * Each entry is `{ thickness, width, enabled }` (mm). The list opens with
 * the squared sizes (thickness == width) disabled — they're specialty
 * posts/beams, useful to reach for occasionally but not typical output —
 * and then runs through each thickness family widest-first, with the
 * 50-mm family enabled by default so a fresh install produces a
 * recognisable 50-mm plank layout straight away.
 *
 * The user can reorder, toggle, or remove entries in the UI; everything
 * below is just the starting point shown on first run and on "Restore
 * defaults".
 */
interface DefaultEntry {
  t: number;
  w: number;
  enabled: boolean;
}
const DEFAULT_PRIORITY: DefaultEntry[] = [
  // ─── Squared sizes (thickness == width), largest first, all disabled ───
  // Parked at the top so they're easy to find when a plan calls for a
  // post or a beam, but off by default so they don't crowd the 50-mm
  // plank layout that most sessions start from.
  { t: 300, w: 300, enabled: false },
  { t: 250, w: 250, enabled: false },
  { t: 225, w: 225, enabled: false },
  { t: 200, w: 200, enabled: false },
  { t: 175, w: 175, enabled: false },
  { t: 150, w: 150, enabled: false },
  { t: 125, w: 125, enabled: false },
  { t: 100, w: 100, enabled: false },

  // ─── 50-mm family — enabled by default, widest-first ───
  { t: 50, w: 250, enabled: true },
  { t: 50, w: 225, enabled: true },
  { t: 50, w: 200, enabled: true },
  { t: 50, w: 175, enabled: true },
  { t: 50, w: 150, enabled: true },
  { t: 50, w: 125, enabled: true },
  { t: 50, w: 100, enabled: true },
  { t: 50, w: 75, enabled: true },

  // ─── Other thickness families — disabled by default ───
  // 38-mm
  { t: 38, w: 200, enabled: false },
  { t: 38, w: 175, enabled: false },
  { t: 38, w: 150, enabled: false },
  { t: 38, w: 125, enabled: false },
  { t: 38, w: 100, enabled: false },
  // 25-mm
  { t: 25, w: 250, enabled: false },
  { t: 25, w: 225, enabled: false },
  { t: 25, w: 200, enabled: false },
  { t: 25, w: 175, enabled: false },
  { t: 25, w: 150, enabled: false },
  { t: 25, w: 125, enabled: false },
  { t: 25, w: 100, enabled: false },
  // 63-mm
  { t: 63, w: 200, enabled: false },
  { t: 63, w: 175, enabled: false },
  { t: 63, w: 150, enabled: false },
  { t: 63, w: 125, enabled: false },
  { t: 63, w: 100, enabled: false },
  // 75-mm
  { t: 75, w: 200, enabled: false },
  { t: 75, w: 175, enabled: false },
  { t: 75, w: 150, enabled: false },
  { t: 75, w: 125, enabled: false },
  // 100-mm non-square
  { t: 100, w: 200, enabled: false },
  { t: 100, w: 150, enabled: false },
  // 125-mm non-square
  { t: 125, w: 175, enabled: false },
  { t: 125, w: 150, enabled: false },
  // 150-mm non-square
  { t: 150, w: 225, enabled: false },
  { t: 150, w: 200, enabled: false },
  // 175-mm non-square
  { t: 175, w: 200, enabled: false },
  // 200-mm non-square
  { t: 200, w: 250, enabled: false },
  { t: 200, w: 225, enabled: false },
  // 225-mm non-square
  { t: 225, w: 250, enabled: false },
  // Big beams (300-wide)
  { t: 250, w: 300, enabled: false },
  { t: 200, w: 300, enabled: false }
];

export const defaultPriority: PlankSpec[] = DEFAULT_PRIORITY.map(({ t, w, enabled }) => ({
  id: `p-${t}x${w}`,
  width: w,
  thickness: t,
  enabled,
  label: `${t}×${w}`
}));

/**
 * Returns a fresh copy of the default priority list. Used by the "Restore
 * defaults" button so the returned specs have brand-new object identities
 * (React state updates cleanly) without mutating the exported constant.
 */
export function makeDefaultPriority(): PlankSpec[] {
  return DEFAULT_PRIORITY.map(({ t, w, enabled }) => ({
    id: `p-${t}x${w}`,
    width: w,
    thickness: t,
    enabled,
    label: `${t}×${w}`
  }));
}

export const initialPlan: PlanState = {
  log: defaultLog,
  settings: defaultSettings,
  priorityList: defaultPriority,
  rotationDeg: 0,
  cuts: [],
  planks: [],
  shape: [],
  produced: []
};

export function loadPlan(): PlanState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlanState;
    // Basic sanity check.
    if (!parsed.log || !parsed.settings || !Array.isArray(parsed.priorityList)) return null;
    // Backfill any settings fields added since this plan was saved, so we
    // don't force a full wipe (new storage key) every time a cosmetic
    // field is added. Only cosmetic / default-safe fields belong here —
    // anything that would change the math gets a new storage key bump.
    parsed.settings = { ...defaultSettings, ...parsed.settings };
    return parsed;
  } catch {
    return null;
  }
}

export function savePlan(plan: PlanState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Swallow quota errors; nothing critical depends on this.
  }
}

export function clearPlan(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

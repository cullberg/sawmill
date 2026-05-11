import type { LogInput, MillSettings, PlanState, PlankSpec } from './types';

const STORAGE_KEY = 'sawmill.plan.v12';

export const defaultLog: LogInput = {
  buttSideDiameter: 400,
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
  barkThickness: 10
};

/**
 * Default priority list of preferred plank dimensions, in decreasing priority.
 * Each entry is `thickness × width` (mm). Grouped by thickness, thickest first
 * within each "visual family". The user can reorder, toggle, or remove entries
 * in the UI.
 */
const DEFAULT_PRIORITY: Array<[thickness: number, width: number]> = [
  // 50-mm thickness family
  [50, 100],
  [50, 125],
  [50, 150],
  [50, 175],
  [50, 200],
  [50, 225],
  [50, 250],
  [50, 75],
  // 38-mm
  [38, 100],
  [38, 125],
  [38, 150],
  [38, 175],
  [38, 200],
  // 25-mm
  [25, 100],
  [25, 125],
  [25, 150],
  [25, 175],
  [25, 200],
  [25, 225],
  [25, 250],
  // 63-mm
  [63, 100],
  [63, 125],
  [63, 150],
  [63, 175],
  [63, 200],
  // 75-mm
  [75, 125],
  [75, 150],
  [75, 175],
  [75, 200],
  // 100-mm squares-ish
  [100, 100],
  [100, 150],
  [100, 200],
  // 125-mm
  [125, 125],
  [125, 150],
  [125, 175],
  // 150-mm
  [150, 150],
  [150, 200],
  [150, 225],
  // 175-mm
  [175, 175],
  [175, 200],
  // 200-mm
  [200, 200],
  [200, 225],
  [200, 250],
  // 225-mm
  [225, 225],
  [225, 250],
  // 250-mm
  [250, 250],
  // big beams
  [200, 300],
  [250, 300],
  [300, 300]
];

export const defaultPriority: PlankSpec[] = DEFAULT_PRIORITY.map(([t, w], i) => ({
  id: `p-${t}x${w}`,
  width: w,
  thickness: t,
  // Enable only the first few by default so the layout is manageable; the
  // user can toggle the rest on as needed.
  enabled: i < 8,
  label: `${t}×${w}`
}));

/**
 * Returns a fresh copy of the default priority list. Used by the "Restore
 * defaults" button so the returned specs have brand-new object identities
 * (React state updates cleanly) without mutating the exported constant.
 */
export function makeDefaultPriority(): PlankSpec[] {
  return DEFAULT_PRIORITY.map(([t, w], i) => ({
    id: `p-${t}x${w}`,
    width: w,
    thickness: t,
    enabled: i < 8,
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

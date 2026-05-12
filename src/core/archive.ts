import type { PlanState } from './types';

/**
 * Archive of completed logs.
 *
 * A "completed log" is a whole PlanState as it existed when the sawyer
 * tapped "Start next log" (and every planned plank had been produced).
 * Each archive entry carries the full PlanState so the Log-history panel
 * can surface its own summary, and so a user can "reopen" a past log to
 * replay the cut sequence in the planner. Storage is append-most-recent;
 * FIFO eviction at ARCHIVE_LIMIT keeps the browser's localStorage from
 * filling up on heavy users (200 logs/year × 30 kB per snapshot would
 * exceed the typical 5 MB quota inside a single season).
 *
 * Storage key is versioned (`sawmill.logs.v1`) so a future schema change
 * can ship a new key and let readers ignore (or migrate) the old one
 * instead of silently corrupting saved data.
 */

const STORAGE_KEY = 'sawmill.logs.v1';
const ARCHIVE_LIMIT = 50;

export interface ArchivedLog {
  /** Stable id for UI keys and delete-by-id. */
  id: string;
  /** ms since epoch when this log was archived. */
  completedAt: number;
  /** Full PlanState snapshot at the moment of archiving. */
  plan: PlanState;
}

/**
 * Read the archive from localStorage. Returns an empty list on any
 * parse / quota / SSR failure — the archive is a nice-to-have, never
 * critical, so we never throw.
 */
export function loadArchive(): ArchivedLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Minimal sanity: each entry must have an id and a plan.log at
    // minimum. We keep parsing lax so an older snapshot with fewer
    // fields still loads (it just displays with whatever it has).
    return parsed.filter(
      (e): e is ArchivedLog =>
        !!e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        typeof e.completedAt === 'number' &&
        !!e.plan &&
        !!e.plan.log
    );
  } catch {
    return [];
  }
}

/** Write the archive, swallowing quota / disabled-storage errors. */
export function saveArchive(archive: ArchivedLog[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
  } catch {
    /* quota exceeded / disabled storage — skip silently */
  }
}

/**
 * Append `log` to the archive, trimming the oldest entries if the
 * archive would exceed the storage cap. Returns the new list. Most
 * recent entry sits at index 0 so the UI can render newest-first
 * without re-sorting.
 */
export function addToArchive(archive: ArchivedLog[], log: ArchivedLog): ArchivedLog[] {
  const next = [log, ...archive];
  if (next.length > ARCHIVE_LIMIT) next.length = ARCHIVE_LIMIT;
  return next;
}

/** Remove a single entry by id. Returns the new list. */
export function removeFromArchive(archive: ArchivedLog[], id: string): ArchivedLog[] {
  return archive.filter((e) => e.id !== id);
}

/**
 * Generate a reasonably unique id for a new archive entry. Timestamp-
 * prefixed so listing by id also sorts chronologically; random suffix
 * prevents collisions when two logs happen to archive inside the same
 * millisecond (rare, but the history UI uses id as a React key).
 */
export function makeArchiveId(completedAt: number): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `log-${completedAt.toString(36)}-${r}`;
}

/** Exported for tests; not strictly needed by callers. */
export const ARCHIVE_LIMIT_FOR_TESTS = ARCHIVE_LIMIT;

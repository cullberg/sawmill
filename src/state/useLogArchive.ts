import { useCallback, useEffect, useState } from 'react';
import {
  addToArchive,
  loadArchive,
  makeArchiveId,
  removeFromArchive,
  saveArchive,
  type ArchivedLog
} from '../core/archive';
import type { PlanState } from '../core/types';

/**
 * React state wrapper around the localStorage archive of completed
 * logs. Separate from `usePlan` so the archive survives the current
 * plan's lifecycle: resetting or reopening a plan never loses the
 * archive, only the live PlanState.
 *
 * The hook mirrors the archive into React state so history-panel
 * renders pick up additions/deletions immediately; every mutator also
 * persists via `saveArchive` so a page reload shows the same list.
 */
export interface UseLogArchive {
  /** Newest-first list of archived completed logs. */
  archive: ArchivedLog[];
  /**
   * Snapshot the given plan and prepend it to the archive. Returns the
   * id of the newly-added entry so callers can, e.g., scroll to it.
   * Caller is responsible for deciding the plan is actually worth
   * archiving (see usePlan's auto-archive in startNextLog).
   */
  archivePlan: (plan: PlanState) => string;
  /** Remove a single entry by id. No-op if not found. */
  removeEntry: (id: string) => void;
  /** Drop the whole archive. */
  clearAll: () => void;
}

export function useLogArchive(): UseLogArchive {
  const [archive, setArchive] = useState<ArchivedLog[]>(() => loadArchive());

  // Persist every change. Cheap — ~tens of kB, well under localStorage's
  // write-latency budget, and keeps the on-disk copy always fresh.
  useEffect(() => {
    saveArchive(archive);
  }, [archive]);

  const archivePlan = useCallback((plan: PlanState): string => {
    const completedAt = Date.now();
    const id = makeArchiveId(completedAt);
    const entry: ArchivedLog = {
      id,
      completedAt,
      // Deep-clone via JSON so later mutations to the live PlanState
      // (new cuts, rotation changes, reset) can never reach back into
      // an archived snapshot. Cheap relative to a typical plan's size.
      plan: JSON.parse(JSON.stringify(plan))
    };
    setArchive((prev) => addToArchive(prev, entry));
    return id;
  }, []);

  const removeEntry = useCallback((id: string) => {
    setArchive((prev) => removeFromArchive(prev, id));
  }, []);

  const clearAll = useCallback(() => {
    setArchive([]);
  }, []);

  return { archive, archivePlan, removeEntry, clearAll };
}

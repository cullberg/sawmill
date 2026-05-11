import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeLayout } from '../core/layout';
import { circlePolygon, clipHalfPlane } from '../core/geometry';
import { buttLowering, designDiameter } from '../core/taper';
import { initialPlan, loadPlan, savePlan } from '../core/storage';
import type {
  Cut,
  LogInput,
  MillSettings,
  PlacedPlank,
  PlanState,
  PlankSpec,
  ProducedPlank,
  Vec2
} from '../core/types';

const HISTORY_LIMIT = 50;

interface MillSnapshot {
  rotationDeg: number;
  cuts: Cut[];
  shape: Vec2[];
  produced: ProducedPlank[];
}

export interface BladeReadout {
  /** Blade (lower edge) height above the mill bed, mm. This is the value you
   *  crank into the mill: after the cut, the remaining log's top sits here. */
  bladeAboveBed: number;
  /** Bed-frame Y of the blade's lower edge (= new shape top after the cut). */
  bladeBedY: number;
  /** Bed-frame height of the lowest point of the current shape, mm. */
  bedY: number;
  /** True if a valid blade position exists. */
  valid: boolean;
  /**
   * What this cut will do:
   *  - 'slab'   – round waste above the topmost plank
   *  - 'plank'  – free the next plank
   *  - 'done'   – nothing left to cut at this rotation (log processed here)
   *  - 'none'   – no valid cut (empty shape / no planks)
   */
  kind: 'slab' | 'plank' | 'done' | 'none';
  /** If `kind === 'plank'`, the plank that will be produced. */
  producingLabel?: string;
}

export interface ConeState {
  /** Drop to apply to butt (mm) while cone is still active, 0 when resolved. */
  buttDropMm: number;
  /** True once two cuts 180° apart have been committed. */
  resolved: boolean;
}

export interface UsePlan {
  plan: PlanState;
  setLog: (log: LogInput) => void;
  setSettings: (s: MillSettings) => void;
  setPriority: (p: PlankSpec[]) => void;
  rotateBy: (deg: number) => void;
  commitStep: () => void;
  finishFinalPlank: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  /**
   * Start a fresh log: clears all cuts and sawn planks but keeps the current
   * log dimensions, priority list and mill settings so the operator only has
   * to update whatever is different on the next log. Equivalent to `reset`
   * but with explicit "new log" semantics.
   */
  startNextLog: () => void;
  canUndo: boolean;
  canRedo: boolean;
  blade: BladeReadout;
  cone: ConeState;
  remainingPlanks: PlacedPlank[];
  /**
   * True once every planned plank has been sawn out AND at least one cut
   * has been made. Signals the operator to load the next log.
   */
  logComplete: boolean;
}

// Initial shape = design-circle polygon centred at (0,0) in LOG frame.
function initialShape(log: LogInput): Vec2[] {
  const r = designDiameter(log) / 2;
  return r > 0 ? circlePolygon(0, 0, r, 96) : [];
}

/**
 * Direction of "up in bed frame" expressed in LOG-frame coordinates, given a
 * log rotation of `rotationDeg` (CCW positive in math convention).
 *
 * The display rotates a log-frame point by CCW θ:
 *   p_bed = R(θ) · p     with R(θ) = [[cos,-sin],[sin,cos]]
 *   ⇒ p_bed.y = sin(θ)·p.x + cos(θ)·p.y
 *   ⇒ bed-frame height of p = p · n̂  with n̂ = (sin θ, cos θ)
 */
function bedUpInLog(rotationDeg: number): Vec2 {
  const r = (rotationDeg * Math.PI) / 180;
  return { x: Math.sin(r), y: Math.cos(r) };
}

/** Plank corners in log frame (same frame planks are planned in). */
function plankCorners(p: PlacedPlank): Vec2[] {
  const hx = p.width / 2;
  const hy = p.thickness / 2;
  return [
    { x: p.x - hx, y: p.y - hy },
    { x: p.x + hx, y: p.y - hy },
    { x: p.x + hx, y: p.y + hy },
    { x: p.x - hx, y: p.y + hy }
  ];
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** Min/max signed projection of polygon points onto direction `n`. */
function projectionRange(poly: Vec2[], n: Vec2): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = dot(p, n);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

export function usePlan(): UsePlan {
  const [plan, setPlan] = useState<PlanState>(() => {
    const loaded = loadPlan();
    if (loaded && loaded.shape && loaded.shape.length > 0) return loaded;
    const base = loaded ?? initialPlan;
    return {
      ...base,
      shape: initialShape(base.log),
      produced: base.produced ?? [],
      cuts: base.cuts ?? []
    };
  });
  const historyRef = useRef<MillSnapshot[]>([]);
  const futureRef = useRef<MillSnapshot[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const firstRunRef = useRef(true);

  // Recompute plan-frame plank layout whenever the log / settings / priority list changes.
  useEffect(() => {
    const dd = designDiameter(plan.log);
    const res = computeLayout({
      designDiameterMm: dd,
      settings: plan.settings,
      priority: plan.priorityList
    });
    if (firstRunRef.current) {
      firstRunRef.current = false;
      setPlan((prev) => ({
        ...prev,
        planks: res.planks,
        shape: prev.shape && prev.shape.length > 0 ? prev.shape : initialShape(prev.log)
      }));
      return;
    }
    setPlan((prev) => ({
      ...prev,
      planks: res.planks,
      shape: initialShape(prev.log),
      produced: [],
      cuts: []
    }));
    historyRef.current = [];
    futureRef.current = [];
    setHistoryVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plan.log.buttSideDiameter,
    plan.log.topSideDiameter,
    plan.log.supportInset,
    plan.log.length,
    plan.settings.kerf,
    plan.settings.minSlab,
    plan.settings.edgeClearance,
    plan.settings.barkThickness,
    plan.settings.strategy,
    plan.priorityList
  ]);

  // Persist to localStorage.
  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  const pushHistory = useCallback((prev: PlanState) => {
    historyRef.current.push({
      rotationDeg: prev.rotationDeg,
      cuts: prev.cuts,
      shape: prev.shape,
      produced: prev.produced
    });
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    futureRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const setLog = (log: LogInput) => setPlan((p) => ({ ...p, log }));
  const setSettings = (settings: MillSettings) => setPlan((p) => ({ ...p, settings }));
  const setPriority = (priorityList: PlankSpec[]) => setPlan((p) => ({ ...p, priorityList }));

  // Rotation does not consume history (it's cheap to spin the log).
  const rotateBy = (deg: number) => {
    setPlan((p) => ({ ...p, rotationDeg: (((p.rotationDeg + deg) % 360) + 360) % 360 }));
  };

  /**
   * Planks that have not yet been sawn out. All are displayed.
   */
  const remainingPlanks = useMemo<PlacedPlank[]>(() => {
    const producedSeq = new Set(plan.produced.map((p) => p.sequence));
    return plan.planks.filter((pl) => !producedSeq.has(pl.sequence));
  }, [plan.planks, plan.produced]);

  /**
   * Determine the next blade position for the current rotation.
   *
   * Frames: shape and planks live in LOG frame. "Bed up" in log frame is
   * n̂ = (sin θ, cos θ). A point's bed-frame height is p · n̂.
   *
   * Physical model: the blade is `kerf` thick. Its BOTTOM edge (bladeBedY)
   * is what the sawyer cranks in on the mill — after the cut, the remaining
   * log's top surface sits exactly at bladeBedY. Material removed by the
   * cut is [bladeBedY, bladeBedY + kerf] (kerf sawdust) plus everything
   * above bladeBedY + kerf (the slab).
   *
   * Two-stage rule per plank:
   *   - If the topmost remaining plank's top edge is STRICTLY below the
   *     current shape top, we need a SLAB cut. Blade bottom = plankTop, so
   *     the kerf band sits in the discarded round waste just above the plank.
   *   - Otherwise (plank's top IS the shape top), we need a PLANK cut.
   *     Blade bottom = plankBottom − kerf, so the kerf band sits exactly in
   *     the planned kerf gap below the freed plank.
   *   - If that plank cut would require the blade to drop below the bed
   *     (or inside the bed), the plank IS the last of the log; return
   *     kind:'done' and leave the blade visible just above the plank.
   */
  const blade = useMemo<BladeReadout>(() => {
    if (plan.shape.length < 3 || remainingPlanks.length === 0) {
      const r = plan.shape.length
        ? projectionRange(plan.shape, bedUpInLog(plan.rotationDeg))
        : { min: 0, max: 0 };
      return { bladeAboveBed: 0, bladeBedY: 0, bedY: r.min, valid: false, kind: 'none' };
    }
    const n = bedUpInLog(plan.rotationDeg);
    const shapeR = projectionRange(plan.shape, n);
    const kerf = plan.settings.kerf;

    // Highest-top remaining plank whose top is still within (or at) the shape top.
    let best: { pl: PlacedPlank; top: number; bottom: number } | null = null;
    for (const pl of remainingPlanks) {
      const r = projectionRange(plankCorners(pl), n);
      if (r.max > shapeR.max + 1e-6) continue;
      if (!best || r.max > best.top) {
        best = { pl, top: r.max, bottom: r.min };
      }
    }
    if (!best) {
      return { bladeAboveBed: 0, bladeBedY: 0, bedY: shapeR.min, valid: false, kind: 'none' };
    }

    const isExposed = Math.abs(best.top - shapeR.max) < Math.max(1e-6, kerf * 0.1);
    const proposed = isExposed ? best.bottom - kerf : best.top;

    // A plank cut that would place the blade at or below the bed means the
    // plank is already resting on the bed — there is nothing left below it
    // to cut through. Treat the log as processed at this rotation.
    if (isExposed && proposed <= shapeR.min + 1e-6) {
      return {
        // Blade sits just above the plank so the UI still makes sense.
        bladeAboveBed: best.top - shapeR.min,
        bladeBedY: best.top,
        bedY: shapeR.min,
        valid: false,
        kind: 'done',
        producingLabel: best.pl.label
      };
    }

    return {
      bladeAboveBed: proposed - shapeR.min,
      bladeBedY: proposed,
      bedY: shapeR.min,
      valid: true,
      kind: isExposed ? 'plank' : 'slab',
      producingLabel: isExposed ? best.pl.label : undefined
    };
  }, [plan.shape, remainingPlanks, plan.rotationDeg, plan.settings.kerf]);

  /**
   * Step cut: the blade bottom (bladeBedY) is the new shape top. Clip the
   * shape to the half-plane p·n̂ ≤ bladeBedY.
   *
   * For a plank cut, the plank being produced is the one whose bottom edge
   * sits at or above `bladeBedY + kerf` (i.e. the plank was wholly inside
   * the removed slab). For a slab cut, no plank is produced.
   */
  const commitStep = () => {
    setPlan((p) => {
      if (!blade.valid) return p;
      pushHistory(p);
      const n = bedUpInLog(p.rotationDeg);
      const newTop = blade.bladeBedY;
      const newShape = clipHalfPlane(p.shape, n, -newTop);

      const producedNow: ProducedPlank[] = [];
      const producedIds: string[] = [];

      if (blade.kind === 'plank') {
        const threshold = newTop + p.settings.kerf;
        for (const pl of remainingPlanks) {
          const corners = plankCorners(pl);
          const r = projectionRange(corners, n);
          if (r.min >= threshold - 1e-6) {
            const id = `prod-${pl.sequence}-${p.cuts.length}`;
            producedNow.push({
              id,
              specId: pl.specId,
              label: pl.label,
              polygon: corners,
              sequence: pl.sequence
            });
            producedIds.push(id);
            break;
          }
        }
      }

      const noteKind =
        blade.kind === 'plank' ? `Plank cut → ${blade.producingLabel}` : 'Slab cut (round waste)';
      const cut: Cut = {
        y: blade.bladeBedY,
        rotationDeg: p.rotationDeg,
        note: `${p.rotationDeg.toFixed(0)}°: ${noteKind}`,
        producedPlankIds: producedIds
      };
      return {
        ...p,
        shape: newShape,
        produced: [...p.produced, ...producedNow],
        cuts: [...p.cuts, cut]
      };
    });
  };

  /**
   * Mark the final plank (the one sitting on the bed that requires no
   * further cut) as produced. Only meaningful when the blade reports
   * `kind === 'done'`.
   */
  const finishFinalPlank = () => {
    setPlan((p) => {
      if (blade.kind !== 'done' || !blade.producingLabel) return p;
      const target = remainingPlanks.find((pl) => pl.label === blade.producingLabel);
      if (!target) return p;
      pushHistory(p);
      const id = `prod-${target.sequence}-final`;
      const produced: ProducedPlank = {
        id,
        specId: target.specId,
        label: target.label,
        polygon: plankCorners(target),
        sequence: target.sequence
      };
      const cut: Cut = {
        y: blade.bladeBedY,
        rotationDeg: p.rotationDeg,
        note: `${p.rotationDeg.toFixed(0)}°: Final plank lifted → ${target.label}`,
        producedPlankIds: [id]
      };
      return {
        ...p,
        produced: [...p.produced, produced],
        cuts: [...p.cuts, cut]
      };
    });
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setPlan((p) => {
      futureRef.current.push({
        rotationDeg: p.rotationDeg,
        cuts: p.cuts,
        shape: p.shape,
        produced: p.produced
      });
      return {
        ...p,
        rotationDeg: prev.rotationDeg,
        cuts: prev.cuts,
        shape: prev.shape,
        produced: prev.produced
      };
    });
    setHistoryVersion((v) => v + 1);
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    setPlan((p) => {
      historyRef.current.push({
        rotationDeg: p.rotationDeg,
        cuts: p.cuts,
        shape: p.shape,
        produced: p.produced
      });
      return {
        ...p,
        rotationDeg: next.rotationDeg,
        cuts: next.cuts,
        shape: next.shape,
        produced: next.produced
      };
    });
    setHistoryVersion((v) => v + 1);
  };

  const reset = () => {
    setPlan((p) => {
      pushHistory(p);
      return {
        ...p,
        rotationDeg: 0,
        cuts: [],
        shape: initialShape(p.log),
        produced: []
      };
    });
  };

  /**
   * Cone detection: resolved once two committed cuts differ in rotation by
   * 180° (±1°). Until then, the sawyer should compensate by dropping the butt.
   */
  const cone = useMemo<ConeState>(() => {
    const angles = plan.cuts.map((c) => ((c.rotationDeg % 360) + 360) % 360);
    let resolved = false;
    for (let i = 0; i < angles.length && !resolved; i++) {
      for (let j = i + 1; j < angles.length && !resolved; j++) {
        const diff = Math.abs(angles[i] - angles[j]) % 360;
        const minDiff = Math.min(diff, 360 - diff);
        if (Math.abs(minDiff - 180) <= 1) resolved = true;
      }
    }
    const drop = resolved ? 0 : buttLowering(plan.log);
    return { resolved, buttDropMm: drop };
  }, [
    plan.cuts,
    plan.log.buttSideDiameter,
    plan.log.topSideDiameter,
    plan.log.supportInset,
    plan.log.length
  ]);

  const canUndo = useMemo(() => historyRef.current.length > 0, [historyVersion]);
  const canRedo = useMemo(() => futureRef.current.length > 0, [historyVersion]);

  const logComplete = remainingPlanks.length === 0 && plan.cuts.length > 0;

  // `startNextLog` is intentionally the same operation as `reset` — the split
  // exists so the UI can offer a distinct, reassuring label ("Next log") at
  // the end of a job without the operator worrying they'll lose settings.
  const startNextLog = reset;

  return {
    plan,
    setLog,
    setSettings,
    setPriority,
    rotateBy,
    commitStep,
    finishFinalPlank,
    undo,
    redo,
    reset,
    startNextLog,
    canUndo,
    canRedo,
    blade,
    cone,
    remainingPlanks,
    logComplete
  };
}

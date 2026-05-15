import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeLayout } from '../core/layout';
import { circlePolygon, clipHalfPlane, convexChord, polygonHasFlatFace } from '../core/geometry';
import { rootLowering, designDiameter } from '../core/taper';
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
  /**
   * Coarse phase of the sawing workflow:
   *  - 'squaring' – still turning the round log into a 4-sided cant.
   *    The first four cuts recommended are slabs at 0°/90°/180°/270°
   *    (one per face) so the sawyer ends up with a rectangular stock
   *    before any plank is freed. This matches real-world practice and
   *    is much easier to reason about than the old per-rotation greedy
   *    rule which would happily plank-cut one face while three others
   *    were still round.
   *  - 'planking' – cant is squared; we now work top-to-bottom on the
   *    face with the tallest remaining plank stack, rotating to the
   *    next face when the current one is exhausted.
   *  - 'done' / 'none' – mirror `kind`.
   */
  phase: 'squaring' | 'planking' | 'done' | 'none';
  /**
   * 1-based index of the current squaring slab (1..squaringTotal) when
   * `phase === 'squaring'`, otherwise `undefined`. Drives the "Squaring
   * slab (n of 4)" label in the NEXT pill.
   */
  squaringIndex?: number;
  /** Total number of squaring slabs the planner expects (always 4 today). */
  squaringTotal?: number;
  /**
   * Rotation (deg) the planner thinks the log *should* be at for the
   * next cut. When this differs from `plan.rotationDeg`, the UI either
   * auto-rotates (if `settings.autoRotateForSquaring`) on commit or
   * shows a "Rotate to X° first" hint and still lets the sawyer cut at
   * their current rotation. `undefined` when the current rotation is
   * already the recommended one (or we have no opinion — e.g. planking
   * phase where any face is acceptable).
   */
  suggestRotationDeg?: number;
}

export interface ConeState {
  /** Drop to apply to the root-side support (mm) while cone is still active, 0 when resolved. */
  rootDropMm: number;
  /** True once two cuts 180° apart have been committed. */
  resolved: boolean;
  /**
   * True when the shape currently has a flat face resting on the mill
   * bed (i.e. the bed-side of `plan.shape` is a straight edge at the
   * current rotation). The log can't roll in that position, and the
   * flat face has ALREADY compensated for the taper for this
   * orientation — the sawyer should NOT drop the support any further.
   *
   * This flag is a function of `plan.shape` and `plan.rotationDeg`,
   * so it flips back to `false` if the sawyer rotates the curved
   * side of the log back down. The UI uses it to suppress drop
   * advice whenever it's true, even when `resolved` is still false.
   */
  bedFlat: boolean;
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
   *
   * If a `UsePlanOptions.onArchiveLog` callback was supplied, the current
   * plan is first passed to it (before the clear) so the caller can push
   * it into a history store. The callback only fires when the plan has
   * both at least one committed cut AND at least one produced plank —
   * avoids archiving a fresh, untouched log if the sawyer taps "Next
   * log" by accident.
   */
  startNextLog: () => void;
  /**
   * Replace the current plan with a full PlanState snapshot (typically
   * loaded from the log archive). Clears undo/redo history because the
   * live history belongs to the previous plan and wouldn't make sense
   * applied to a different log's shape.
   */
  loadSnapshot: (snapshot: PlanState) => void;
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

/** Optional dependencies the hook collaborates with. */
export interface UsePlanOptions {
  /**
   * Called with the current plan just before `startNextLog` clears it.
   * Fires only when the plan looks finished (≥ 1 cut and ≥ 1 produced
   * plank) so empty / abandoned plans don't pollute the archive.
   */
  onArchiveLog?: (plan: PlanState) => void;
}

// Initial shape = design-circle polygon centred at (0,0) in LOG frame.
// Exported so other modules (e.g. the edging guide) can compute against
// the original log cross-section independently of the current cut state.
export function initialShape(log: LogInput): Vec2[] {
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

/**
 * The four canonical squaring rotations, in the order the planner will
 * recommend them: flip 90° each time so the sawyer always puts the
 * previous flat face down before cutting the next one. After the
 * fourth, the cant is square. Exported for tests.
 */
export const SQUARING_ROTATIONS = [0, 90, 180, 270] as const;
const SQUARING_TOTAL = SQUARING_ROTATIONS.length;

/** Normalise a rotation to [0, 360). */
function normDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Given the committed cut history, returns the number of *distinct*
 * squaring rotations already slabbed (0..4). A rotation counts as
 * "slabbed" if any prior cut was made at (approximately) that angle.
 * We only inspect whether the angle is present — not what kind of cut
 * it was — because in the two-phase workflow the first cut at a given
 * squaring rotation is always a slab by construction.
 *
 * Exported for unit tests.
 */
export function squaringProgress(cuts: Cut[]): { doneCount: number; doneSet: Set<number> } {
  const done = new Set<number>();
  for (const c of cuts) {
    const a = normDeg(c.rotationDeg);
    for (const target of SQUARING_ROTATIONS) {
      // ±1° tolerance matches the cone-banner's matching tolerance so
      // a "close enough" rotation still counts as that face.
      if (Math.abs(a - target) <= 1 || Math.abs(a - target) >= 359) {
        done.add(target);
        break;
      }
    }
  }
  return { doneCount: done.size, doneSet: done };
}

/**
 * The next squaring rotation the planner wants, or `undefined` if all
 * four faces are already slabbed. Order is taken from
 * `SQUARING_ROTATIONS`: 0° is the natural starting face (the rotation
 * the user has at log load); subsequent 90° flips keep the sawyer's
 * mental model simple.
 *
 * Exported for unit tests.
 */
export function nextSquaringRotation(cuts: Cut[]): number | undefined {
  const { doneSet } = squaringProgress(cuts);
  for (const r of SQUARING_ROTATIONS) {
    if (!doneSet.has(r)) return r;
  }
  return undefined;
}

/**
 * Which rotation should the planker work on? Heuristic: pick the
 * squaring rotation whose "up" face has the most remaining planks
 * whose bed-up projection puts them above the pith at that rotation.
 * Ties are broken by total plank area, then by preferring 0° (since
 * that's where the main cant stack was laid out).
 *
 * Returns `undefined` when there are no remaining planks.
 *
 * Exported for unit tests.
 */
export function bestPlankingRotation(
  remaining: PlacedPlank[],
  shape: Vec2[]
): number | undefined {
  if (remaining.length === 0) return undefined;
  let best: { deg: number; count: number; area: number } | null = null;
  for (const deg of SQUARING_ROTATIONS) {
    const n = bedUpInLog(deg);
    const shapeR = shape.length ? projectionRange(shape, n) : { min: 0, max: 0 };
    let count = 0;
    let area = 0;
    // Tolerance guards against `Math.cos(π/2) ≈ 6e-17` (and similar
    // trig noise) leaking planks from the wrong face into the count.
    // A plank centre must be meaningfully above the pith — more than
    // a thousandth of a mm — to count as reachable from this face.
    const CENTRE_EPS = 1e-3;
    for (const pl of remaining) {
      const r = projectionRange(plankCorners(pl), n);
      // Plank must still be inside the current shape at this rotation,
      // and its centre must be on the "up" side of the pith so it's
      // reachable from this face (a plank on the opposite side would
      // need the log flipped first).
      const centreProj = dot({ x: pl.x, y: pl.y }, n);
      if (centreProj <= CENTRE_EPS) continue;
      if (r.max > shapeR.max + 1e-6) continue;
      count += 1;
      area += pl.width * pl.thickness;
    }
    const entry = { deg, count, area };
    if (!best) {
      best = entry;
      continue;
    }
    // Strict winner wins outright.
    if (count > best.count) {
      best = entry;
      continue;
    }
    if (count < best.count) continue;
    if (area > best.area) {
      best = entry;
      continue;
    }
    if (area < best.area) continue;
    // Exact tie on count & area: prefer 0° over all others, then 90°,
    // then 180°, then 270°. The helper iterates rotations in that
    // order, so the incumbent is already better-or-equal by tiebreak
    // and we leave it untouched.
  }
  // If no face has any upward plank (e.g. only cant remains, which
  // straddles the pith), fall back to whatever rotation the user is
  // at — there's no face-preference to offer.
  if (!best || best.count === 0) return undefined;
  return best.deg;
}

/**
 * Given a rotation, compute the usual "topmost remaining plank,
 * slab-or-plank cut" proposal used to drive the blade readout. Pulled
 * out of the memo so the two phases share one decision routine — the
 * phase logic only changes *which rotation we evaluate against* and
 * how the UI labels the result.
 */
function proposeCutAtRotation(
  shape: Vec2[],
  remaining: PlacedPlank[],
  rotationDeg: number,
  kerf: number
): Omit<BladeReadout, 'phase' | 'squaringIndex' | 'squaringTotal' | 'suggestRotationDeg'> {
  if (shape.length < 3 || remaining.length === 0) {
    const r = shape.length
      ? projectionRange(shape, bedUpInLog(rotationDeg))
      : { min: 0, max: 0 };
    return { bladeAboveBed: 0, bladeBedY: 0, bedY: r.min, valid: false, kind: 'none' };
  }
  const n = bedUpInLog(rotationDeg);
  const shapeR = projectionRange(shape, n);

  // Highest-top remaining plank whose top is still within (or at) the shape top.
  let best: { pl: PlacedPlank; top: number; bottom: number } | null = null;
  for (const pl of remaining) {
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

  // A plank cut that would place the blade at or below the bed means
  // the plank is already resting on the bed — there is nothing left
  // below it to cut through. Treat the log as processed at this rotation.
  if (isExposed && proposed <= shapeR.min + 1e-6) {
    return {
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
}

export function usePlan(options: UsePlanOptions = {}): UsePlan {
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

  // Mirror the live plan into a ref so callbacks (e.g. `startNextLog`)
  // can read the latest state without adding `plan` to their dep array
  // — we want stable identities for the callbacks so React doesn't
  // re-render consumers on every state tick.
  const planRef = useRef(plan);
  planRef.current = plan;

  const firstRunRef = useRef(true);
  // When set, the NEXT run of the layout-recompute effect should
  // treat the plan as already-complete and skip its wipe of
  // cuts/produced/shape. Flipped to true by `loadSnapshot` so
  // reopening an archived log keeps the snapshot's cuts and produced
  // planks visible instead of having them zeroed out by the regular
  // "input changed → reset" side-effect.
  const suppressRecomputeWipeRef = useRef(false);

  // Recompute plan-frame plank layout whenever the log / settings / priority list changes.
  useEffect(() => {
    const dd = designDiameter(plan.log);
    const res = computeLayout({
      designDiameterMm: dd,
      settings: plan.settings,
      priority: plan.priorityList,
      species: plan.log.species
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
    if (suppressRecomputeWipeRef.current) {
      // A snapshot load just landed. Adopt the freshly-computed
      // `planks` (they're a pure function of log + settings + priority
      // so this is effectively a no-op for a well-formed snapshot)
      // but keep the snapshot's cuts / produced / shape intact.
      suppressRecomputeWipeRef.current = false;
      setPlan((prev) => ({ ...prev, planks: res.planks }));
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
    plan.log.rootSideDiameter,
    plan.log.topSideDiameter,
    plan.log.supportInset,
    plan.log.length,
    plan.log.sweepMm,
    plan.log.species,
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
   * Determine the next blade position using a two-phase workflow.
   *
   * Phase A — squaring: for a fresh log the planner insists on four
   * slab cuts first, one per 90° face, rotating 0° → 90° → 180° → 270°.
   * The result is a rectangular cant with flat faces on every side,
   * matching how sawyers actually work and sidestepping the old bug
   * where rotating mid-plank would happily propose a new plank on a
   * still-round face.
   *
   * Phase B — planking: once the cant is squared, the planner picks
   * the face with the most reachable remaining planks (usually the
   * widest stack above the cant) and delegates to the classic per-
   * rotation "slab or plank" logic. The sawyer rotates manually in
   * this phase; if they're already on a planking face the readout
   * tracks them exactly, otherwise the pill surfaces the recommended
   * rotation as a hint.
   *
   * Frames: shape and planks live in LOG frame. "Bed up" in log frame
   * is n̂ = (sin θ, cos θ). A point's bed-frame height is p · n̂.
   *
   * Physical model (unchanged per cut): the blade is `kerf` thick.
   * Its BOTTOM edge (bladeBedY) is what the sawyer cranks in on the
   * mill — after the cut, the remaining log's top surface sits exactly
   * at bladeBedY. Material removed by the cut is [bladeBedY,
   * bladeBedY + kerf] (kerf sawdust) plus everything above
   * bladeBedY + kerf (the slab).
   */
  const blade = useMemo<BladeReadout>(() => {
    const kerf = plan.settings.kerf;

    if (plan.shape.length < 3 || remainingPlanks.length === 0) {
      const base = proposeCutAtRotation(plan.shape, remainingPlanks, plan.rotationDeg, kerf);
      return { ...base, phase: base.kind === 'done' ? 'done' : 'none' };
    }

    const squaringTarget = nextSquaringRotation(plan.cuts);

    if (squaringTarget !== undefined) {
      // === Phase A: squaring ===
      const { doneCount } = squaringProgress(plan.cuts);
      // Always describe the cut at whichever rotation the user is
      // currently at so the height readout and EndView blade line
      // track what they see. If auto-rotate is on, `commitStep` will
      // swap in the recommended rotation before actually cutting.
      const base = proposeCutAtRotation(plan.shape, remainingPlanks, plan.rotationDeg, kerf);
      // The first cut on any still-round face is, by geometry, a slab
      // (no plank can already have its top at the shape top of a round
      // log). If the proposed kind came back as 'done' or 'none' at
      // this rotation (e.g. no remaining plank projects into the face)
      // we still advertise a slab — it's the user's job to trust the
      // workflow for now. `bladeAboveBed` in that edge case stays with
      // whatever `proposeCutAtRotation` returned, which is fine.
      const current = normDeg(plan.rotationDeg);
      const aligned = SQUARING_ROTATIONS.some(
        (r) => r === squaringTarget && (Math.abs(current - r) <= 1 || Math.abs(current - r) >= 359)
      );
      return {
        ...base,
        // Force the kind to slab during squaring — the first cut on any
        // face of a round log is always a round-waste slab.
        kind: base.kind === 'none' ? 'none' : 'slab',
        producingLabel: undefined,
        phase: 'squaring',
        squaringIndex: doneCount + 1,
        squaringTotal: SQUARING_TOTAL,
        suggestRotationDeg: aligned ? undefined : squaringTarget
      };
    }

    // === Phase B: planking ===
    const planningRotation = bestPlankingRotation(remainingPlanks, plan.shape);
    const current = normDeg(plan.rotationDeg);
    // Evaluate the cut at the user's ACTUAL rotation so the readout
    // matches the illustration. We only surface `suggestRotationDeg`
    // if the planner thinks another face is strictly better.
    const base = proposeCutAtRotation(plan.shape, remainingPlanks, plan.rotationDeg, kerf);
    const phase: BladeReadout['phase'] = base.kind === 'done' ? 'done' : 'planking';
    const suggest =
      planningRotation !== undefined &&
      Math.abs(current - planningRotation) > 1 &&
      Math.abs(current - planningRotation) < 359
        ? planningRotation
        : undefined;
    return { ...base, phase, suggestRotationDeg: suggest };
  }, [plan.shape, remainingPlanks, plan.rotationDeg, plan.settings.kerf, plan.cuts]);

  /**
   * Step cut: the blade bottom (bladeBedY) is the new shape top. Clip the
   * shape to the half-plane p·n̂ ≤ bladeBedY.
   *
   * For a plank cut, the plank being produced is the one whose bottom edge
   * sits at or above `bladeBedY + kerf` (i.e. the plank was wholly inside
   * the removed slab). For a slab cut, no plank is produced.
   *
   * Auto-rotate during squaring: when `settings.autoRotateForSquaring` is
   * on and we're still in Phase A after this cut, we rotate the log to
   * the next canonical face *inside the same setPlan call*. The sawyer's
   * mental model is "cut, then the log turns so the next face is up" —
   * matching the physical workflow where they'd drop the supports and
   * flip the log 90° before setting up the next cut. Both the cut and
   * the rotation share one undo snapshot, so ↑ Undo restores the pre-
   * cut state cleanly.
   *
   * Auto-rotate is strictly a Phase A (squaring) feature. Once the cant
   * is squared, rotation stays fully manual so the sawyer can empty one
   * stack face before deciding where to go next.
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
        // The cut face is the chord of the pre-clip shape where the
        // cut line `p·n = newTop` intersects it — the new straight
        // boundary the cut introduces. Computed once per step and
        // attached to every plank produced by the step (typically one).
        const faceChord = convexChord(p.shape, n, newTop);
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
              sequence: pl.sequence,
              // Freeze the shape as it was when this plank came off the log.
              // The edging guide uses this so each produced plank keeps its
              // real trim values (reflecting earlier squaring cuts) instead
              // of being re-evaluated against the worst-case round log.
              shapeAtCut: p.shape,
              cutFace: faceChord ?? undefined
            });
            producedIds.push(id);
            break;
          }
        }
      }

      // Label distinguishes squaring slabs (part of the first-four
      // workflow) from waste slabs between planks so the cut history
      // and the NEXT pill can differ cosmetically.
      let noteKind: string;
      if (blade.kind === 'plank') {
        noteKind = `Plank cut → ${blade.producingLabel}`;
      } else if (blade.phase === 'squaring' && blade.squaringIndex && blade.squaringTotal) {
        noteKind = `Squaring slab (${blade.squaringIndex} of ${blade.squaringTotal})`;
      } else {
        noteKind = 'Slab cut (round waste)';
      }
      const cut: Cut = {
        y: blade.bladeBedY,
        rotationDeg: p.rotationDeg,
        note: `${p.rotationDeg.toFixed(0)}°: ${noteKind}`,
        producedPlankIds: producedIds
      };
      const nextCuts = [...p.cuts, cut];

      // Post-cut auto-rotate: only fires during Phase A with the setting
      // enabled. Three cases:
      //  1. Still squaring (nextSquaringRotation is defined): rotate to
      //     that next canonical face so the sawyer sees the next setup.
      //  2. Just completed squaring (nextSquaringRotation is undefined
      //     but we're currently in the squaring phase): rotate straight
      //     into the best planking face so the sawyer can keep tapping
      //     Cut without manually spinning the log. Without this, the
      //     log would be left at 270° and the sawyer would have to
      //     rotate back to (typically) 0° before the first plank cut.
      //  3. Already past squaring (no-op — rotation stays manual).
      let nextRotation = p.rotationDeg;
      if (p.settings.autoRotateForSquaring && blade.phase === 'squaring') {
        const upcoming = nextSquaringRotation(nextCuts);
        if (upcoming !== undefined) {
          nextRotation = upcoming;
        } else {
          // Squaring just finished on this cut. Compute the best
          // planking face against the POST-cut shape + remaining
          // planks (remaining excludes the plank produced by this
          // step, if any — although squaring slabs don't produce
          // planks in practice, this is the defensive form). Falls
          // back to the current rotation if there's no clear winner.
          const producedNowIds = new Set(producedNow.map((p) => p.id));
          const remainingAfterCut = remainingPlanks.filter(
            (pl) =>
              !producedNow.some(
                (pr) => pr.sequence === pl.sequence && producedNowIds.has(pr.id)
              )
          );
          const planking = bestPlankingRotation(remainingAfterCut, newShape);
          if (planking !== undefined) {
            nextRotation = planking;
          }
        }
      }

      return {
        ...p,
        rotationDeg: nextRotation,
        shape: newShape,
        produced: [...p.produced, ...producedNow],
        cuts: nextCuts
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
        sequence: target.sequence,
        // Final plank lifts off whatever shape is currently on the mill —
        // no further clip happens, so the live shape is also the cut-time
        // shape for edging purposes.
        shapeAtCut: p.shape
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
   * Cone detection. The sawyer needs to know whether the taper
   * problem is currently handled — either physically (the log rests
   * on a flat cut face and can't roll) or procedurally (two cuts
   * 180° apart have been made, so the pith is level between
   * supports). Three signals captured:
   *
   *   - `rootDropMm` : the theoretical drop needed for the root-side
   *     support given the measured taper, 0 when resolved. Always
   *     what the sawyer would need IF the log were still round at
   *     the current rotation.
   *   - `resolved`   : two cuts 180° apart have been committed.
   *     Permanent for the rest of the log.
   *   - `bedFlat`    : the log currently rests on a flat cut face,
   *     so the drop is already compensated by the geometry and
   *     MUST NOT be re-applied. Rotation-dependent — flips back
   *     false if the sawyer spins onto a round face before
   *     resolution.
   *
   * The UI suppresses drop advice whenever `resolved || bedFlat`,
   * showing a confirmation badge instead. This fixes the "claims
   * 10 mm compensation when the log is already flat on the bed"
   * bug that came from trusting resolved alone.
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
    const drop = resolved ? 0 : rootLowering(plan.log);
    const bedUp = bedUpInLog(plan.rotationDeg);
    const bedFlat = polygonHasFlatFace(plan.shape, bedUp);
    return { resolved, rootDropMm: drop, bedFlat };
  }, [
    plan.cuts,
    plan.shape,
    plan.rotationDeg,
    plan.log.rootSideDiameter,
    plan.log.topSideDiameter,
    plan.log.supportInset,
    plan.log.length
  ]);

  const canUndo = useMemo(() => historyRef.current.length > 0, [historyVersion]);
  const canRedo = useMemo(() => futureRef.current.length > 0, [historyVersion]);

  const logComplete = remainingPlanks.length === 0 && plan.cuts.length > 0;

  /**
   * `startNextLog` is `reset` + an optional archive hand-off. We fire
   * the `onArchiveLog` callback from the OPTIONS passed to the hook
   * (so the hook stays agnostic about the archive module itself), and
   * only when the current plan has actual content worth archiving — at
   * least one committed cut AND at least one produced plank. This
   * avoids polluting the history with empty "I tapped reset by
   * mistake" entries.
   *
   * Archive runs before state reset so the callback sees the plan as
   * the sawyer saw it. The archive callback is synchronous and is
   * expected to finish (or at least queue a setState) during the
   * call; React's batching then lets both updates settle together.
   */
  const startNextLog = useCallback(() => {
    const current = planRef.current;
    const worthArchiving =
      current.cuts.length > 0 && current.produced.length > 0;
    if (worthArchiving && options.onArchiveLog) {
      options.onArchiveLog(current);
    }
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.onArchiveLog]);

  /**
   * Replace the live plan with a snapshot — used to "reopen" an
   * archived completed log. Undo/redo history is wiped because its
   * entries describe cuts on a different log's shape and replaying
   * them on this one would crash or produce nonsense.
   *
   * Sets `suppressRecomputeWipeRef` so the layout-recompute effect
   * that fires right after this state change keeps the snapshot's
   * cuts / shape / produced intact. Without that flag, the effect
   * would see a "new log" (dims changed) and zero everything out.
   */
  const loadSnapshot = useCallback((snapshot: PlanState) => {
    // Deep-clone so later mutations to the live plan don't reach
    // back into the caller's archive entry (which is also a frozen-
    // by-convention JSON blob, but belt-and-braces is cheap here).
    const clone: PlanState = JSON.parse(JSON.stringify(snapshot));
    suppressRecomputeWipeRef.current = true;
    setPlan(clone);
    historyRef.current = [];
    futureRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

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
    loadSnapshot,
    canUndo,
    canRedo,
    blade,
    cone,
    remainingPlanks,
    logComplete
  };
}

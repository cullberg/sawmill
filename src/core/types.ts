// Core types for the sawmill planner.
// All length/size values are in millimetres unless stated otherwise.

export type Species = 'pine' | 'spruce' | 'birch';

export interface LogInput {
  /**
   * Diameter measured at the root-side support (mm). The support sits at
   * `supportInset` from the root end of the log (the wider, tree-base end).
   */
  rootSideDiameter: number;
  /**
   * Diameter measured at the top-side support (mm). The support sits at
   * `supportInset` from the top end of the log.
   */
  topSideDiameter: number;
  /**
   * Distance from each end cut to its support (mm). Symmetric by
   * construction so the two supports are `length − 2·supportInset` apart
   * (e.g. 1250 mm inset on a 5000 mm log ⇒ 2500 mm between supports).
   */
  supportInset: number;
  /** Total length of the log, mm (e.g. 5000). */
  length: number;
  /** Species (used for presets only). */
  species: Species;
}

export interface MillSettings {
  /** Kerf width per cut, mm (default 6). */
  kerf: number;
  /** Minimum usable slab thickness the mill can still handle, mm. */
  minSlab: number;
  /** Strategy for auto-layout. */
  strategy: 'priority' | 'value' | 'min-waste';
  /** Clearance between planks and the log bark edge, mm. */
  edgeClearance: number;
  /** Bark thickness assumed on the uncut (round) sides of the log, mm. */
  barkThickness: number;
  /**
   * What the cutting tool is called in the UI. `chain` (default) suits
   * chainsaw mills; `blade` reads better for bandsaw mills. The choice
   * is purely cosmetic — it doesn't change any math. Persisted so each
   * mill keeps the term its sawyer prefers.
   */
  cuttingTool: 'chain' | 'blade';
  /**
   * When true (default), the Cut button automatically rotates the log
   * to the face recommended by the two-phase next-step planner before
   * it commits the cut. When false, the planner always describes the
   * next cut at the sawyer's current rotation and only surfaces the
   * recommended rotation as a hint — the sawyer is trusted to spin the
   * log manually. Kept as a setting because muscle-memory sawyers may
   * prefer deterministic behaviour with no hidden rotations.
   */
  autoRotateForSquaring: boolean;
}

export interface PlankSpec {
  id: string;
  /** Nominal width, mm. */
  width: number;
  /** Nominal thickness, mm. */
  thickness: number;
  /** Optional label / note. */
  label?: string;
  /** Relative value score when the value strategy is used. */
  value?: number;
  /** Minimum count to produce (soft). */
  minCount?: number;
  /** Maximum count to produce (hard). */
  maxCount?: number;
  /** Whether to include this spec in optimization. */
  enabled: boolean;
}

/**
 * A plank placement in the PLAN (log-local) coordinate system.
 *
 * Coordinate system:
 *   - origin (0,0) = geometric centre of the log end face at plan time
 *   - +x = right, +y = up
 *   - planks are axis-aligned in this plan frame; the whole plan is rotated
 *     by `rotationDeg` when presenting to the sawyer.
 *
 * `x`, `y` are the centre of the plank rectangle. `width` runs along plan-x,
 * `thickness` runs along plan-y.
 */
export interface PlacedPlank {
  specId: string;
  x: number;
  y: number;
  width: number;
  thickness: number;
  /** Order in which the plank is produced (1 = first). */
  sequence: number;
  /** Label shown in UI. */
  label: string;
}

/** A 2D point in the world (bed) frame. mm. */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * A committed cut.
 * `y` is the blade height in the WORLD (bed) frame, mm above the bed reference.
 */
export interface Cut {
  /** Blade y in world frame at the moment of the cut, mm. */
  y: number;
  /** The rotation angle of the log at the moment of the cut, degrees. */
  rotationDeg: number;
  /** Short human description. */
  note: string;
  /** IDs of planks produced in the same step (may be empty). */
  producedPlankIds: string[];
}

/**
 * A plank that has actually been sawn (produced), in world frame. These are
 * preserved across subsequent cuts so the sawyer sees what's already done.
 */
export interface ProducedPlank {
  /** Unique id for history keeping. */
  id: string;
  specId: string;
  label: string;
  /** Four corners of the plank rectangle, in world frame, mm. */
  polygon: Vec2[];
  sequence: number;
  /**
   * Snapshot of the log cross-section polygon at the moment this plank
   * was sawn off (before the step clip was applied). Used by the end-view
   * and edging guide to compute the plank's wane trim against the shape
   * as it actually was when the plank came off — which correctly accounts
   * for prior squaring cuts and isn't the worst-case round-log value.
   * Optional to stay backward-compatible with plans saved before this
   * field existed; readers should fall back to the original log circle.
   */
  shapeAtCut?: Vec2[];
  /**
   * Endpoints (in log frame, mm) of the straight cut face added to the
   * remaining log when this plank was freed. Drawn in the end-view so
   * every produced plank gets the same "cut-face line" between itself
   * and the current shape, regardless of whether later cuts have since
   * trimmed that boundary away from `plan.shape`. Optional for
   * backwards-compat with plans saved before the field existed.
   */
  cutFace?: [Vec2, Vec2];
}

export interface PlanState {
  log: LogInput;
  settings: MillSettings;
  priorityList: PlankSpec[];
  /** Current log rotation for the UI, degrees. Positive = clockwise on screen. */
  rotationDeg: number;
  /** Committed cuts (history). */
  cuts: Cut[];
  /** Planks planned by the layout (in plan frame). */
  planks: PlacedPlank[];
  /** Current cross-section polygon in WORLD frame (mm). */
  shape: Vec2[];
  /** Planks already sawn out, in WORLD frame. */
  produced: ProducedPlank[];
}

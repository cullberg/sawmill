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

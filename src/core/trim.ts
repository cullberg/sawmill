import type { PlacedPlank, Vec2 } from './types';

/**
 * Per-plank trim allowance — how much wane (round edge material) extends
 * beyond the plank's target rectangle on each side in the log frame.
 *
 * Positive values mean the sawyer will need to edge that side after
 * cutting the plank off the log to reach the target width. Zero means
 * the side is already flush against a previous cut face (typical inner
 * edge of a side board, against the squared cant) and no edging is
 * needed there.
 */
export interface PlankTrim {
  left: number;
  right: number;
}

/** Small epsilon to discount floating-point fuzz when deciding if an edge is "flush". */
const EPS = 0.5;

/**
 * Find the leftmost and rightmost x at which a horizontal line at the
 * given y-level intersects the polygon. Returns null if the line misses
 * the polygon entirely (y outside the polygon's y-range).
 *
 * Standard ray-crossing on each polygon edge, recording the x of every
 * crossing and taking min/max. Handles arbitrary convex / non-convex
 * polygons so this keeps working after several clip operations.
 */
function polygonXExtentAtY(poly: Vec2[], y: number): { xMin: number; xMax: number } | null {
  if (poly.length < 3) return null;
  const crossings: number[] = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    // Edge crosses the horizontal line at `y` iff one endpoint is above
    // and the other is at/below (or vice versa). Using a half-open test
    // so we don't double-count edges that touch the line at a vertex.
    if (a.y === b.y) continue;
    const hi = Math.max(a.y, b.y);
    const lo = Math.min(a.y, b.y);
    if (y < lo || y > hi) continue;
    const t = (y - a.y) / (b.y - a.y);
    crossings.push(a.x + t * (b.x - a.x));
  }
  if (crossings.length === 0) return null;
  return { xMin: Math.min(...crossings), xMax: Math.max(...crossings) };
}

/**
 * Worst-case x-extent of the polygon over the y-range `[yLow, yHigh]`.
 * Samples at the two endpoints AND at a few interior y-levels so a
 * concave polygon doesn't fool us. This is O(samples × polygonVertices)
 * per call — perfectly fine for our ~96-vertex shape with ~30 planks.
 */
function shapeXExtentOverYRange(
  poly: Vec2[],
  yLow: number,
  yHigh: number,
  samples = 5
): { xMin: number; xMax: number } | null {
  let xMin = Infinity;
  let xMax = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = samples === 0 ? 0 : i / samples;
    const y = yLow + (yHigh - yLow) * t;
    const ext = polygonXExtentAtY(poly, y);
    if (!ext) continue;
    if (ext.xMin < xMin) xMin = ext.xMin;
    if (ext.xMax > xMax) xMax = ext.xMax;
  }
  if (!isFinite(xMin) || !isFinite(xMax)) return null;
  return { xMin, xMax };
}

/**
 * Compute the trim allowance on each side of a plank given the current
 * log cross-section polygon. Returns `{ left: 0, right: 0 }` for planks
 * whose target rectangle already reaches the shape boundary on both
 * sides (i.e. they'll come off clean with no edging required).
 *
 * Interpretation: the "rough" plank the sawyer gets when they make the
 * horizontal cut occupies the cross-section of the shape between the
 * plank's y-range. It's bounded vertically by the cuts above and below
 * and horizontally by the shape's current left / right edge. Everything
 * outside `[cx − w/2, cx + w/2]` is wane to be trimmed.
 *
 * Because the shape polygon evolves as cuts are made, the trim value is
 * reactive: once the sawyer squares the cant with side cuts, inner
 * planks in the cant will show zero trim automatically.
 */
export function computePlankTrim(shape: Vec2[], plank: PlacedPlank): PlankTrim {
  if (shape.length < 3) return { left: 0, right: 0 };
  const yLow = plank.y - plank.thickness / 2;
  const yHigh = plank.y + plank.thickness / 2;
  const ext = shapeXExtentOverYRange(shape, yLow, yHigh);
  if (!ext) return { left: 0, right: 0 };

  const targetLeft = plank.x - plank.width / 2;
  const targetRight = plank.x + plank.width / 2;
  const left = Math.max(0, targetLeft - ext.xMin);
  const right = Math.max(0, ext.xMax - targetRight);
  // Snap sub-millimetre leftovers to zero so we don't pester the sawyer
  // with "+0 mm" trim badges from FP noise after clip operations.
  return {
    left: left < EPS ? 0 : left,
    right: right < EPS ? 0 : right
  };
}

/**
 * Blade-height recommendation for edging a plank with the given target
 * width down from its rough (post-cut) width. Assumes the sawyer stands
 * the plank on the mill with its width dimension vertical and one wane
 * edge resting on the bed.
 *
 * Two possible workflows depending on whether the plank has wane on
 * both sides:
 *
 *   - **Both sides wane** (central-column planks, first side boards off
 *     a round log): two cuts with a 180° flip between them.
 *       • Cut 1: blade at `roughWidth − trimTop`, trimming the upper
 *         wane down to clean flat wood. After this cut the plank is
 *         `roughWidth − trimTop` tall with flat top and wane bottom.
 *       • Flip upside-down (new bed = freshly-cut flat face).
 *       • Cut 2: blade at `targetWidth`, trimming the now-upper (old
 *         lower) wane down to the target width. Plank is rectangular.
 *
 *   - **One side wane** (side boards after the cant is squared): one
 *     cut, no flip. Plank rests flat-face-down on the bed.
 *       • Cut 1: blade at `targetWidth`. Removes the wane, leaves a
 *         perfectly rectangular plank.
 *
 * We always report with the bottom wane (if any) resting on the bed
 * because that's the only stable orientation for a horizontal-blade
 * mill. Heights are in millimetres above the bed.
 */
export interface EdgingPlan {
  /** True if the plank is fully rectangular already — no edging required. */
  clean: boolean;
  /** Rough width (target + any wane trim on either side), mm. */
  roughWidth: number;
  /** Target width after edging, mm. */
  targetWidth: number;
  /** Blade height for cut 1 in mm, or null if no cut needed. */
  cut1: number | null;
  /** Blade height for cut 2 in mm, or null if only one cut is needed. */
  cut2: number | null;
  /**
   * True when the workflow requires flipping the plank 180° after cut 1
   * (so the freshly-cut face becomes the new bed reference for cut 2).
   */
  requiresFlip: boolean;
  /** Left-side trim in mm (0 = flush with shape boundary / cant edge). */
  trimLeft: number;
  /** Right-side trim in mm. */
  trimRight: number;
}

export function edgingPlanForPlank(
  trim: PlankTrim,
  plank: PlacedPlank
): EdgingPlan {
  const { left, right } = trim;
  const targetWidth = plank.width;
  const roughWidth = targetWidth + left + right;
  const bothWane = left > 0 && right > 0;
  const oneWane = (left > 0) !== (right > 0);

  if (!bothWane && !oneWane) {
    return {
      clean: true,
      roughWidth,
      targetWidth,
      cut1: null,
      cut2: null,
      requiresFlip: false,
      trimLeft: left,
      trimRight: right
    };
  }

  if (oneWane) {
    // Flat face down on bed, wane face up. One cut at `targetWidth` does it.
    return {
      clean: false,
      roughWidth,
      targetWidth,
      cut1: targetWidth,
      cut2: null,
      requiresFlip: false,
      trimLeft: left,
      trimRight: right
    };
  }

  // Both sides wane: stand plank on the DEEPER wane to minimise wobble.
  // Whichever wane is "down", its depth adds to the bed-to-flat distance;
  // the "up" wane's depth is what we'll trim first. For the recommendation
  // we take the greater trim as the "down" side (lowest point of that
  // wane = bed reference).
  const downTrim = Math.max(left, right);
  const upTrim = Math.min(left, right);
  // Distance from bed up to the flat top surface (before the top wane
  // starts curving) is `targetWidth + downTrim`: plank's target width plus
  // the chunk of wane below the lower flat face.
  const cut1 = targetWidth + downTrim;
  // After cut 1, the plank is `cut1` tall on the bed with flat top and
  // wane bottom. Flip: new bed = the flat top. Plank is still `cut1` tall
  // measured bed-to-top (old bottom wane is now top). Cut 2 at target
  // width removes (`cut1 − targetWidth`) = `downTrim` from the top.
  //
  // Cross-check: total trimmed = upTrim (cut 1) + downTrim (cut 2) = left + right. ✓
  void upTrim; // kept for clarity in the comment above
  return {
    clean: false,
    roughWidth,
    targetWidth,
    cut1,
    cut2: targetWidth,
    requiresFlip: true,
    trimLeft: left,
    trimRight: right
  };
}

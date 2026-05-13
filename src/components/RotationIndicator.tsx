import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Current rotation in degrees; drives the detection of deltas. */
  rotationDeg: number;
  /**
   * How long the animation lasts (ms). Default 900 — slow enough for
   * the sawyer's eye to follow the arrow comfortably without pushing
   * the rotate → cut rhythm past one second per step.
   */
  durationMs?: number;
}

/**
 * Brief visual cue that the log has just rotated. A small amber
 * arrow flies around the OUTSIDE of the log along a circular path,
 * pointing (and moving) in the direction the log just turned. The
 * arrow travels ~180° of arc, then fades out — far enough that the
 * direction is unambiguous even caught out of the corner of an eye.
 *
 * Triggering is automatic: the component watches `rotationDeg` and
 * fires whenever the value changes by a non-zero signed delta. The
 * sign of the shortest-path delta (normalised to (-180°, 180°])
 * determines arrow direction, so a 270° → 0° jump reads as +90°
 * clockwise rather than -270°.
 *
 * We DO fire on undo/redo: rewinding a rotation is still a rotation
 * the sawyer needs to perceive. We do NOT fire on the initial mount
 * (no previous value to compare against).
 *
 * The animation uses SMIL (<animateTransform>) rather than CSS
 * because we want the arrow to translate along a circular path AND
 * rotate its own body to stay tangent to the path simultaneously.
 * SMIL's rotate() with a centre argument does both in one shot; the
 * CSS equivalent would need nested transform-origins or a second
 * element. SMIL has broad browser support for SVG transforms and
 * stops cleanly when the element unmounts.
 */
export function RotationIndicator({ rotationDeg, durationMs = 900 }: Props) {
  const prevRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  // `direction === null` means the arrow is hidden. When a rotation
  // fires, we set it to 'cw' or 'ccw'; after durationMs, a timer
  // clears it back to null.
  const [direction, setDirection] = useState<'cw' | 'ccw' | null>(null);
  // Nonce bumps on every trigger so the SVG element remounts (via
  // React's `key`) and the SMIL animation restarts from frame 0 even
  // if the previous one hasn't finished yet.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = rotationDeg;
    if (prev === null) return; // first render, no delta to show

    // Shortest-path signed delta, normalised to (-180°, 180°]. A
    // 270° → 0° change reads as +90° (CW short-way) not −270°.
    let delta = rotationDeg - prev;
    delta = ((delta + 540) % 360) - 180;
    if (delta > 180) delta -= 360;
    if (Math.abs(delta) < 0.5) return; // no-op rotation

    // Map delta sign to on-screen direction. +delta in log frame
    // (counter-clockwise in math convention) corresponds to a CCW
    // spin in the rendered EndView — the log rotates the same way
    // you'd rotate a point in a standard x/y plot. See EndView.tsx
    // where this is done via cos(rad)/sin(rad) on each point.
    setDirection(delta > 0 ? 'ccw' : 'cw');
    setNonce((n) => n + 1);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setDirection(null);
      timerRef.current = null;
    }, durationMs);
  }, [rotationDeg, durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (direction === null) return null;

  // Geometry: the orbit radius is tuned to place the arrow OUTSIDE
  // the log silhouette. EndView renders the log inside a viewBox of
  // size ~560 px with a pad of ~36 px; the usable log diameter fills
  // the square minus the pad. We want our arrow to orbit at ~95% of
  // the overlay's half-width so it sits in the corner space between
  // the log and the EndView's rounded-xl background — visible but
  // not overlapping the dimensions labels drawn on the log's edges.
  //
  // The indicator overlay is `absolute inset-0` sized to the EndView
  // image (the wrapper in EndView.tsx is `max-w-[600px] aspect-
  // square`), so our SVG can use its own consistent local viewBox
  // without caring about the outer px size.
  //
  // viewBox -100..100: orbit radius 90, arrow ~24 units long.
  const orbitR = 90;

  // Start / end angles for the arrow's travel. Chosen so the sweep
  // covers the top half of the log (top ~quadrant of the illustration)
  // where the blade sits — that's where the sawyer is already
  // looking. 200° → 340° for CW (sweep through the top, left→right)
  // and the mirror for CCW.
  //
  // SVG angle convention in this component: 0° = right (+x), 90° =
  // DOWN (+y in SVG), 270° = UP. We want the sweep to pass the top
  // of the circle (y = -90 in SVG), so that's angle 270°. The arrow
  // enters from one side, crosses the top, and exits on the other
  // side.
  //
  // CW on-screen = angle increasing in SVG math convention with y
  // flipped, i.e. visually clockwise. Pick start/end to make the
  // SWEEP cross angle 270° (= top of circle):
  //   - CW sweep: angles 210° → 330° (left-top to right-top via top).
  //   - CCW sweep: angles 330° → 210° (right-top to left-top via top).
  const startAngleDeg = direction === 'cw' ? 210 : 330;
  const endAngleDeg = direction === 'cw' ? 330 : 210;

  const polar = (aDeg: number) => {
    const r = (aDeg * Math.PI) / 180;
    return { x: orbitR * Math.cos(r), y: orbitR * Math.sin(r) };
  };
  const start = polar(startAngleDeg);

  // Tangent at startAngleDeg — the direction the arrow points when
  // the animation begins. Tangent to a circle is perpendicular to
  // the radius; for CW sweep it points in the +angle direction (i.e.
  // +90° from the radius).
  //   radius direction = (cos a, sin a)
  //   CW tangent       = (-sin a, +cos a)  // +90° rotation
  //   CCW tangent      = ( sin a, -cos a)  // -90° rotation
  const tangentDeg =
    direction === 'cw'
      ? startAngleDeg + 90
      : startAngleDeg - 90;

  return (
    <div
      key={nonce}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <svg viewBox="-100 -100 200 200" className="w-full h-full">
        {/*
          The arrow is drawn once at the START position, rotated to
          point along the tangent there. Two SVG animations run in
          parallel on the same <g>:

            1. <animateTransform type="rotate"> sweeps the <g> around
               the circle centre (0,0). Because the arrow is drawn at
               `start` and we rotate around the origin, this MOVES
               the arrow along the orbit AND keeps its own tangent
               orientation consistent — a rotate around the centre
               changes the radial direction by the same amount, so
               the tangent follows automatically. No nested transforms
               needed.

            2. <animate attributeName="opacity"> does the three-phase
               fade-in / hold / fade-out via keyTimes + values, so
               the arrow briefly appears, stays fully visible for
               most of the sweep, and fades out by the end.

          `fill='freeze'` on both holds the final state for the one
          frame between the animation ending and React unmounting
          the element (the durationMs timeout), avoiding a snap-back
          flash.

          `calcMode='spline'` + `keySplines` gives an ease-out feel
          on the rotate so the arrow decelerates into its end
          position rather than stopping abruptly.
        */}
        <g opacity="0">
          <Arrow x={start.x} y={start.y} angleDeg={tangentDeg} />
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 0 0"
            to={`${endAngleDeg - startAngleDeg} 0 0`}
            dur={`${durationMs}ms`}
            fill="freeze"
            calcMode="spline"
            keySplines="0.25 0.1 0.25 1"
          />
          <animate
            attributeName="opacity"
            values="0; 1; 1; 0"
            keyTimes="0; 0.15; 0.8; 1"
            dur={`${durationMs}ms`}
            fill="freeze"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * A single amber arrow: fat rounded-ended tail + triangular head,
 * drawn pointing in the +x direction by default, then rotated to
 * `angleDeg` and translated to (x, y). Tuned to look "directional"
 * at small sizes on a workshop tablet.
 *
 * `angleDeg` uses SVG math conventions (0° = right, +90° = down on
 * screen) to match the rest of this file.
 */
function Arrow({ x, y, angleDeg }: { x: number; y: number; angleDeg: number }) {
  const fill = '#b45309'; // amber-700 — matches the cone-warning tier
  // Tail runs from (-14, 0) to (+2, 0); head is a 12-wide triangle.
  // A 2-unit gap between tail end and head base so the triangle
  // reads as a separate arrow-head rather than a fat spike.
  return (
    <g transform={`translate(${x} ${y}) rotate(${angleDeg})`}>
      <rect
        x="-14"
        y="-3.5"
        width="16"
        height="7"
        rx="2"
        ry="2"
        fill={fill}
      />
      <polygon points="4,-8 16,0 4,8" fill={fill} />
    </g>
  );
}

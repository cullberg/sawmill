import { rootEndDiameter, designDiameter } from '../core/taper';
import { toolName } from '../core/tool';
import { computePlankTrim, edgingPlanForPlank } from '../core/trim';
import type { PlacedPlank, PlanState, ProducedPlank, Vec2 } from '../core/types';
import { initialShape, type BladeReadout } from '../state/usePlan';
import { RotationIndicator } from './RotationIndicator';

interface Props {
  plan: PlanState;
  /** Planks from the layout that are still "to be cut". */
  remainingPlanks: PlacedPlank[];
  blade: BladeReadout;
  /** Size of the rendered SVG in px. */
  size?: number;
}

/**
 * Coordinate conventions:
 *   - Log frame (y-up): `plan.shape`, remaining planks' local rectangles,
 *     and `produced[].polygon` all live here. Rotation does not move them.
 *   - Bed frame (y-up): obtained by rotating the log frame by `+rotationDeg`
 *     (CCW in math convention). The bed line and blade line are horizontal
 *     in this frame.
 *   - SVG frame (y-down): flipped version of the bed frame.
 */
export function EndView({ plan, remainingPlanks, blade, size = 560 }: Props) {
  const dTop = designDiameter(plan.log);
  const dRoot = rootEndDiameter(plan.log);
  const maxD = Math.max(dTop, dRoot);
  const pad = 36;
  const scale = (size - pad * 2) / maxD;

  const cx = size / 2;
  const cy = size / 2;
  const rRoot = (dRoot / 2) * scale;
  const rTop = (dTop / 2) * scale;
  const bark = plan.settings.barkThickness * scale;
  const kerfPx = plan.settings.kerf * scale;

  const rotation = plan.rotationDeg;
  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const logToBed = (p: Vec2): Vec2 => ({
    x: p.x * cosR - p.y * sinR,
    y: p.x * sinR + p.y * cosR
  });
  const bedToSvg = (p: Vec2): Vec2 => ({ x: cx + p.x * scale, y: cy - p.y * scale });
  const logToSvg = (p: Vec2): Vec2 => bedToSvg(logToBed(p));

  // Orientation of the plank's long axis (= log-frame +x) in SVG degrees.
  // The log-frame unit vector (1,0) lands at (cosR, -sinR) in SVG (Y flips
  // between bed and SVG), whose SVG-CW angle is `-rotationDeg`. We then
  // normalise into the readable half-circle [-90°, 90°] by flipping 180°
  // when the text would otherwise run upside-down, so plank labels are
  // always left-to-right regardless of how much the log has been rotated.
  const rawTextAngle = -rotation;
  const normAngle = ((rawTextAngle % 360) + 540) % 360 - 180; // (-180, 180]
  const plankTextAngle = normAngle > 90 ? normAngle - 180 : normAngle < -90 ? normAngle + 180 : normAngle;

  const bedSvgY = cy - blade.bedY * scale;
  const bladeSvgY = cy - blade.bladeBedY * scale;

  const pathFromPoints = (pts: Vec2[]): string =>
    'M ' + pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z';

  const shapePath = plan.shape.length ? pathFromPoints(plan.shape.map(logToSvg)) : '';

  // Edging is a POST-PROCESS: after a plank is sawn off the slab, the
  // sawyer still needs to see its wane edges so they can edge it to the
  // target width later.
  //
  // - "+N" trim indicators use `pp.shapeAtCut` (the log cross-section
  //   at the moment the plank was sawn), which correctly reflects any
  //   earlier squaring cuts. `plan.shape` has since been clipped past
  //   the plank's y-range and would give zero.
  // - Brown bark-ring wedges use the same `shapeAtCut` polygons — bark
  //   only physically remained beside a plank where the log material
  //   did at cut time, so a plank cut from an already-squared cant has
  //   no bark on its squared sides.
  //
  // For legacy plans saved before `shapeAtCut` existed we fall back to
  // the original round log (worst case) so the view still renders.
  const originalShape = initialShape(plan.log);
  const shapeAtCutFor = (pp: ProducedPlank): Vec2[] =>
    pp.shapeAtCut && pp.shapeAtCut.length >= 3 ? pp.shapeAtCut : originalShape;

  // Stable id so clip paths don't collide between multiple EndView instances.
  const clipId = `shape-clip-${rotation.toFixed(0)}`;
  const barkClipId = `bark-clip-${rotation.toFixed(0)}`;
  const barkId = `bark-ring-${plan.settings.barkThickness}`;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Wrapping the SVG in a relative container so RotationIndicator
          can absolute-overlay it. The indicator sits on top of the
          log drawing only — not the legend below — so the legend
          stays readable while a rotation arrow animates. */}
      <div className="relative w-full max-w-[600px]">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full aspect-square bg-steel-50 rounded-2xl shadow-inner"
          role="img"
          aria-label="End view of the log with planned planks"
        >
        <defs>
          {/* Clip everything drawn inside the log to the current cross-section shape. */}
          {shapePath && (
            <clipPath id={clipId}>
              <path d={shapePath} />
            </clipPath>
          )}
          {/*
            Bark clip = current shape ∪ each produced plank's `shapeAtCut`
            polygon. Multiple paths inside a clipPath union together, so
            bark remains visible exactly where log material was present
            when each plank came off — i.e. the bark wedges travel with
            the produced plank, but squared sides (cut earlier) show no
            bark, matching physical reality.
          */}
          {shapePath && (
            <clipPath id={barkClipId}>
              <path d={shapePath} />
              {plan.produced.map((pp) => {
                const poly = shapeAtCutFor(pp);
                if (poly.length < 3) return null;
                return (
                  <path
                    key={`bark-shape-${pp.id}`}
                    d={pathFromPoints(poly.map(logToSvg))}
                  />
                );
              })}
            </clipPath>
          )}
          {/*
            Bark ring as the even-odd fill of two concentric circles at the
            design diameter: outer = bark outer, inner = bark inner. Clipped
            to the current shape so only arc portions remain visible.
          */}
          <mask id={barkId}>
            <rect x={0} y={0} width={size} height={size} fill="black" />
            <circle cx={cx} cy={cy} r={rTop} fill="white" />
            <circle cx={cx} cy={cy} r={Math.max(0, rTop - bark)} fill="black" />
          </mask>
        </defs>

        {/* Root-end reference circle (faded backdrop for taper context) */}
        <circle
          cx={cx}
          cy={cy}
          r={rRoot}
          fill="#f6e8d8"
          stroke="#81532b"
          strokeWidth={1.2}
          opacity={0.45}
        />
        {/* Design diameter reference circle (dashed) */}
        <circle
          cx={cx}
          cy={cy}
          r={rTop}
          fill="none"
          stroke="#5f3d20"
          strokeWidth={1}
          strokeDasharray="6 4"
          opacity={0.6}
        />

        {/* Current cross-section fill (wood-coloured) */}
        {shapePath && (
          <path d={shapePath} fill="#fdf8f3" stroke="#3f2815" strokeWidth={1.6} strokeLinejoin="round" />
        )}

        {/*
          Bark ring, drawn only where the shape is still round. Drawing order:
          1. A bark-coloured filled circle at the design diameter (clipped to shape).
          2. A wood-coloured inner circle on top of it (also clipped), leaving
             only the annulus ring visible in the arc regions.
          Using a mask keeps the edges crisp without polygon math.
        */}
        {shapePath && bark > 0 && (
          <g clipPath={`url(#${barkClipId})`}>
            <rect
              x={0}
              y={0}
              width={size}
              height={size}
              fill="#6b4423"
              mask={`url(#${barkId})`}
              opacity={0.85}
            />
          </g>
        )}

        {/* Pith mark (log centre) */}
        <circle cx={cx} cy={cy} r={Math.max(2, 4 * scale)} fill="#3f2815" />

        {/*
          Produced planks — drawn with a kerf halo (stroke outside, fill inside).
          SVG strokes are centred on the path; paint-order puts stroke first so
          the fill sits on top, leaving kerf/2 of stroke visible around the plank.
        */}
        {plan.produced.map((pp) => {
          const pts = pp.polygon.map(logToSvg);
          const centroid = pts.reduce(
            (acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }),
            { x: 0, y: 0 }
          );

          // Produced planks still need edging — it's a post-process, so
          // keep showing the "+N" trim indicators as a reminder. Compute
          // against the shape snapshotted at the moment the plank was
          // sawn off (reflects any earlier squaring cuts); fall back to
          // the original log shape for plans saved before the snapshot
          // field existed.
          const spec = plan.planks.find((pl) => pl.sequence === pp.sequence);
          const trim = spec
            ? computePlankTrim(shapeAtCutFor(pp), spec)
            : { left: 0, right: 0 };
          const showLeft = spec != null && trim.left >= 5;
          const showRight = spec != null && trim.right >= 5;
          const trimFontPx = spec
            ? Math.max(8, Math.min(11, spec.thickness * scale * 0.28))
            : 10;
          // Cut-height numbers get their own, larger scale — with no
          // "cut 1/2" prefix they're just 2-3 digits, so we can afford
          // a bigger multiplier and a higher cap than the "+N" trim
          // label (which sits above a short dashed arrow and must fit
          // inside the wane wedge).
          const cutFontPx = spec
            ? Math.max(11, Math.min(18, spec.thickness * scale * 0.45))
            : 14;
          // Blade-height callout for cut 1 — the non-obvious height the
          // sawyer needs to dial in before the first edging pass. Goes
          // next to the deeper wane (the side whose wedge is being
          // removed by cut 1); ties break left. Cut 2 is always
          // `targetWidth` (= plank.width), already implied by the plank's
          // own dimensions, so we don't label it separately.
          const eplan = spec ? edgingPlanForPlank(trim, spec) : null;
          const leftIsCut1 = trim.left >= trim.right;
          const leftCutLabel =
            eplan && !eplan.clean && showLeft && leftIsCut1 && eplan.cut1 != null
              ? eplan.cut1.toFixed(0)
              : null;
          const rightCutLabel =
            eplan && !eplan.clean && showRight && !leftIsCut1 && eplan.cut1 != null
              ? eplan.cut1.toFixed(0)
              : null;
          const leftStart = spec ? logToSvg({ x: spec.x - spec.width / 2, y: spec.y }) : null;
          const leftEnd = spec
            ? logToSvg({ x: spec.x - spec.width / 2 - trim.left, y: spec.y })
            : null;
          const rightStart = spec ? logToSvg({ x: spec.x + spec.width / 2, y: spec.y }) : null;
          const rightEnd = spec
            ? logToSvg({ x: spec.x + spec.width / 2 + trim.right, y: spec.y })
            : null;

          return (
            <g key={pp.id}>
              {/* Shape-at-cut outline: the log silhouette at the moment
                  this plank was sawn off. Drawn behind the plank fill so
                  only the portion outside the plank rectangle is visible
                  — i.e. the curved arcs that bound the wane wedges on
                  the plank's sides, and any earlier cut-face flats.
                  Gives every produced plank a consistent "enclosed wane"
                  appearance regardless of what later cuts have done to
                  `plan.shape`. */}
              {pp.shapeAtCut && pp.shapeAtCut.length >= 3 && (
                <path
                  d={pathFromPoints(pp.shapeAtCut.map(logToSvg))}
                  fill="none"
                  stroke="#3f2815"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              )}

              <path
                d={pathFromPoints(pts)}
                fill="#d5e6c6"
                stroke="#9ca3af"
                strokeWidth={kerfPx}
                strokeOpacity={0.7}
                style={{ paintOrder: 'stroke fill' }}
              />
              <path d={pathFromPoints(pts)} fill="none" stroke="#35671e" strokeWidth={1} />

              {/* Cut-face line: straight edge added to the remaining log
                  when this plank was freed. Drawing it explicitly per
                  produced plank means every plank shows its cut boundary
                  in the log silhouette, regardless of whether later cuts
                  have since clipped it away from `plan.shape`. Coloured
                  the same dark brown as the main shape stroke so it
                  reads as part of the log outline. */}
              {pp.cutFace && (
                <line
                  x1={logToSvg(pp.cutFace[0]).x}
                  y1={logToSvg(pp.cutFace[0]).y}
                  x2={logToSvg(pp.cutFace[1]).x}
                  y2={logToSvg(pp.cutFace[1]).y}
                  stroke="#3f2815"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              )}

              <text
                x={centroid.x}
                y={centroid.y}
                transform={`rotate(${plankTextAngle.toFixed(2)} ${centroid.x} ${centroid.y})`}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cutFontPx}
                fontWeight={500}
                fill="#203d12"
                className="select-none pointer-events-none"
              >
                ✓ {pp.label}
              </text>

              {/* Post-process edging reminders: same red dashed "+N"
                  indicators used on remaining planks, so the sawyer keeps
                  seeing which edges still need to be trimmed after the
                  slab has come off. */}
              {showLeft && leftStart && leftEnd && (
                <g className="select-none pointer-events-none">
                  <line
                    x1={leftStart.x}
                    y1={leftStart.y}
                    x2={leftEnd.x}
                    y2={leftEnd.y}
                    stroke="#c01d10"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />
                  <text
                    x={(leftStart.x + leftEnd.x) / 2}
                    y={leftStart.y - 4}
                    textAnchor="middle"
                    dominantBaseline="alphabetic"
                    fontSize={trimFontPx}
                    fill="#c01d10"
                    fontWeight={600}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    style={{ paintOrder: 'stroke' }}
                  >
                    +{trim.left.toFixed(0)}
                  </text>
                  {leftCutLabel && (
                    <text
                      x={(leftStart.x + leftEnd.x) / 2}
                      y={leftStart.y + cutFontPx + 2}
                      textAnchor="middle"
                      dominantBaseline="alphabetic"
                      fontSize={cutFontPx}
                      fill="#1f2937"
                      fontWeight={600}
                      stroke="#ffffff"
                      strokeWidth={3}
                      style={{ paintOrder: 'stroke' }}
                    >
                      {leftCutLabel}
                    </text>
                  )}
                </g>
              )}
              {showRight && rightStart && rightEnd && (
                <g className="select-none pointer-events-none">
                  <line
                    x1={rightStart.x}
                    y1={rightStart.y}
                    x2={rightEnd.x}
                    y2={rightEnd.y}
                    stroke="#c01d10"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />
                  <text
                    x={(rightStart.x + rightEnd.x) / 2}
                    y={rightStart.y - 4}
                    textAnchor="middle"
                    dominantBaseline="alphabetic"
                    fontSize={trimFontPx}
                    fill="#c01d10"
                    fontWeight={600}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    style={{ paintOrder: 'stroke' }}
                  >
                    +{trim.right.toFixed(0)}
                  </text>
                  {rightCutLabel && (
                    <text
                      x={(rightStart.x + rightEnd.x) / 2}
                      y={rightStart.y + cutFontPx + 2}
                      textAnchor="middle"
                      dominantBaseline="alphabetic"
                      fontSize={cutFontPx}
                      fill="#1f2937"
                      fontWeight={600}
                      stroke="#ffffff"
                      strokeWidth={3}
                      style={{ paintOrder: 'stroke' }}
                    >
                      {rightCutLabel}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Remaining planks — same kerf halo treatment */}
        {remainingPlanks.map((p, i) => {
          const hx = p.width / 2;
          const hy = p.thickness / 2;
          const corners: Vec2[] = [
            { x: p.x - hx, y: p.y - hy },
            { x: p.x + hx, y: p.y - hy },
            { x: p.x + hx, y: p.y + hy },
            { x: p.x - hx, y: p.y + hy }
          ];
          const pts = corners.map(logToSvg);
          const centre = logToSvg({ x: p.x, y: p.y });

          // Wane trim indicators: show how far the current log shape
          // extends beyond the plank's target rectangle on each side. A
          // 5 mm threshold keeps the illustration from turning into noise
          // for planks that are already within rounding error of flush.
          const trim = computePlankTrim(plan.shape, p);
          const showLeft = trim.left >= 5;
          const showRight = trim.right >= 5;
          const trimFontPx = Math.max(8, Math.min(11, p.thickness * scale * 0.28));
          const cutFontPx = Math.max(11, Math.min(18, p.thickness * scale * 0.45));
          // Plank centre label shares the cut-callout size so both labels
          // scale together as the illustration grows.
          const fontPx = cutFontPx;

          // Blade-height callout for cut 1 only — see produced-planks
          // block above for rationale (cut 2 always = plank.width).
          const eplan = edgingPlanForPlank(trim, p);
          const leftIsCut1 = trim.left >= trim.right;
          const leftCutLabel =
            !eplan.clean && showLeft && leftIsCut1 && eplan.cut1 != null
              ? eplan.cut1.toFixed(0)
              : null;
          const rightCutLabel =
            !eplan.clean && showRight && !leftIsCut1 && eplan.cut1 != null
              ? eplan.cut1.toFixed(0)
              : null;

          // Endpoints for trim indicators in LOG frame. We draw from the
          // plank's edge (at the plank's centreline y for readability)
          // outward toward the shape boundary.
          const leftStart = logToSvg({ x: p.x - hx, y: p.y });
          const leftEnd = logToSvg({ x: p.x - hx - trim.left, y: p.y });
          const rightStart = logToSvg({ x: p.x + hx, y: p.y });
          const rightEnd = logToSvg({ x: p.x + hx + trim.right, y: p.y });

          return (
            <g key={`rem-${i}`}>
              {/* Kerf halo */}
              <path
                d={pathFromPoints(pts)}
                fill="#e9cba7"
                stroke="#9ca3af"
                strokeWidth={kerfPx}
                strokeOpacity={0.7}
                style={{ paintOrder: 'stroke fill' }}
              />
              {/* Crisp plank outline on top */}
              <path d={pathFromPoints(pts)} fill="none" stroke="#3f2815" strokeWidth={1} />
              <text
                x={centre.x}
                y={centre.y}
                transform={`rotate(${plankTextAngle.toFixed(2)} ${centre.x} ${centre.y})`}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontPx}
                fontWeight={500}
                fill="#23170b"
                className="select-none pointer-events-none"
              >
                {p.sequence}. {p.label}
              </text>

              {/* Trim indicators — subtle dashed arrows with "+Nmm" label.
                  Colour-matched to the cone-compensation red so they read
                  as "action needed" without screaming. A white halo
                  (paint-order: stroke) keeps the digits legible when they
                  sit on top of the dashed line or the bark ring. */}
              {showLeft && (
                <g className="select-none pointer-events-none">
                  <line
                    x1={leftStart.x}
                    y1={leftStart.y}
                    x2={leftEnd.x}
                    y2={leftEnd.y}
                    stroke="#c01d10"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />
                  <text
                    x={(leftStart.x + leftEnd.x) / 2}
                    y={leftStart.y - 4}
                    textAnchor="middle"
                    dominantBaseline="alphabetic"
                    fontSize={trimFontPx}
                    fill="#c01d10"
                    fontWeight={600}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    style={{ paintOrder: 'stroke' }}
                  >
                    +{trim.left.toFixed(0)}
                  </text>
                  {leftCutLabel && (
                    <text
                      x={(leftStart.x + leftEnd.x) / 2}
                      y={leftStart.y + cutFontPx + 2}
                      textAnchor="middle"
                      dominantBaseline="alphabetic"
                      fontSize={cutFontPx}
                      fill="#1f2937"
                      fontWeight={600}
                      stroke="#ffffff"
                      strokeWidth={3}
                      style={{ paintOrder: 'stroke' }}
                    >
                      {leftCutLabel}
                    </text>
                  )}
                </g>
              )}
              {showRight && (
                <g className="select-none pointer-events-none">
                  <line
                    x1={rightStart.x}
                    y1={rightStart.y}
                    x2={rightEnd.x}
                    y2={rightEnd.y}
                    stroke="#c01d10"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />
                  <text
                    x={(rightStart.x + rightEnd.x) / 2}
                    y={rightStart.y - 4}
                    textAnchor="middle"
                    dominantBaseline="alphabetic"
                    fontSize={trimFontPx}
                    fill="#c01d10"
                    fontWeight={600}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    style={{ paintOrder: 'stroke' }}
                  >
                    +{trim.right.toFixed(0)}
                  </text>
                  {rightCutLabel && (
                    <text
                      x={(rightStart.x + rightEnd.x) / 2}
                      y={rightStart.y + cutFontPx + 2}
                      textAnchor="middle"
                      dominantBaseline="alphabetic"
                      fontSize={cutFontPx}
                      fill="#1f2937"
                      fontWeight={600}
                      stroke="#ffffff"
                      strokeWidth={3}
                      style={{ paintOrder: 'stroke' }}
                    >
                      {rightCutLabel}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Bed line (horizontal in bed frame) */}
        <line x1={pad / 2} x2={size - pad / 2} y1={bedSvgY} y2={bedSvgY} stroke="#44403c" strokeWidth={1.4} />
        <text
          x={pad / 2 + 2}
          y={bedSvgY + 14}
          fontSize={11}
          fill="#44403c"
          stroke="#ffffff"
          strokeWidth={2.5}
          style={{ paintOrder: 'stroke' }}
        >
          bed
        </text>

        {/* Cutting tool (chain / blade) drawn at its actual kerf thickness.
            The saw's lower edge is at `bladeSvgY` (= new shape top after
            the cut); the upper edge sits `kerfPx` above that — together
            they form a solid band covering the sawdust that will be
            removed. Label adapts to the user's tool terminology. */}
        {blade.valid && (
          <>
            {/* Solid fill inside the kerf — represents the physical tool
                body. Slightly darker / more opaque than the old 0.15
                wash so the saw reads as a real object in the scene. */}
            <rect
              x={pad / 2}
              y={bladeSvgY - kerfPx}
              width={size - pad}
              height={kerfPx}
              fill="#e42313"
              opacity={0.35}
            />
            {/* Thin outlines along the top and bottom edges of the band
                sharpen the boundary so even a 2-mm kerf is visible. */}
            <line
              x1={pad / 2}
              x2={size - pad / 2}
              y1={bladeSvgY - kerfPx}
              y2={bladeSvgY - kerfPx}
              stroke="#991810"
              strokeWidth={0.9}
              opacity={0.7}
            />
            <line
              x1={pad / 2}
              x2={size - pad / 2}
              y1={bladeSvgY}
              y2={bladeSvgY}
              stroke="#e42313"
              strokeWidth={2}
              strokeDasharray="8 4"
            />
            <text
              x={size - pad / 2 - 4}
              y={bladeSvgY - kerfPx - 4}
              fontSize={12}
              fontWeight={600}
              textAnchor="end"
              fill="#e42313"
              stroke="#ffffff"
              strokeWidth={2.5}
              style={{ paintOrder: 'stroke' }}
            >
              {toolName(plan.settings)}
            </text>

            {/* Bed-to-blade dimension arrow on the left */}
            <g stroke="#e42313" fill="#e42313">
              <line x1={pad / 2 + 10} x2={pad / 2 + 10} y1={bedSvgY} y2={bladeSvgY} strokeWidth={1.2} />
              <polygon
                points={`${pad / 2 + 6},${bedSvgY - 8} ${pad / 2 + 14},${bedSvgY - 8} ${pad / 2 + 10},${bedSvgY}`}
              />
              <polygon
                points={`${pad / 2 + 6},${bladeSvgY + 8} ${pad / 2 + 14},${bladeSvgY + 8} ${pad / 2 + 10},${bladeSvgY}`}
              />
              <text
                x={pad / 2 + 18}
                y={(bedSvgY + bladeSvgY) / 2}
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                stroke="#ffffff"
                strokeWidth={3}
                style={{ paintOrder: 'stroke' }}
              >
                {blade.bladeAboveBed.toFixed(0)} mm
              </text>
            </g>
          </>
        )}

        {/* Rotation indicator outside the shape - points to the top of the log */}
        <g transform={`translate(${cx} ${cy})`}>
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={-rRoot - 6}
            stroke="#1a5ca8"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <text
            x={0}
            y={-rRoot - 12}
            textAnchor="middle"
            fontSize={12}
            fill="#1a5ca8"
            stroke="#ffffff"
            strokeWidth={2.5}
            style={{ paintOrder: 'stroke' }}
          >
            top {rotation.toFixed(0)}°
          </text>
        </g>
      </svg>
        <RotationIndicator rotationDeg={plan.rotationDeg} />
      </div>

      {/* Legend lives outside the SVG so its brown swatch can't be mistaken
          for a piece of bark hanging off the log illustration, and so it
          stays readable even when the log fills the canvas. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: '#6b4423', opacity: 0.85 }}
            aria-hidden
          />
          bark {plan.settings.barkThickness} mm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: '#9ca3af', opacity: 0.7 }}
            aria-hidden
          />
          kerf {plan.settings.kerf} mm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-[2px]"
            style={{ backgroundColor: '#e42313' }}
            aria-hidden
          />
          {toolName(plan.settings)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-[2px]"
            style={{ backgroundColor: '#44403c' }}
            aria-hidden
          />
          bed
        </span>
      </div>
    </div>
  );
}

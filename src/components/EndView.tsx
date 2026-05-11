import { rootEndDiameter, designDiameter } from '../core/taper';
import type { PlacedPlank, PlanState, Vec2 } from '../core/types';
import type { BladeReadout } from '../state/usePlan';

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

  const bedSvgY = cy - blade.bedY * scale;
  const bladeSvgY = cy - blade.bladeBedY * scale;

  const pathFromPoints = (pts: Vec2[]): string =>
    'M ' + pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z';

  const shapePath = plan.shape.length ? pathFromPoints(plan.shape.map(logToSvg)) : '';

  // Stable id so clip paths don't collide between multiple EndView instances.
  const clipId = `shape-clip-${rotation.toFixed(0)}`;
  const barkId = `bark-ring-${plan.settings.barkThickness}`;

  return (
    <div className="w-full flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[600px] aspect-square bg-steel-50 rounded-2xl shadow-inner"
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
          <g clipPath={`url(#${clipId})`}>
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
          return (
            <g key={pp.id}>
              <path
                d={pathFromPoints(pts)}
                fill="#d5e6c6"
                stroke="#9ca3af"
                strokeWidth={kerfPx}
                strokeOpacity={0.7}
                style={{ paintOrder: 'stroke fill' }}
              />
              <path d={pathFromPoints(pts)} fill="none" stroke="#35671e" strokeWidth={1} />
              <text
                x={centroid.x}
                y={centroid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill="#203d12"
                className="select-none pointer-events-none"
              >
                ✓ {pp.label}
              </text>
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
          const fontPx = Math.max(10, Math.min(14, Math.min(p.width, p.thickness) * scale * 0.35));
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
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontPx}
                fill="#23170b"
                className="select-none pointer-events-none"
              >
                {p.sequence}. {p.label}
              </text>
            </g>
          );
        })}

        {/* Bed line (horizontal in bed frame) */}
        <line x1={pad / 2} x2={size - pad / 2} y1={bedSvgY} y2={bedSvgY} stroke="#44403c" strokeWidth={1.4} />
        <text x={pad / 2 + 2} y={bedSvgY + 14} fontSize={11} fill="#44403c">
          bed
        </text>

        {/* Blade line (lower edge of the blade / new shape top after the cut)
            with the kerf band drawn ABOVE it — i.e. in the material that will
            be removed as sawdust. */}
        {blade.valid && (
          <>
            <rect
              x={pad / 2}
              y={bladeSvgY - kerfPx}
              width={size - pad}
              height={kerfPx}
              fill="#e42313"
              opacity={0.15}
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
            >
              blade
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
          <text x={0} y={-rRoot - 12} textAnchor="middle" fontSize={12} fill="#1a5ca8">
            top {rotation.toFixed(0)}°
          </text>
        </g>
      </svg>

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
          blade
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

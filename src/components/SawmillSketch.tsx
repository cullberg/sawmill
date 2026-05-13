/**
 * Line-art sketch of a Nordic single-blade chainsaw sawmill — the physical
 * tool the planner is designed for. Intentionally loose "pen drawing" feel:
 * visible stroke, no fills on structural elements, slight colour accents to
 * call out the motor, red-painted posts, and the log.
 *
 * Fully inline SVG so the start-page hero ships in the main bundle and
 * works offline. Scales via `className` on the wrapper; intrinsic aspect
 * ratio is 3:1 to match a real mill's long-beam profile.
 */
interface Props {
  className?: string;
}

export function SawmillSketch({ className = 'w-full h-auto' }: Props) {
  // Palette tuned to the existing Tailwind brand / steel / motor / wood
  // tones so the sketch sits comfortably next to the rest of the app.
  const INK = '#3a444f'; // steel-700 — main outline
  const INK_LIGHT = '#7f8c9b'; // steel-400 — secondary/structural
  const RED = '#c01d10'; // brand-600 — signal-red posts
  const MOTOR = '#1a5ca8'; // motor-500
  const WOOD_LIGHT = '#e9cba7'; // wood-200
  const WOOD_DARK = '#81532b'; // wood-700

  return (
    <svg
      viewBox="0 0 900 300"
      className={className}
      role="img"
      aria-label="Sketched illustration of a Nordic chainsaw sawmill — the physical tool this planner is built for"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Subtle ground line so the mill has somewhere to stand */}
      <path
        d="M 20 278 Q 200 272 450 278 T 880 280"
        fill="none"
        stroke={INK_LIGHT}
        strokeWidth={1.2}
        strokeDasharray="2 5"
        strokeLinecap="round"
      />

      {/* ─── The log: lying between the clamping posts, partially visible ─── */}
      <g>
        {/* Log body — slight taper, root end on the left */}
        <path
          d="M 230 182 L 670 188 L 670 222 L 230 228 Z"
          fill={WOOD_LIGHT}
          stroke={WOOD_DARK}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        {/* Root end cap (left): slightly larger ellipse */}
        <ellipse cx={230} cy={205} rx={8} ry={23} fill={WOOD_LIGHT} stroke={WOOD_DARK} strokeWidth={1.6} />
        {/* Top end cap (right): slightly smaller ellipse */}
        <ellipse cx={670} cy={205} rx={6} ry={17} fill={WOOD_LIGHT} stroke={WOOD_DARK} strokeWidth={1.6} />
        {/* Pith mark on the root end */}
        <circle cx={230} cy={205} r={2} fill={WOOD_DARK} />
        {/* A couple of growth-ring arcs on the root end for flavour */}
        <path d="M 227 193 Q 223 205 227 217" fill="none" stroke={WOOD_DARK} strokeWidth={0.8} opacity={0.6} />
        <path d="M 225 188 Q 218 205 225 222" fill="none" stroke={WOOD_DARK} strokeWidth={0.8} opacity={0.4} />
        {/* A few bark-texture squiggles along the top of the log */}
        <path
          d="M 280 185 q 6 -3 12 0 M 340 186 q 7 -2 14 1 M 420 188 q 6 -2 14 0 M 500 188 q 8 -3 14 0 M 580 190 q 7 -2 14 0"
          fill="none"
          stroke={WOOD_DARK}
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.7}
        />
      </g>

      {/* ─── Two A-frame trestles that hold the whole mill up ─── */}
      <g stroke={INK} fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* Left trestle — apex roughly under the left pair of posts */}
        <path d="M 140 280 L 230 120 L 320 280" />
        <path d="M 178 220 L 282 220" />
        {/* Right trestle — apex roughly under the right pair of posts */}
        <path d="M 580 280 L 670 120 L 760 280" />
        <path d="M 618 220 L 722 220" />
      </g>

      {/* ─── The long galvanised-steel beam the carriage rides on ─── */}
      <g>
        {/* Main beam body — thick, with a highlight line along the top */}
        <rect x={90} y={110} width={720} height={26} fill="#e6eaee" stroke={INK} strokeWidth={2} rx={2} />
        {/* Beam top highlight for the "galvanised" feel */}
        <line x1={96} y1={116} x2={804} y2={116} stroke="#c8d0d8" strokeWidth={1.2} />
        {/* Rails the carriage rolls on (top face of the beam) */}
        <line x1={100} y1={110} x2={800} y2={110} stroke={INK_LIGHT} strokeWidth={1} strokeDasharray="4 4" />
      </g>

      {/* ─── Four vertical posts that clamp the log (red-painted) ─── */}
      <g stroke={INK} strokeWidth={1.6}>
        {/* Left pair */}
        <rect x={272} y={136} width={14} height={68} fill={RED} />
        <rect x={338} y={136} width={14} height={68} fill={RED} />
        {/* Right pair */}
        <rect x={548} y={136} width={14} height={68} fill={RED} />
        <rect x={614} y={136} width={14} height={68} fill={RED} />
        {/* Small caps on each post so they look bolted to the beam */}
        <rect x={270} y={132} width={18} height={6} fill={INK_LIGHT} />
        <rect x={336} y={132} width={18} height={6} fill={INK_LIGHT} />
        <rect x={546} y={132} width={18} height={6} fill={INK_LIGHT} />
        <rect x={612} y={132} width={18} height={6} fill={INK_LIGHT} />
      </g>

      {/* ─── Cross-supports under the log (the actual "supports") ─── */}
      <g stroke={INK} fill={INK_LIGHT} strokeWidth={1.4}>
        <rect x={265} y={204} width={92} height={6} />
        <rect x={543} y={204} width={92} height={6} />
      </g>

      {/* ─── The carriage + motor riding along the beam ─── */}
      <g transform="translate(400 30)">
        {/* Carriage base plate */}
        <rect x={0} y={76} width={90} height={12} fill="#c8d0d8" stroke={INK} strokeWidth={1.8} rx={1} />
        {/* Two roller wheels */}
        <circle cx={14} cy={92} r={6} fill="#e6eaee" stroke={INK} strokeWidth={1.5} />
        <circle cx={76} cy={92} r={6} fill="#e6eaee" stroke={INK} strokeWidth={1.5} />

        {/* Motor housing — blue cylinder with cooling fins suggested by vertical strokes */}
        <rect x={18} y={18} width={54} height={58} fill={MOTOR} stroke={INK} strokeWidth={1.8} rx={4} />
        <g stroke="#0e3564" strokeWidth={0.9} opacity={0.7}>
          <line x1={26} y1={26} x2={26} y2={68} />
          <line x1={32} y1={26} x2={32} y2={68} />
          <line x1={38} y1={26} x2={38} y2={68} />
          <line x1={52} y1={26} x2={52} y2={68} />
          <line x1={58} y1={26} x2={58} y2={68} />
          <line x1={64} y1={26} x2={64} y2={68} />
        </g>
        {/* Little knurled knob for manual feed */}
        <circle cx={45} cy={10} r={7} fill="#cddff5" stroke={INK} strokeWidth={1.4} />
        <line x1={45} y1={3} x2={45} y2={17} stroke={INK} strokeWidth={1} />
        <line x1={38} y1={10} x2={52} y2={10} stroke={INK} strokeWidth={1} />

        {/* Chainsaw bar hanging below the carriage — long horizontal ellipse */}
        <g transform="translate(-50 100)">
          <path
            d="M 0 6 L 180 6 A 6 6 0 0 1 180 18 L 0 18 A 6 6 0 0 1 0 6 Z"
            fill="#e6eaee"
            stroke={INK}
            strokeWidth={1.6}
          />
          {/* Chain teeth suggested as little ticks along the bar */}
          <g stroke={INK} strokeWidth={0.8}>
            {Array.from({ length: 28 }).map((_, i) => (
              <line key={i} x1={8 + i * 6} y1={18} x2={8 + i * 6} y2={22} />
            ))}
          </g>
          {/* Drive tip */}
          <circle cx={184} cy={12} r={5} fill="#a4afbb" stroke={INK} strokeWidth={1.4} />
        </g>
      </g>

      {/* ─── Height-adjust handwheel on the right end of the beam ─── */}
      <g transform="translate(820 123)">
        <circle r={14} fill="none" stroke={INK} strokeWidth={1.8} />
        <circle r={3} fill={INK} />
        {/* Spokes */}
        <line x1={-14} y1={0} x2={14} y2={0} stroke={INK} strokeWidth={1.2} />
        <line x1={0} y1={-14} x2={0} y2={14} stroke={INK} strokeWidth={1.2} />
        <line x1={-10} y1={-10} x2={10} y2={10} stroke={INK} strokeWidth={1.2} />
        <line x1={-10} y1={10} x2={10} y2={-10} stroke={INK} strokeWidth={1.2} />
      </g>

      {/* Tiny manufacturer-style label on the beam, for flavour */}
      <g transform="translate(120 123)" fill={INK} fontFamily="ui-sans-serif, system-ui, sans-serif">
        <text fontSize={9} fontWeight={700} letterSpacing="1">
          NORTHERN LIGHTS
        </text>
      </g>
    </svg>
  );
}

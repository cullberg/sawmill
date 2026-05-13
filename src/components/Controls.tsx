import type { ConeState } from '../state/usePlan';
import { togglePanelAndScroll } from './panelScroll';

interface Props {
  rotation: number;
  onRotateBy: (deg: number) => void;
  onStep: () => void;
  onFinish: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  /** Start a fresh log, prompting the operator to update measurements. */
  onNextLog: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Current cone / taper-compensation state. Drives the middle pill
   * in Row 1 so the drop number sits right next to the chain-height
   * number the sawyer is about to crank — the two values they need
   * together. The banner below the illustration still renders the
   * tilted-log figure for spatial context.
   */
  cone: ConeState;
  bladeAboveBed: number;
  bladeValid: boolean;
  bladeKind: 'slab' | 'plank' | 'done' | 'none';
  bladeProducing?: string;
  /** Coarse workflow phase — drives the NEXT pill copy. */
  bladePhase: 'squaring' | 'planking' | 'done' | 'none';
  /** 1-based index of the squaring slab being recommended. */
  squaringIndex?: number;
  /** Total number of squaring slabs expected (usually 4). */
  squaringTotal?: number;
  /**
   * Rotation the planner thinks the log should be at for this cut.
   * Present when it differs from the current rotation. Drives the
   * "Rotate to X°" hint and, when auto-rotate is on, the Cut button
   * caption ("Rotate & cut").
   */
  suggestRotationDeg?: number;
  /** Whether the Cut button will auto-rotate before cutting. */
  autoRotateForSquaring: boolean;
  /** All planned planks have been sawn — time to load the next log. */
  logComplete: boolean;
  /** Counts shown in the completion celebration banner. */
  cutsCount: number;
  producedCount: number;
  /**
   * User-visible name of the cutting tool ("chain" or "blade"). Drives
   * the readout labels so chainsaw-mill users see "Set chain height"
   * while bandsaw users see "Set blade height". Internal prop names keep
   * `blade*` for historical / code-simplicity reasons.
   */
  toolLabel: 'chain' | 'blade';
}

/**
 * Compact, always-visible action panel. Reading order top-to-bottom:
 *   1. Blade-height readout + next-cut description
 *   2. PRIMARY BIG BUTTON: Cut (or Lift plank when done, or Next log when
 *      the current log is fully sawn)
 *   3. Rotation + Undo/Redo secondary row
 *   4. Start over link
 */
export function Controls({
  rotation,
  onRotateBy,
  onStep,
  onFinish,
  onUndo,
  onRedo,
  onReset,
  onNextLog,
  canUndo,
  canRedo,
  cone,
  bladeAboveBed,
  bladeValid,
  bladeKind,
  bladeProducing,
  bladePhase,
  squaringIndex,
  squaringTotal,
  suggestRotationDeg,
  autoRotateForSquaring,
  logComplete,
  cutsCount,
  producedCount,
  toolLabel
}: Props) {
  // NEXT-pill primary line. Squaring cuts get a numbered label so the
  // sawyer can see "3 of 4 faces done". Planking cuts keep the classic
  // "Plank cut → 150×50" / "Slab cut" copy.
  const kindLabel =
    bladePhase === 'squaring' && bladeKind !== 'none'
      ? `Squaring slab (${squaringIndex ?? 1} of ${squaringTotal ?? 4})`
      : bladeKind === 'plank'
        ? `Plank cut → ${bladeProducing ?? ''}`
        : bladeKind === 'slab'
          ? 'Slab cut (round waste)'
          : bladeKind === 'done'
            ? `Log processed${bladeProducing ? ` — final: ${bladeProducing}` : ''}`
            : '—';

  const isDone = bladeKind === 'done';
  // Rotation hint: only shown when the log isn't at the recommended
  // face AND we won't fix it for them. With auto-rotate on, the log
  // is post-rotated after every squaring cut, so the sawyer arrives
  // at the next cut already aligned — nothing to warn about. With
  // auto-rotate off (or at the very first cut of a freshly-rotated
  // log), surface a quiet reminder that they need to spin the log.
  const rotationHint =
    suggestRotationDeg !== undefined && !autoRotateForSquaring
      ? `Rotate to ${suggestRotationDeg}° first`
      : undefined;

  /**
   * Cone-compensation pill copy + colour. Always visible so the
   * Row-1 layout stays three-column and the sawyer always has a
   * definitive cone read-out next to the chain-height number.
   *
   * Two user-visible states driven by four internal signals:
   *   - active (round log, positive drop)  → amber "Lower root / N mm / support"
   *   - everything else                    → forest green "Cone ✓ OK resolved"
   *
   * Collapsing `resolved`, `bedFlat`, and `noDrop` into one
   * confirmation is a deliberate simplification — from the sawyer's
   * perspective all three mean the same thing ("no drop needed right
   * now"), so three separate visuals would just be three things to
   * learn. The underlying state machine remains four-way (see
   * usePlan's ConeState) and is still visible in the pill's tooltip
   * for the curious user.
   *
   * Precedence (same as ConeBanner): resolved > bedFlat > active >
   * noDrop. `bedFlat` trumping `active` is what prevents the UI
   * saying "Lower root 10 mm" when the log already rests on a flat
   * cut face and the taper is geometrically compensated.
   */
  const coneState: 'resolved' | 'bedFlat' | 'active' | 'noDrop' = cone.resolved
    ? 'resolved'
    : cone.bedFlat
      ? 'bedFlat'
      : cone.rootDropMm > 0
        ? 'active'
        : 'noDrop';
  const coneCls =
    coneState === 'active'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-forest-50 border-forest-200 text-forest-800';
  const coneHeading = coneState === 'active' ? 'Lower root' : 'Cone';
  const coneValue = coneState === 'active' ? `${cone.rootDropMm.toFixed(0)} mm` : '✓ OK';
  const coneFoot = coneState === 'active' ? 'support' : 'resolved';

  /**
   * Completion flow: every planned plank is sawn. Swap the blade readout
   * for a celebration banner and promote "Next log" to the primary action
   * so the sawyer knows exactly how to continue with a fresh log. No
   * confirmation dialog — by the time this button is visible the log is
   * already fully sawn, so there's nothing to accidentally discard. The
   * completed plan is auto-archived into Log history on the way out, so
   * even a mis-tap is recoverable via the Reopen action in that panel.
   *
   * Uses `togglePanelAndScroll` instead of a raw setTimeout because the
   * scroll target depends on the panel's POST-expand height: if the
   * panel is currently collapsed (e.g. the previous log ended with
   * "OK, back to cutting"), dispatching the open event and calling
   * scrollIntoView in the same microtask would land on the PRE-expand
   * position and scroll too little. The helper waits two animation
   * frames so React's re-render and the browser's layout pass both
   * finish before the scroll fires.
   */
  const handleNextLog = () => {
    onNextLog();
    togglePanelAndScroll('log', true, 'panel-log');
  };

  return (
    <section
      id="panel-controls"
      className="bg-white rounded-xl p-4 shadow-sm space-y-3 scroll-mt-4"
    >
      {logComplete ? (
        /* === Completion state === */
        <>
          <div className="rounded-lg bg-forest-50 border border-forest-300 px-3 py-3 flex items-center gap-3">
            <span className="text-2xl text-forest-600" aria-hidden>
              ✓
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-forest-800">Log complete</div>
              <div className="text-xs text-forest-700">
                {cutsCount} cuts · {producedCount} planks sawn. Load the next log when you're ready.
              </div>
            </div>
          </div>
          <button
            onClick={handleNextLog}
            className="w-full rounded-lg py-4 font-bold text-lg bg-forest-500 text-white hover:bg-forest-600 transition flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: '#35671e', color: '#ffffff' }}
            title="Clear the cut history and edit measurements for the next log"
          >
            <span className="text-2xl leading-none">↻</span>
            Start next log
          </button>
        </>
      ) : (
        /* === Active cutting state === */
        <>
          {/* Row 1: three equal-width pills — blade height (left),
              cone compensation (middle), next-cut description
              (right). Cone is always-visible with state-dependent
              colour + copy so the sawyer has both key numbers (drop
              and blade height) side by side, matching the natural
              "set the supports, then set the blade" order. */}
          <div className="flex items-stretch gap-3">
            <div
              className={`flex-1 min-w-0 rounded-lg px-3 py-2 ${
                bladeValid
                  ? 'bg-forest-50 border border-forest-200'
                  : 'bg-stone-100 border border-stone-200'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide text-stone-500">
                Set {toolLabel} height
              </div>
              <div
                className={`tabular-nums font-bold leading-none ${
                  bladeValid ? 'text-forest-700 text-2xl' : 'text-stone-400 text-2xl'
                }`}
              >
                {bladeValid ? `${bladeAboveBed.toFixed(0)} mm` : '—'}
              </div>
              <div className="text-[10px] text-stone-500">from bed to {toolLabel}</div>
            </div>
            <div
              className={`flex-1 min-w-0 rounded-lg px-3 py-2 border ${coneCls}`}
              title={
                coneState === 'active'
                  ? `Lower the root-side support by ${cone.rootDropMm.toFixed(0)} mm before your first cut.`
                  : coneState === 'resolved'
                    ? 'Cone resolved — two cuts 180° apart, pith is horizontal between the supports.'
                    : coneState === 'bedFlat'
                      ? 'Log rests on a flat cut face — the taper is already compensated at this rotation, so no further drop is needed here.'
                      : 'Measured diameters match (or root is smaller) — no support drop needed yet.'
              }
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">
                {coneHeading}
              </div>
              <div
                className={`tabular-nums font-bold leading-none ${
                  coneState === 'active' ? 'text-2xl' : 'text-lg'
                }`}
              >
                {coneValue}
              </div>
              <div className="text-[10px] opacity-80">{coneFoot}</div>
            </div>
            <div
              className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-xs flex flex-col justify-center ${
                bladeKind === 'plank'
                  ? 'bg-forest-50 text-forest-800 border border-forest-200'
                  : bladeKind === 'slab'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : isDone
                      ? 'bg-forest-100 text-forest-900 border border-forest-300'
                      : 'bg-stone-100 text-stone-500 border border-stone-200'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">
                {isDone ? 'Status' : 'Next'}
              </div>
              <div className="font-semibold leading-tight">
                {isDone ? `✓ ${kindLabel}` : kindLabel}
              </div>
              {/* Rotation hint: shown both when we'll auto-rotate (so the
                  sawyer is warned the log will spin) and when manual
                  rotation is expected (so they know to rotate before
                  cutting). Styled subtly so it doesn't compete with the
                  main pill text. */}
              {rotationHint && !isDone && (
                <div className="text-[10px] mt-0.5 opacity-80">↻ {rotationHint}</div>
              )}
            </div>
          </div>

          {/* Row 2: PRIMARY CUT / LIFT BUTTON — full width, always visible.
              Forest green for the "go / proceed" semantic so red stays
              reserved for warnings (cone banner, over-range hints).
              Inline style acts as a belt-and-braces fallback in case a
              future Tailwind purge ever drops the forest background
              utility — the button must never render invisibly. */}
          {isDone ? (
            <button
              onClick={onFinish}
              className="w-full rounded-lg py-4 font-bold text-lg bg-forest-500 text-white hover:bg-forest-600 transition flex items-center justify-center gap-2 shadow-sm"
              style={{ backgroundColor: '#35671e', color: '#ffffff' }}
              title="Lift the final plank off the bed"
            >
              <span className="text-2xl leading-none">✓</span>
              Lift final plank
            </button>
          ) : (
            <button
              onClick={onStep}
              disabled={!bladeValid}
              className={`w-full rounded-lg py-4 font-bold text-lg transition flex items-center justify-center gap-2 shadow-sm ${
                bladeValid
                  ? 'bg-forest-500 text-white hover:bg-forest-600'
                  : 'bg-stone-200 text-stone-500 cursor-not-allowed'
              }`}
              style={
                bladeValid
                  ? { backgroundColor: '#35671e', color: '#ffffff' }
                  : { backgroundColor: '#e7e5e4', color: '#78716c' }
              }
              title="Make the next cut"
            >
              <span className="text-2xl leading-none">↓</span>
              Cut
            </button>
          )}
        </>
      )}

      {/* Row 3: rotation + undo/redo, compact — always visible so the
          operator can still undo their way back out of the completion state.

          Signs on the two rotate buttons are chosen so the icon matches
          the on-screen spin direction:
            - ⟲ (anticlockwise icon) calls onRotateBy(+90): rotationDeg
              is "CCW positive" (see usePlan's `bedUpInLog` comment), so
              a +90 delta rotates the log CCW on screen — matching the
              ⟲ glyph and the amber RotationIndicator's CCW arrow.
            - ⟳ (clockwise icon) calls onRotateBy(-90) for the mirror
              reason. Flipping these signs was the long-standing bug the
              rotation indicator surfaced: the icons and the log's spin
              used to point opposite ways. */}
      <div className="grid grid-cols-4 gap-2">
        <SecBtn onClick={() => onRotateBy(90)} label="⟲ 90°" sub={`${rotation.toFixed(0)}°`} />
        <SecBtn onClick={() => onRotateBy(-90)} label="90° ⟳" sub="" />
        <SecBtn onClick={onUndo} disabled={!canUndo} label="↑" sub="Undo" />
        <SecBtn onClick={onRedo} disabled={!canRedo} label="↷" sub="Redo" />
      </div>

      {/* Row 4: subtle start-over (hidden in the completion state since the
          primary button already does the equivalent thing). */}
      {!logComplete && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Start over? This clears all cuts and sawn planks but keeps your log measurements and priority list.'
                )
              ) {
                onReset();
              }
            }}
            className="text-xs text-stone-500 hover:text-forest-600 underline"
            title="Clear all cuts and start over"
          >
            ↺ Start over
          </button>
        </div>
      )}
    </section>
  );
}

function SecBtn({
  label,
  sub,
  onClick,
  disabled
}: {
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const base =
    'flex flex-col items-center justify-center rounded-md py-2 font-medium transition leading-tight';
  const cls = disabled
    ? `${base} bg-stone-50 text-stone-300 border border-stone-200 cursor-not-allowed`
    : `${base} bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300`;
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      <span className="text-lg">{label}</span>
      {sub && <span className="text-[10px] text-stone-500">{sub}</span>}
    </button>
  );
}

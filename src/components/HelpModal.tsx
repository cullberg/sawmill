import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

/**
 * Step-by-step walkthrough of a typical sawing session. Rendered as a
 * modal so it overlays the planner without losing the user's context —
 * they can dismiss it and pick up mid-cut.
 *
 * Layout:
 *   - Sticky header (title + close) so the dismiss affordance is always
 *     visible while the body scrolls.
 *   - Scrollable body with a hero cross-section diagram, a lead
 *     paragraph, a series of collapsible <details> steps (Step 1 open
 *     by default so the user sees something useful without clicking),
 *     then Keyboard and Glossary sections and a small "About" footer.
 *   - Sticky footer button that closes the dialog.
 *
 * Keyboard: Escape closes the dialog. That's the only shortcut wired
 * app-wide and it's documented in the Keyboard section below.
 */
export function HelpModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      className="fixed inset-0 z-50 bg-steel-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        // Click outside the card closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Sticky header with title + close so long help content can scroll
            without hiding the dismiss affordance. */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-steel-100 bg-white">
          <h2 id="help-title" className="text-lg font-bold text-steel-900">
            How to use the planner
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="text-steel-500 hover:text-forest-700 text-2xl leading-none px-2 py-0.5 rounded hover:bg-stone-100"
          >
            ×
          </button>
        </header>

        <div className="px-6 py-4 overflow-y-auto text-sm text-steel-800 space-y-5 leading-relaxed">
          {/* Hero photo: the physical sawmill this planner was built
              for — a bandsaw mill tucked under a freshly-built open
              timber shelter, red-painted workshop behind, two pine
              logs queued on the infeed bunk. Shown so new users see
              the real workshop the UI is modelled on before diving
              into the step-by-step. Using BASE_URL so the URL resolves
              both in dev ("/") and under the GitHub Pages subpath
              ("/sawmill/").

              Height is modest on phones (h-36) and taller on sm+ so
              the ~600 px tablet / desktop viewport still feels like
              the image is a hero, not a space-eater. */}
          <figure className="-mx-6 -mt-4 mb-1">
            <img
              src={`${import.meta.env.BASE_URL}sawmill-photo.jpg`}
              alt="The physical sawmill this planner was built for: a bandsaw mill under a freshly-built open timber shelter with a red-painted workshop behind, two pine logs queued on the infeed bunk ready to saw."
              className="w-full h-36 sm:h-56 object-cover"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="px-6 pt-1.5 text-xs text-stone-500 italic">
              The mill this planner was built for — logs queued on the
              infeed bunk, ready to saw.
            </figcaption>
          </figure>

          <p className="text-steel-700">
            A typical session, top to bottom. You'll only need to tweak the Mill
            settings and Preferred dimensions once — after that, sawing a log
            takes less than a minute of data entry per log. Click any step
            below to expand it.
          </p>

          <Step n={1} title="Measure your log" defaultOpen>
            <p>
              Sit the log on its two supports. With a diameter tape or calipers,
              measure the <b>Ø at each support</b> — one near the root (thicker)
              end and one near the top (thinner) end.
            </p>
            <p>
              Open the <b>Log measurements</b> pane and enter both values in
              centimetres, then the <b>distance between supports</b> and the{' '}
              <b>log length</b>, both in cm. The app will show what sticks out
              past each support as a sanity check, and compute the extrapolated
              end diameters, taper and volume automatically.
            </p>
          </Step>

          <Step n={2} title="Read the cone-compensation banner">
            <p>
              At the top of the illustration, a red banner tells you how many
              millimetres to <b>lower the root-side support</b>. Doing so aligns
              the <b>pith</b> horizontally between the supports so your first
              cut is parallel to the centre line, not the bark.
            </p>
            <p>
              The banner turns a neutral grey if no drop is needed (equal
              diameters, or inverse taper at the root flare), and forest-green{' '}
              <b>"Cone resolved"</b> once you've cut two reference faces 180°
              apart.
            </p>
          </Step>

          <Step n={3} title="Pick your preferred plank dimensions">
            <p>
              Open <b>Preferred dimensions</b>. The list ships with the full
              Swedish dimension catalogue (25 / 38 / 50 / 63 / 75 / 100 / 125 /
              150 / 175 / 200 / 225 / 250 / 300 mm thickness families). Tick the
              sizes you want today, drag to reorder (higher = higher priority),
              and tap <b>+ Add</b> for anything missing. Your choices are saved
              in the browser.
            </p>
            <p>
              Under <b>Mill settings</b> you can also pick one of three layout
              strategies:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Strict priority</b> (default) — places your #1 spec wherever
                it fits, then #2 for the gaps, and so on. The spec at the top
                of the list always becomes the central cant if it fits.
              </li>
              <li>
                <b>Maximize value</b> — you fill in a <i>value</i> number
                next to each spec (a price, a weight, anything you want
                to rank by). The planner then tries <i>every</i> enabled
                spec as the central cant and keeps the layout with the
                highest total value — often a different cant than "Strict
                priority" would pick.
              </li>
              <li>
                <b>Minimize waste</b> — same "try every cant" pass, but
                the winner is the layout whose planks cover the most
                area of the log cross-section. Ignores list order and
                value; the biggest fitting rectangles win.
              </li>
            </ul>
          </Step>

          <Step n={4} title="Square the cant (first four slabs)">
            <p>
              A fresh round log always starts with <b>four squaring slabs</b>,
              one per face. The <b>NEXT</b> pill walks you through them as{' '}
              <i>"Squaring slab (1 of 4)"</i> … <i>"(4 of 4)"</i>, cycling the
              recommended rotation 0° → 90° → 180° → 270°. After the fourth
              slab you have a square cant with four flat faces and no bark —
              only then does the planner start freeing planks.
            </p>
            <SquaringDiagram />
            <p>
              The big <b>Set chain / blade height</b> readout shows the number
              you crank into the mill — distance from the bed to the saw, in
              mm. Set the mill to that height, make the cut, then tap the big
              red <b>↓ Cut</b> button to record it. Rolling or repositioning
              the log on the bed is still your job; the app only tracks the
              cuts.
            </p>
            <p>
              By default <b>Auto-rotate during squaring</b> is on (Mill
              settings): the moment you tap Cut, the illustration rotates the
              log 90° to the next face so the NEXT pill, the height readout
              and the end-view all preview the next setup. Physically reposition
              the log to match, then tap Cut again. After the fourth slab the
              log auto-rotates once more — straight to the best planking face
              — so you can keep going without a manual spin.
            </p>
            <p>
              Prefer to rotate manually? Turn the toggle off. The log will
              stay at whatever rotation you set, and the NEXT pill will
              remind you <i>"Rotate to 90° first"</i> whenever you drift off
              the recommended face.
            </p>
            <p className="text-xs text-stone-500">
              Tip: if you're running a bandsaw mill, switch <b>Cutting tool</b>
              under Mill settings from <i>Chain</i> to <i>Blade</i> — the UI
              labels will follow.
            </p>
          </Step>

          <Step n={5} title="Plank top-to-bottom">
            <p>
              Once the cant is squared, the NEXT pill switches to{' '}
              <i>"Plank cut → 150×50"</i> and works down the face with the
              tallest remaining stack. Because every plank's top edge is now
              flush with the squared face above it, <b>each plank comes off
              in a single cut</b> — no waste slab in between. The
              illustration and the big height readout update after every cut
              so you never have to guess the next crank setting.
            </p>
            <p>
              When one face is empty, rotate 180° (or 90°) to reach the next
              stack. If you rotate to a face the planner didn't pick, the NEXT
              pill adds a small <i>↻ Rotate to X°</i> hint — follow it or
              ignore it, the height readout tracks whichever face you chose.
            </p>
            <p>
              Planks that were fully inside the squared cant come off clean.
              Side boards and the first / last plank on any face often keep
              a bit of <b>wane</b> (bark-edge curvature) on one or two sides
              — check the <b>Edging guide</b> below the Controls for the
              second-pass widths that trim them square.
            </p>
          </Step>

          <Step n={6} title="Rotate and keep cutting">
            <p>
              Use <b>⟲ 90°</b> / <b>90° ⟳</b> to spin the log manually at any
              time. Rotating is free — it doesn't use an undo slot. The
              illustration shows your current rotation ("top 0°" label above
              the log) and which planks are still to cut.
            </p>
            <p>
              Made a mistake? <b>↑ Undo</b> rewinds the last cut or rotation,{' '}
              <b>↷ Redo</b> replays it. You get 50 steps of history.
            </p>
          </Step>

          <Step n={7} title="Finish the log">
            <p>
              When the last plank is the one sitting on the bed, the button
              turns green and reads <b>✓ Lift final plank</b>. Tap it to record
              the plank as produced.
            </p>
            <p>
              Once every planned plank is sawn, the whole Controls card flips
              into a <b>Log complete</b> banner with a big green{' '}
              <b>↻ Start next log</b> button. Tap that to clear the cut history
              and jump into the Log measurements pane for your next log. Mill
              settings and Preferred dimensions stay put — only the log data
              changes.
            </p>
          </Step>

          <Step n={8} title="Check your yield">
            <p>
              Expand <b>Log report</b> (below the Cut button) any time to see
              taper, root / top Ø, volume, cuts made, end-view yield %, and a
              per-size tally of planks planned vs. actually sawn.
            </p>
          </Step>

          <section className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 mt-4">
            <h3 className="font-semibold text-steel-900 mb-1">Keyboard</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="font-medium text-steel-700">Esc</dt>
              <dd className="text-steel-600">
                Closes this help dialog (and the first-run splash). That's the
                only app-wide shortcut — everything else is on-screen so the
                workshop-tablet use case isn't keyboard-dependent.
              </dd>
            </dl>
          </section>

          <section className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3">
            <h3 className="font-semibold text-steel-900 mb-1">Glossary</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="font-medium text-steel-700">Kerf</dt>
              <dd className="text-steel-600">Width of the cut — sawdust removed per pass.</dd>
              <dt className="font-medium text-steel-700">Cant</dt>
              <dd className="text-steel-600">The squared-off centre of the log after the first slab cuts.</dd>
              <dt className="font-medium text-steel-700">Slab</dt>
              <dd className="text-steel-600">The rounded waste piece cut off before you reach good plank stock.</dd>
              <dt className="font-medium text-steel-700">Cone resolved</dt>
              <dd className="text-steel-600">Two faces cut 180° apart — the pith is now horizontal, taper is "beaten".</dd>
              <dt className="font-medium text-steel-700">Design Ø</dt>
              <dd className="text-steel-600">Smallest extrapolated end diameter — what full-length planks must fit inside.</dd>
              <dt className="font-medium text-steel-700">Pith</dt>
              <dd className="text-steel-600">
                The geometric centre of the log, roughly where the tree's
                original growth axis ran. Planks straddle or flank it.
              </dd>
              <dt className="font-medium text-steel-700">Wane</dt>
              <dd className="text-steel-600">
                Bark edge or missing corner on a plank that wasn't fully
                inside the squared cant. Trimmed away in a second pass.
              </dd>
              <dt className="font-medium text-steel-700">Edging</dt>
              <dd className="text-steel-600">
                The second-pass cut that trims a plank's wane side(s) to
                its target width. Plan is in the Edging guide.
              </dd>
              <dt className="font-medium text-steel-700">Root / top end</dt>
              <dd className="text-steel-600">Root = wider, tree-base end. Top = narrower, crown end.</dd>
            </dl>
          </section>
        </div>

        <footer className="px-6 py-3 border-t border-steel-100 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-forest-500 hover:bg-forest-600 text-white font-semibold px-5 py-2 shadow-sm"
          >
            Back to planner
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Collapsible step. Renders a native <details> so the browser handles
 * keyboard + accessibility for free. First step is typically opened by
 * default so the user sees something without clicking, and long steps
 * can be skipped without scrolling past their full body.
 */
function Step({
  n,
  title,
  children,
  defaultOpen = false
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-stone-200 open:bg-white bg-stone-50/60"
    >
      <summary
        className="flex gap-3 items-center px-3 py-2 cursor-pointer list-none rounded-lg hover:bg-stone-100 group-open:bg-white group-open:border-b group-open:border-stone-200"
      >
        <div
          className="shrink-0 w-8 h-8 rounded-full bg-forest-500 text-white font-bold flex items-center justify-center text-sm"
          aria-hidden
        >
          {n}
        </div>
        <h3 className="flex-1 min-w-0 font-semibold text-steel-900">{title}</h3>
        {/* Chevron: CSS rotates via the group-open variant. Plain text
            so we don't need an icon dependency. */}
        <span
          aria-hidden
          className="text-steel-400 text-xs transition-transform group-open:rotate-90"
        >
          ▶
        </span>
      </summary>
      <div className="px-3 pb-3 pt-2 space-y-2">{children}</div>
    </details>
  );
}

/**
 * Small diagram showing the four squaring slabs, numbered 1–4 in the
 * order the auto-rotate workflow takes them (0° at top, 90° to the
 * right, 180° at the bottom, 270° to the left). Pure SVG, stateless,
 * no external assets.
 *
 * Dimensions: the viewBox is -60..60 on both axes with a 50-unit
 * circle. The red-dashed lines are the cut positions; the numbered
 * pills sit just outside each cut.
 */
function SquaringDiagram() {
  const cuts: Array<{ n: number; x1: number; y1: number; x2: number; y2: number; lx: number; ly: number }> = [
    // 0° → top face: horizontal cut across the top, numbered "1" above.
    { n: 1, x1: -45, y1: -40, x2: 45, y2: -40, lx: 0, ly: -52 },
    // 90° → right face: vertical cut on the right, numbered "2" to the right.
    { n: 2, x1: 40, y1: -45, x2: 40, y2: 45, lx: 52, ly: 2 },
    // 180° → bottom face: horizontal cut across the bottom, numbered "3" below.
    { n: 3, x1: -45, y1: 40, x2: 45, y2: 40, lx: 0, ly: 56 },
    // 270° → left face: vertical cut on the left, numbered "4" to the left.
    { n: 4, x1: -40, y1: -45, x2: -40, y2: 45, lx: -52, ly: 2 }
  ];
  return (
    <figure className="my-2 flex flex-col items-center">
      <svg
        viewBox="-60 -60 120 120"
        className="w-40 h-40"
        role="img"
        aria-label="Diagram of the four squaring slabs: the round log with cut 1 across the top, cut 2 on the right, cut 3 across the bottom, cut 4 on the left — the order produced by the auto-rotate workflow."
      >
        {/* Log outline */}
        <circle cx="0" cy="0" r="50" fill="#f5efe6" stroke="#8b6f4e" strokeWidth="1.2" />
        {/* Resulting square cant, lightly filled so the diagram shows
            "what you get after the four slabs" at a glance. */}
        <rect x="-40" y="-40" width="80" height="80" fill="#e7d9c0" stroke="#8b6f4e" strokeWidth="0.6" />
        {cuts.map((c) => (
          <g key={c.n}>
            <line
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              stroke="#e42313"
              strokeWidth="1.6"
              strokeDasharray="3 2"
            />
            <circle cx={c.lx} cy={c.ly} r="6.5" fill="#e42313" />
            <text
              x={c.lx}
              y={c.ly + 2.2}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="#ffffff"
            >
              {c.n}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="text-xs text-stone-500 italic text-center -mt-1">
        Four squaring slabs, in the order the auto-rotate workflow takes
        them: top → right → bottom → left.
      </figcaption>
    </figure>
  );
}

import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

/**
 * Step-by-step walkthrough of a typical sawing session. Rendered as a
 * modal so it overlays the planner without losing the user's context —
 * they can dismiss it and pick up mid-cut.
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
            className="text-steel-500 hover:text-brand-600 text-2xl leading-none px-2 py-0.5 rounded hover:bg-stone-100"
          >
            ×
          </button>
        </header>

        <div className="px-6 py-4 overflow-y-auto text-sm text-steel-800 space-y-5 leading-relaxed">
          {/* Photo of the physical mill this planner was built for —
              gives new users an anchor between the on-screen illustration
              and the real machine they're about to feed a log into.
              Uses BASE_URL so it resolves correctly both in dev (`/`) and
              when deployed under the GitHub Pages subpath (`/sawmill/`). */}
          <figure className="-mx-6 -mt-4 mb-1">
            <img
              src={`${import.meta.env.BASE_URL}sawmill-photo.jpg`}
              alt="The sawmill this planner is built for: a bandsaw mill under a freshly-built open timber shelter, with two spruce logs queued on the infeed ramp."
              className="w-full h-48 sm:h-56 object-cover"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="px-6 pt-1.5 text-xs text-stone-500 italic">
              The mill this planner was built for — logs queued on the
              infeed, ready to saw.
            </figcaption>
          </figure>

          <p className="text-steel-700">
            A typical session, top to bottom. You'll only need to tweak the Mill
            settings and Preferred dimensions once — after that, sawing a log
            takes less than a minute of data entry per log.
          </p>

          <Step n={1} title="Measure your log">
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
              the pith horizontally between the supports so your first cut is
              parallel to the centre line, not the bark.
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
              Under <b>Mill settings</b> you can also switch strategy:
              <i> Strict priority</i> (default — greedy, #1 first),{' '}
              <i>Maximize value</i>, or <i>Minimize waste</i>.
            </p>
          </Step>

          <Step n={4} title="Square the cant (first four slabs)">
            <p>
              A fresh round log always starts with <b>four squaring slabs</b>, one
              per face. The <b>NEXT</b> pill walks you through them as{' '}
              <i>"Squaring slab (1 of 4)"</i> … <i>"(4 of 4)"</i>, cycling the
              recommended rotation 0° → 90° → 180° → 270°. After the fourth
              slab you have a square cant with four flat faces and no bark —
              only then does the planner start freeing planks.
            </p>
            <p>
              The big <b>Set chain / blade height</b> readout shows the number
              you crank into the mill — distance from the bed to the saw, in mm.
              Set the mill to that height, make the cut physically, then tap
              the big red <b>↓ Cut</b> button to record it.
            </p>
            <p>
              By default <b>Auto-rotate during squaring</b> is on (Mill
              settings): immediately after you tap Cut, the illustration
              turns the log 90° to the next face — so the NEXT pill, the
              height readout and the end-view all show exactly what the
              next setup looks like (bed / supports dropped, new blade
              height, new face up). Tap Cut again once you've mechanically
              repositioned the log, and so on for four slabs. After the
              fourth slab the log auto-rotates once more, straight to the
              best planking face, so you can keep tapping Cut and start
              peeling planks without a manual spin.
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
              tallest remaining stack. Each plank typically needs <b>two cuts</b>:
              a thin waste slab to expose the top, then the plank cut itself.
              The illustration and the big height readout update after every
              cut so you never have to guess the next crank setting.
            </p>
            <p>
              When one face is empty, rotate 180° (or 90°) to reach the next
              stack. If you rotate to a face the planner didn't pick, the NEXT
              pill adds a small <i>↻ Rotate to X°</i> hint — follow it or
              ignore it, the height readout tracks whichever face you chose.
            </p>
            <p>
              The first and last plank on a face often need a little trimming
              for wane afterwards — check the <b>Edging guide</b> below the
              Controls for the second-pass widths.
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
              <b>↷ Redo</b> replays it.
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
              <dt className="font-medium text-steel-700">Root / top end</dt>
              <dd className="text-steel-600">Root = wider, tree-base end. Top = narrower, crown end.</dd>
            </dl>
          </section>
        </div>

        <footer className="px-6 py-3 border-t border-steel-100 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-2 shadow-sm"
            style={{ backgroundColor: '#e42313', color: '#ffffff' }}
          >
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-3">
      <div
        className="shrink-0 w-8 h-8 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-sm"
        style={{ backgroundColor: '#e42313', color: '#ffffff' }}
        aria-hidden
      >
        {n}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <h3 className="font-semibold text-steel-900">{title}</h3>
        {children}
      </div>
    </section>
  );
}

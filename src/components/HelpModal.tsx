import { useEffect } from 'react';
import { useT, useTRich } from '../i18n/I18nProvider';

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
 *   - Scrollable body with a hero cross-section diagram, a short
 *     "Quick guidance" cheat-sheet (so a returning user can scan and
 *     dive back in without re-reading every step), then the full
 *     step-by-step (Step 1 open by default) covering all the details
 *     of every feature, then Keyboard and Glossary sections.
 *   - Sticky footer button that closes the dialog.
 *
 * Keyboard: Escape closes the dialog. That's the only shortcut wired
 * app-wide and it's documented in the Keyboard section below.
 *
 * Translation: every prose string flows through `t()` (plain text) or
 * `tRich()` (`**bold**` / `*italic*` markup expanded into <strong> /
 * <em>). The component tree itself is locale-agnostic — only the keys
 * change between languages. See `src/i18n/strings.ts` for the
 * en / sv tables.
 */
export function HelpModal({ onClose }: Props) {
  const t = useT();
  const tRich = useTRich();

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
            {t('help.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('help.close.aria')}
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
              alt={t('help.hero.alt')}
              className="w-full h-36 sm:h-56 object-cover"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="px-6 pt-1.5 text-xs text-stone-500 italic">
              {t('help.hero.caption')}
            </figcaption>
          </figure>

          {/* ── Quick guidance cheat-sheet ──
              Sits above the detailed walkthrough so a returning user
              who already knows the app can scan the numbered list and
              jump back into a session without re-reading every step.
              First-time users keep scrolling for the full details
              below. The sheet deliberately avoids long sentences;
              every line is one verb plus one noun where possible. */}
          <section className="rounded-lg border border-forest-200 bg-forest-50 px-4 py-3">
            <h3 className="font-semibold text-forest-900 mb-2 flex items-center gap-2">
              <span aria-hidden className="text-forest-600">⚡</span>
              {t('help.quick.heading')}
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-steel-800 marker:text-forest-700 marker:font-semibold">
              <li>{tRich('help.quick.1')}</li>
              <li>{tRich('help.quick.2')}</li>
              <li>{tRich('help.quick.3')}</li>
              <li>{tRich('help.quick.4')}</li>
              <li>{tRich('help.quick.5')}</li>
              <li>{tRich('help.quick.6')}</li>
              <li>{tRich('help.quick.7')}</li>
              <li>{tRich('help.quick.8')}</li>
            </ol>
            <p className="text-xs text-forest-800 mt-2">
              {t('help.quick.persists')}
            </p>
          </section>

          <p className="text-steel-700">{t('help.lead')}</p>

          <Step n={1} title={t('help.step1.title')} defaultOpen>
            <p>{tRich('help.step1.p1')}</p>
            <p>{tRich('help.step1.p2')}</p>
            <p>{tRich('help.step1.p3')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{tRich('help.step1.li1')}</li>
              <li>{tRich('help.step1.li2')}</li>
              <li>{tRich('help.step1.li3')}</li>
            </ul>
            <p>{tRich('help.step1.p4')}</p>
          </Step>

          <Step n={2} title={t('help.step2.title')}>
            <p>{tRich('help.step2.p1')}</p>
            <p>{tRich('help.step2.p2')}</p>
            <p>{tRich('help.step2.p3')}</p>
          </Step>

          <Step n={3} title={t('help.step3.title')}>
            <p>{tRich('help.step3.p1')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{tRich('help.step3.li1')}</li>
              <li>{tRich('help.step3.li2')}</li>
              <li>{tRich('help.step3.li3')}</li>
              <li>{tRich('help.step3.li4')}</li>
              <li>{tRich('help.step3.li5')}</li>
            </ul>
            <p>{tRich('help.step3.p2')}</p>
          </Step>

          <Step n={4} title={t('help.step4.title')}>
            <p>{tRich('help.step4.p1')}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{tRich('help.step4.li1')}</li>
              <li>{tRich('help.step4.li2')}</li>
              <li>{tRich('help.step4.li3')}</li>
              <li>{tRich('help.step4.li4')}</li>
            </ul>
          </Step>

          <Step n={5} title={t('help.step5.title')}>
            <p>{tRich('help.step5.p1')}</p>
            <SquaringDiagram />
            <p>{tRich('help.step5.p2')}</p>
            <p>{tRich('help.step5.p3')}</p>
            <p>{tRich('help.step5.p4')}</p>
            <p className="text-xs text-stone-500">{tRich('help.step5.tip')}</p>
          </Step>

          <Step n={6} title={t('help.step6.title')}>
            <p>{tRich('help.step6.p1')}</p>
            <p>{tRich('help.step6.p2')}</p>
            <p>{tRich('help.step6.p3')}</p>
          </Step>

          <Step n={7} title={t('help.step7.title')}>
            <p>{tRich('help.step7.p1')}</p>
            <p>{tRich('help.step7.p2')}</p>
          </Step>

          <Step n={8} title={t('help.step8.title')}>
            <p>{tRich('help.step8.p1')}</p>
            <p>{tRich('help.step8.p2')}</p>
            <p>{tRich('help.step8.p3')}</p>
          </Step>

          <Step n={9} title={t('help.step9.title')}>
            <p>{tRich('help.step9.p1')}</p>
          </Step>

          <section className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 mt-4">
            <h3 className="font-semibold text-steel-900 mb-1">
              {t('help.keyboard.heading')}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="font-medium text-steel-700">
                {t('help.keyboard.esc.key')}
              </dt>
              <dd className="text-steel-600">{t('help.keyboard.esc.body')}</dd>
            </dl>
          </section>

          <section className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3">
            <h3 className="font-semibold text-steel-900 mb-1">
              {t('help.glossary.heading')}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="font-medium text-steel-700">{t('help.glossary.kerf.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.kerf.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.cant.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.cant.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.slab.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.slab.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.coneResolved.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.coneResolved.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.designD.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.designD.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.sweep.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.sweep.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.pith.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.pith.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.quartersawn.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.quartersawn.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.flatsawn.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.flatsawn.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.cup.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.cup.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.wane.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.wane.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.edging.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.edging.d')}</dd>
              <dt className="font-medium text-steel-700">{t('help.glossary.rootTop.t')}</dt>
              <dd className="text-steel-600">{t('help.glossary.rootTop.d')}</dd>
            </dl>
          </section>
        </div>

        <footer className="px-6 py-3 border-t border-steel-100 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-forest-500 hover:bg-forest-600 text-white font-semibold px-5 py-2 shadow-sm"
          >
            {t('help.back')}
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
        {/* Chevron: inline SVG rather than the Unicode "▶" (U+25B6)
            so the colour is guaranteed. On iOS and some Android
            skins the character gets rendered by the system emoji
            font as a blue glyph that ignores CSS `color`. An SVG
            with `fill="currentColor"` respects the parent's
            `text-*` class on every platform. Rotates via the
            group-open variant. */}
        <svg
          aria-hidden
          viewBox="0 0 10 10"
          className="inline-block w-2.5 h-2.5 text-forest-500 transition-transform group-open:rotate-90"
          fill="currentColor"
        >
          <polygon points="2,1 9,5 2,9" />
        </svg>
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
  const t = useT();
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
        aria-label={t('help.squaring.aria')}
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
        {t('help.squaring.caption')}
      </figcaption>
    </figure>
  );
}

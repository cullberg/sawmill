import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  /** Stable id used to persist open/closed state in localStorage. */
  id: string;
  title: ReactNode;
  /** Optional small summary shown next to the title when collapsed. */
  summary?: ReactNode;
  /**
   * Default open state if nothing is stored yet. Typically `true` on large
   * screens and `false` on small ones — callers decide via a media query.
   */
  defaultOpen?: boolean;
  /** Right-aligned controls rendered inside the header (won't toggle). */
  headerExtras?: ReactNode;
  /**
   * Accent colour on the left edge — helps visual grouping. Semantics:
   *   - `steel`  : neutral, secondary or settings panels.
   *   - `forest` : primary / positive — the content you act on.
   *   - `brand`  : signal red. Reserve for content that itself draws
   *                the physical saw in red (e.g. EndView-adjacent).
   *   - `warn`   : amber. Reserve for warning content (cone banner
   *                style). Not currently used by App.tsx but kept
   *                available for future callers.
   *   - `motor`  : blue, reserved for "mechanical" / reference content.
   *   - `wood`   : timber-brown, reserved for log-measurement content.
   */
  accent?: 'steel' | 'brand' | 'forest' | 'warn' | 'motor' | 'wood';
  children: ReactNode;
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  steel: 'border-l-steel-400',
  brand: 'border-l-brand-500',
  forest: 'border-l-forest-500',
  warn: 'border-l-amber-500',
  motor: 'border-l-motor-500',
  wood: 'border-l-wood-500'
};

/**
 * A lightweight collapsible card. Designed for the sidebar panels on
 * smaller screens where vertical space is precious. State is persisted so
 * collapsed/expanded choices survive reloads.
 */
export function Collapsible({
  id,
  title,
  summary,
  defaultOpen = true,
  headerExtras,
  accent = 'steel',
  children
}: Props) {
  const storageKey = `sawmill.panel.${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'open') return true;
    if (stored === 'closed') return false;
    return defaultOpen;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, open ? 'open' : 'closed');
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [open, storageKey]);

  // Listen for a global "please open/close this panel" event so other
  // components (e.g. the "Next log" and "OK, back to cutting" buttons)
  // can programmatically toggle a pane without lifting all panel state
  // into a parent.
  //
  // Detail: { id: string; open?: boolean }. `open` defaults to true
  // when absent so existing callers — which only ever wanted to open a
  // panel — continue to work unchanged. Pass `open: false` to request a
  // close.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; open?: boolean }>).detail;
      if (detail?.id !== id) return;
      setOpen(detail.open ?? true);
    };
    window.addEventListener('sawmill:open-panel', handler as EventListener);
    return () => window.removeEventListener('sawmill:open-panel', handler as EventListener);
  }, [id]);

  return (
    <section
      id={`panel-${id}`}
      className={`bg-white rounded-xl shadow-sm border-l-4 ${ACCENT[accent]} overflow-hidden scroll-mt-4`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          {/* Chevron: a right-pointing triangle in our brand green.
              Using inline SVG rather than the Unicode "▶" (U+25B6)
              because on iOS and some Android skins that character is
              rendered by the system EMOJI font as a blue "▶️" glyph
              that ignores CSS `color` — making the chevron stubbornly
              blue no matter what Tailwind class we apply. SVG with
              `fill="currentColor"` honours the parent's `text-*`
              class on every platform. */}
          <svg
            aria-hidden
            viewBox="0 0 10 10"
            className={`inline-block w-2.5 h-2.5 text-forest-500 transition-transform ${
              open ? 'rotate-90' : ''
            }`}
            fill="currentColor"
          >
            <polygon points="2,1 9,5 2,9" />
          </svg>
          <span className="font-semibold text-stone-800 truncate">{title}</span>
          {!open && summary && (
            <span className="text-xs text-stone-500 truncate">{summary}</span>
          )}
        </button>
        {headerExtras && <div className="flex items-center gap-1">{headerExtras}</div>}
      </div>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}

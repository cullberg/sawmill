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
  /** Accent colour on the left edge — helps visual grouping. */
  accent?: 'steel' | 'brand' | 'forest' | 'motor' | 'wood';
  children: ReactNode;
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  steel: 'border-l-steel-400',
  brand: 'border-l-brand-500',
  forest: 'border-l-forest-500',
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

  // Listen for a global "please open this panel" event so other components
  // (e.g. the "Next log" button) can programmatically reveal a pane without
  // lifting all panel state into a parent. Detail: { id: string }.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === id) setOpen(true);
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
          <span
            className={`inline-block text-stone-500 transition-transform ${
              open ? 'rotate-90' : ''
            }`}
            aria-hidden
          >
            ▶
          </span>
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

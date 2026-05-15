import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { translate, type Locale, type TranslationKey, LOCALES } from './strings';

/**
 * React glue for the locale-aware translation tables.
 *
 * Single source of truth: `localeRef` in localStorage (key:
 * `sawmill.locale.v1`), wrapped in a context so any component can
 * read the current locale and the `t()` helper without prop-drilling
 * through a dozen layers. The provider also exposes a setter so the
 * language picker can flip locale and have the whole UI re-render.
 *
 * No external i18n library — the `translate()` function is ~10 lines
 * and the type system already enforces key parity between English and
 * Swedish, so adding a runtime dependency would be over-engineering.
 *
 * Default locale is browser-derived: if `navigator.language` starts
 * with `sv`, default to Swedish; otherwise English. Once the user
 * picks a locale via the UI, the persisted value wins forever.
 */

const STORAGE_KEY = 'sawmill.locale.v1';

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'sv') return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through.
  }
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language ?? '').toLowerCase();
    if (nav.startsWith('sv')) return 'sv';
  }
  return 'en';
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Swallow quota / disabled-storage errors.
    }
  }, []);

  // Keep <html lang="..."> in sync so screen readers, browser
  // translate banners, and CSS `:lang()` rules pick up the correct
  // language. Cheap to do and avoids a stale `lang="en"` whenever
  // the user has switched.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars)
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the current locale, the setter, and the `t()` translator.
 * Call sites typically destructure just `t`. Throws if used outside
 * a provider — which is intentional, every component that renders
 * user-facing text needs the context.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return ctx;
}

/**
 * Convenience hook that returns just the translator. Most components
 * only need this — the locale itself is rarely consulted in render
 * code. Re-exported separately so call sites stay tidy:
 *   const t = useT();
 *   <button>{t('controls.cut')}</button>
 */
export function useT() {
  return useI18n().t;
}

/**
 * Tiny inline-markup formatter used by long help / glossary strings.
 * Splits a translated string on `**bold**` and `*italic*` markers
 * and returns a React fragment with `<strong>` / `<em>` wrappers
 * around the marked-up runs.
 *
 * Why a hand-rolled mini-Markdown rather than HTML in the
 * translation strings + `dangerouslySetInnerHTML`? Three reasons:
 *
 *   1. Translators (or future-me) edit `**bold**` confidently;
 *      raw `<strong>` tags are easier to mistype.
 *   2. No XSS surface — only `<strong>` and `<em>` are ever
 *      injected, by us, structurally; the input string is treated
 *      as plain text everywhere else.
 *   3. The output is real React nodes, so they nest inside any
 *      surrounding JSX without escaping issues.
 *
 * Limitations: nested markup isn't supported (no `**bold *italic*
 * inside**`). For the help prose that's fine — the cases we care
 * about are flat. Variable substitution (`{name}`) happens BEFORE
 * the markup pass, so `t()` callers can still use placeholders
 * inside marked-up strings.
 */
export function formatRich(translated: string): ReactNode {
  // Combined matcher: each capture group is one type of markup.
  // Group 1 = bold (**…**), Group 2 = italic (*…*). The order
  // matters: match `**` BEFORE `*` so a literal `**bold**` doesn't
  // get mis-parsed as `*` + `*bold*` + `*`.
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(translated)) !== null) {
    if (m.index > lastIndex) {
      out.push(translated.slice(lastIndex, m.index));
    }
    if (m[1] != null) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else if (m[2] != null) {
      out.push(<em key={key++}>{m[2]}</em>);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < translated.length) {
    out.push(translated.slice(lastIndex));
  }
  // Fragment so the caller can drop the result inside a paragraph
  // without an extra wrapper element.
  return <Fragment>{out}</Fragment>;
}

/**
 * Hook companion to `formatRich`: translate + format in one call.
 * Most help-prose paragraphs use this — it's the equivalent of
 * `t()` for strings that may contain `**bold**` / `*italic*`.
 */
export function useTRich() {
  const { t } = useI18n();
  return (key: TranslationKey, vars?: Record<string, string | number>): ReactNode =>
    formatRich(t(key, vars));
}

export { LOCALES };
export type { Locale, TranslationKey };

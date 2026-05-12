/**
 * Helpers for programmatically opening/closing a Collapsible panel
 * and then scrolling another element into view, without the two
 * operations racing each other.
 *
 * The race we're avoiding: `window.dispatchEvent('sawmill:open-panel',
 * ...)` toggles a React state inside the Collapsible, which expands
 * or collapses its content on the NEXT render. `scrollIntoView`
 * called synchronously right after the dispatch targets the DOM as
 * it exists BEFORE that render, so it lands at the pre-toggle height
 * and can misfire — especially on the second and later iterations of
 * a flow, once the panel has been left in a collapsed state by a
 * previous step.
 *
 * The fix is `requestAnimationFrame` × 2: the first RAF lands after
 * React's commit phase, the second lands after the browser's layout
 * pass, so `scrollIntoView` sees the geometry the user is actually
 * about to see.
 *
 * These helpers are UI-glue only and have no state — suitable for
 * direct use from event handlers in Controls.tsx and App.tsx.
 */

/**
 * Dispatch the `sawmill:open-panel` event a Collapsible listens for.
 * `open` defaults to `true` for historical back-compat (the original
 * event only opened panels); pass `false` to close.
 */
export function setPanelOpen(id: string, open = true): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('sawmill:open-panel', { detail: { id, open } })
  );
}

/**
 * Wait two animation frames so a just-queued React state update has
 * both committed (first RAF) and laid out (second RAF) before the
 * caller reads layout-dependent DOM geometry.
 */
function afterLayout(cb: () => void): void {
  if (typeof window === 'undefined') {
    cb();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(cb));
}

/**
 * Smooth-scroll an element with `id="<domId>"` into view at the top
 * of the viewport. No-op if the element is missing (e.g. a panel id
 * that doesn't exist yet) — callers don't need to null-check.
 */
export function scrollPanelIntoView(domId: string): void {
  if (typeof window === 'undefined') return;
  document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Toggle a Collapsible then scroll a (possibly different) target into
 * view once the toggle has rendered and laid out. Used by "Start next
 * log" to open the Log-measurements panel and scroll onto it.
 *
 * Keeping the open and scroll concerns in one helper prevents the two
 * call sites from drifting and makes the race-avoidance explicit.
 */
export function togglePanelAndScroll(
  panelId: string,
  open: boolean,
  scrollTargetId: string
): void {
  setPanelOpen(panelId, open);
  afterLayout(() => scrollPanelIntoView(scrollTargetId));
}

/**
 * Toggle a Collapsible then scroll the page to the very top (the
 * Help pill and primary column's ConeBanner + EndView come into
 * view). Used by "OK, back to cutting" so the sawyer sees the whole
 * illustration + Controls card again, not just the Controls panel
 * landing halfway down the page.
 *
 * Same two-RAF wait as `togglePanelAndScroll` so the panel's collapse
 * has finished rendering before the scroll animation starts — without
 * it, the scroll would race the layout shift and undershoot.
 */
export function togglePanelAndScrollToTop(panelId: string, open: boolean): void {
  setPanelOpen(panelId, open);
  afterLayout(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

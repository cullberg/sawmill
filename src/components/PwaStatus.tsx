import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Surfaces two service-worker lifecycle events as lightweight toasts:
 *
 *  1. **Offline ready** — after the service worker finishes precaching
 *     every asset on first load, a green toast appears telling the
 *     sawyer the app is now safe to use without internet. Auto-hides
 *     after a few seconds; can be dismissed manually.
 *
 *  2. **Update available** — when a new build is detected on the
 *     server, a blue toast with "Reload" / "Later" buttons lets the
 *     user choose whether to switch to the new version now. Choosing
 *     later keeps the current build running until next launch.
 *
 * Both toasts stack bottom-right on desktop and bottom-centre on
 * mobile so they never cover the Cut button or the illustration.
 */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    // Fires once the service worker has populated Cache Storage with
    // every precache entry for the first time.
    onOfflineReady() {
      // Nothing to do — the state setter above already makes the toast
      // render; the `useEffect` below auto-dismisses it.
    },
    onNeedRefresh() {
      // A new SW has finished installing and is waiting; the state
      // setter triggers the update-available toast.
    },
    onRegisterError(error) {
      // Don't crash the app if SW registration fails (e.g. a browser
      // extension blocked it); just log so dev builds aren't noisy in
      // production.
      // eslint-disable-next-line no-console
      console.warn('Service worker registration failed', error);
    }
  });

  // Auto-dismiss the "offline ready" toast after 5 s — it's informational,
  // not actionable. The update-available toast stays until the user picks
  // a side because reloading mid-session is destructive enough to warrant
  // an explicit choice.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 inset-x-0 bottom-4 flex flex-col items-center gap-2 px-4 pointer-events-none sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {offlineReady && (
        <div className="pointer-events-auto max-w-sm w-full sm:w-auto rounded-xl bg-forest-600 text-white shadow-lg px-4 py-3 flex items-center gap-3">
          <span className="text-xl leading-none" aria-hidden>
            ✓
          </span>
          <div className="flex-1 text-sm">
            <div className="font-semibold">Ready to use offline</div>
            <div className="text-forest-100 text-xs">
              The app is cached. You can now disconnect Wi-Fi and keep sawing.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            aria-label="Dismiss"
            className="text-forest-100 hover:text-white text-lg leading-none px-1"
          >
            ×
          </button>
        </div>
      )}

      {needRefresh && (
        <div className="pointer-events-auto max-w-sm w-full sm:w-auto rounded-xl bg-motor-600 text-white shadow-lg px-4 py-3 flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5" aria-hidden>
            ↻
          </span>
          <div className="flex-1 text-sm">
            <div className="font-semibold">Update available</div>
            <div className="text-motor-100 text-xs">
              A newer version has downloaded. Reload to use it?
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => updateServiceWorker(true)}
                className="rounded-md bg-white text-motor-700 hover:bg-motor-50 font-semibold text-xs px-3 py-1.5"
              >
                Reload now
              </button>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="rounded-md bg-motor-700 hover:bg-motor-500 text-white text-xs px-3 py-1.5"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

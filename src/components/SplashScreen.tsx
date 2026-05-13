import { useEffect, useState } from 'react';
import { SawmillSketch } from './SawmillSketch';

interface Props {
  /**
   * Called when the user dismisses the splash (either by clicking
   * "Get started" or the close button). The parent decides what
   * happens next — typically just hides the overlay.
   */
  onDismiss: () => void;
  /** Open the help modal instead of the planner. */
  onShowHelp: () => void;
}

/**
 * First-run splash with the sawmill hero. Shown once per browser (flag
 * persisted in localStorage under `sawmill.splash.seen`). Dismissable
 * with the primary button, the close affordance, or Escape.
 *
 * Rendered as a fixed full-screen overlay so it stacks above the
 * planner without disturbing its layout.
 */
export function SplashScreen({ onDismiss, onShowHelp }: Props) {
  // Close on Escape so keyboard users aren't trapped.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
      className="fixed inset-0 z-50 bg-steel-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden">
        {/* Hero band with the sketched sawmill */}
        <div className="bg-gradient-to-b from-steel-50 to-white px-6 pt-6 pb-2 border-b border-steel-100">
          <SawmillSketch className="w-full h-auto max-h-60" />
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <h1
              id="splash-title"
              className="text-2xl font-bold text-steel-900 tracking-tight"
            >
              Northern Lights Sawmill Planner
            </h1>
            <p className="text-sm text-steel-600 mt-1">
              Plan and optimise how to saw your log on a single-blade chainsaw or
              bandsaw mill. Designed for the workshop tablet — big buttons, offline,
              no account.
            </p>
          </div>

          <ul className="grid sm:grid-cols-3 gap-2 text-xs text-steel-700">
            <li className="rounded-lg bg-wood-50 border border-wood-200 px-3 py-2">
              <div className="font-semibold text-wood-700">Measure</div>
              the log at the two supports — enter diameters in cm.
            </li>
            <li className="rounded-lg bg-motor-50 border border-motor-200 px-3 py-2">
              <div className="font-semibold text-motor-700">Read</div>
              the blade height off the big green dimension every cut.
            </li>
            <li className="rounded-lg bg-forest-50 border border-forest-200 px-3 py-2">
              <div className="font-semibold text-forest-800">Cut</div>
              step by step. The app tracks planks and waste for you.
            </li>
          </ul>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onShowHelp}
              className="text-sm text-steel-600 hover:text-forest-700 underline underline-offset-2 sm:mr-auto"
            >
              How does it work?
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto rounded-lg bg-forest-500 hover:bg-forest-600 text-white font-semibold px-6 py-3 shadow-sm transition"
              style={{ backgroundColor: '#35671e', color: '#ffffff' }}
              autoFocus
            >
              Get started →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** localStorage key that records whether the splash has been dismissed. */
const SPLASH_SEEN_KEY = 'sawmill.splash.seen';

/**
 * Tracks whether the user has already dismissed the splash. Returns the
 * current state and a setter that persists the dismissal.
 *
 * The initial state is read synchronously from localStorage so the first
 * paint doesn't flicker from "open" to "closed" on returning visits.
 */
export function useSplashState(): [boolean, () => void] {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SPLASH_SEEN_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SPLASH_SEEN_KEY, 'true');
    } catch {
      /* ignore */
    }
  };

  return [open, dismiss];
}

import { useEffect, useState } from 'react';
import { Collapsible } from './components/Collapsible';
import { ConeBanner } from './components/ConeBanner';
import { Controls } from './components/Controls';
import { EdgingGuide } from './components/EdgingGuide';
import { EndView } from './components/EndView';
import { HelpModal } from './components/HelpModal';
import { LogForm } from './components/LogForm';
import { PriorityList } from './components/PriorityList';
import { PwaStatus } from './components/PwaStatus';
import { SettingsForm } from './components/SettingsForm';
import { SplashScreen, useSplashState } from './components/SplashScreen';
import { Summary } from './components/Summary';
import { usePlan } from './state/usePlan';

/**
 * `lg` (Tailwind default 1024px) is our threshold for "roomy" layouts.
 * Below it, we collapse the side panels by default so the log illustration
 * and the Cut button dominate the viewport.
 */
function useIsLargeScreen(): boolean {
  const [isLarge, setIsLarge] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isLarge;
}

export default function App() {
  const {
    plan,
    setLog,
    setSettings,
    setPriority,
    rotateBy,
    commitStep,
    finishFinalPlank,
    undo,
    redo,
    reset,
    startNextLog,
    canUndo,
    canRedo,
    blade,
    cone,
    remainingPlanks,
    logComplete
  } = usePlan();

  const isLarge = useIsLargeScreen();
  const defaultOpen = isLarge;

  // Splash appears on first visit (flag in localStorage); help is an
  // on-demand modal reachable from the splash or the "?" button.
  const [splashOpen, dismissSplash] = useSplashState();
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = () => {
    // If the splash is still showing when the user taps "How does it work?"
    // we close it and open help instead — they don't need to see the
    // splash again after reading the walkthrough.
    dismissSplash();
    setHelpOpen(true);
  };

  // All log measurements display in cm to match the LogForm input units.
  const logSummary = `Ø ${(plan.log.rootSideDiameter / 10).toFixed(1)}/${(
    plan.log.topSideDiameter / 10
  ).toFixed(1)} cm · ${(plan.log.length / 10).toFixed(0)} cm`;
  const prioritySummary = `${plan.priorityList.filter((s) => s.enabled).length}/${
    plan.priorityList.length
  } enabled`;
  const settingsSummary = `kerf ${plan.settings.kerf} · bark ${plan.settings.barkThickness}`;

  return (
    <div className="min-h-screen bg-steel-50 text-steel-900">
      {/* Floating help button — always reachable without eating precious
          vertical space in the main layout. `fixed` so it stays visible
          when the user scrolls the long sidebar on small screens. */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        aria-label="Open help"
        title="How does the planner work?"
        className="fixed top-3 right-3 z-40 w-10 h-10 rounded-full bg-white shadow-md border border-steel-200 text-steel-700 hover:text-brand-600 hover:border-brand-300 font-bold text-lg flex items-center justify-center"
      >
        ?
      </button>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Primary column: log illustration + cut controls. First on every
            viewport so the operator's main working surface is never pushed
            below the fold. */}
        <div className="space-y-3 order-1">
          <ConeBanner cone={cone} log={plan.log} />
          <EndView plan={plan} blade={blade} remainingPlanks={remainingPlanks} />
          <Controls
            rotation={plan.rotationDeg}
            onRotateBy={rotateBy}
            onStep={commitStep}
            onFinish={finishFinalPlank}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
            onNextLog={startNextLog}
            canUndo={canUndo}
            canRedo={canRedo}
            bladeAboveBed={blade.bladeAboveBed}
            bladeValid={blade.valid}
            bladeKind={blade.kind}
            bladeProducing={blade.producingLabel}
            bladePhase={blade.phase}
            squaringIndex={blade.squaringIndex}
            squaringTotal={blade.squaringTotal}
            suggestRotationDeg={blade.suggestRotationDeg}
            autoRotateForSquaring={plan.settings.autoRotateForSquaring}
            logComplete={logComplete}
            cutsCount={plan.cuts.length}
            producedCount={plan.produced.length}
            toolLabel={plan.settings.cuttingTool}
          />
          {/* The log report is useful but not essential mid-cut — tuck it
              behind a collapsible on every viewport so it never steals focus
              from the illustration. */}
          <Collapsible
            id="edging"
            title="Edging guide"
            summary={`${plan.settings.cuttingTool === 'chain' ? 'Chain' : 'Blade'} heights for the second-pass width trim`}
            defaultOpen={false}
            accent="brand"
          >
            <EdgingGuide plan={plan} remainingPlanks={remainingPlanks} />
          </Collapsible>
          <Collapsible
            id="summary"
            title="Log report"
            summary={`${plan.cuts.length} cuts · ${plan.produced.length} sawn`}
            defaultOpen={false}
            accent="forest"
          >
            <Summary plan={plan} />
          </Collapsible>
        </div>

        {/* Secondary column: setup + preferences. Each panel is collapsible
            so small-screen users can hide everything and concentrate on
            sawing. On large screens they default to open. */}
        <div className="space-y-3 order-2">
          <Collapsible
            id="log"
            title="Log measurements"
            summary={logSummary}
            defaultOpen={defaultOpen}
            accent="wood"
          >
            <LogForm log={plan.log} onChange={setLog} />
          </Collapsible>

          <Collapsible
            id="priority"
            title="Preferred dimensions"
            summary={prioritySummary}
            defaultOpen={defaultOpen}
            accent="brand"
          >
            <PriorityList
              list={plan.priorityList}
              strategy={plan.settings.strategy}
              onChange={setPriority}
            />
          </Collapsible>

          <Collapsible
            id="settings"
            title="Mill settings"
            summary={settingsSummary}
            defaultOpen={defaultOpen}
            accent="steel"
          >
            <SettingsForm settings={plan.settings} onChange={setSettings} />
          </Collapsible>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto p-4 text-xs text-stone-500">
        <p>Log measurements in cm, mill settings and plank dimensions in mm. Data is saved in your browser.</p>
      </footer>

      {/* Overlays render last so they stack on top of the planner. Both
          trap focus implicitly via their `autoFocus` / close buttons and
          dismiss on Escape. */}
      {splashOpen && (
        <SplashScreen onDismiss={dismissSplash} onShowHelp={openHelp} />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* Service-worker lifecycle toasts (offline-ready, update-available).
          Invisible until the SW fires the relevant event, so there's no
          cost to mounting it unconditionally. */}
      <PwaStatus />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Collapsible } from './components/Collapsible';
import { ConeBanner } from './components/ConeBanner';
import { Controls } from './components/Controls';
import { EndView } from './components/EndView';
import { LogForm } from './components/LogForm';
import { PriorityList } from './components/PriorityList';
import { SettingsForm } from './components/SettingsForm';
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

  // All log measurements display in cm to match the LogForm input units.
  const logSummary = `Ø ${(plan.log.buttSideDiameter / 10).toFixed(1)}/${(
    plan.log.topSideDiameter / 10
  ).toFixed(1)} cm · ${(plan.log.length / 10).toFixed(0)} cm`;
  const prioritySummary = `${plan.priorityList.filter((s) => s.enabled).length}/${
    plan.priorityList.length
  } enabled`;
  const settingsSummary = `kerf ${plan.settings.kerf} · bark ${plan.settings.barkThickness}`;

  return (
    <div className="min-h-screen bg-steel-50 text-steel-900">
      <main className="max-w-6xl mx-auto p-3 sm:p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Primary column: log illustration + cut controls. First on every
            viewport so the operator's main working surface is never pushed
            below the fold. */}
        <div className="space-y-3 order-1">
          <ConeBanner cone={cone} />
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
            logComplete={logComplete}
            cutsCount={plan.cuts.length}
            producedCount={plan.produced.length}
          />
          {/* The log report is useful but not essential mid-cut — tuck it
              behind a collapsible on every viewport so it never steals focus
              from the illustration. */}
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
    </div>
  );
}

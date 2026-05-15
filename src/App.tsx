import { useEffect, useState } from 'react';
import { AppSettingsForm } from './components/AppSettingsForm';
import { Collapsible } from './components/Collapsible';
import { ConeBanner } from './components/ConeBanner';
import { Controls } from './components/Controls';
import { EdgingGuide } from './components/EdgingGuide';
import { EndView } from './components/EndView';
import { HelpModal } from './components/HelpModal';
import { LogForm } from './components/LogForm';
import { LogHistory } from './components/LogHistory';
import { togglePanelAndScrollToTop } from './components/panelScroll';
import { PriorityList } from './components/PriorityList';
import { PwaStatus } from './components/PwaStatus';
import { SettingsForm } from './components/SettingsForm';
import { SplashScreen, useSplashState } from './components/SplashScreen';
import { Summary } from './components/Summary';
import { LOCALES, useI18n, useT } from './i18n/I18nProvider';
import { useLogArchive } from './state/useLogArchive';
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
  const t = useT();
  const { locale } = useI18n();
  // The log archive lives outside of usePlan so its lifecycle is
  // independent: reopening an archived log or resetting the current
  // plan never touches the archive. usePlan calls `archivePlan` via
  // the `onArchiveLog` option whenever a completed plan is cleared
  // by `startNextLog` — so each completed log lands in the archive
  // exactly once, without the UI having to coordinate the two.
  const { archive, archivePlan, removeEntry, clearAll } = useLogArchive();

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
    loadSnapshot,
    canUndo,
    canRedo,
    blade,
    cone,
    remainingPlanks,
    logComplete
  } = usePlan({ onArchiveLog: archivePlan });

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
  const prioritySummary = t('panel.priority.summary', {
    enabled: plan.priorityList.filter((s) => s.enabled).length,
    total: plan.priorityList.length
  });
  const settingsSummary = t('panel.settings.summary', {
    kerf: plan.settings.kerf,
    bark: plan.settings.barkThickness
  });

  /**
   * "OK, back to cutting" from the Log measurements panel: close the
   * panel (so its real-estate returns to the illustration) and scroll
   * the page all the way to the top so the sawyer sees the ConeBanner
   * + EndView + Controls card as one unit, with the Cut button below
   * its live illustration. "Top of page" matches the user's mental
   * model better than "top of Controls" — the latter used to hide
   * the EndView above the fold on a tablet.
   *
   * Uses the two-RAF-aware helper so the close → layout → scroll
   * sequence is race-free. Without it, scrolling would start while
   * the panel was still collapsing and undershoot.
   */
  const onLogMeasurementsDone = () => {
    togglePanelAndScrollToTop('log', false);
  };

  return (
    <div className="min-h-screen bg-steel-50 text-steel-900">
      {/* Floating app icon — mirrors the help button in the opposite
          corner. Kept as a pure brand mark (no text label) so it takes
          minimal space on mobile while still anchoring the identity of
          the planner. Using BASE_URL so the src resolves both in dev
          ("/favicon.svg") and under the GitHub Pages subpath
          ("/sawmill/favicon.svg"). */}
      <div
        className="fixed top-3 left-3 z-40 w-10 h-10 rounded-xl overflow-hidden shadow-md bg-[#0b1026]"
        title={t('app.title')}
        aria-hidden
      >
        <img
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          alt=""
          className="w-full h-full"
          draggable={false}
        />
      </div>

      {/* Floating help button — always reachable without eating
          precious vertical space in the main layout. `fixed` so it
          stays visible when the user scrolls the long sidebar on
          small screens. The language picker used to live here too,
          but it now belongs in the App settings panel below — keeps
          the floating bar focused on a single primary action. */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        aria-label={t('app.help.aria')}
        title={t('app.help.title')}
        className="fixed top-3 right-3 z-40 rounded-full bg-forest-500 hover:bg-forest-600 text-white shadow-md font-semibold flex items-center gap-1.5 px-3 h-10 text-sm"
        style={{ backgroundColor: '#35671e', color: '#ffffff' }}
      >
        <span aria-hidden className="text-base leading-none">?</span>
        <span className="hidden sm:inline">{t('app.help.button')}</span>
      </button>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Primary column: log illustration + cut controls. First on every
            viewport so the operator's main working surface is never pushed
            below the fold. */}
        <div className="space-y-3 order-1">
          <EndView plan={plan} blade={blade} remainingPlanks={remainingPlanks} />
          {/* Cone-compensation banner sits UNDER the illustration so it
              mirrors the physical workshop layout — the support blocks
              are beneath the log, and "lower the root support" advice
              naturally belongs there. The Row-1 cone pill inside
              Controls (below) shows the drop number so the sawyer sees
              it right next to the blade height; this banner keeps the
              tilted-log figure for spatial context. */}
          <ConeBanner cone={cone} log={plan.log} rotationDeg={plan.rotationDeg} />
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
            cone={cone}
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
          {/* Log measurements sit immediately below the Controls card
              so a fresh log's primary data-entry panel is the first
              thing the sawyer sees after completing a log, without
              having to glance across to the sidebar. Keeps the
              illustration-first primary column intact. */}
          <Collapsible
            id="log"
            title={t('panel.log')}
            summary={logSummary}
            defaultOpen={defaultOpen}
            accent="wood"
          >
            <LogForm
              log={plan.log}
              onChange={setLog}
              settings={plan.settings}
              onSettingsChange={setSettings}
              onDone={onLogMeasurementsDone}
            />
          </Collapsible>
          {/* The log report is useful but not essential mid-cut — tuck it
              behind a collapsible on every viewport so it never steals focus
              from the illustration. */}
          <Collapsible
            id="edging"
            title={t('panel.edging')}
            summary={t(
              plan.settings.cuttingTool === 'chain'
                ? 'panel.edging.summary.chain'
                : 'panel.edging.summary.blade'
            )}
            defaultOpen={false}
            accent="forest"
          >
            <EdgingGuide plan={plan} remainingPlanks={remainingPlanks} />
          </Collapsible>
          <Collapsible
            id="summary"
            title={t('panel.report')}
            summary={t('panel.report.summary', {
              cuts: plan.cuts.length,
              produced: plan.produced.length
            })}
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
            id="priority"
            title={t('panel.priority')}
            summary={prioritySummary}
            defaultOpen={defaultOpen}
            accent="forest"
          >
            <PriorityList
              list={plan.priorityList}
              strategy={plan.settings.strategy}
              onChange={setPriority}
            />
          </Collapsible>

          <Collapsible
            id="settings"
            title={t('panel.settings')}
            summary={settingsSummary}
            defaultOpen={defaultOpen}
            accent="steel"
          >
            <SettingsForm settings={plan.settings} onChange={setSettings} />
          </Collapsible>

          {/* Log history: completed logs accumulate here (most recent
              first) every time the sawyer taps "Start next log". The
              panel is always collapsed by default so an empty archive
              doesn't waste space; the summary line shows the count so
              users know the panel has something in it without opening. */}
          <Collapsible
            id="history"
            title={t('panel.history')}
            summary={
              archive.length === 0
                ? t('panel.history.summary.empty')
                : archive.length === 1
                  ? t('panel.history.summary.one', { n: archive.length })
                  : t('panel.history.summary.many', { n: archive.length })
            }
            defaultOpen={false}
            accent="wood"
          >
            <LogHistory
              archive={archive}
              onRemove={removeEntry}
              onClear={clearAll}
              onReopen={(entry) => loadSnapshot(entry.plan)}
            />
          </Collapsible>

          {/* App settings — cross-cutting UI preferences that aren't
              tied to a specific log or saw. Currently just the
              language picker, but the panel is the natural future
              home for theme / unit / accessibility toggles. Closed
              by default because once language is set most users
              never touch it again. The summary shows the active
              language's native name so the panel announces its
              state without expanding. */}
          <Collapsible
            id="app-settings"
            title={t('panel.app')}
            summary={t('panel.app.summary', {
              lang:
                LOCALES.find((l) => l.code === locale)?.label ?? locale
            })}
            defaultOpen={false}
            accent="steel"
          >
            <AppSettingsForm />
          </Collapsible>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto p-4 text-xs text-stone-500">
        <p>{t('app.footer.units')}</p>
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

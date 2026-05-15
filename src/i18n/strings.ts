/**
 * Locale-aware translation tables.
 *
 * Design notes:
 * - One flat record per locale, keyed by short stable identifiers
 *   like `"app.title"` or `"logForm.spacing.label"`. Flat, not nested,
 *   so call sites stay one short string lookup with no `.` traversal
 *   plumbing.
 * - English (`en`) is the source of truth; Swedish (`sv`) mirrors
 *   each key exactly. The `Strings` type is derived from `en` so
 *   TypeScript flags any sv key that goes missing or any en key that
 *   doesn't exist on sv. Adding a new key means: add to `en`, then
 *   the type checker forces you to add it to `sv` too.
 * - Strings with runtime values use simple `{name}` placeholders that
 *   the `t()` helper substitutes. Keeps the call site free of string
 *   concatenation while avoiding a templating dependency.
 * - Rich content (paragraphs of help, JSX-formatted prose) is *not*
 *   translated here — those live as React subtrees in their own
 *   components. The HelpModal in particular stays English-only for
 *   now; everything else (forms, banners, controls, summaries) is
 *   fully translated.
 */

export type Locale = 'en' | 'sv';

export const LOCALES: Array<{ code: Locale; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' }
];

const en = {
  // ── App shell ──
  'app.title': 'Northern Lights Sawmill Planner',
  'app.help.button': 'Help',
  'app.help.title': 'How does the planner work?',
  'app.help.aria': 'Open help',
  'app.footer.units':
    'Log measurements in cm, mill settings and plank dimensions in mm. Data is saved in your browser.',

  // ── Collapsible panel titles ──
  'panel.log': 'Log measurements',
  'panel.edging': 'Edging guide',
  'panel.report': 'Log report',
  'panel.priority': 'Preferred dimensions',
  'panel.settings': 'Mill settings',
  'panel.history': 'Log history',
  'panel.app': 'App settings',

  // ── Panel summaries ──
  'panel.edging.summary.chain': 'Chain heights for the second-pass width trim',
  'panel.edging.summary.blade': 'Blade heights for the second-pass width trim',
  'panel.report.summary': '{cuts} cuts · {produced} sawn',
  'panel.priority.summary': '{enabled}/{total} enabled',
  'panel.settings.summary': 'kerf {kerf} · bark {bark}',
  'panel.history.summary.empty': 'no logs yet',
  'panel.history.summary.one': '{n} log archived',
  'panel.history.summary.many': '{n} logs archived',

  // ── LogForm ──
  'logForm.intro':
    'Measure the log diameter at each of the two supports underneath it. The app extrapolates the taper to the log ends.',
  'logForm.rootDiameter': 'Root-side Ø at support (cm)',
  'logForm.topDiameter': 'Top-side Ø at support (cm)',
  'logForm.spacing': 'Distance between supports (cm)',
  'logForm.spacing.invalid': '⚠ must be > 0 and < log length',
  'logForm.spacing.hint': '{cm} cm sticks out past each support.',
  'logForm.length': 'Log length (cm)',
  'logForm.sweep': 'Worst sweep / curvature (cm)',
  'logForm.sweep.hint.zero':
    'String-line offset at the worst point. Leave 0 for straight logs.',
  'logForm.sweep.hint.active':
    'Effective design Ø shrinks to {effective} cm (was {straight} cm).',
  'logForm.extrapolated': 'Extrapolated ends:',
  'logForm.extrapolated.invalid': 'need support spacing > 0',
  'logForm.extrapolated.values': 'root {root} cm · top {top} cm',
  'logForm.curve.advisory.label': 'Curved log:',
  'logForm.curve.advisory':
    'roll it so the highest point of the bow is on top (ends drooping toward the bed) before the first cut. The first slab will shave off the apex and leave a flat reference face.',
  'logForm.species': 'Species',
  'logForm.species.pine': 'Pine',
  'logForm.species.spruce': 'Spruce',
  'logForm.species.fir': 'Fir',
  'logForm.species.larch': 'Larch',
  'logForm.species.birch': 'Birch',
  'logForm.species.aspen': 'Aspen',
  'logForm.species.alder': 'Alder',
  'logForm.species.oak': 'Oak',
  'logForm.species.beech': 'Beech',
  'logForm.bark': 'Bark thickness (mm)',
  'logForm.bark.default': 'Species default: {n} mm',
  'logForm.bark.overridden': 'Species default {n} mm — overridden.',
  'logForm.strategy': 'Strategy',
  'logForm.strategy.priority': 'Strict priority — fill #1 first, then #2, …',
  'logForm.strategy.value': 'Maximize value — pick the highest-scoring set',
  'logForm.strategy.minWaste': 'Minimize waste — pick the tightest-fitting set',
  'logForm.strategy.minCup': 'Minimize cup — quartersawn-friendly placement',
  'logForm.done': 'OK, back to cutting',
  'logForm.done.disabledTitle': 'Fix the support spacing first',
  'logForm.done.title': 'Close this panel and jump back to the Cut button',
  'logForm.stepper.dec.aria': 'Decrease {label} by 1 cm',
  'logForm.stepper.inc.aria': 'Increase {label} by 1 cm',
  'logForm.bark.dec.aria': 'Decrease bark thickness by 1 mm',
  'logForm.bark.inc.aria': 'Increase bark thickness by 1 mm',

  // ── PriorityList ──
  'priority.intro':
    'Drag to reorder. Higher = higher priority. {enabled}/{total} enabled.',
  'priority.hideDisabled': 'Hide disabled',
  'priority.showAll': 'Show all ({n})',
  'priority.add': '+ Add',
  'priority.restoreDefaults': '↺ Restore defaults',
  'priority.restoreDefaults.title':
    'Replace the list with the built-in default dimensions',
  'priority.restoreDefaults.confirm':
    'Restore the default preferred-dimensions list? Your current customisations (order, enabled state, custom rows) will be replaced.',
  'priority.enableAll': 'enable all',
  'priority.enableNone': 'none',
  'priority.empty': 'No entries visible. Toggle "Show all" to see disabled rows.',
  'priority.moveUp': 'Move up',
  'priority.moveDown': 'Move down',
  'priority.enabled': 'Enabled',
  'priority.label.placeholder': 'label (optional)',
  'priority.remove': 'Remove',
  'priority.dup.badge': 'dup',
  'priority.dup.title':
    'Another row earlier in the list has the same thickness × width. The layout will treat them as interchangeable candidates — usually you want only one row per dimension.',
  'priority.thickness': 'thickness (mm)',
  'priority.width': 'width (mm)',
  'priority.value.label': 'value',
  'priority.value.score': 'value score',
  'priority.times': '×',
  'priority.dec.aria': 'Decrease {label} by {step}',
  'priority.inc.aria': 'Increase {label} by {step}',

  // ── SettingsForm ──
  'settings.kerf': 'Kerf (mm)',
  'settings.minSlab': 'Min slab (mm)',
  'settings.edgeClearance': 'Edge clearance (mm)',
  'settings.edgeClearance.hint': 'Extra inset from bark to avoid wane',
  'settings.cuttingTool': 'Cutting tool',
  'settings.cuttingTool.hint': 'Cosmetic only — label used in the UI for your saw',
  'settings.cuttingTool.chain': 'Chain (chainsaw mill)',
  'settings.cuttingTool.blade': 'Blade (bandsaw mill)',
  'settings.autoRotate.title': 'Auto-rotate during squaring',
  'settings.autoRotate.body':
    'After each of the first four squaring slabs, the log spins automatically to the next face (0° → 90° → 180° → 270°) so the NEXT pill and height readout preview the next setup. Uncheck to rotate manually — the planner will then hint "Rotate to X° first" when you\'re off the recommended face.',
  'settings.dec.aria': 'Decrease {label} by {step}',
  'settings.inc.aria': 'Increase {label} by {step}',

  // ── ConeBanner ──
  'cone.lowerRoot': 'Lower root-side support by',
  'cone.mm': 'mm',
  'cone.resolved': 'Cone resolved',
  'cone.resolved.body': '— no support drop needed at this rotation.',
  'cone.resolved.curve': '— bow follows the log rotation.',
  'cone.tooltip.resolved':
    'Cone resolved — two cuts 180° apart, the pith is horizontal between the supports.',
  'cone.tooltip.bedFlat':
    'Log rests on a flat cut face — the taper is already compensated at this rotation, so no further drop is needed here.',
  'cone.tooltip.noDrop':
    'Measured diameters match (or root is smaller) — no support drop needed yet.',
  'cone.aria.straight':
    'Log on supports, lower root by {mm} millimetres',
  'cone.aria.curved':
    'Curved log on supports, lower root by {mm} millimetres',
  'cone.aria.straight.equal': 'Log on supports, both ends equal',
  'cone.aria.curved.equal': 'Curved log on supports, both ends equal',

  // ── Controls ──
  'controls.cut': '↓ Cut',
  'controls.cut.disabled.title':
    'Set the chain / blade above the bed line first',
  'controls.cut.title': 'Record this cut and update the illustration',
  'controls.finish': '✓ Lift final plank',
  'controls.finish.title':
    'The last plank is on the bed. Tap to record it as produced.',
  'controls.undo': '↑ Undo',
  'controls.redo': '↷ Redo',
  'controls.reset': 'Reset cuts',
  'controls.reset.confirm':
    'Reset all cuts and rotations on this log? The log measurements and Mill settings stay put.',
  'controls.rotateLeft': '⟲ 90°',
  'controls.rotateRight': '90° ⟳',
  'controls.rotation': 'top {deg}°',
  'controls.bladeReadout.chain': 'Set chain height',
  'controls.bladeReadout.blade': 'Set blade height',
  'controls.bladeReadout.aboveBed': 'above the bed',
  'controls.next': 'NEXT',
  'controls.next.squaring': 'Squaring slab ({i} of {total})',
  'controls.next.plank': 'Plank cut → {label}',
  'controls.next.done': 'Log complete',
  'controls.next.idle': 'Set a height',
  'controls.next.rotateHint': '↻ Rotate to {deg}° first',
  'controls.cone.pill.active': 'lower root {mm} mm',
  'controls.cone.pill.resolved': 'cone OK',
  'controls.logComplete': 'Log complete',
  'controls.startNextLog': '↻ Start next log',
  'controls.startNextLog.title':
    'Archive this log and clear the planner for the next one',

  // ── EndView legend ──
  'endView.legend.bark': 'bark {mm} mm',
  'endView.legend.kerf': 'kerf {mm} mm',
  'endView.legend.chain': 'chain',
  'endView.legend.blade': 'blade',
  'endView.legend.bed': 'bed',
  'endView.legend.straightLogD': 'straight-log Ø (−{mm} mm)',
  'endView.legend.straightLogD.title':
    'Where the design circle would be on a straight log. The annulus between this ring and the dark dashed design circle is what curvature costs you in usable diameter.',
  'endView.svgLabel.straightLogD': 'straight-log Ø',
  'endView.svgLabel.sweep': 'sweep {mm} mm',
  'endView.svgLabel.shrink': '−{mm} mm Ø',
  'endView.aria': 'End view of the log with planned planks',
  'endView.bedLabel': 'bed',
  'endView.rotationLabel': 'top {deg}°',

  // ── Summary ──
  'summary.taper': 'Taper',
  'summary.taperPerM': '{mm} mm/m',
  'summary.rootEnd': 'Root end Ø',
  'summary.topEnd': 'Top end Ø',
  'summary.designD': 'Design Ø',
  'summary.length': 'Length',
  'summary.volume': 'Volume',
  'summary.cuts': 'Cuts made',
  'summary.yield': 'End-view yield',
  'summary.planks.heading': 'Planks',
  'summary.planks.planned': 'planned',
  'summary.planks.sawn': 'sawn',

  // ── LogHistory ──
  'history.empty.line1': 'No archived logs yet.',
  'history.empty.line2':
    'Each completed log lands here when you tap "Start next log".',
  'history.totalVolume': 'Total volume',
  'history.totalPlanks': 'Total planks sawn',
  'history.exportCsv': 'Export CSV',
  'history.clearAll': 'Clear all',
  'history.clearAll.confirm':
    'Delete all archived logs? This cannot be undone (export a CSV first if you want to keep the data).',
  'history.entry.reopen': 'Reopen',
  'history.entry.reopen.title':
    'Load this log back into the planner. Your current plan will be replaced; archive it first if it\'s not done yet.',
  'history.entry.reopen.confirm':
    'Reopen this archived log? Your current in-progress plan will be replaced.',
  'history.entry.delete': 'Delete',
  'history.entry.delete.title': 'Delete this archived log',
  'history.entry.delete.confirm': 'Delete this archived log? Cannot be undone.',
  'history.entry.cuts': '{n} cuts',
  'history.entry.planks': '{n} planks',
  'history.entry.completedAt': 'Completed {when}',
  'history.entry.species': 'Species: {s}',

  // ── Splash screen ──
  'splash.title': 'Welcome',
  'splash.body':
    'A planner for sawing pine, spruce and birch logs on a single-blade chainsaw or bandsaw mill. Plan your cuts, track your yield, and never crank the wrong blade height again.',
  'splash.startSawing': 'Start sawing',
  'splash.howItWorks': 'How does it work?',

  // ── PWA ──
  'pwa.offline': 'App is ready to work offline.',
  'pwa.update.title': 'A new version is available.',
  'pwa.update.button': 'Reload',
  'pwa.dismiss': 'Dismiss',

  // ── Language picker (lives inside the App settings panel) ──
  'lang.label': 'Language',
  'panel.app.summary': '{lang}',
  'panel.app.intro':
    'Settings that affect the planner UI itself, not any specific log or saw. Stored in this browser only.',

  // ── Help button stays in English helpers (HelpModal is en-only)
  'help.englishOnlyNotice': 'Help is currently English-only.',

  // ── HelpModal: header / hero / lead ──
  'help.title': 'Northern Lights Sawmill Planner',
  'help.close.aria': 'Close help',
  'help.hero.alt':
    'The physical sawmill this planner was built for: a bandsaw mill under a freshly-built open timber shelter with a red-painted workshop behind, two pine logs queued on the infeed bunk ready to saw.',
  'help.hero.caption':
    'The mill this planner was built for — logs queued on the infeed bunk, ready to saw.',
  'help.lead':
    'A typical session, top to bottom. Click any step below to expand it for the full details.',
  'help.back': 'Back to planner',

  // ── HelpModal: Quick guidance ──
  'help.quick.heading': 'Quick guidance',
  'help.quick.1':
    '**Measure** the log — diameter at each support, distance between supports, length, sweep (string-line offset).',
  'help.quick.2': '**Pick species** — bark thickness auto-fills.',
  'help.quick.3':
    '**Pick a strategy** — Strict priority / Maximize value / Minimize waste / Minimize cup.',
  'help.quick.4':
    '**Read the cone banner** — lower the root-side support by the shown mm if needed.',
  'help.quick.5': '**Roll the log** if curved — apex of the bow on top.',
  'help.quick.6':
    '**Square the cant** — four slabs, the app cycles 0° → 90° → 180° → 270° for you.',
  'help.quick.7':
    '**Plank top-to-bottom** — set the height the app shows, cut, repeat. Rotate when a face is empty.',
  'help.quick.8':
    '**Finish** the log — tap *Lift final plank*, then *Start next log*.',
  'help.quick.persists':
    'Mill settings and Preferred dimensions persist between logs — you only set them up once.',

  // ── HelpModal: Step 1 — Measure ──
  'help.step1.title': 'Measure your log',
  'help.step1.p1':
    'Sit the log on its two supports. With a diameter tape or calipers, measure the **Ø at each support** — one near the root (thicker) end and one near the top (thinner) end.',
  'help.step1.p2':
    'Open the **Log measurements** pane and enter both values in centimetres, then the **distance between supports** and the **log length**, both in cm. The app shows what sticks out past each support as a sanity check, and computes the extrapolated end diameters, taper and volume automatically. All four fields have big **− / +** stepper buttons that snap to whole-cm so you can dial them in with a thumb on a tablet.',
  'help.step1.p3':
    "**Worst sweep / curvature** — if the log isn't straight, stretch a string line between the two ends and measure the biggest gap from the string to the bark. Enter that number in cm. Leave at 0 for a straight log. The app will:",
  'help.step1.li1':
    "**Shrink the design diameter** by 2× the sweep, since a full-length plank inside a curved log can't use the wood near the bark on the concave side.",
  'help.step1.li2':
    '**Show the lost ring** in the cross-section illustration — a faint red dashed circle for "straight-log Ø" with the annulus between it and the actual design Ø highlighted, plus a red *−N mm Ø* callout in the corner so you see the cost as a number too.',
  'help.step1.li3':
    '**Add a "Curved log" advisory** with a small icon reminding you to roll the log so the apex of the bow is on top before the first cut.',
  'help.step1.p4':
    "**Species** — pick from 9 built-in choices (pine, spruce, fir, larch, birch, aspen, alder, oak, beech). Each has a little tree icon next to the dropdown for visual confirmation. Picking a species auto-fills **Bark thickness** with that species' typical value (pine 12 mm, spruce 8 mm, oak 15 mm, birch 6 mm, etc.) — the bark stepper still lets you override it, and the hint shows whether the value matches the species default or has been customised.",

  // ── HelpModal: Step 2 — Cone banner ──
  'help.step2.title': 'Read the cone-compensation banner',
  'help.step2.p1':
    'Below the illustration, an amber banner with a small side-view of your log on its supports tells you how many millimetres to **lower the root-side support**. Doing so aligns the **pith** horizontally between the supports so your first cut is parallel to the centre line, not the bark.',
  'help.step2.p2':
    "Once you've cut two reference faces 180° apart, the banner turns forest-green **\"Cone resolved\"**. If the log already rests on a flat cut face, or the diameters happen to be equal, the banner is also green — different reasons, same outcome: no support drop needed right now. Hover the banner for the underlying state in a tooltip.",
  'help.step2.p3':
    'When the log has sweep, the side-view in the banner draws the log **curved** (apex up, ends drooping toward the supports) instead of straight, so you can see the bow at a glance even after the cone is resolved. The bow is a schematic indicator — it stays visible regardless of how the cross-section is currently rotated.',

  // ── HelpModal: Step 3 — Preferred dimensions ──
  'help.step3.title': 'Pick your preferred plank dimensions',
  'help.step3.p1':
    'Open **Preferred dimensions**. The list ships with the full Swedish dimension catalogue (25 / 38 / 50 / 63 / 75 / 100 / 125 / 150 / 175 / 200 / 225 / 250 / 300 mm thickness families). Each row is a card with:',
  'help.step3.li1':
    '**▲ / ▼** position arrows on the left to reorder (drag-and-drop also works). When the "Hide disabled" filter is on, the arrows step through visible rows only.',
  'help.step3.li2':
    '**Enabled checkbox** — uncheck to keep a size in the list without including it in the next layout.',
  'help.step3.li3':
    '**Label** field — defaults to "width×thickness" but you can rename it (e.g. "decking", "studs"). Custom labels flow through to the produced planks in the cross-section.',
  'help.step3.li4':
    '**Big − / + steppers** on both sides of the thickness and width inputs. Steps in 5 mm. Both-sided steppers mean your left thumb decreases and right thumb increases regardless of which hand holds the tablet.',
  'help.step3.li5':
    "**DUP badge** — appears in amber if another row earlier in the list has the same thickness × width, so duplicates aren't silent.",
  'help.step3.p2':
    'Drag to reorder (higher = higher priority), or tap **+ Add** for a missing dimension. **↺ Restore defaults** brings the full list back. Choices are saved in this browser.',

  // ── HelpModal: Step 4 — Strategy ──
  'help.step4.title': 'Pick a layout strategy',
  'help.step4.p1':
    'Below the species/bark row in **Log measurements**, the **Strategy** dropdown decides how the planner fills the log. Strategy is a per-log choice — the same physical mill can run different strategies for different jobs:',
  'help.step4.li1':
    '**Strict priority** (default) — places your #1 spec wherever it fits, then #2 for the gaps, and so on. The spec at the top of the list always becomes the central cant if it fits.',
  'help.step4.li2':
    '**Maximize value** — you fill in a *value* number next to each spec (a price, a weight, anything you want to rank by). The planner trials *every* enabled spec as the central cant and keeps the layout with the highest total value — often a different cant than "Strict priority" would pick.',
  'help.step4.li3':
    '**Minimize waste** — same "try every cant" pass, but the winner is the layout whose planks cover the most area of the log cross-section. Ignores list order and value; the biggest fitting rectangles win.',
  'help.step4.li4':
    "**Minimize cup** — quartersawn-friendly placement. Targets *cup*, the dominant drying defect: planks close to the pith resist cup; wide flat-sawn planks far from the pith cup the most. Yield (used area) leads, and cup-resistance breaks ties between near-equal-area layouts. The risk score is weighted by the species' tangential / radial shrinkage ratio (birch and aspen cup hardest, pine and larch are mildest), and planks that cover the pith zone get a small extra penalty because that wood is juvenile and unstable in service. Note: this strategy targets cup only — it can't predict bow or twist, which depend on the tree's reaction wood and drying conditions.",

  // ── HelpModal: Step 5 — Square the cant ──
  'help.step5.title': 'Square the cant (first four slabs)',
  'help.step5.p1':
    'A fresh round log always starts with **four squaring slabs**, one per face. The **NEXT** pill walks you through them as *"Squaring slab (1 of 4)"* … *"(4 of 4)"*, cycling the recommended rotation 0° → 90° → 180° → 270°. After the fourth slab you have a square cant with four flat faces and no bark — only then does the planner start freeing planks.',
  'help.step5.p2':
    'The big **Set chain / blade height** readout shows the number you crank into the mill — distance from the bed to the saw, in mm. Set the mill to that height, make the cut, then tap the big red **↓ Cut** button to record it. Rolling or repositioning the log on the bed is still your job; the app only tracks the cuts.',
  'help.step5.p3':
    'By default **Auto-rotate during squaring** is on (Mill settings): the moment you tap Cut, the illustration rotates the log 90° to the next face so the NEXT pill, the height readout and the end-view all preview the next setup. Physically reposition the log to match, then tap Cut again. After the fourth slab the log auto-rotates once more — straight to the best planking face — so you can keep going without a manual spin.',
  'help.step5.p4':
    'Prefer to rotate manually? Turn the toggle off. The log will stay at whatever rotation you set, and the NEXT pill will remind you *"Rotate to 90° first"* whenever you drift off the recommended face.',
  'help.step5.tip':
    "Tip: if you're running a bandsaw mill, switch **Cutting tool** under Mill settings from *Chain* to *Blade* — the UI labels will follow.",
  'help.squaring.aria':
    'Diagram of the four squaring slabs: the round log with cut 1 across the top, cut 2 on the right, cut 3 across the bottom, cut 4 on the left — the order produced by the auto-rotate workflow.',
  'help.squaring.caption':
    'Four squaring slabs, in the order the auto-rotate workflow takes them: top → right → bottom → left.',

  // ── HelpModal: Step 6 — Plank top-to-bottom ──
  'help.step6.title': 'Plank top-to-bottom',
  'help.step6.p1':
    'Once the cant is squared, the NEXT pill switches to *"Plank cut → 150×50"* and works down the face with the tallest remaining stack. Because every plank\'s top edge is now flush with the squared face above it, **each plank comes off in a single cut** — no waste slab in between. The illustration and the big height readout update after every cut so you never have to guess the next crank setting.',
  'help.step6.p2':
    "When one face is empty, rotate 180° (or 90°) to reach the next stack. If you rotate to a face the planner didn't pick, the NEXT pill adds a small *↻ Rotate to X°* hint — follow it or ignore it, the height readout tracks whichever face you chose.",
  'help.step6.p3':
    'Planks that were fully inside the squared cant come off clean. Side boards and the first / last plank on any face often keep a bit of **wane** (bark-edge curvature) on one or two sides — check the **Edging guide** below the Controls for the second-pass widths that trim them square.',

  // ── HelpModal: Step 7 — Rotate / undo / redo ──
  'help.step7.title': 'Rotate, undo, redo',
  'help.step7.p1':
    'Use **⟲ 90°** / **90° ⟳** to spin the log manually at any time. Rotating is free — it doesn\'t use an undo slot. The illustration shows your current rotation ("top 0°" label above the log) and which planks are still to cut.',
  'help.step7.p2':
    'Made a mistake? **↑ Undo** rewinds the last cut or rotation, **↷ Redo** replays it. You get 50 steps of history.',

  // ── HelpModal: Step 8 — Finish ──
  'help.step8.title': 'Finish the log and start the next',
  'help.step8.p1':
    'When the last plank is the one sitting on the bed, the button turns green and reads **✓ Lift final plank**. Tap it to record the plank as produced.',
  'help.step8.p2':
    'Once every planned plank is sawn, the whole Controls card flips into a **Log complete** banner with a big green **↻ Start next log** button. Tap that to clear the cut history and jump into the Log measurements pane for your next log. Mill settings and Preferred dimensions stay put — only the log data changes.',
  'help.step8.p3':
    'The completed log is archived automatically into the **Log history** panel in the sidebar — with its dimensions, cuts, produced planks and yield. The archive keeps the last 50 logs and is stored in this browser only (no server, no account). Expand the panel to see aggregate stats (total volume, per-size plank totals), **Reopen** any past log into the planner, delete individual entries, or **Export CSV** of everything for your records.',

  // ── HelpModal: Step 9 — Yield ──
  'help.step9.title': 'Check your yield',
  'help.step9.p1':
    'Expand **Log report** (below the Cut button) any time to see taper, root / top Ø, volume, cuts made, end-view yield %, and a per-size tally of planks planned vs. actually sawn.',

  // ── HelpModal: Keyboard ──
  'help.keyboard.heading': 'Keyboard',
  'help.keyboard.esc.key': 'Esc',
  'help.keyboard.esc.body':
    "Closes this help dialog (and the first-run splash). That's the only app-wide shortcut — everything else is on-screen so the workshop-tablet use case isn't keyboard-dependent.",

  // ── HelpModal: Glossary ──
  'help.glossary.heading': 'Glossary',
  'help.glossary.kerf.t': 'Kerf',
  'help.glossary.kerf.d': 'Width of the cut — sawdust removed per pass.',
  'help.glossary.cant.t': 'Cant',
  'help.glossary.cant.d':
    'The squared-off centre of the log after the first slab cuts.',
  'help.glossary.slab.t': 'Slab',
  'help.glossary.slab.d':
    'The rounded waste piece cut off before you reach good plank stock.',
  'help.glossary.coneResolved.t': 'Cone resolved',
  'help.glossary.coneResolved.d':
    'Two faces cut 180° apart — the pith is now horizontal, taper is "beaten".',
  'help.glossary.designD.t': 'Design Ø',
  'help.glossary.designD.d':
    'The largest cylinder a full-length plank must fit inside. Equals the smaller end Ø, minus 2× sweep on a curved log.',
  'help.glossary.sweep.t': 'Sweep',
  'help.glossary.sweep.d':
    'Worst-case bow of the log along its length, measured as the offset between a string line tied between the two ends and the bark at the worst point.',
  'help.glossary.pith.t': 'Pith',
  'help.glossary.pith.d':
    "The geometric centre of the log, roughly where the tree's original growth axis ran. Planks straddle or flank it.",
  'help.glossary.quartersawn.t': 'Quartersawn',
  'help.glossary.quartersawn.d':
    'A plank whose wide face is roughly radial (points at the pith). Resists cup. Targeted by the Minimize cup strategy.',
  'help.glossary.flatsawn.t': 'Flat-sawn',
  'help.glossary.flatsawn.d':
    'A plank whose wide face is roughly tangent to the rings. Cups the most as it dries.',
  'help.glossary.cup.t': 'Cup',
  'help.glossary.cup.d':
    'Concave / convex bow across the width of a plank as it dries. Worst on wide flat-sawn planks far from the pith.',
  'help.glossary.wane.t': 'Wane',
  'help.glossary.wane.d':
    "Bark edge or missing corner on a plank that wasn't fully inside the squared cant. Trimmed away in a second pass.",
  'help.glossary.edging.t': 'Edging',
  'help.glossary.edging.d':
    "The second-pass cut that trims a plank's wane side(s) to its target width. Plan is in the Edging guide.",
  'help.glossary.rootTop.t': 'Root / top end',
  'help.glossary.rootTop.d':
    'Root = wider, tree-base end. Top = narrower, crown end.'
};

type Strings = typeof en;

const sv: Strings = {
  // ── App shell ──
  'app.title': 'Northern Lights såg-planerare',
  'app.help.button': 'Hjälp',
  'app.help.title': 'Hur fungerar planeraren?',
  'app.help.aria': 'Öppna hjälp',
  'app.footer.units':
    'Stockmått i cm, sågens inställningar och plankdimensioner i mm. Data sparas i din webbläsare.',

  // ── Collapsible panel titles ──
  'panel.log': 'Stockmått',
  'panel.edging': 'Kantsågsguide',
  'panel.report': 'Stockrapport',
  'panel.priority': 'Önskade dimensioner',
  'panel.settings': 'Såginställningar',
  'panel.history': 'Stockhistorik',
  'panel.app': 'App-inställningar',

  // ── Panel summaries ──
  'panel.edging.summary.chain': 'Kedjehöjder för andra passets breddtrim',
  'panel.edging.summary.blade': 'Bladhöjder för andra passets breddtrim',
  'panel.report.summary': '{cuts} skär · {produced} sågade',
  'panel.priority.summary': '{enabled}/{total} aktiva',
  'panel.settings.summary': 'sågspår {kerf} · bark {bark}',
  'panel.history.summary.empty': 'inga stockar än',
  'panel.history.summary.one': '{n} stock arkiverad',
  'panel.history.summary.many': '{n} stockar arkiverade',

  // ── LogForm ──
  'logForm.intro':
    'Mät stockens diameter vid de två stöden under den. Appen extrapolerar avsmalningen till stockens ändar.',
  'logForm.rootDiameter': 'Rotänds-Ø vid stödet (cm)',
  'logForm.topDiameter': 'Toppänds-Ø vid stödet (cm)',
  'logForm.spacing': 'Avstånd mellan stöden (cm)',
  'logForm.spacing.invalid': '⚠ måste vara > 0 och < stocklängd',
  'logForm.spacing.hint': '{cm} cm sticker ut förbi varje stöd.',
  'logForm.length': 'Stocklängd (cm)',
  'logForm.sweep': 'Värsta krökning (cm)',
  'logForm.sweep.hint.zero':
    'Snörlinjens avvikelse vid den värsta punkten. Lämna 0 för raka stockar.',
  'logForm.sweep.hint.active':
    'Effektiv design-Ø krymper till {effective} cm (var {straight} cm).',
  'logForm.extrapolated': 'Extrapolerade ändar:',
  'logForm.extrapolated.invalid': 'stödavstånd måste vara > 0',
  'logForm.extrapolated.values': 'rot {root} cm · topp {top} cm',
  'logForm.curve.advisory.label': 'Krökt stock:',
  'logForm.curve.advisory':
    'rulla den så att bågens högsta punkt är uppåt (ändarna hänger ner mot bädden) före första skäret. Första skivan tar bort toppen och lämnar en plan referensyta.',
  'logForm.species': 'Trädslag',
  'logForm.species.pine': 'Tall',
  'logForm.species.spruce': 'Gran',
  'logForm.species.fir': 'Ädelgran',
  'logForm.species.larch': 'Lärk',
  'logForm.species.birch': 'Björk',
  'logForm.species.aspen': 'Asp',
  'logForm.species.alder': 'Al',
  'logForm.species.oak': 'Ek',
  'logForm.species.beech': 'Bok',
  'logForm.bark': 'Barktjocklek (mm)',
  'logForm.bark.default': 'Trädslagets standard: {n} mm',
  'logForm.bark.overridden': 'Trädslagets standard {n} mm — överskriven.',
  'logForm.strategy': 'Strategi',
  'logForm.strategy.priority': 'Strikt prioritet — fyll #1 först, sedan #2, …',
  'logForm.strategy.value': 'Maximera värde — välj högst poängsatta uppsättning',
  'logForm.strategy.minWaste': 'Minimera spill — välj den tätaste passningen',
  'logForm.strategy.minCup':
    'Minimera koppning — placering vänlig mot kvartersågning',
  'logForm.done': 'OK, tillbaka till sågningen',
  'logForm.done.disabledTitle': 'Åtgärda stödavståndet först',
  'logForm.done.title':
    'Stäng panelen och hoppa tillbaka till Skär-knappen',
  'logForm.stepper.dec.aria': 'Minska {label} med 1 cm',
  'logForm.stepper.inc.aria': 'Öka {label} med 1 cm',
  'logForm.bark.dec.aria': 'Minska barktjocklek med 1 mm',
  'logForm.bark.inc.aria': 'Öka barktjocklek med 1 mm',

  // ── PriorityList ──
  'priority.intro':
    'Dra för att ordna om. Högre = högre prioritet. {enabled}/{total} aktiva.',
  'priority.hideDisabled': 'Dölj inaktiva',
  'priority.showAll': 'Visa alla ({n})',
  'priority.add': '+ Lägg till',
  'priority.restoreDefaults': '↺ Återställ standard',
  'priority.restoreDefaults.title':
    'Ersätt listan med de inbyggda standarddimensionerna',
  'priority.restoreDefaults.confirm':
    'Återställ standardlistan med önskade dimensioner? Dina nuvarande anpassningar (ordning, av/på, egna rader) ersätts.',
  'priority.enableAll': 'aktivera alla',
  'priority.enableNone': 'inga',
  'priority.empty':
    'Inga rader synliga. Slå på "Visa alla" för att se inaktiva rader.',
  'priority.moveUp': 'Flytta upp',
  'priority.moveDown': 'Flytta ner',
  'priority.enabled': 'Aktiv',
  'priority.label.placeholder': 'etikett (valfritt)',
  'priority.remove': 'Ta bort',
  'priority.dup.badge': 'dup',
  'priority.dup.title':
    'En tidigare rad i listan har samma tjocklek × bredd. Layouten behandlar dem som utbytbara — oftast vill du bara ha en rad per dimension.',
  'priority.thickness': 'tjocklek (mm)',
  'priority.width': 'bredd (mm)',
  'priority.value.label': 'värde',
  'priority.value.score': 'värdepoäng',
  'priority.times': '×',
  'priority.dec.aria': 'Minska {label} med {step}',
  'priority.inc.aria': 'Öka {label} med {step}',

  // ── SettingsForm ──
  'settings.kerf': 'Sågspår (mm)',
  'settings.minSlab': 'Minsta skiva (mm)',
  'settings.edgeClearance': 'Kantmarginal (mm)',
  'settings.edgeClearance.hint':
    'Extra avstånd från barken för att undvika vankant',
  'settings.cuttingTool': 'Skärverktyg',
  'settings.cuttingTool.hint':
    'Endast kosmetiskt — etikett som används i UI för din såg',
  'settings.cuttingTool.chain': 'Kedja (motorsågsverk)',
  'settings.cuttingTool.blade': 'Blad (bandsågsverk)',
  'settings.autoRotate.title': 'Auto-rotera under fyrkantsågning',
  'settings.autoRotate.body':
    'Efter var och en av de första fyra skivorna roterar stocken automatiskt till nästa sida (0° → 90° → 180° → 270°) så att NÄSTA-pillen och höjdvärdet förhandsvisar nästa inställning. Avmarkera för att rotera manuellt — planeraren tipsar då "Rotera till X° först" när du är fel sida upp.',
  'settings.dec.aria': 'Minska {label} med {step}',
  'settings.inc.aria': 'Öka {label} med {step}',

  // ── ConeBanner ──
  'cone.lowerRoot': 'Sänk rotsidans stöd med',
  'cone.mm': 'mm',
  'cone.resolved': 'Konen löst',
  'cone.resolved.body': '— ingen sänkning behövs vid denna rotation.',
  'cone.resolved.curve': '— bågen följer stockens rotation.',
  'cone.tooltip.resolved':
    'Konen löst — två skär 180° isär, märgen är vågrät mellan stöden.',
  'cone.tooltip.bedFlat':
    'Stocken vilar på en plan skuren yta — avsmalningen är redan kompenserad i denna rotation, så ingen ytterligare sänkning behövs här.',
  'cone.tooltip.noDrop':
    'De uppmätta diametrarna stämmer (eller roten är mindre) — ingen sänkning behövs ännu.',
  'cone.aria.straight': 'Stock på stöd, sänk roten med {mm} millimeter',
  'cone.aria.curved': 'Krökt stock på stöd, sänk roten med {mm} millimeter',
  'cone.aria.straight.equal': 'Stock på stöd, båda ändarna lika',
  'cone.aria.curved.equal': 'Krökt stock på stöd, båda ändarna lika',

  // ── Controls ──
  'controls.cut': '↓ Skär',
  'controls.cut.disabled.title': 'Ställ kedjan / bladet ovanför bädden först',
  'controls.cut.title': 'Registrera detta skär och uppdatera bilden',
  'controls.finish': '✓ Lyft sista plankan',
  'controls.finish.title':
    'Sista plankan ligger på bädden. Tryck för att registrera den som producerad.',
  'controls.undo': '↑ Ångra',
  'controls.redo': '↷ Gör om',
  'controls.reset': 'Nollställ skär',
  'controls.reset.confirm':
    'Nollställa alla skär och rotationer på denna stock? Stockmåtten och Såginställningar lämnas orörda.',
  'controls.rotateLeft': '⟲ 90°',
  'controls.rotateRight': '90° ⟳',
  'controls.rotation': 'topp {deg}°',
  'controls.bladeReadout.chain': 'Ställ kedjehöjd',
  'controls.bladeReadout.blade': 'Ställ bladhöjd',
  'controls.bladeReadout.aboveBed': 'över bädden',
  'controls.next': 'NÄSTA',
  'controls.next.squaring': 'Fyrkantskiva ({i} av {total})',
  'controls.next.plank': 'Plankskär → {label}',
  'controls.next.done': 'Stocken klar',
  'controls.next.idle': 'Ange en höjd',
  'controls.next.rotateHint': '↻ Rotera till {deg}° först',
  'controls.cone.pill.active': 'sänk rot {mm} mm',
  'controls.cone.pill.resolved': 'kon OK',
  'controls.logComplete': 'Stocken klar',
  'controls.startNextLog': '↻ Starta nästa stock',
  'controls.startNextLog.title':
    'Arkivera denna stock och rensa planeraren för nästa',

  // ── EndView legend ──
  'endView.legend.bark': 'bark {mm} mm',
  'endView.legend.kerf': 'sågspår {mm} mm',
  'endView.legend.chain': 'kedja',
  'endView.legend.blade': 'blad',
  'endView.legend.bed': 'bädd',
  'endView.legend.straightLogD': 'rakstock-Ø (−{mm} mm)',
  'endView.legend.straightLogD.title':
    'Var designcirkeln skulle ligga på en rak stock. Ringen mellan denna och den mörka streckade designcirkeln är vad krökningen kostar dig i användbar diameter.',
  'endView.svgLabel.straightLogD': 'rakstock-Ø',
  'endView.svgLabel.sweep': 'krökning {mm} mm',
  'endView.svgLabel.shrink': '−{mm} mm Ø',
  'endView.aria': 'Ändvy av stocken med planerade plankor',
  'endView.bedLabel': 'bädd',
  'endView.rotationLabel': 'topp {deg}°',

  // ── Summary ──
  'summary.taper': 'Avsmalning',
  'summary.taperPerM': '{mm} mm/m',
  'summary.rootEnd': 'Rotände-Ø',
  'summary.topEnd': 'Toppände-Ø',
  'summary.designD': 'Design-Ø',
  'summary.length': 'Längd',
  'summary.volume': 'Volym',
  'summary.cuts': 'Antal skär',
  'summary.yield': 'Utbyte (ändvy)',
  'summary.planks.heading': 'Plankor',
  'summary.planks.planned': 'planerade',
  'summary.planks.sawn': 'sågade',

  // ── LogHistory ──
  'history.empty.line1': 'Inga arkiverade stockar än.',
  'history.empty.line2':
    'Varje färdig stock hamnar här när du trycker "Starta nästa stock".',
  'history.totalVolume': 'Total volym',
  'history.totalPlanks': 'Totalt antal sågade plankor',
  'history.exportCsv': 'Exportera CSV',
  'history.clearAll': 'Rensa alla',
  'history.clearAll.confirm':
    'Radera alla arkiverade stockar? Detta går inte att ångra (exportera CSV först om du vill behålla datan).',
  'history.entry.reopen': 'Öppna igen',
  'history.entry.reopen.title':
    'Ladda denna stock tillbaka i planeraren. Din nuvarande plan ersätts; arkivera den först om den inte är klar än.',
  'history.entry.reopen.confirm':
    'Öppna denna arkiverade stock igen? Din pågående plan ersätts.',
  'history.entry.delete': 'Radera',
  'history.entry.delete.title': 'Radera denna arkiverade stock',
  'history.entry.delete.confirm':
    'Radera denna arkiverade stock? Går inte att ångra.',
  'history.entry.cuts': '{n} skär',
  'history.entry.planks': '{n} plankor',
  'history.entry.completedAt': 'Klar {when}',
  'history.entry.species': 'Trädslag: {s}',

  // ── Splash screen ──
  'splash.title': 'Välkommen',
  'splash.body':
    'En planerare för att såga tall-, gran- och björkstockar på ett enbladigt motorsågs- eller bandsågsverk. Planera dina skär, följ ditt utbyte, och veva aldrig fel bladhöjd igen.',
  'splash.startSawing': 'Börja såga',
  'splash.howItWorks': 'Hur fungerar det?',

  // ── PWA ──
  'pwa.offline': 'Appen är klar att köra offline.',
  'pwa.update.title': 'En ny version är tillgänglig.',
  'pwa.update.button': 'Ladda om',
  'pwa.dismiss': 'Avfärda',

  // ── Language picker (lives inside the App settings panel) ──
  'lang.label': 'Språk',
  'panel.app.summary': '{lang}',
  'panel.app.intro':
    'Inställningar som påverkar själva planeraren, inte någon specifik stock eller såg. Sparas endast i denna webbläsare.',

  // ── Help button stays in English helpers (HelpModal is en-only)
  'help.englishOnlyNotice': 'Hjälpen finns för närvarande endast på engelska.',

  // ── HelpModal: header / hero / lead ──
  'help.title': 'Northern Lights såg-planerare',
  'help.close.aria': 'Stäng hjälpen',
  'help.hero.alt':
    'Sågverket som denna planerare byggdes för: ett bandsågverk under ett nybyggt öppet timmertak med en rödmålad verkstad bakom, två tallstockar köade på inmatningsbänken, klara att sågas.',
  'help.hero.caption':
    'Sågverket som denna planerare byggdes för — stockar köade på inmatningsbänken, klara att sågas.',
  'help.lead':
    'En typisk arbetsgång, uppifrån och ner. Klicka på valfritt steg nedan för att fälla ut alla detaljer.',
  'help.back': 'Tillbaka till planeraren',

  // ── HelpModal: Quick guidance ──
  'help.quick.heading': 'Snabbguide',
  'help.quick.1':
    '**Mät** stocken — diameter vid varje stöd, avstånd mellan stöden, längd, krökning (snörlinjens avvikelse).',
  'help.quick.2': '**Välj trädslag** — barktjockleken fylls i automatiskt.',
  'help.quick.3':
    '**Välj en strategi** — Strikt prioritet / Maximera värde / Minimera spill / Minimera koppning.',
  'help.quick.4':
    '**Läs konbannern** — sänk rotsidans stöd med visat antal mm vid behov.',
  'help.quick.5': '**Rulla stocken** om den är krökt — bågens topp uppåt.',
  'help.quick.6':
    '**Fyrkanta** stocken — fyra skivor, appen växlar 0° → 90° → 180° → 270° åt dig.',
  'help.quick.7':
    '**Plankor uppifrån-och-ner** — ställ höjden som appen visar, skär, upprepa. Rotera när en sida är tom.',
  'help.quick.8':
    '**Avsluta** stocken — tryck *Lyft sista plankan*, sedan *Starta nästa stock*.',
  'help.quick.persists':
    'Såginställningar och Önskade dimensioner sparas mellan stockar — du ställer in dem bara en gång.',

  // ── HelpModal: Step 1 — Measure ──
  'help.step1.title': 'Mät din stock',
  'help.step1.p1':
    'Lägg stocken på sina två stöd. Med en diametertumstock eller skjutmått, mät **Ø vid varje stöd** — ett nära rotänden (tjockare) och ett nära toppänden (smalare).',
  'help.step1.p2':
    'Öppna panelen **Stockmått** och ange båda värdena i centimeter, sedan **avstånd mellan stöden** och **stocklängd**, båda i cm. Appen visar hur mycket som sticker ut förbi varje stöd som en rimlighetskontroll, och beräknar de extrapolerade ändarnas diameter, avsmalning och volym automatiskt. Alla fyra fälten har stora **− / +**-knappar som snäpper till hela cm så att du kan ställa in dem med en tumme på en surfplatta.',
  'help.step1.p3':
    'Om stocken inte är rak, **värsta krökning** — spänn en snörlinje mellan de två ändarna och mät det största avståndet från snöret till barken. Skriv in det talet i cm. Lämna 0 för en rak stock. Appen kommer att:',
  'help.step1.li1':
    '**Krympa designdiametern** med 2× krökningen, eftersom en planka som går genom hela stocken inte kan utnyttja veden nära barken på den konkava sidan.',
  'help.step1.li2':
    '**Visa den förlorade ringen** i ändvybilden — en svagt röd streckad cirkel för "rakstock-Ø" med ringen mellan den och den verkliga design-Ø markerad, plus en röd *−N mm Ø*-anvisning i hörnet så att du också ser kostnaden som ett tal.',
  'help.step1.li3':
    '**Lägga till en "Krökt stock"-anvisning** med en liten ikon som påminner om att rulla stocken så att bågens högsta punkt är uppåt före första skäret.',
  'help.step1.p4':
    'Du kan **välja trädslag** bland 9 inbyggda alternativ (tall, gran, ädelgran, lärk, björk, asp, al, ek, bok). Var och en har en liten trädsymbol bredvid menyn för visuell bekräftelse. Att välja trädslag fyller automatiskt i **Barktjocklek** med det trädslagets typiska värde (tall 12 mm, gran 8 mm, ek 15 mm, björk 6 mm, etc.) — barksteget kan fortfarande överskridas, och hjälptexten visar om värdet matchar trädslagets standard eller har anpassats.',

  // ── HelpModal: Step 2 — Cone banner ──
  'help.step2.title': 'Läs konkompensationsbannern',
  'help.step2.p1':
    'Under bilden talar en bärnstensfärgad banner med en liten sidovy av stocken på sina stöd om hur många millimeter du ska **sänka rotsidans stöd**. Detta riktar **märgen** vågrätt mellan stöden så att första skäret blir parallellt med centrumlinjen, inte med barken.',
  'help.step2.p2':
    'När du har sågat två referensytor 180° ifrån varandra blir bannern skogsgrön **"Konen löst"**. Om stocken redan vilar på en plan skuren yta, eller om diametrarna råkar vara lika, är bannern också grön — olika orsaker, samma utfall: ingen sänkning behövs just nu. Hovra över bannern för att se det underliggande tillståndet i en hjälpruta.',
  'help.step2.p3':
    'När stocken har krökning ritar sidovyn i bannern stocken **krökt** (topp uppåt, ändarna hänger ner mot stöden) i stället för rak, så att du kan se bågen vid en blick även efter att konen är löst. Bågen är en schematisk indikator — den syns oavsett hur tvärsnittet just nu är roterat.',

  // ── HelpModal: Step 3 — Preferred dimensions ──
  'help.step3.title': 'Välj dina önskade plankdimensioner',
  'help.step3.p1':
    'Öppna **Önskade dimensioner**. Listan levereras med hela det svenska dimensionsregistret (25 / 38 / 50 / 63 / 75 / 100 / 125 / 150 / 175 / 200 / 225 / 250 / 300 mm tjockleksfamiljer). Varje rad är ett kort med:',
  'help.step3.li1':
    '**▲ / ▼**-positionspilar till vänster för att ändra ordning (dra-och-släpp fungerar också). När filtret "Dölj inaktiva" är på går pilarna bara genom synliga rader.',
  'help.step3.li2':
    '**Aktiv-kryssruta** — avmarkera för att behålla en storlek i listan utan att inkludera den i nästa layout.',
  'help.step3.li3':
    '**Etikett**-fält — har som standard "bredd×tjocklek" men kan döpas om (t.ex. "trall", "reglar"). Egna etiketter följer med till de producerade plankorna i tvärsnittet.',
  'help.step3.li4':
    '**Stora − / +-knappar** på båda sidor om tjocklek- och breddfälten. Steg på 5 mm. Knappar på båda sidor betyder att vänstertummen minskar och högertummen ökar oavsett vilken hand som håller surfplattan.',
  'help.step3.li5':
    '**DUP-märke** — visas i bärnsten om en tidigare rad i listan har samma tjocklek × bredd, så att dubbletter inte är tysta.',
  'help.step3.p2':
    'Dra för att ändra ordning (högre = högre prioritet), eller tryck **+ Lägg till** för en saknad dimension. **↺ Återställ standard** tar tillbaka hela listan. Valen sparas i denna webbläsare.',

  // ── HelpModal: Step 4 — Strategy ──
  'help.step4.title': 'Välj en layoutstrategi',
  'help.step4.p1':
    'Under trädslag/bark-raden i **Stockmått** bestämmer rullgardinsmenyn **Strategi** hur planeraren fyller stocken. Strategi är ett val per stock — samma fysiska sågverk kan köra olika strategier för olika jobb:',
  'help.step4.li1':
    '**Strikt prioritet** (standard) — placerar din #1-spec där den passar, sedan #2 i luckorna, och så vidare. Specen överst i listan blir alltid den centrala kärnan om den passar.',
  'help.step4.li2':
    '**Maximera värde** — du fyller i ett *värde* bredvid varje spec (ett pris, en vikt, vad du nu vill rangordna efter). Planeraren provar *varje* aktiv spec som central kärna och behåller den layout som har högst totalvärde — ofta en annan kärna än "Strikt prioritet" skulle välja.',
  'help.step4.li3':
    '**Minimera spill** — samma "prova alla kärnor"-pass, men vinnaren är den layout vars plankor täcker störst yta av stockens tvärsnitt. Ignorerar listordning och värde; de största passande rektanglarna vinner.',
  'help.step4.li4':
    '**Minimera koppning** — placering vänlig mot kvartersågning. Inriktad på *koppning*, den dominerande torkdefekten: plankor nära märgen står emot koppning; breda flatsågade plankor långt från märgen koppar mest. Utbytet (använd yta) leder, och koppningsmotstånd avgör jämna lägen mellan layouter med nästan samma yta. Riskpoängen viktas av trädslagets förhållande mellan tangentiell och radiell krympning (björk och asp koppar hårdast, tall och lärk är mildast), och plankor som täcker märgzonen får ett litet extra straff eftersom den veden är ungvuxen och instabil i bruk. Obs: denna strategi inriktar sig endast på koppning — den kan inte förutse böjning eller vridning, vilka beror på trädets reaktionsved och torkförhållanden.',

  // ── HelpModal: Step 5 — Square the cant ──
  'help.step5.title': 'Fyrkanta stocken (de fyra första skivorna)',
  'help.step5.p1':
    'En färsk rund stock börjar alltid med **fyra fyrkantsskivor**, en per sida. **NÄSTA**-pillen leder dig genom dem som *"Fyrkantskiva (1 av 4)"* … *"(4 av 4)"*, och växlar den rekommenderade rotationen 0° → 90° → 180° → 270°. Efter den fjärde skivan har du en fyrkantskärna med fyra plana sidor och utan bark — först då börjar planeraren frisätta plankor.',
  'help.step5.p2':
    'Den stora utläsningen **Ställ kedjehöjd / bladhöjd** visar talet du vevar in på sågen — avstånd från bädden till sågen, i mm. Ställ in sågen på den höjden, gör skäret, och tryck sedan på den stora röda **↓ Skär**-knappen för att registrera det. Att rulla eller flytta stocken på bädden är fortfarande ditt jobb; appen håller bara reda på skären.',
  'help.step5.p3':
    'Som standard är **Auto-rotera under fyrkantsågning** på (Såginställningar): i samma stund som du trycker Skär roterar bilden stocken 90° till nästa sida så att NÄSTA-pillen, höjdvärdet och ändvyn alla förhandsvisar nästa inställning. Flytta stocken fysiskt så att den matchar och tryck Skär igen. Efter den fjärde skivan auto-roterar stocken en gång till — direkt till den bästa plankningssidan — så att du kan fortsätta utan en manuell rotering.',
  'help.step5.p4':
    'Föredrar du att rotera manuellt? Stäng av reglaget. Stocken behåller då den rotation du ställer, och NÄSTA-pillen påminner *"Rotera till 90° först"* när du är fel sida upp.',
  'help.step5.tip':
    'Tips: om du kör ett bandsågverk, byt **Skärverktyg** under Såginställningar från *Kedja* till *Blad* — UI-etiketterna följer med.',
  'help.squaring.aria':
    'Diagram över de fyra fyrkantsskivorna: den runda stocken med skär 1 över toppen, skär 2 till höger, skär 3 över botten, skär 4 till vänster — i den ordning som auto-roteringsflödet tar dem.',
  'help.squaring.caption':
    'Fyra fyrkantsskivor, i den ordning som auto-roteringsflödet tar dem: topp → höger → botten → vänster.',

  // ── HelpModal: Step 6 — Plank top-to-bottom ──
  'help.step6.title': 'Såga plankor uppifrån-och-ner',
  'help.step6.p1':
    'När kärnan är fyrkantad växlar NÄSTA-pillen till *"Plankskär → 150×50"* och arbetar sig nedåt på den sida som har den högsta återstående stapeln. Eftersom varje plankas övre kant nu ligger jäms med den fyrkantade ytan ovanför, **kommer varje planka loss på ett enda skär** — ingen spillskiva emellan. Bilden och den stora höjdutläsningen uppdateras efter varje skär så du aldrig behöver gissa nästa vevinställning.',
  'help.step6.p2':
    'När en sida är tom, rotera 180° (eller 90°) för att nå nästa stapel. Om du roterar till en sida som planeraren inte valde lägger NÄSTA-pillen till en liten *↻ Rotera till X°*-ledtråd — följ den eller strunta i den, höjdutläsningen följer den sida du valt.',
  'help.step6.p3':
    'Plankor som låg helt inuti den fyrkantade kärnan kommer ut rena. Sidobrädor och första / sista plankan på varje sida behåller ofta lite **vankant** (barkkantskrökning) på en eller två sidor — kolla **Kantsågsguiden** under Kontroller för andra-passets bredder som trimmar dem rätvinkliga.',

  // ── HelpModal: Step 7 — Rotate / undo / redo ──
  'help.step7.title': 'Rotera, ångra, gör om',
  'help.step7.p1':
    'Använd **⟲ 90°** / **90° ⟳** för att snurra stocken manuellt när som helst. Rotering är gratis — den tar inte en ångra-plats. Bilden visar din nuvarande rotation ("topp 0°"-etiketten ovanför stocken) och vilka plankor som återstår att skära.',
  'help.step7.p2':
    'Gjorde du ett misstag? **↑ Ångra** spolar tillbaka det senaste skäret eller rotationen, **↷ Gör om** spelar upp det igen. Du har 50 stegs historik.',

  // ── HelpModal: Step 8 — Finish ──
  'help.step8.title': 'Avsluta stocken och starta nästa',
  'help.step8.p1':
    'När den sista plankan är den som ligger på bädden blir knappen grön och visar **✓ Lyft sista plankan**. Tryck för att registrera plankan som producerad.',
  'help.step8.p2':
    'När alla planerade plankor är sågade slår hela Kontroll-kortet om till en **Stocken klar**-banner med en stor grön **↻ Starta nästa stock**-knapp. Tryck på den för att rensa skärhistoriken och hoppa till panelen Stockmått för nästa stock. Såginställningar och Önskade dimensioner ligger kvar — bara stockdatan ändras.',
  'help.step8.p3':
    'Den färdiga stocken arkiveras automatiskt i panelen **Stockhistorik** i sidofältet — med dimensioner, skär, producerade plankor och utbyte. Arkivet håller de senaste 50 stockarna och sparas endast i denna webbläsare (ingen server, inget konto). Fäll ut panelen för att se sammanställd statistik (total volym, plankantal per storlek), **Öppna igen** valfri tidigare stock i planeraren, radera enskilda poster, eller **Exportera CSV** av allt för dina anteckningar.',

  // ── HelpModal: Step 9 — Yield ──
  'help.step9.title': 'Kolla ditt utbyte',
  'help.step9.p1':
    'Fäll ut **Stockrapport** (under Skär-knappen) när som helst för att se avsmalning, rot- / topp-Ø, volym, antal skär, ändvy-utbyte i %, och en sammanställning per storlek över planerade kontra faktiskt sågade plankor.',

  // ── HelpModal: Keyboard ──
  'help.keyboard.heading': 'Tangentbord',
  'help.keyboard.esc.key': 'Esc',
  'help.keyboard.esc.body':
    'Stänger den här hjälpdialogen (och första-besöks-introt). Det är den enda app-omfattande genvägen — allt annat finns på skärmen så att verkstadssurfplattans användning inte är beroende av tangentbord.',

  // ── HelpModal: Glossary ──
  'help.glossary.heading': 'Ordlista',
  'help.glossary.kerf.t': 'Sågspår',
  'help.glossary.kerf.d': 'Skärbredden — sågspån som tas bort per pass.',
  'help.glossary.cant.t': 'Kärna',
  'help.glossary.cant.d':
    'Stockens fyrkantade mitt efter de första skivskären.',
  'help.glossary.slab.t': 'Skiva',
  'help.glossary.slab.d':
    'Den runda spillbiten som skärs av innan du når bra plankvirke.',
  'help.glossary.coneResolved.t': 'Konen löst',
  'help.glossary.coneResolved.d':
    'Två sidor sågade 180° isär — märgen är nu vågrät, avsmalningen är "besegrad".',
  'help.glossary.designD.t': 'Design-Ø',
  'help.glossary.designD.d':
    'Den största cylinder en helstockslångplank måste få plats inuti. Lika med den mindre änd-Ø, minus 2× krökning på en krökt stock.',
  'help.glossary.sweep.t': 'Krökning',
  'help.glossary.sweep.d':
    'Stockens värsta båge längs sin längd, mätt som avståndet mellan en snörlinje knuten mellan de två ändarna och barken vid den värsta punkten.',
  'help.glossary.pith.t': 'Märg',
  'help.glossary.pith.d':
    'Stockens geometriska centrum, ungefär där trädets ursprungliga växtaxel löpte. Plankor sträcker sig över eller flankerar den.',
  'help.glossary.quartersawn.t': 'Kvartersågat',
  'help.glossary.quartersawn.d':
    'En planka vars breda yta är ungefär radiell (pekar mot märgen). Står emot koppning. Eftersträvas av strategin Minimera koppning.',
  'help.glossary.flatsawn.t': 'Flatsågat',
  'help.glossary.flatsawn.d':
    'En planka vars breda yta är ungefär tangentiell mot årsringarna. Koppar mest när den torkar.',
  'help.glossary.cup.t': 'Koppning',
  'help.glossary.cup.d':
    'Konkav / konvex böj tvärs en plankas bredd när den torkar. Värst på breda flatsågade plankor långt från märgen.',
  'help.glossary.wane.t': 'Vankant',
  'help.glossary.wane.d':
    'Barkkant eller saknat hörn på en planka som inte låg helt inuti den fyrkantade kärnan. Trimmas bort i ett andra pass.',
  'help.glossary.edging.t': 'Kantsågning',
  'help.glossary.edging.d':
    'Det andra-passets skär som trimmar plankans vankantssida(or) till sin målbredd. Planen finns i Kantsågsguiden.',
  'help.glossary.rootTop.t': 'Rotände / toppände',
  'help.glossary.rootTop.d':
    'Rot = bredare, trädbasände. Topp = smalare, krönände.'
};

const TABLES: Record<Locale, Strings> = { en, sv };

/**
 * Translate a key for the given locale, substituting any `{name}`
 * placeholders with the values from `vars`. Missing placeholders are
 * left intact (visible in the UI), and missing keys fall back to the
 * key itself — both are loud, so a sawyer notices and reports rather
 * than seeing silently empty UI.
 */
export function translate(
  locale: Locale,
  key: keyof Strings,
  vars?: Record<string, string | number>
): string {
  const table = TABLES[locale] ?? TABLES.en;
  const raw = table[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

export type TranslationKey = keyof Strings;

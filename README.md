# Sawmill Planner

A mobile/tablet-friendly Progressive Web App that helps you plan and
optimize how to saw a log (pine, spruce, birch) on a single-blade
chainsaw or bandsaw sawmill. Styled after the look of a Nordic chainsaw
mill — galvanised steel frame, signal-red accents, motor-blue details,
and warm wood tones for the log illustration.

## Features

- **Log measurements in cm** — enter the two diameters you measured at
  the supports, the distance between the supports, and the log length.
  The app extrapolates the actual root- and top-end diameters, taper,
  volume, and design diameter automatically.
- **Cone compensation banner** — big red notice telling you how much to
  lower the root-side support so the first cut is parallel to the pith,
  not the bark. Turns neutral grey when no lowering is needed, then
  forest green ("cone resolved") once you have cut two reference faces
  180° apart.
- **Bed-to-saw readout** — large numeric dimension of the chain / blade
  height above the lowest point of the current log shape. This is the
  number you crank into the sawmill. Also drawn as a red dimension line
  on the end-view illustration. Pick whether the UI says "chain" or
  "blade" under Mill settings.
- **Interactive step-cut workflow** — each ↓ Cut actually removes the
  slab above the blade, records which planks were produced, and updates
  the shape so the next blade reading is against the fresh surface.
  Undo / redo always available.
- **Next log flow** — once every planned plank is sawn, the primary
  button turns green and reads *Start next log*. Tapping it clears the
  cut history and auto-opens the Log measurements pane to enter the
  next log's diameters. Mill settings and priority list stay put.
- **Preferred dimensions list** — reorderable, enable-toggle priority
  list of plank dimensions (thickness × width). Ships with the standard
  Swedish dimension catalogue (25/38/50/63/75/100/125/150/175/200/225/
  250/300 mm thickness families) pre-populated; the first eight are
  enabled by default. A *Restore defaults* link brings the full list
  back.
- **Three optimization strategies** selectable in Mill settings:
  - **Strict priority** — greedy, produce as many of #1 first, then #2
    from leftovers, etc. (Default.)
  - **Maximize value** — pick the plank set with the highest total
    value.
  - **Minimize waste** — pick the plank set that leaves least offcut.
- **Live SVG end-view** showing: root-end reference circle (faded, for
  taper context), design circle (dashed), current cross-section
  (filled, updates as you cut), pith, remaining planks in their rotated
  positions, produced planks in green, bed line, blade line with red
  dimension arrow.
- **Collapsible side panels** — Log measurements, Preferred dimensions,
  Mill settings and Log report all collapse independently. State is
  remembered per-panel. On small screens everything collapses by
  default so the illustration and Cut button dominate the viewport.
- **Rotate the log** with ±90° buttons, Undo and Redo.
- All mill settings configurable: kerf (default 6 mm), minimum slab
  thickness, edge clearance, bark thickness, strategy.
- **Offline-first PWA** — installable on iPad / iPhone / Android. Data
  is saved locally in your browser (LocalStorage). No account, no
  server, no tracking.

## Stack

- Vite 8 + React 18 + TypeScript
- Tailwind CSS
- `vite-plugin-pwa` for installability and offline caching
- Vitest for math unit tests

## Getting started

Requires **Node.js 18+**.

```bash
npm install
npm run dev        # development server
npm test           # run unit tests
npm run build      # production build in dist/
npm run preview    # preview the production build
```

Open the dev URL on your phone / tablet (same Wi-Fi). To install as an
app use your browser's "Add to Home Screen" option.

## Deploying to GitHub Pages

This repository is configured to publish automatically to GitHub Pages.

1. **Create the repository on GitHub** named exactly **`sawmill`** (this
   controls the URL — the app is built with `base: '/sawmill/'`). If
   you use a different name, update `BASE` in `vite.config.ts`
   accordingly.
2. **Enable Pages**: on GitHub go to `Settings → Pages` and set
   *Source* to **GitHub Actions**. No branch selection needed.
3. **Push**:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/sawmill.git
   git push -u origin main
   ```

4. Watch the **Actions** tab — the `Deploy to GitHub Pages` workflow
   builds the site and publishes `dist/` to the `github-pages`
   environment. The URL will be `https://<you>.github.io/sawmill/`.
5. Open that URL on your Android tablet in Chrome, then
   *menu → Add to Home screen* to install it as a full-screen offline
   PWA.

Subsequent pushes to `main` redeploy automatically. You can also
trigger a deploy manually from the Actions tab with *Run workflow*.

## Project layout

```
src/
  core/                Pure math and data model (no React imports)
    types.ts           Log / Plank / Cut / Settings types
    taper.ts           Taper, diameter, root-lowering math
    layout.ts          Cant-sawing layout algorithm
    geometry.ts        Polygon clipping helpers
    storage.ts         LocalStorage persistence + defaults
    *.test.ts          Vitest unit tests
  state/
    usePlan.ts         React hook bundling plan state + undo/redo
  components/
    EndView.tsx        SVG end-view renderer
    LogForm.tsx        Log measurement inputs (cm)
    PriorityList.tsx   Drag-to-reorder priority list
    SettingsForm.tsx   Kerf / strategy / etc.
    Controls.tsx       Cut / rotate / undo / redo / next log
    Summary.tsx        Log report (taper, yield, cuts)
    ConeBanner.tsx     Cone compensation notice
    Collapsible.tsx    Reusable expandable pane
  App.tsx              Layout + collapsible orchestration
  main.tsx             Entry
  index.css            Tailwind + mobile tweaks
public/
  favicon.svg
  icon-192.png, icon-512.png, icon-512-maskable.png
  .nojekyll            Stops GitHub Pages from running Jekyll on the build
.github/
  workflows/deploy.yml CI build + GitHub Pages deploy
```

## Math notes

- Measurements are taken at the two supports under the log. A typical
  5 m log with supports 125 cm in from each end gives a 250 cm span
  between supports.
- **Taper per metre** = (root-side Ø − top-side Ø) / supportGap (in m).
- **End diameters** are extrapolated from the support measurements
  along the linear taper.
- **Design diameter** = the smaller of the two extrapolated end
  diameters. All full-length planks must fit inside this circle.
- **Root-lowering** = (root-side Ø − top-side Ø) / 2, taken directly
  from the two support measurements. Lowering the root-side support
  (or raising the top-side one) by this amount aligns the pith
  horizontally between the supports, so the first cut is parallel to
  the centre axis rather than the bark.
- **Log volume** uses the frustum-of-a-cone formula:
  *V = π h (r₁² + r₁·r₂ + r₂²) / 3*.

## Layout algorithm

The cross-section is treated as a circle of the design diameter.
Planks are axis-aligned rectangles inside that circle at the current
rotation.

1. Place the **central cant** — the highest-scoring plank spec whose
   larger dimension still fits across the circle — centred on the pith.
2. **Stack above and below** the cant with planks chosen greedily from
   the priority list, respecting kerf between cuts.
3. Try to place **side boards** (left and right of the cant) and stack
   above / below each side board as well.

This matches the classic cant-sawing workflow a sawyer would follow:
first two slabs to create a top / bottom reference face, rotate 90°,
two more slabs to make a cant, then resaw the cant and edge the side
slabs.

## Extending

Ideas for future versions:

- PDF / image export of the plan
- Per-spec shrinkage / dressing allowance
- Heartwood-avoidance constraint (keep planks outside the pith zone)
- Multiple logs per job and cumulative yield reporting
- Per-species presets (taper defaults, sapwood thickness)
- True 2D bin-packing optimizer for a global optimum
- Import / export JSON jobs

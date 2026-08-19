# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Italian version: see `CHANGELOG.md`.

## [Unreleased]

## [3.12.7] - 2026-08-19

### Fixed
- Resource wells: + and trash buttons on sub-nodes work; well extractions are correctly recognized in calculations

### Changed
- Resource wells: extractor field text left-aligned like other inputs

## [3.12.6] - 2026-08-19

### Changed
- Resource wells: node output is read-only (no editable field); restored per-node extractor slider with aligned rows

## [3.12.5] - 2026-08-19

### Changed
- Resource wells: aligned node rows (no slider under extractors); editable output with production-schema styling and behavior (yellow field + external unit)

## [3.12.4] - 2026-08-19

### Changed
- Resource wells: dedicated node row cards, column headers, readonly output field, and alignment consistent with other extractions

## [3.12.3] - 2026-08-19

### Changed
- Resource wells: top row only output and pressurizer overclock; sub-nodes below with purity, extractors per node, output, and +/× buttons; fixed sliders overlapping labels

## [3.12.2] - 2026-08-19

### Changed
- Resource wells: same config grid as other extractions (output, pressurizer overclock, extractors); extractor count slider restored; per-sub-node purity rows with visible delete button

## [3.12.1] - 2026-08-19

### Changed
- Resource wells: overclock applies to the pressurizer only (one setting for the whole well), with power shards and consumption updated accordingly; extractors have no individual overclock

## [3.12.0] - 2026-08-19

### Added
- Resource wells: per-sub-node purity, +/× buttons to add or remove extractors, schema linking for nitrogen gas too

### Changed
- Resource wells: pressurizer power consumption (150 MW fixed per well at 100% OC, regardless of extractor count)

## [3.11.0] - 2026-08-19

### Added
- Extractions: picker split into Minerals, Fluids, and Resource wells; water and crude oil appear as both pump and well; nitrogen gas added from wells

## [3.10.1] - 2026-08-19

### Changed
- Resource schemas: widened the summary (power/consumption) column by 20%

## [3.10.0] - 2026-08-19

### Changed
- Production layout: extraction column now 45%, resource schemas column 55%
- Resource extractions: removed "Power shard" and "Power consumption (MW)" fields from the card, already shown in the summary below
- Resource schemas: removed "Power shard" and "Power consumption (MW)" fields from production steps, already shown in the summary below

## [3.9.7] - 2026-08-18

### Changed
- Production: buttons are now «Resource production schema» and «Resource consumption schema»; the picker titles are «Select OUTPUT/INPUT resource» with matching subtitles

## [3.9.6] - 2026-08-18

### Changed
- Production: «Resource Schema Input/Output» buttons renamed to «Produce resource» and «Consume resource»; tooltips on ingredients and products updated too

## [3.9.5] - 2026-08-17

### Changed
- Production: «Link from production» between production plans is exclusive — if the output is already used by another production step (even in the same plan), it is no longer offered; links to Power stay independent

## [3.9.4] - 2026-08-15

### Fixed
- Production: «Link from production» still appears when that plan is already linked to Power (the two links are not exclusive)

## [3.9.3] - 2026-08-15

### Fixed
- Power: «Create linked fuel production» hint stays on one line
- Power: «Link from production» still appears when that plan is already linked to another Production plan
- Power: the green input badge shows «Covered by extractions» again instead of the translation key

## [3.9.2] - 2026-08-15

### Changed
- Production and Power: the plan list appears immediately (names and cards), then summaries fill in — no lingering «Loading plans…»

## [3.9.1] - 2026-08-15

### Fixed
- Production and Power: plan list loading is instant again (cross-plan links no longer recompute every plan on each list open)

## [3.9.0] - 2026-08-15

### Added
- Production: link a step’s input to surplus from another plan («Link from production»), without excluding links to Power

### Fixed
- Power: the «Link from production» checkbox on generators now saves correctly even when extractions are linked

## [3.8.0] - 2026-08-15

### Added
- Machine panel (Production and Power): «Output / machine» section with per-machine rates (including byproducts/waste), matching «Input / machine»

## [3.7.1] - 2026-08-15

### Fixed
- Extractions (Production and Power): typing an output above the max at 250% OC now auto-increases extractors/nodes (prefer even) and overclock, same as Production machines

## [3.7.0] - 2026-08-15

### Added
- Power: extractions can link to generators («Link to generator»), and generators can link extractions («Link from extraction»), same as Production

## [3.6.1] - 2026-08-15

### Changed
- Power: «Create linked fuel production» option sits below the target controls, full width

## [3.6.0] - 2026-08-15

### Added
- Power: «Create linked fuel production» option when creating or rebuilding a plan — for crafted fuels you choose whether to also generate a Production plan

### Changed
- Power: with the option off, auto-plan only builds generators and extractions (water/coal); it no longer creates Production plans by surprise

## [3.5.0] - 2026-08-15

### Added
- Power: generator input/output rates (fuel, water, MW, waste) are editable like Production — they recalculate machines and overclock
- Power: if fuel (or a linked rate) exceeds the max at 250% OC, generator count increases automatically

## [3.4.1] - 2026-08-15

### Fixed
- Power: extractions now flag surplus or shortfall against generator demand (border and message, same as Production)
- Power: with production links, generator inputs show chain surplus instead of «Fully covered» when extractions overproduce

## [3.4.0] - 2026-08-15

### Added
- Power: auto-plan target can be MW or fuel consumption /min (e.g. 200 compacted coal)

## [3.3.0] - 2026-08-15

### Added
- Production: clicking a step output opens «Resource Schema Output» (recipes that consume that product), mirroring input clicks that find how to produce it

## [3.2.0] - 2026-08-15

### Added
- Production: resource picker shows a «History» section with the last 4 selected resources (above categories)

## [3.1.1] - 2026-08-15

### Fixed
- Production: «Resource Schema Output» no longer lists duplicate recipes (copies owned by byproducts, e.g. water)

## [3.1.0] - 2026-08-15

### Added
- Production: «Resource Schema Output» button — pick a resource to use or dispose of and add a recipe that consumes it as input (e.g. uranium waste)

### Changed
- Production: shorter labels — «Tree», «Group tree», «Extraction», «Resource Schema Input» (all locales)

## [3.0.0] - 2026-08-10

Major: Transport — definitive train planning support (time units, total trip time, convoy count, list and route form).

### Added
- Transport: minutes/seconds time-unit selector in create and detail (always stored as seconds)
- Transport: total trip time field (outbound + return); manual entry sets outbound and return to half each
- Transport (trains only): convoy count field; load is split across trains (e.g. 2 trains ≈ half the cars per train)

### Changed
- Transport: plan list uses a single-row layout with a compact summary; platform port-limit warning visible again
- Transport: more compact route form (narrower numeric inputs; min/s selector next to the section title)
- Transport: complete UI strings in all supported locales (time units, total, train count, placeholders)

### Fixed
- Existing plan migration: automatic conversion of times from minutes to seconds
- Transport list: rename plan via modal (same as Production); `window.prompt` was not usable in Electron

## [2.6.3] - 2026-08-09

### Changed
- Transport: more spacing between locomotive, cars, and Mk selectors in the composition strip

## [2.6.2] - 2026-08-09

### Changed
- Vehicle contents dialog: highlight this car’s amount; show full-trip total underneath

## [2.6.1] - 2026-08-09

### Fixed
- Transport: cargo is split evenly across cars (e.g. 12,000 Quickwire → 6,000+6,000), not all in the first car

### Changed
- Transport: belt/pipe Mk is chosen **per station** (under each car); one station = one vehicle

## [2.6.0] - 2026-08-09

### Added
- Transport: choose station belt/pipe Mk (like Production); vehicles needed also respect the 2-port platform cap (`max(capacity, stations)`)
- Result: stations/belts summary and a hint when platform ports—not vehicle capacity—are the limit

## [2.5.4] - 2026-08-09

### Fixed
- Transport vehicle names are localized: English UI shows «Freight Car», «Tractor», etc. (no more Italian «Vagone merci» / «Trattore»)

## [2.5.3] - 2026-08-09

### Fixed
- Full Transport UI translations in every UI language (66 keys each: list, detail, cargo, composition, slot modal, errors) — no more English sentence fallbacks
- General pass: nav, dashboard fleet, modal and confirm strings aligned; contextual “total trip time” wording everywhere

## [2.5.2] - 2026-08-09

### Fixed
- Transport: «Round-trip» label replaced with «Total trip time» (and contextual equivalents across all UI languages)
- Locale packs: transport/dashboard/nav strings aligned; missing keys fall back to English

## [2.5.1] - 2026-08-09

### Added
- Dashboard: transport overview with KPIs, fleet cards (vehicle icon + cargo), vehicles-by-plan chart, projects/alerts, and a Transport shortcut

## [2.5.0] - 2026-08-09

### Changed
- Transport route: separate **outbound** and **return** times (round-trip = sum); detail layout uses two columns for times with vehicle type below
- Existing plans migrate with return = previous one-way time

## [2.4.9] - 2026-08-09

### Added
- Transport detail: under the composition strip, round-trip totals per cargo item with icons

## [2.4.8] - 2026-08-09

### Fixed
- Vehicle contents dialog: Close button margins aligned with the rest of the modal

## [2.4.7] - 2026-08-09

### Changed
- Transport list: large vehicle icon like the create dialog, plus stats (vehicles, one-way, round-trip) and cargo preview chips

## [2.4.6] - 2026-08-09

### Changed
- Vehicle contents dialog: larger slot icons and a per-item round-trip total summary

## [2.4.5] - 2026-08-09

### Added
- Electric locomotive icon in the train composition strip
- Click a vehicle/car in the composition to open a slot grid dialog (stack sizes) or fluid tank fill

## [2.4.4] - 2026-08-09

### Added
- Per solid cargo line: choose separate (dedicated cars) or mix with other solids
- Train composition preview (loco + dedicated/mixed cars) in the plan result

### Changed
- Fluids always use dedicated cars; solids default to separate loading

## [2.4.3] - 2026-08-09

### Changed
- Transport detail: two-column layout like Production (settings/route on the left, one box per cargo on the right)

## [2.4.2] - 2026-08-09

### Changed
- Single freight car type (solids + fluids): cars are summed per cargo line on the same train

## [2.4.1] - 2026-08-09

### Changed
- New transport dialog: wider 2×4 vehicle grid with larger icons; cargo removed from create; no default 3-minute one-way time

## [2.4.0] - 2026-08-08

### Added
- New Transport section: saved plans with vehicle type (train, drone, truck, …), cargo and one-way time; automatic count of vehicles/freight cars needed

## [2.3.6] - 2026-08-08

### Fixed
- Item `stack_size` values re-synced from SCIM (e.g. Quickwire 500); fluids no longer keep a fake stack size

## [2.3.5] - 2026-08-08

### Added
- Items in the local database again store `stack_size` (inventory stack size), filled from the seed

## [2.3.4] - 2026-08-08

### Fixed
- Group tree: removed the Simple/Complex toggle (not applicable to this view; leftover from normal trees)

## [2.3.3] - 2026-08-08

### Fixed
- Converter: power use shows the peak (400 MW) instead of 0; lightning label reads “Peak power use”

## [2.3.2] - 2026-08-03

### Fixed
- Extraction links: with multiple miners on the same step (e.g. 1200+960 → 1800) leftover capacity is shared with other linked steps (e.g. 360 to silica) instead of assigning the full demand onto one belt

## [2.3.1] - 2026-08-02

### Fixed
- Draggable popups: stay where you drop them (no snap-back to center) and the dim backdrop no longer fades away while dragging

## [2.3.0] - 2026-08-02

### Changed
- All popups are floating and draggable from the header (like the calculator): move them to read content underneath; the backdrop no longer blocks clicks

## [2.2.6] - 2026-08-02

### Changed
- Line schematic: up to 24 machines per row show every icon (no more “+4” on 12-machine banks that already wrapped)

## [2.2.5] - 2026-08-02

### Changed
- Align-machines robot: always clickable — always opens the popup (already aligned / single line / alternatives); no more disabled icon with “no useful alignment”

## [2.2.4] - 2026-08-02

### Changed
- Align machines (robot) and line schematic: respect the selected belt/pipe Mk — if linked sources (e.g. 1200+600) do not fit the belt (e.g. Mk.5 at 780), lines switch to belt-true shares (e.g. 600+600+600) and the robot suggests compatible machine counts

## [2.2.3] - 2026-08-02

### Fixed
- Line schematic: with many machines the output belt no longer stacks under the input belt (they stay left and right of the row)

## [2.2.2] - 2026-08-02

### Fixed
- Align machines: with multiple sources, belt shares are no longer proportionally shrunk (e.g. 1200+960 → 1000+800). Larger belts are filled first (1200+600), so suggestions like 15 machines (10+5) come back

## [2.2.1] - 2026-08-02

### Fixed
- Align machines (robot): uses live linked source shares (same as input badges), not stale rates on the links — so 1200+600 also suggests 15 machines (10+5), not only options based on outdated values

## [2.2.0] - 2026-08-02

### Added
- Production: robot icon next to the line schematic — opens a popup to align machine count to real belt/linked source shares (e.g. 1200+600 → 15 machines as 10+5 or 18 as 12+6), keeping total output fixed

### Changed
- Belt/pipe line box: with multiple linked sources on the same input, machine rows follow real shares instead of an even split (8+8)

### Fixed
- Belt/pipe line box: updates immediately when you change output, overclock, or machine count (it used to stay stale)
- Overclock with repeating decimals (e.g. 83.333%): no more spurious totals like 1800.015/min

## [2.1.1] - 2026-08-02

### Changed
- Multi-extraction input links: clearer partial rates (`600/min of 1,800/min` instead of `600/min/1,800/min`) and more spacing between source badges

## [2.1.0] - 2026-08-02

### Added
- Production and power: export the tree view as a PNG image (button in the zoom toolbar; Save As…)
- Production and power: “Belts/pipes” toolbar option to show or hide Mk hints on links (off by default)

### Changed
- Tree view: higher-contrast link strokes; PNG export uses thicker, fully opaque lines
- Tree view: you can drag nodes past the top/left edge — the stage grows (previously a y=0 clamp blocked moving upward)

### Fixed
- Tree view: the Belts/pipes toggle (and other rebuilds) no longer realigns nodes you rearranged with drag and drop
- PNG export: tree links stay visible (inline SVG strokes; html-to-image often ignored CSS stroke)
- Tree view: Simple ↔ Complex keeps drag layout (per-mode storage + bank id mapping)
- Tree view: with Belts/pipes on, edge label names wrap instead of truncating with “…”

## [2.0.1] - 2026-08-02

### Added
- Automated test suite (`npm test`) for auto-plan, recipe picking, production scale, and belt/pipe helpers — covers known cases (Packager loops, self-links, machine counts)

## [2.0.0] - 2026-08-02

Major release: target-based auto-plan (production and power), navigable tree view, belt/pipe and power-shard constraints — based on [@loafdaddy](https://github.com/loafdaddy)’s contribution ([PR #3](https://github.com/raffaelemaiorino/factory-manager/pull/3)), then integrated, fixed, and polished in this version.

### Added
- Production: create a plan from one or more target products + rates/min; the app auto-adds default-recipe steps, raw extractions, and supply links (shared intermediates are combined).
- Production: manage plan targets in the editor (add / remove / edit rates) — changes rebuild the production tree.
- Production: plan constraints for power-shard budget (default 0, or unlimited) and highest belt/pipe Mk; tree edges show belt/pipe needs.
- Production: machine count + clock speed on tree nodes and plan steps; build summary by building; split into lines when belt/pipe throughput is not enough.
- Production: tree Simple / Complex toggle; Complex splits steps/extractions into per-line nodes.
- Production: optional “Sink byproducts” — Wet Concrete / packaging / AWESOME Sink lines for unused secondary outputs.
- Production: per step/extraction — «i» toggle for the lines box, local «Change belt/pipe» Mk, and a graphical machine/belt line schematic.
- Power: create/replan from target MW + generator + fuel; auto-sizes generators with coal/water extractions or a companion fuel production plan.
- Power: power-shard budget; Simple/Complex tree view.
- Tree view: pan, zoom, Fit, fullscreen; compact header.
- Catalog: Excited Photonic Matter Converter recipe; auto-plan leaves uncraftable items as external demand.
- Dashboard: hover delete on projects in Your projects.

### Changed
- Resources: category counts use the active UI locale.
- Tree view: sharper CSS `zoom`; more node spacing; localized hints.
- Plan UI and line badges: clearer copy; themed selects; belt/pipe/line strings translated for all UI locales (Satisfactory / SCIM terminology).
- Defaults: English UI and en-US numbers for new installs; limited shard budget keeps auto-plan at 100% OC.
- Auto-planned step names use the localized item name.
- README: Features section updated (auto-plan, constraints, tree).

### Fixed
- Freeze / slowness on Create for large plans (link and chain-detail work).
- Bad recipe cycles (e.g. aluminum Packager) and self-links on byproducts / nitrogen.
- Resource box vanishing on IT→EN locale switch; other auto-plan UI polish.

### Credits
- Automatic planner (production/power auto-plan) and tree view: [@loafdaddy](https://github.com/loafdaddy) — [PR #3](https://github.com/raffaelemaiorino/factory-manager/pull/3)

## [1.58.20] - 2026-08-02

### Changed
- Production: larger machine icons in the line schematic; belt/pipe/line UI strings translated for all UI locales (Satisfactory / SCIM terminology)

## [1.58.19] - 2026-08-02

### Added
- Production: sitemap icon next to «Change belt» opens a popup with the calculated machine/belt line layout

## [1.58.18] - 2026-08-02

### Changed
- Production: «Change belt» / «Change pipe» selector sits inside the lines box, on the right

## [1.58.17] - 2026-08-02

### Changed
- Production: «Change belt» / «Change pipe» now use the same themed select as the other app dropdowns

## [1.58.16] - 2026-08-02

### Added
- Production: «i» icon on each step/extraction to show or hide the belt/pipe lines box (hidden by default)

## [1.58.15] - 2026-08-02

### Added
- Production: each step/extraction has «Change belt» / «Change pipe» (Mk) for that box only; line split recalculates there without changing the plan-wide maximum

## [1.58.14] - 2026-08-02

### Changed
- Production: line/bank badge now explains why a split is needed (item, rate, belt/pipe Mk limit) and how to distribute machines

## [1.58.13] - 2026-08-02

### Changed
- Production: collapsible «Buildings» / «Elenco macchine» summary (collapsed by default) replaces «Build» / «Costruzione»

### Fixed
- Production: the resource balance box (required/produced/missing) no longer disappears when switching Italian → English

## [1.58.12] - 2026-08-02

### Changed
- Production/Power: plan targets sit in their own card, separated from extractions and steps (same gap as the header card above)

## [1.58.11] - 2026-08-02

### Changed
- Italian UI: power-shard option label «Limite» renamed to «Definiti» («Illimitati» unchanged)

## [1.58.10] - 2026-08-02

### Changed
- Italian UI: auto-plan wording aligned with the game/SCIM — power shards as «frammenti energetici», rate as «portata», manifold banks as «linee/file», pipes, byproduct sink, MW target

## [1.58.9] - 2026-08-02

### Fixed
- Production: auto-plan prefers recipes where the item is the primary output (not a byproduct) and skips self-links — fixes compacted coal (“cannot link a resource schema to itself”) and wrong fuel-byproduct chains

## [1.58.8] - 2026-08-02

### Fixed
- Production: auto-plan no longer picks Packager pack/unpack recipes as defaults — avoids loops (e.g. aluminum ingot → alumina ↔ packaged ↔ canisters) and the “possible recipe cycle” error

## [1.58.7] - 2026-08-02

### Fixed
- Production: creating a large auto-planned schema no longer freezes the app (skip full-detail rebuilds on every link; sink-byproducts path avoids N+1 detail loads)

## [1.58.6] - 2026-08-01

### Fixed
- Production: the Output field no longer goes blank/black when changing Machines with a decimal overclock (e.g. 62.5%)
- Production: when all groups are collapsed, the left drag handle to reorder them shows again (no need to also collapse schemas inside)

## [1.58.5] - 2026-08-01

### Fixed
- Production: on extractions, “Missing … for linked steps” now accounts for total coverage from all linked sources (not just that miner’s output)

## [1.58.4] - 2026-08-01

### Changed
- Production: mineral/liquid extractions on the left are sorted alphabetically (including after adding a new extraction)

## [1.58.3] - 2026-07-29

### Changed
- Production: the “Group tree view” button is hidden when you are already inside a single group’s tree view

## [1.58.2] - 2026-07-29

### Changed
- Production: Collapse/Expand icons (step and group) switch from chevron to caret (caret-up / caret-down)

## [1.58.1] - 2026-07-29

### Changed
- Official Somersloop icon in the machine summary and plan Info box

## [1.58.0] - 2026-07-29

### Added
- Production: the machine summary (and the plan Info box) also shows required Somersloops alongside Power Shards

## [1.57.0] - 2026-07-29

### Added
- Tree view: steps with Somersloop enabled show a 5px border with an animated red-to-purple gradient

## [1.56.3] - 2026-07-29

### Fixed
- Production: toggling Somersloop scales output by a clean ratio (e.g. 400→800) without leftovers like 800.002 / 200.001

## [1.56.2] - 2026-07-29

### Fixed
- Production: entering an integer input/output rate (e.g. plastic 200/min) no longer shows leftovers like 200.01 from ceiling rounding of repeating decimals

## [1.56.1] - 2026-07-29

### Changed
- Production: input/output rate fields more visible (yellow border) and slightly taller IO boxes

## [1.56.0] - 2026-07-29

### Added
- Production: input and output rates (including byproducts, e.g. resin / crude oil) are editable fields — entering a value recalculates primary output, machines, and overclock

## [1.55.0] - 2026-07-29

### Changed
- Production: if the requested output exceeds the current machines’ max (×250% OC), the required machine count (even number) and overclock are calculated automatically
- Output field width matched to the slider below it

## [1.54.2] - 2026-07-29

### Fixed
- Crude oil extraction: pure node at 100% yields 240 m³/min (not 250), matching the wiki; at 250% → 600 m³/min per extractor

## [1.54.1] - 2026-07-28

### Fixed
- Resource schemas: when an input is already "Fully covered", no additional extractions or schemas are offered for linking

## [1.54.0] - 2026-07-28

### Added
- Settings → Configuration: number format preference independent of UI language — Italian (`1.234,56`) or US English (`1,234.56`), used across dashboard, production, energy, and the calculator

## [1.53.5] - 2026-07-28

### Fixed
- App startup: `setupCalculator is not defined` caused by a typo in the Paste regex in `calculator.js`

## [1.53.4] - 2026-07-28

### Changed
- Calculator → Paste: extracts and cleans only the number (ignores text/units; rejects clipboard content with no digits)

## [1.53.3] - 2026-07-28

### Changed
- Calculator: yellow border (`--warning`) so it stands out more clearly from the rest of the UI

## [1.53.2] - 2026-07-28

### Added
- Calculator: Copy and Paste buttons (Italian number format; also Ctrl+C / Ctrl+V while the calculator is open)

## [1.53.1] - 2026-07-28

### Changed
- Calculator: panel 50% larger and opens at the top-right below the topbar

## [1.53.0] - 2026-07-28

### Added
- Floating calculator from the topbar: basic operations (+ − × ÷), percent, memory (MC/MR/M+/M−/MS), draggable panel that stays open when switching views
- Italian number format in the calculator: comma for decimals, period as thousands separator (e.g. `1.234,56`)

## [1.52.0] - 2026-07-28

### Added
- Linux build target (`npm run build:linux`, produces an AppImage and a `.deb`) alongside the existing Windows and macOS builds
- `TODO.md`: known follow-ups (macOS build untested, `.deb` build untested, no CI matrix, no automated tests)
- README: Architecture section describing the main-process/renderer/data-layer split and the current file layout, including a note that there's no automated test suite yet

### Changed
- Fixed the app-icon and logo assets (`app-icon.png`, `logo.png`): both were actually JPEG data mislabeled with a `.png` extension, which broke Linux icon generation. Re-saved as genuine PNGs with no visible change
- The main window's icon now uses the correct format per platform (`icon.ico` on Windows, `app-icon.png` elsewhere)
- README: build instructions now cover all three platforms, plus a "Run from source" section and macOS notarization / Linux FUSE notes
- Internal: `src/renderer/scripts/app.js` split into 11 files by responsibility (no intended behavior change)
- `.deb` package metadata: maintainer set to `Raffaele Maiorino <raffaelemaiorino@gmail.com>`

### Removed
- Unused `recipes` / `recipe_ingredients` database tables (new databases no longer create them; existing databases unchanged)

### Fixed
- App startup (`boot()`): initialization errors are shown instead of leaving the app half-started with no feedback
- Electron main process: failures after database init reported via error dialog and a clean quit
- Production chain reordering: a second failure during recovery refresh is logged instead of becoming an unhandled rejection
- Resource edit modal: opening from the resources list no longer risks an unhandled promise rejection
- Content Security Policy: allowed `data:` images so `<select>` dropdown arrows render
- Settings → Configuration (IT/EN): titles, labels, and messages show translated text instead of i18n keys

## [1.51.0] - 2026-07-27

### Changed
- Schema import: importing an Energy plan in Production (or vice versa) now shows an in-app popup instead of the system alert, with a clear explanation

## [1.50.1] - 2026-07-26

### Changed
- Dashboard: KPI boxes laid out in 4 columns

## [1.50.0] - 2026-07-26

### Changed
- Sticky top menu bar: stays visible while scrolling (including page-level horizontal scroll)

## [1.44.1] - 2026-07-26

### Added
- Dashboard: explicit power coverage status (Covered / Deficit / Uncovered) with output vs use comparison and surplus or shortfall MW

## [1.44.0] - 2026-07-26

### Added
- Dashboard: power-use and balance KPIs, Output vs Use chart with top consuming chains, and an alert when use exceeds output

## [1.43.1] - 2026-07-26

### Changed
- Info box: lightning icon next to total power use (aligned with Power Shards)

## [1.43.0] - 2026-07-26

### Added
- Calculated power use (MW) on production steps and extractions from overclock and Somersloop; total in the Info box (not on generators)

## [1.42.0] - 2026-07-26

### Added
- Base power consumption (MW) in the default building catalog for extractors and production machines (excluding generators and variable-power buildings)

## [1.41.1] - 2026-07-26

### Changed
- Production: Info box (Power Shards) sits under the Objectives box

## [1.41.0] - 2026-07-26

### Added
- Info box in plan summary: table with Total Power Shards (extractions + machines/generators)

## [1.40.1] - 2026-07-26

### Changed
- Power Shards summary: icon size fixed on extractions; only the count stays orange bold, surrounding text is muted

## [1.40.0] - 2026-07-26

### Added
- Side summary on production steps, extractions, and generators: required Power Shards (icon + total from overclock × machines)

## [1.39.0] - 2026-07-26

### Added
- On launch, the app checks GitHub for a newer release and shows a dismissible banner with a download link (no automatic download)

## [1.38.2] - 2026-07-25

### Fixed
- Settings → Environment: DB path shows “local database” instead of “—” (absolute path stays hidden)

## [1.38.1] - 2026-07-25

### Fixed
- Stable security-hardening release replacing 1.38.0 (which was not usable)

### Security
- Schema import: validation and limits (max 5 MB, max 2000 items), numeric clamps, and rejection of invalid generator slugs (including `__proto__`)
- UI locale packs: only `a-z` language codes (2–3 letters); no path traversal via `getUiMessages`
- Main window: block `window.open` and non-`file://` navigation
- Production UI state and settings: sanitized payloads and hard caps (machines 10,000, generators 50,000)
- `escapeHtml` aligned (including apostrophe); tighter CSP (`object-src` / `base-uri` / `frame-src`)

## [1.38.0] - 2026-07-25

### Added
- Schema import: verifies the JSON is a Factory Manager export (format + version), of the correct kind (production vs energy), and actually importable (resources, recipes, generators, fuels, and links) before writing to the database

### Security
- Import rejects unknown or cross-type files with a clear message; catalog checks run in a preflight pass without leaving partial data

## [1.37.1] - 2026-07-25

### Security
- `escapeHtml` also escapes apostrophes (single-quoted HTML attributes)
- Stronger CSP: `base-uri`, `object-src`, `frame-src`, and `frame-ancestors`
- Export filenames: block Windows reserved device names (CON, PRN, AUX, …)

## [1.37.0] - 2026-07-25

### Security
- Electron hardening: sandbox enabled; navigation and popups blocked outside the app
- UI locale packs: only 2-letter language codes and files confined to the locales folder (no arbitrary paths)
- Production/energy schema import: 2 MB file limit, caps on elements/strings/numbers, and sanitization before save
- IPC: requests accepted only from the main window; UI state size limited
- Settings: absolute cap of 10,000 for machines and generators
- Absolute database path no longer exposed to the UI (generic “local database” label)
- Windows build prepared for Authenticode signing via environment variables (`CSC_LINK` / `CSC_KEY_PASSWORD`)

## [1.36.0] - 2026-07-25

### Added
- Settings → Configuration: customizable limits for maximum machines (default 100) and power generators (default 600), saved in the local database

## [1.35.1] - 2026-07-25

### Fixed
- Startup on slow PCs: catalog translations are no longer recalculated on every launch (could leave the process in Task Manager with no window)
- If initialization fails, an error message is shown instead of a "ghost" process
- Splash screen "Preparing data…" during first seed; fallback if the main window does not appear
- More reliable sql.js loading in packaged builds (WASM file unpack)

## [1.35.0] - 2026-07-20

### Added
- Game catalog in all 25 SCIM languages (names, descriptions, and recipes) imported from satisfactory-calculator.com
- Complete UI packs for all SCIM languages in `src/locales/ui/` (beyond IT/EN), with sense-oriented translation and key parity
- Language selector in the top bar with all catalog languages; basic RTL layout for Arabic, Hebrew, and Persian
- Batch script `import:locale:all` (with resume) and language inventory in `scripts/scim-locales.js`

### Changed
- If a language's UI pack is missing, interface text falls back to English
- Remaining hardcoded strings (energy, fuels, purity, miners, Base labels) wired to `t()` / localized catalog

### Fixed
- Catalog categories in non-EN languages resolved from canonical slug via `game_id`, not from localized breadcrumbs

## [1.34.0] - 2026-07-20

### Added
- Complete UI packs in German, French, Spanish, Polish, Portuguese, and Dutch (`src/locales/ui/de.json`, `fr.json`, `es.json`, `pl.json`, `pt.json`, `nl.json`) with 414-key parity vs `it.json`, sense-oriented translation for the Satisfactory planner

### Changed
- Scripts `scripts/build-six-ui-locales.js` and `scripts/apply-ui-flats.js` to regenerate JSON from overlays and localized legal text

## [1.33.0] - 2026-07-20

### Added
- Full interface translation (not just catalog): nav, dashboard, resources, production, energy, settings, modals, disclaimer, and legal text

### Changed
- IT/EN language selector updates both game names from the database and all UI text, with sense-oriented English translation (Satisfactory domain terms)
- Runtime-generated text wired to the `src/locales/ui` catalog via `t()`

## [1.32.1] - 2026-07-20

### Changed
- Static interface text in `index.html` wired to UI catalog `data-i18n` keys (nav, dashboard, resources, production, energy, settings, footer, modals, and legal)

## [1.32.0] - 2026-07-20

### Added
- Complete UI files `src/locales/ui/it.json` and `en.json` (413 keys each): static text from interface, legal modal, dashboard, production, energy, settings, and runtime strings planned for `app.js` / `energy-ui.js`
- Helper `src/locales/ui/format.js` with `{placeholder}` interpolation and utilities to list keys; `t()` in `index.js` accepts optional variables
- Script `scripts/generate-ui-locales.js` to regenerate JSON while maintaining IT/EN parity

## [1.31.0] - 2026-07-20

### Added
- Language selector in the top bar (IT/EN), styled like existing controls
- Resource, building, and recipe catalog localized based on active language

### Changed
- Language preference saved locally and applied on restart

## [1.30.0] - 2026-07-20

### Added
- English catalog translations (151 items, 50 buildings, categories, and recipe names) from Satisfactory Calculator
- Script `npm run import:locale:en` to regenerate the EN pack
- UI file `src/locales/ui/en.json` (base for interface text)

## [1.29.0] - 2026-07-20

### Added
- Multilingual foundation in the database: translation tables for items, buildings, categories, and recipes, with Italian as the base language
- App language preference (`locale`) and API to read/set supported languages
- Separate structure for UI text (`src/locales/ui`), distinct from the game catalog

## [1.28.1] - 2026-07-20

### Changed
- `start.bat` excluded from the repository (remains local only)

## [1.28.0] - 2026-07-20

### Added
- Desktop build with electron-builder: NSIS installer and Windows portable version (`npm run build`)

## [1.27.0] - 2026-07-20

### Changed
- Local data in `factory-manager` folder (AppData) and database renamed to `factory-manager.db`, with automatic migration from the previous path

## [1.26.5] - 2026-07-19

### Changed
- Tree view: increased spacing between labels on parallel links between the same nodes

## [1.26.4] - 2026-07-19

### Fixed
- Tree view (including groups): labels and curves of links between the same nodes no longer overlap

## [1.26.3] - 2026-07-19

### Removed
- Native menu bar (File, Edit, View, etc.) hidden at startup

## [1.26.2] - 2026-07-19

### Changed
- Updated FACTORY MANAGER logo (dashboard and header)

## [1.26.1] - 2026-07-19

### Changed
- Schema import (production and energy): " (import)" appended to the name

## [1.26.0] - 2026-07-19

### Added
- Production: "Import schema" button next to "New schema" — loads a schema from a JSON file
- Energy: JSON schema export and import (extractions, generators, and internal links), with buttons on the card and in the header

## [1.25.2] - 2026-07-19

### Changed
- Info popup: width doubled for easier reading of legal text

## [1.25.1] - 2026-07-19

### Changed
- More compact footer: version and disclaimer on the same line, without stacked paragraphs

## [1.25.0] - 2026-07-19

### Added
- Footer: brief disclaimer (independent fan-made, unofficial, Coffee Stain attribution) next to the version

## [1.24.0] - 2026-07-19

### Added
- Info button in the top bar: opens the popup with legal information, attributions, and disclaimer

## [1.23.0] - 2026-07-19

### Changed
- Product renamed to FACTORY MANAGER (window title, footer, dashboard, logo, and documentation)

## [1.22.0] - 2026-07-19

### Added
- Production: Export schema button on the card — saves a complete schema to a JSON file (extractions, resource schemas, links, and groups)

## [1.21.1] - 2026-07-19

### Fixed
- Production: drag & drop of boxes in the tree (including groups) no longer jumps downward when the area is scrolled

## [1.21.0] - 2026-07-19

### Added
- Production: "Groups tree view" in the detail — available only when groupings exist; shows each group as a node with main inputs/outputs only (no internal processing)

## [1.20.0] - 2026-07-19

### Added
- Production: Duplicate button on the schema card — creates a full copy (resource schemas, extractions, links, and groupings) named "… (copy)"

## [1.19.10] - 2026-07-07

### Fixed
- Production: collapse/expand state of schemas and groupings saved to file in AppData and restored after closing and reopening the app

## [1.19.9] - 2026-07-07

### Fixed
- Production: collapse/expand state of individual resource schemas stored correctly and restored after tree view

## [1.19.8] - 2026-07-06

### Fixed
- Production: schema collapse/expand arrow button always neutral (no longer orange when collapsed)

## [1.19.7] - 2026-07-06

### Fixed
- Extraction→schema link: you can link nodes with partial output (e.g. two coal nodes at 600/min to cover 1,200/min), as already between resource schemas

## [1.19.6] - 2026-07-05

### Changed
- Dashboard: extended description of what FACTORY MANAGER does (catalog, production, energy, and project overview)

## [1.19.5] - 2026-07-05

### Fixed
- "FACTORY MANAGER" logo: transparent background instead of the black rectangle visible on the dashboard and in the header

## [1.19.4] - 2026-07-05

### Fixed
- Highlight schema/group button: when active keeps the standard dark style, only the icon changes to X

## [1.19.3] - 2026-07-05

### Changed
- Highlight schema and group: check icon when inactive, X when active; active icon is no longer green

## [1.19.2] - 2026-07-05

### Fixed
- Highlight schema and group: unified green on card, group, active checkboxes, linked inputs/outputs, and status text

## [1.19.1] - 2026-07-05

### Added
- Tree view: highlight schema checkbox at top right on each schema node, synced with the editor

## [1.19.0] - 2026-07-05

### Added
- "Highlight group" checkbox next to the rename pencil: green background on the group, all internal schemas highlighted, and state saved in the database

## [1.18.0] - 2026-07-05

### Added
- Energy section: under each generator, in the building panel, per-machine inputs (fuel and water) with current and base rates, as in production

## [1.17.0] - 2026-07-05

### Added
- Dashboard KPIs: total power production (MW), generators separate from machines, active deficit count

### Changed
- "Machines" KPI counts production steps only, not generators

## [1.16.2] - 2026-07-05

### Changed
- "Generator mix" chart: Font Awesome icons by type (coal fire, nuclear radiation, fuel lightning), without background

## [1.16.1] - 2026-07-05

### Fixed
- MW unit always separated from the value by a space (e.g. `200.000 MW` instead of `200.000MW`)

## [1.16.0] - 2026-07-05

### Changed
- Numbers throughout the app formatted with a period as thousands separator (e.g. 200.000 MW, 19.200 m³/min, 5.000 MW)

## [1.15.1] - 2026-07-05

### Fixed
- "Generator mix" chart: ⚡ icon instead of empty placeholder, without background

## [1.15.0] - 2026-07-05

### Added
- Dashboard: bar charts for top 5 resource deficits, production targets per chain, and generator MW mix (coal, fuel, nuclear)

## [1.14.0] - 2026-07-05

### Added
- Operational dashboard: KPIs on chains, machines, nodes, and power shards; recent projects list with health status; alerts panel for resource deficits

### Changed
- Environment status and catalog statistics moved from Dashboard to Settings

## [1.13.3] - 2026-07-05

### Changed
- Highlight schema button: check icon; icon color unchanged when active (only the container background turns green)

## [1.13.2] - 2026-07-05

### Changed
- Highlight schema checkbox moved to the top of the header: check icon without label, same style as collapse/reset/delete buttons

## [1.13.1] - 2026-07-05

### Changed
- In tree view (global or per group) highlighted schemas have a green background as in the list

## [1.13.0] - 2026-07-05

### Added
- "Highlight schema" checkbox on each resource schema: green background and state saved in the database

## [1.12.2] - 2026-07-05

### Fixed
- Group select in schema: closes when clicking outside the dropdown
- Collapse/reset/delete buttons aligned in height with the group select

## [1.12.1] - 2026-07-05

### Fixed
- In tree view the "Add extraction" and "Add resource schema" buttons stay hidden (previously `.btn` overrode the `hidden` attribute)

## [1.12.0] - 2026-07-05

### Added
- Reorder groupings by dragging the icon on the left in the header: available only when all groupings are collapsed (with a hint visible while one remains open)

## [1.11.0] - 2026-07-05

### Added
- Rename group: pencil icon in the group header; updates all schemas in the group and preserves collapsed state and tree layout

## [1.10.0] - 2026-07-05

### Added
- Collapse/expand state of groupings and resource schemas stored per project: on app restart they remain as you left them

## [1.9.2] - 2026-07-05

### Changed
- In tree view (full chain or single group) the "Add extraction" and "Add resource schema" buttons are hidden; only "Back to editor" remains

## [1.9.1] - 2026-07-05

### Changed
- "Tree view" button in the group: same font, padding, and rounded borders as the main button

## [1.9.0] - 2026-07-05

### Added
- "Tree view" button in each group header: shows the graph of that group's schemas only (with linked extractions and targets)

## [1.8.3] - 2026-07-05

### Changed
- Resource extraction output: manual entry with decimal comma (e.g. 120,5/min) for minerals, liquids, and water

## [1.8.2] - 2026-07-05

### Changed
- Group select in production schema headers fills the available horizontal space next to the title

## [1.8.1] - 2026-07-05

### Changed
- Extractions linked to multiple schemas: red status "Missing X/min for linked schemas" when total demand exceeds output; badge with partial quota (e.g. 160/480/min)
- Extraction→schema link offered only if free minutes fully cover the schema's demand

### Fixed
- "Fully used" on extraction no longer appears when linked schemas require more resource than the node produces

## [1.8.0] - 2026-07-05

### Added
- Resource extractions: left section split into **Minerals** and **Liquids** groups (crude oil, water)

## [1.7.4] - 2026-07-05

### Fixed
- Inputs in resource schemas: "Linked surplus" and extraction/schema badges use the quota actually allocated to the consumer, not the producer's total output (aligned with left-side extraction calculation)

## [1.7.3] - 2026-07-05

### Fixed
- Left-side extractions: surplus color and label update immediately when you change output, overclock, or nodes (no need to interact with schemas on the right)

## [1.7.2] - 2026-07-05

### Changed
- Inputs in resource schemas: green and "Fully covered" only with explicit links to schema or extraction; removed "Covered by chain" and automatic coverage from global balance

## [1.7.1] - 2026-07-05

### Changed
- Left-side extractions: yellow border and "Surplus" label even when output exceeds what is linked to schemas, including when there is no explicit link yet

## [1.7.0] - 2026-07-05

### Added
- Left-side extractions: green/yellow/red border when linked to schemas (balanced, surplus, insufficient), badges toward consumers, and "Link to schema" section with available quota
- One extraction can feed multiple schemas: lists show only compatible schemas or those with free capacity, as between resource schemas

## [1.6.1] - 2026-07-05

### Fixed
- Manual link from extraction: fixed local database migration that blocked saving with "NOT NULL constraint failed" on `producer_step_id`

## [1.6.0] - 2026-07-05

### Added
- Mineral/liquid inputs in resource schemas: "Link from extraction" section with checkbox, like "Link from schema"; without manual links automatic chain balance remains active

## [1.5.4] - 2026-07-05

### Changed
- New resource schema from input: if the source schema belongs to a group, the new schema is added to the same group

## [1.5.3] - 2026-07-05

### Changed
- Resource schema groupings: group name always shown in uppercase, even if typed in lowercase

## [1.5.2] - 2026-07-05

### Fixed
- New resource schema grouping: "+ New group…" opens the name entry modal (Electron `prompt` is not available)

## [1.5.1] - 2026-07-05

### Fixed
- Inputs and outputs in resource schemas: uniform spacing between resource rows, regardless of links or "Link from schema" section

## [1.5.0] - 2026-07-05

### Added
- Resource schemas: visual groupings with dropdown next to the name; each group can expand or collapse; drag reorders schemas only within the same group

## [1.4.3] - 2026-07-05

### Fixed
- Resource schema linking: schemas already linked elsewhere but with surplus (e.g. 12/min free on a 300/min pipe) appear again in "Link from schema" options; available quota shown in the rate

## [1.4.2] - 2026-07-05

### Fixed
- Resource schema linking: "Link from schema" list shows only producers not yet linked to that input, or already linked there or with available surplus; schemas 100% used by other links are no longer selectable

## [1.4.1] - 2026-07-05

### Fixed
- Collapse resource schema: a single click immediately hides everything (sliders, inputs/outputs, and machine panel), without the intermediate state with the machine still visible on the right

## [1.4.0] - 2026-07-05

### Added
- Resource production schema: arrow button in header to compress (machine panel only), collapse (title only), or return to full view; state remembered until you leave the schema

## [1.3.3] - 2026-07-05

### Fixed
- Resource production schema: inputs and outputs no longer show spurious values (e.g. 288,015/min instead of 288/min) when overclock and machines produce an exact total — floating-point noise is no longer rounded up

## [1.3.2] - 2026-07-05

### Changed
- Production: adding a resource schema from an input, the new step appears immediately below the current one; with "Add resource schema" it stays at the bottom of the list

## [1.3.1] - 2026-07-05

### Fixed
- Machine panel: resource icons visible in per-machine inputs

### Changed
- Machine panel: simplified base labels (e.g. "Base: 20/min") without "per machine @ 100%"

## [1.3.0] - 2026-07-05

### Added
- Resource production schema: per-machine inputs in the right machine panel (current value with overclock and base @ 100%), with resource icon

## [1.2.5] - 2026-07-05

### Fixed
- Reset resource schema: recipes with fractional base (e.g. silica 37,5/min) no longer round output to integer (38) with overclock recalculated to 101,334%; reset returns to base @ 100%

## [1.2.4] - 2026-07-05

### Fixed
- Underclock (overclock below 100%): minimum output was calculated at base @ 100%, so values like 25% were ignored and production stayed unchanged; minimum is now at base @ 1% (as in the game) in resource production schemas and extractions

## [1.2.3] - 2026-07-05

### Fixed
- Resource production schema: slow recipes (e.g. uranium rod 0,4/min, plutonium 0,25/min) now start from base @ 100% instead of being forced to 1/min with 250% overclock; slider and output field accept decimals when maximum is below 1/min

## [1.2.2] - 2026-07-05

### Changed
- Resource extractions: Output, Overclock, and Nodes fields narrower (−25%); machine summary (right side) slightly wider

## [1.2.1] - 2026-07-05

### Added
- Nuclear power plant: waste output based on fuel (plutonium waste 1/min, uranium waste 10/min; no waste with ficsonium rod), visible in Output box and summary

## [1.2.0] - 2026-07-05

### Added
- Energy schema: nuclear power plant (2500 MW at 100%, overclock, 3 fuel rods — plutonium, uranium, ficsonium — and water 240 m³/min)

## [1.1.2] - 2026-07-05

### Changed
- Energy, "Generators" slider: maximum raised to 600 (previously 100)

## [1.1.1] - 2026-07-05

### Fixed
- Industrial "M" logo only as window/taskbar icon; in the app the "FACTORY MANAGER" logo remains (dashboard and compact header)

## [1.1.0] - 2026-07-05

### Added
- Energy schema: fuel generator (250 MW at 100%, overclock, 5 liquid fuels — ionized fuel, rocket fuel, turbofuel, liquid biofuel, fuel — without water input)

## [1.0.1] - 2026-07-05

### Changed
- "Add energy schema" button: `industry` icon instead of `braille`

## [1.0.0] - 2026-07-05

### Changed
- Production and energy buttons with Font Awesome icons: tree (`code-fork`), editor (`align-right`), extraction (`hammer`), schema (`braille`)
- New application icon (industrial "M" logo) in title bar, header, and Windows taskbar

## [0.3.100] - 2026-07-05

### Fixed
- Energy, top summary: MW power appears in the "Produced" column (no longer aligned to "Missing"); green row when inputs are also covered

## [0.3.99] - 2026-07-05

### Changed
- Fluid rates without space before unit: `1200m³/min` (like `1200/min` for solids)

## [0.3.98] - 2026-07-05

### Fixed
- Uniform rate format everywhere: `1200/min` (no space before slash); fluids remain `1200 m³/min`

## [0.3.97] - 2026-07-05

### Changed
- Energy, links from production: only the schema name shown (e.g. "Factory") with quantity, without the resource schema name

## [0.3.96] - 2026-07-05

### Added
- Energy: on each generator input (fuel, water) you can link production targets with checkboxes, as between resource schemas in Production
- Energy summary includes in "Produced" resources linked from production schemas

## [0.3.95] - 2026-07-05

### Added
- Pencil button on Production and Energy cards to rename a schema

### Removed
- Stack field from resources: removed from list, edit, detail, and database

## [0.3.94] - 2026-07-04

### Changed
- Energy, top summary table: shows all required inputs (coal, compacted coal, coke, water…) with Required, Produced, and Missing columns, as in Resource Planning

## [0.3.93] - 2026-07-04

### Changed
- Energy: water and coal link automatically to extractions (as in Resource Planning), without manual checkboxes

## [0.3.92] - 2026-07-04

### Fixed
- Energy, extractions (water/coal): output, overclock, and extractor/node sliders work again as in Resource Planning
- Energy: modifying an extraction immediately updates water/coal balance and linked generator inputs

## [0.3.91] - 2026-07-04

### Fixed
- Machines field in resource schemas: keyboard ↑↓ arrows increment/decrement by ±1 like Output and Overclock; maximum adapts when you exceed the slider limit

## [0.3.90] - 2026-07-04

### Changed
- Water extractor: Output field accepts manual entry with decimal comma (e.g. 120,5 m³/min) in Resource Planning and Energy

## [0.3.89] - 2026-07-04

### Fixed
- Energy, water/coal extractors: same logic as Resource Planning — changing extractors, output, or overclock values stay consistent (no overclock reset to 100%)
- Partial extraction update: existing overclock and output no longer overwritten when modifying a single field

## [0.3.88] - 2026-07-04

### Changed
- Water extractors: maximum number of extractors raised from 25 to 500 (Resource Planning and Energy section)

## [0.3.87] - 2026-07-04

### Changed
- Power generators: logic aligned with Production — more generators scale total fuel while keeping overclock; fuel adjusts overclock only; maximum = default × generators @ 250%

## [0.3.86] - 2026-07-04

### Fixed
- Power generators: compacted coal @ 100% uses exact value **7,142857**/min (not rounded to 7,144)

## [0.3.85] - 2026-07-04

### Fixed
- Power generators: changing fuel type (e.g. compacted coal → coal) calculation restarts from new fuel default @ 100%

## [0.3.84] - 2026-07-04

### Fixed
- Power generators: fuel field shows full decimals on default restore (e.g. compacted coal 7,144/min)

## [0.3.83] - 2026-07-04

### Fixed
- Power generators: typing fuel, overclock, or generator count immediately updates power, inputs/outputs, balance, and summary (as with the slider)

## [0.3.82] - 2026-07-04

### Changed
- Production list: summary tables right-aligned in the card; title stays on the left on one line

## [0.3.81] - 2026-07-04

### Fixed
- Resource schemas: Output field arrows and spinner advance by ±1 and keep integer values (no more 0,001 steps after overclock recalculation)

## [0.3.80] - 2026-07-04

### Fixed
- Energy: numeric fields (output, fuel, overclock, machines) can be typed as in Production
- Right building panel: generator image no longer clipped in height

## [0.3.79] - 2026-07-04

### Changed
- Fuel type select (Energy): labels without values in parentheses

## [0.3.78] - 2026-07-04

### Fixed
- App startup: fixed error that blocked the interface (`LINK_BALANCE_TOLERANCE` not initialized)

## [0.3.77] - 2026-07-04

### Changed
- Power generators: set fuel input (/min) and MW power is calculated automatically
- Water/coal inputs with links to extractions and green indicator when chain is covered (as in Production)
- Energy section layout aligned with Production; ⚡ icon on electricity output

## [0.3.76] - 2026-07-04

### Changed
- Energy section: layout aligned with Production (picker, extractions, generators with craft schema, sliders, and summary)

## [0.3.75] - 2026-07-04

### Removed
- Dashboard: removed "Production planner" card (not yet available)

## [0.3.74] - 2026-07-04

### Fixed
- Energy: "New schema" button opens the creation modal again

## [0.3.73] - 2026-07-04

### Fixed
- App startup: energy tables created automatically on first launch after update

## [0.3.72] - 2026-07-04

### Added
- New **Energy** section: create schemas with extractions (water and coal) and generators
- Coal generator: 75 MW at 100%, overclock, fuel (coal, compacted coal, petroleum coke) and water consumption (45 m³/min)

## [0.3.71] - 2026-07-04

### Fixed
- Production list: schema title stays on one line and summary tables start immediately after, without empty space in the middle

## [0.3.70] - 2026-07-04

### Fixed
- Production list: summary tables correct on first access (previously required opening detail to align data)

## [0.3.69] - 2026-07-04

### Added
- Production list: each schema shows summary tables (Targets, Nodes, Resources) as in the detail view

## [0.3.68] - 2026-07-04

### Changed
- Tree view: wider boxes for full text; line labels with material icon and name, centered on the link

## [0.3.67] - 2026-07-04

### Changed
- Tree view: diagram adapted to page width (no horizontal scrolling), line labels with material icon only, schema boxes with input and output values

## [0.3.66] - 2026-07-04

### Changed
- Tree view: free layout with more space between boxes, no column labels, drag & drop on every node, and positions saved per project

## [0.3.65] - 2026-07-04

### Added
- Green "Tree view" button in production detail: left→right diagram with extractions, schemas, targets, and links with material and machine icons

## [0.3.64] - 2026-07-04

### Changed
- Input/Output boxes: link status text ("Fully covered", "Fully used", etc.) always right-aligned

## [0.3.63] - 2026-07-04

### Changed
- Production/extraction sliders: also deactivate when the mouse leaves the field (not only with Tab or click elsewhere)

## [0.3.62] - 2026-07-04

### Changed
- Production and extraction sliders: inactive until you click; mouse wheel modifies them only when focused (like numeric inputs)

## [0.3.61] - 2026-07-04

### Fixed
- Partial links + extraction: if global balance is covered (e.g. 600 from schema + 4800 from extraction), inputs and outputs show green instead of blue "External"/"Insufficient"
- Linked schema output: demand attributed to producer is at most its production, not the consumer's entire demand

## [0.3.60] - 2026-07-04

### Changed
- Input/Output boxes in resource schemas: reduced line spacing between resources, links, and subtext

## [0.3.59] - 2026-07-04

### Fixed
- Output slider in resource extractions: each step sets an exact integer value (67, 68, …) without decimals from overclock recalculation (no more 67,001)

## [0.3.58] - 2026-07-04

### Fixed
- Building panel in resource schemas: production total stays at top; machine icon and details remain centered below

## [0.3.57] - 2026-07-04

### Fixed
- Updating resource extractions, schema inputs (e.g. "Missing in chain" on iron ore) update immediately based on new balance
- Output and overclock sliders and arrows in resource extractions always advance by ±1 (no decimal steps)

## [0.3.56] - 2026-07-04

### Changed
- Values calculated to three decimals (output, overclock, rate): rounded up (e.g. 83,333… → 83,334)

## [0.3.55] - 2026-07-04

### Changed
- Building panel (machines and extractors): content always top-aligned, no longer vertically centered

## [0.3.54] - 2026-07-04

### Changed
- Deficits and chain shortages: blue boxes and text instead of red, more distinguishable from green (ok coverage)

## [0.3.53] - 2026-07-04

### Added
- Building panel in production steps: total output above machine icon, same style as schema title

## [0.3.52] - 2026-07-04

### Fixed
- Extractors/mines: arrows, spinner, and wheel on numeric fields advance by one unit (±1), as in production steps; overclock uses integer steps via slider

## [0.3.51] - 2026-07-04

### Added
- Extractors and mines: Output field with slider, linked to overclock and nodes as for production machines

## [0.3.50] - 2026-07-04

### Changed
- Production/extraction numeric fields (output, overclock, machines, nodes): readonly until you click; deactivate when leaving the field

## [0.3.49] - 2026-07-04

### Changed
- Chain shortage and link deficits: bright red boxes and text; surplus remains yellow

## [0.3.48] - 2026-07-04

### Fixed
- Links between schemas: surpluses and deficits below 0,05/min (or 0,1% of flow) no longer shown — avoids false "Surplus: 0,01/min" from decimal overclock rounding

## [0.3.47] - 2026-07-04

### Changed
- Top-right summary: Targets, Nodes, and Resources tables side by side horizontally (buttons unchanged)
- Resource extractions: under the building, per node/extractor output in bold, multiplier and overclock, then total output below

## [0.3.46] - 2026-07-04

### Changed
- New resource schemas always added at the bottom of the list, regardless of method used (button, input click, etc.)

## [0.3.45] - 2026-07-04

### Added
- Click on an input in resource schemas: opens schema addition for that resource (1 schema → automatic add, multiple schemas → choice in popup)

### Changed
- Resource selection from "Add resource schema": schema popup even with multiple main schemas, not only with alternatives

## [0.3.44] - 2026-07-04

### Fixed
- Machines field (and other numerics): typing and arrows work again; ±1 spinner only on internal arrow clicks, typing confirmed by leaving field or Enter

## [0.3.43] - 2026-07-04

### Changed
- Arrows (keyboard and spinner) in production/extraction numeric fields: always ±1 increment on integer values, like sliders

## [0.3.42] - 2026-07-04

### Added
- "Targets" table in production detail: lists resource schema outputs without links to other schemas, with quantity and source schema

## [0.3.41] - 2026-07-04

### Changed
- Overclock slider: always steps of 1 (integer values); overclock numeric field keeps decimals when calculated from output
- Total output with up to 3 decimals when overclock is not an integer (e.g. 63,333% → 19 /min)

## [0.3.40] - 2026-07-04

### Changed
- Output per machine moved to building panel (orange row): e.g. **19 /min** 1× @ 63,333%; removed separate field below overclock/machines

## [0.3.39] - 2026-07-04

### Added
- Read-only "Output / machine" field next to overclock and machines in production step

### Changed
- Overclock, machines, and output no longer linked by a toggle: changing output recalculates overclock (up to 3 decimals) without changing machines; changing machines updates total output only
- Maximum output (field and slider): base value × machines × 250% overclock, with Somersloop multiplier if active

### Removed
- Overclock/machines link icon and mode

## [0.3.38] - 2026-07-04

### Fixed
- Overclock/machines link icon centered horizontally and vertically between the two numeric fields

## [0.3.37] - 2026-07-04

### Changed
- Overclock/machines link toggle: Font Awesome `fa-link` and `fa-link-slash` icons, centered between text fields

## [0.3.36] - 2026-07-04

### Changed
- Production schema header: "Add extraction" and "Add resource schema" buttons moved to bottom left; resource summary tables aligned top right to save vertical space

## [0.3.35] - 2026-07-04

### Changed
- Resource extractions: overclock, nodes/extractors, purity, and power shard aligned on a single row

## [0.3.34] - 2026-07-04

### Changed
- Production section titles unified: **RESOURCE EXTRACTIONS** and **RESOURCE SCHEMAS** with same font, color, and size

## [0.3.33] - 2026-07-04

### Changed
- Production schema detail: extractions on the left and resource schemas on the right in a two-column layout

## [0.3.32] - 2026-07-04

### Changed
- On startup the application opens maximized full screen (window no longer resized)

## [0.3.31] - 2026-07-04

### Changed
- Main layout: maximum content width doubled (1200px → 2400px)

## [0.3.30] - 2026-07-04

### Changed
- Resources table: **Missing** column populated only if Required > Produced

## [0.3.29] - 2026-07-04

### Changed
- Nodes table: purity with capital initial (**Impure**, **Normal**, **Pure**)

## [0.3.28] - 2026-07-04

### Changed
- Resource summary table: **Required**, **Produced**, and **Missing** columns (instead of a single quantity)

## [0.3.27] - 2026-07-04

### Changed
- Resource summary table: visible for required **Crude Oil** and **Water**, not only minerals

## [0.3.26] - 2026-07-04

### Fixed
- Resource detail: schema cards no longer compressed in modal (inputs/outputs and building icons fully visible)
- Schema cards with correct bottom padding on input/output lists

## [0.3.25] - 2026-07-04

### Fixed
- Resource detail and production schemas: inputs/outputs no longer clipped at bottom; correct internal padding in schema cards

## [0.3.24] - 2026-07-04

### Changed
- Minerals table hidden when no minerals are required (no empty message)

## [0.3.23] - 2026-07-04

### Changed
- **Nodes** and **Minerals** tables side by side in top summary, not stacked

## [0.3.22] - 2026-07-04

### Changed
- Somersloop: increases output only; inputs stay at the same quantity (machines × overclock)
- New resource schema inserted at top of list, not bottom

## [0.3.21] - 2026-07-04

### Added
- **Nodes** table above minerals in summary: lists mineral + purity and total node count from configured extractions

## [0.3.20] - 2026-07-04

### Fixed
- Top minerals table: uniform continuous row separators (no broken or missing lines with green/yellow rows)

## [0.3.19] - 2026-07-04

### Fixed
- Mineral extractions: +/- arrows on Overclock increment/decrement by 1 (like Machines in resource schemas)

## [0.3.18] - 2026-07-04

### Fixed
- Miner/Purity select: selecting an entry now saves correctly (`data-extraction-id` attribute and label update)

## [0.3.17] - 2026-07-04

### Fixed
- Miner and node purity menu: open/select working (global click conflict and menu clipped by grid)

## [0.3.16] - 2026-07-04

### Added
- Mineral extractions: **+** button on each row to add another extraction of the same mineral; numbered titles (e.g. Limestone #2) when there is more than one

## [0.3.15] - 2026-07-04

### Changed
- Top minerals table: green if extractions cover demand exactly, yellow if there is surplus (like input/output links)

## [0.3.14] - 2026-07-04

### Changed
- **Nodes** slider in mineral extractions: range 1–25 (previously 1–100)

## [0.3.13] - 2026-07-04

### Changed
- Miner and node purity menu: custom dropdown with white text on hover, without system blue highlight

## [0.3.12] - 2026-07-04

### Fixed
- Resource schemas: +/- arrows on Output and Overclock increment/decrement by 1 (no longer 0,001)

## [0.3.11] - 2026-07-04

### Changed
- "Add extraction" button with same orange style as "Add resource schema"

## [0.3.10] - 2026-07-04

### Added
- **Nodes** field in mineral extractions (number of miners/nodes, with slider): multiplies output and power shards

### Fixed
- Extraction reset/delete buttons aligned with resource schemas (previously appeared as two unstyled lines)
- Extraction configuration grid: removed empty column caused by 5-column layout with only 4 fields

## [0.3.9] - 2026-07-04

### Changed
- Top minerals table: always shows real demand; green row when configured extractions fully cover required quantity

## [0.3.8] - 2026-07-04

### Changed
- Dropdown menus (miner, node purity, categories): dark theme consistent with app, more readable text, and orange accent instead of system blue

## [0.3.7] - 2026-07-04

### Added
- **Mineral extractions** section in production schemas: choose mineral, miner (Mk.1–3), node purity, and overclock
- "Add extraction" button with picker dedicated to minerals only

### Changed
- Top summary table shows only **minerals** still to cover, net of configured extractions

## [0.3.6] - 2026-07-04

### Added
- Reset button on each resource schema: 1 machine, 100%, no Somersloop, default output, links removed

## [0.3.5] - 2026-07-04

### Fixed
- Somersloop toggle: output now scales by ratio (×1,5 / ×1,25 etc.) without machine rounding drift

## [0.3.4] - 2026-07-04

### Changed
- Input/output links: green if balanced, yellow if excess, no color if insufficient

## [0.3.3] - 2026-07-04

### Fixed
- Preload script: app version read moved to main process (error `module not found: fs`)

## [0.3.2] - 2026-07-04

### Changed
- Building Somersloop slots saved in `buildings.json` and visible in Settings statistics on data restore

## [0.3.1] - 2026-07-04

### Added
- Linked outputs colored green (fully used) or yellow (surplus) in production schemas

## [0.3.0] - 2026-07-04

### Added
- Somersloop checkbox in resource schemas with production boost per slot (100% / 50% / 25%)
- `somersloop_slots` field in buildings database for Smelter, Constructor, Assembler, Foundry, Refinery, Converter, Manufacturer, Blender, Particle Accelerator, and Quantum Encoder

## [0.2.1] - 2026-07-04

### Changed
- Reduced vertical space between resource schemas in production view

## [0.2.0] - 2026-07-04

### Added
- Resource management with categories, search, and crafting schema detail
- Production chains with resource schemas, input/output links, and live recalculation
- External resources table in production schema header
- "Power shard" field calculated from overclock and machines
- Settings with default data restore and database statistics
- Buildings database imported from SCIM
- App version in footer read automatically from `package.json`
- Cursor rule for version bump and changelog on every implementation

### Changed
- Production schema layout: machine info below image, add button at top
- Linked input boxes: green if covered, yellow if partial
- Output, overclock, and machine sliders with step of 1

### Fixed
- Live input coverage update when a linked producer schema changes

## [0.1.0] - 2026-07-04

### Added
- Base Electron project with SQLite (sql.js) and SCIM-style interface
- Initial tables for items, schemas, and metadata

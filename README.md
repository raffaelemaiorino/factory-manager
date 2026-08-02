# Factory Manager

<p align="center">
  <img src="src/renderer/assets/logo.png" alt="Factory Manager logo" width="620" />
</p>

> Italiano: [`README.it.md`](README.it.md)

A local desktop app for planning Satisfactory factories.

I built it because working out production chains by hand (machines, rates, power, extractions) gets messy fast. Factory Manager keeps an item catalog, production plans, and power plans on your PC — no account, no cloud, not affiliated with Coffee Stain.

Plan chains, machines, rates, and layouts locally. Fan-made. Independent. Not affiliated with Coffee Stain.

## What’s in the app

### Production and power plans

- Browse the game item catalog and recipes
- Plan production chains: inputs, outputs, machine counts, rates, overclock, Somersloop
- Set up extractions and power (generators + fuel)
- Save projects and reopen them later

### Share and restore plans

Export and import JSON for both production and power (extractions, generators, links). One file = a backup or something you can send a friend. Imports are labeled `(import)` so they don’t get mixed up with your originals. The importer checks that the file is really a Factory Manager export before writing to the database.

### Clearer production tree

When several links run between the same nodes, labels and curves no longer sit on top of each other. More space, less clutter when the factory gets big.

### Power and power shards

- Base MW use in the catalog for extractors and production machines
- Calculated use on plans and extractions (overclock + Somersloop)
- Power shards needed in the side summary, plus a total in Info
- Dashboard KPIs for use / balance, production vs use chart, top chains, and a warning if you burn more than you produce
- Clear status: Covered / Deficit / Uncovered, with MW of headroom or shortfall

### Languages

Italian and English first, then the full SCIM catalog set (German, French, Spanish, Polish, Portuguese, Dutch, and more) — UI strings plus resource, building, and recipe names. Your language choice is kept across restarts. Arabic, Hebrew, and Persian get basic RTL layout. If a UI string is missing, it falls back to English without breaking the app.

### Desktop app, data on your PC

Windows: NSIS installer or portable build. macOS and Linux builds are available too when published. Data stays local (AppData on Windows), with automatic migration if you used an older path. Fully offline.

Footer shows the Coffee Stain disclaimer and attribution. Custom window chrome (no native Windows menu bar), updated logo, and a clearer Info popup.

### Everyday comfort

- More reliable startup on slow PCs (no leftover “ghost” process)
- Splash (“Preparing data…”) on first catalog seed
- Sticky menu while you scroll
- Dashboard KPIs in a four-column layout
- Settings: raise the caps for machines and generators
- Electron hardening, sandbox, file limits

### Update check

On launch the app can check GitHub for a newer release. If there is one, you get a dismissible banner with a download link — no forced download.

Data can be wrong or out of date after a game patch. Double-check important numbers in-game if it matters.

## Releases vs building yourself

GitHub Releases include Windows installers / portable builds (and other platforms when published). Those binaries are built from this repo with electron-builder. They are **not code-signed**, so Windows SmartScreen (and similar warnings on macOS/Linux) may complain — that is normal for an unsigned indie app, not proof the file is malicious.

If you prefer not to trust a prebuilt `.exe`, build from this source (steps below). That is the most transparent option.

## Changelog

- Italian: [`CHANGELOG.md`](CHANGELOG.md)
- English: [`CHANGELOG.en.md`](CHANGELOG.en.md)

## Build from source (step by step)

You do not need to be a developer. Roughly: install Node.js, download the code, install dependencies, run or build.

### 1. Install Node.js

1. Open [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version for your OS
3. Install it with the default options
4. Open a terminal (PowerShell on Windows, Terminal on macOS/Linux) and check:

```bash
node -v
npm -v
```

Both commands should print a version number. If they fail, restart the terminal (or reboot) and try again.

### 2. Get the source code

**Option A — Git (if you have it):**

```bash
git clone https://github.com/raffaelemaiorino/factory-manager.git
cd factory-manager
```

**Option B — ZIP from GitHub:**

1. On the GitHub repo page, click **Code → Download ZIP**
2. Unzip somewhere easy to find
3. In the terminal, `cd` into that folder

### 3. Install dependencies

From the project folder:

```bash
npm install
```

This downloads Electron and other packages. It can take a few minutes.

### 4. Run the app (no installer)

```bash
npm start
```

Or with more console logging:

```bash
npm run dev
```

Same idea on Windows, macOS, and Linux — it is a normal Electron app.

### 5. Build installers / portable apps

```bash
npm install
npm run build:win     # Windows: NSIS installer + portable exe
npm run build:mac     # macOS: .dmg
npm run build:linux   # Linux: AppImage
```

Finished files go under `dist/`.  
`npm run build` (no suffix) is the same as `npm run build:win` (kept for older habits).

#### Windows code signing (optional)

Without a certificate the Windows build is unsigned (SmartScreen may warn). To sign with Authenticode, set these before `npm run build:win`:

- `CSC_LINK` — path to `.pfx` / `.p12` (or `WIN_CSC_LINK`)
- `CSC_KEY_PASSWORD` — certificate password

electron-builder picks them up automatically.

#### macOS Gatekeeper

The macOS build has `hardenedRuntime` enabled but is **not** notarized by Apple. Gatekeeper will warn on first launch (“unidentified developer”) unless you notarize it yourself (Apple Developer account) or the user right-clicks → **Open** once to bypass the warning.

#### Linux AppImage

You get a single `AppImage` file. Make it executable (`chmod +x`) and run it, or use an AppImage launcher. Running it directly often needs `libfuse2` on the host; without that, extract and run:

```bash
./Factory*.AppImage --appimage-extract
./squashfs-root/factory-manager
```

## Architecture (for contributors)

Everything runs locally — no server or cloud backend. Data lives in a SQLite database file (via [sql.js](https://sql.js.org/), SQLite compiled to WASM) in Electron’s per-user app-data folder.

- **`electron/`** — main process: window/lifecycle (`main.js`), IPC bridge as `window.satisfactory` (`preload.js`), GitHub update check (`update-check.js`), production-view UI state JSON (`production-ui-state-store.js`).
- **`src/database/`** — data layer in the main process, reached only via IPC: schema/migrations, domain files (`items.js`, `buildings.js`, `production-chains.js`, …), seeds under `seeds/`.
- **`src/renderer/`** — UI (`index.html` + plain `<script>` files, no bundler). Load order in `index.html` matters; scripts share one global scope.
- **`src/locales/ui/`** — UI language packs (not game catalog text).
- **`scripts/`** — manual import helpers (`npm run import:*`). One-off generators live under `scripts/archive/` — see `scripts/archive/README.md`.

There is no automated test suite yet; changes are checked by running the app and trying the affected flow.

## Community

Facebook group: [Factory Manager](https://www.facebook.com/groups/factorymanager)

## Disclaimer

Factory Manager is an independent, unofficial fan project. It is not affiliated with, endorsed by, sponsored by, or connected to Coffee Stain Studios AB, Coffee Stain Publishing AB, or any Coffee Stain company.

Satisfactory and related names, trademarks, logos, images, icons, game data, and assets belong to Coffee Stain Studios AB and/or their respective owners. This app does not claim ownership of that content; game references are for identification and planning only.

Factory Manager does not replace Satisfactory, does not let you play the game, and does not ship game executables or files. It is provided as-is, without warranties.

# Factory Manager

<p align="center">
  <img src="src/renderer/assets/logo.png" alt="Factory Manager logo" width="620" />
</p>

Factory Manager is an independent, fan-made desktop planner for **Satisfactory**.  
It helps you design production lines, estimate machine counts, and validate input/output rates before you build in-game.

## Why Use It

- Build and inspect production chains visually.
- Calculate required resources and machine counts.
- Validate throughput and production rates.
- Explore extraction and energy planning flows.
- Keep factory planning data local on your machine.

## Screenshots

Add app screenshots here after launch:

```md
![Dashboard](docs/screenshots/dashboard.png)
![Production Chain](docs/screenshots/production-chain.png)
![Resource Detail](docs/screenshots/resource-detail.png)
```

Tip: create `docs/screenshots/` and drop your captures there to keep the README tidy.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Run from Source

```bash
npm install
npm start
# or: npm run dev  (adds --enable-logging for DevTools console output)
```

This project runs on Windows, macOS, and Linux as a standard Electron app.

## Build

```bash
npm install
npm run build:win
npm run build:mac
npm run build:linux
```

Build artifacts are generated under `dist/`.  
`npm run build` is kept as an alias for `npm run build:win`.

### Windows Code Signing (Optional)

To sign a Windows build with Authenticode, set:

- `CSC_LINK` (or `WIN_CSC_LINK`) to your `.pfx`/`.p12` file path
- `CSC_KEY_PASSWORD` to the certificate password

`electron-builder` picks these up automatically.

### macOS Notarization

macOS builds use `hardenedRuntime`, but are not notarized by default.  
Without notarization, Gatekeeper may show an "unidentified developer" warning on first launch.

### Linux

Linux builds produce an AppImage.  
If your system lacks `libfuse2`, extract it with:

```bash
./Factory*.AppImage --appimage-extract
./squashfs-root/factory-manager
```

## Project Structure

- `electron/` - Electron main process (window lifecycle, preload bridge, update checks, persisted UI state).
- `src/database/` - SQLite-backed data layer and domain queries, accessed via IPC.
- `src/renderer/` - Renderer UI (`index.html`, scripts, styles, assets).
- `src/locales/ui/` - Runtime-loaded interface localization packs.
- `scripts/` - Data import and maintenance utilities.

## Changelog

- Italian: [`CHANGELOG.md`](CHANGELOG.md)
- English: [`CHANGELOG.en.md`](CHANGELOG.en.md)

## Community

Join the Facebook group: [Factory Manager](https://www.facebook.com/groups/factorymanager)

## Legal Notice

Factory Manager is unofficial and is not affiliated with, endorsed by, sponsored by, or officially connected to Coffee Stain Studios AB or Coffee Stain Publishing AB.

Satisfactory and all related names, trademarks, logos, images, icons, items, recipes, and game content remain the property of their respective owners and licensors.

This tool is provided as-is without warranty, and production data/calculations may not always match the latest game balance updates.

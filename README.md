# Factory Manager

Factory Manager is an independent, unofficial, fan-made production planning tool for Satisfactory.

It is designed to help players visually plan and calculate production chains, including:

* required resources;
* production inputs and outputs;
* machine quantities;
* production rates;
* recipes and manufacturing steps;
* factory layouts and production schemes.

Factory Manager is a local application and is not affiliated with, endorsed by, sponsored by, supported by, or officially connected to Coffee Stain Studios AB, Coffee Stain Publishing AB, or any other Coffee Stain company.

Satisfactory, its name, trademarks, logos, images, icons, resources, machines, buildings, items, recipes, production elements, game data, and all related content are the property of Coffee Stain Studios AB and/or their respective owners and licensors.

The developers of Factory Manager do not claim ownership of any Satisfactory-related content. Any references, names, images, icons, or game assets used within the application are included solely for informational, descriptive, and identification purposes.

Factory Manager does not replace the original game, does not allow users to play Satisfactory, and does not distribute copies, files, or executable content from the game.

Production data and calculations may contain errors or may not always reflect the latest game updates, balancing changes, or recipe modifications.

Factory Manager is provided as-is, without warranties of accuracy, availability, or fitness for a particular purpose.

## Changelog

- Italian: [`CHANGELOG.md`](CHANGELOG.md)
- English: [`CHANGELOG.en.md`](CHANGELOG.en.md)

## Run from source

```bash
npm install
npm start          # or: npm run dev (adds --enable-logging for DevTools console output)
```

Works the same on Windows, macOS, and Linux — the app is a standard Electron app with no OS-specific setup required.

## Build

```bash
npm install
npm run build:win     # NSIS installer + portable exe
npm run build:mac     # .dmg
npm run build:linux   # AppImage
```

Artifacts land under `dist/`. `npm run build` (no suffix) is an alias for `npm run build:win`, kept for backward compatibility.

### Windows code signing (optional)

Without a certificate the Windows build is unsigned (SmartScreen may warn). To sign with Authenticode, set env vars before `npm run build:win`:

- `CSC_LINK` — path to `.pfx` / `.p12` (or `WIN_CSC_LINK`)
- `CSC_KEY_PASSWORD` — certificate password

electron-builder picks them up automatically.

### macOS notarization

The macOS build has `hardenedRuntime` enabled but is not notarized by Apple, so Gatekeeper will warn on first launch ("unidentified developer") unless you notarize it yourself (requires an Apple Developer account) or the user right-clicks → Open to bypass the warning once.

### Linux

Produces a single-file `AppImage` (`chmod +x` it and run, or use an AppImage launcher — no installation needed). Requires `libfuse2` on the host to run directly; without it, extract first with `./Factory*.AppImage --appimage-extract` and run `./squashfs-root/factory-manager`.

## Community

Join the discussion on Facebook: [Factory Manager](https://www.facebook.com/groups/factorymanager)

# TODO / Known follow-ups

Concrete items deferred from recent work, not a wishlist. See `CHANGELOG.md` / `CHANGELOG.en.md` for what's already shipped.

## Packaging

- **macOS build is config-verified only, not build-tested.** `npm run build:mac` was never actually run — this repo's active development happened on Linux, which can't produce or sign a `.dmg`. The `mac`/`dmg` config in `package.json` was checked by inspection (icon path now fixed, `hardenedRuntime`/`gatekeeperAssess` already set) but has no verified build artifact behind it. If a CI matrix (e.g. GitHub Actions with a `macos-latest` runner) gets set up, add a Mac build to it.
- **`.deb` Linux target is config-verified only, not build-tested.** `npm run build:linux` now also attempts a `.deb`, but building it locally failed on the contributor's machine (Fedora 44) because electron-builder's bundled `fpm` tool needs `libcrypt.so.1`, which wasn't installed there. The `AppImage` target *is* fully build-tested (built, extracted, launched, confirmed no console errors). `build.linux.maintainer` is set to a real contact in `package.json`; still verify a `.deb` build on a suitable Linux host before publishing that artifact.
- **No CI build matrix.** All three platform builds are currently manual (`npm run build:win` / `:mac` / `:linux`), run locally. A GitHub Actions workflow building all three on push/tag would catch platform regressions automatically and could produce/verify the Mac and `.deb` artifacts mentioned above.

## Code

- **`scripts/archive/ui-translations/build-rtl-sense.js`** and **`scripts/archive/ui-translations/sense/merge-sense.js`** each reference a file that doesn't exist anywhere in this repo's git history (`./rtl-sense-maps` and `./need-rtl-translations` respectively). This is a pre-existing gap in the original scripts, found while archiving them (not caused by the archive move) — see `scripts/archive/README.md`. Harmless since these are archived/reference-only, not run.
- **No automated test suite.** No test framework, no test files, nothing in `package.json`'s `scripts`. All verification is manual (see README's Architecture section). Worth a minimal smoke-test pass (boot, create/edit a production chain, drag-reorder, energy tab, resource edit, settings, auto-plan from targets, power MW auto-plan, tree pan/zoom/fullscreen) if a test framework ever gets introduced — particularly valuable before any further changes to the newly-split `src/renderer/scripts/` files, which have no safety net.
- **Auto-plan coverage.** Fuel generators beyond coal/fuel/nuclear (and non-coal/water extractions) still need manual wiring or companion production; Excited Photonic Matter and similar edge cases may remain external demand when no recipe exists.

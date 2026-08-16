# TODO / Known follow-ups

Concrete items deferred from recent work, not a wishlist. See `CHANGELOG.md` / `CHANGELOG.en.md` for what's already shipped.

## Packaging

- **macOS build is config-verified only, not build-tested.** `npm run build:mac` was never actually run — this repo's active development happened on Linux, which can't produce or sign a `.dmg`. The `mac`/`dmg` config in `package.json` was checked by inspection (icon path now fixed, `hardenedRuntime`/`gatekeeperAssess` already set) but has no verified build artifact behind it. If a CI matrix (e.g. GitHub Actions with a `macos-latest` runner) gets set up, add a Mac build to it.
- **`.deb` Linux target is config-verified only, not build-tested.** `npm run build:linux` now also attempts a `.deb`, but building it locally failed on the contributor's machine (Fedora 44) because electron-builder's bundled `fpm` tool needs `libcrypt.so.1`, which wasn't installed there. The `AppImage` target *is* fully build-tested (built, extracted, launched, confirmed no console errors). `build.linux.maintainer` is set to a real contact in `package.json`; still verify a `.deb` build on a suitable Linux host before publishing that artifact.
- **No CI build matrix.** All three platform builds are currently manual (`npm run build:win` / `:mac` / `:linux`), run locally. A GitHub Actions workflow building all three on push/tag would catch platform regressions automatically and could produce/verify the Mac and `.deb` artifacts mentioned above.

## Code

- **Archived RTL scripts** `scripts/archive/ui-translations/build-rtl-sense.js` and `scripts/archive/ui-translations/sense/merge-sense.js` each reference a file that doesn't exist (`./rtl-sense-maps` and `./need-rtl-translations`). Harmless — archived/reference-only. See `scripts/archive/README.md`.
- **Auto-plan coverage.** Fuel generators beyond coal/fuel/nuclear (and non-coal/water extractions) still need manual wiring or companion production; Excited Photonic Matter and similar edge cases may remain external demand when no recipe exists.
- **Export / duplicate drop cross-plan links.** Production duplicate/export omits foreign `producer_step_id`s; energy export omits production links, targets, and companion fuel plan IDs.
- **Transport train × shared dock.** Station count currently splits by `train_count`. If trains share one freight platform, belts still need the full factory rate.
- **Renderer UI** still has weaker coverage than `src/database/` (`npm test` covers auto-plan, leftover alloc, transport calc, energy scale). Smoke-test: boot, auto-plan, power leftover links, transport locale switch, dashboard fleet KPI.

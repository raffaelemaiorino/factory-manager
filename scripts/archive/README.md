# Archived scripts

Everything in this folder was a **one-off migration/build tool**, run
once (or a handful of times) to generate content that is now committed
directly under `src/locales/ui/` and `src/database/seeds/translations/`.
None of it runs as part of the app, is referenced by anything in
`src/` or `electron/`, or is wired into `package.json`'s `scripts`.
It's kept for history/reference rather than deleted outright, in case
a future locale needs the same approach as a starting point.

Specifically:

- `apply-ui-flats*.js`, `build-*-ui-locales.js`, `build-six-ui-output.js`,
  `generate-ui-locales.js`, `merge-ui-locale-flat.js`,
  `ui-locale-pack-util.js`, `_en-flat.json` — generated the initial
  multi-language UI text packs from a flat EN source + overlays.
- `ui-legal-locales*.js` — generated the localized legal/disclaimer text
  bundled into each UI pack.
- `fill-ui-translations-part*.js`, `machine-translate-*.js` — filled
  gaps in specific locale packs via a machine-translation API.
- `ui-locale-overlays/` — the per-language JSON overlays those scripts
  consumed.
- `ui-translations/` (including `ui-translations/sense/`) — the RTL
  locale pipeline (Arabic, Hebrew, Farsi, Thai, Ukrainian): builders,
  intermediate "sense" translation files, and merge scripts used to
  hand-tune right-to-left language packs.

**Note:** `ui-translations/build-rtl-sense.js` and
`ui-translations/sense/merge-sense.js` reference files
(`./rtl-sense-maps`, `./need-rtl-translations`) that don't exist
anywhere in this repo's history — that's a pre-existing gap in the
original scripts, not something introduced by archiving them.

## Still-live tooling (not archived)

These remain at `scripts/` (top level) because they're wired into
`package.json`'s `import:*` scripts and are the way to pull fresh game
data or add a new locale going forward: `import-items.js`,
`import-buildings.js`, `import-building-power.js`,
`import-item-details.js`, `import-locale.js`, `import-locale-all.js`,
plus their shared dependencies `scim-http.js`, `scim-detail-parser.js`,
and `scim-locales.js`.

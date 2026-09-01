---
name: starting-an-app
description: The setup wizard - clone placement, the outer gitignore, a capability interview in plain language, scaffolding via sgs:init, and de-wiring main.js for whatever was left out. Use when creating a new app from this repo, when someone asks "how do I start", or when an app was scaffolded with capabilities it doesn't want.
---

# Starting an app

Terms are in [VOCABULARY.md](../../../VOCABULARY.md); the filesystem convention is in
[CONTRIBUTING.md](../../../CONTRIBUTING.md). The short version: the CLONE plays
`node_modules` (gitignored, never edited, kept at latest), the APP is a one-time copy that
the outer repo tracks normally, and the MANIFEST (`sgs.json`) — not the clone — is the pin.

## 1. Place the clone

Inside the directory where the app should live (a whole repo, or one folder of a monorepo):

```bash
cd path/to/my-app
git clone https://github.com/s-frantz/sleek-geospatial-skills
```

Then, in the OUTER repo's `.gitignore` (create it if the app is its own fresh repo):

```gitignore
sleek-geospatial-skills/
```

The clone must stay pristine. Never edit it; `git -C sleek-geospatial-skills status` should
always be clean, and `git -C sleek-geospatial-skills pull` is always safe because the app's
pin is its manifest, not the clone's checkout. Contributions happen on branches in the clone
(see `contributing-upstream`), which is the one exception to "never touch it".

## 2. Interview, by capability

Ask in plain language, one at a time — the questions live in
`scripts/sgs-capabilities.json` (`asks` field), and the core set ships regardless. Do NOT ask
about component ids; the capability map resolves those. Also collect, while you are here:

- the app's name (for `<title>` and the panel heading),
- whether the demo data stays, and if not, roughly where on earth the map should open.

Someone who says "just give me everything" gets everything: `sgs:init` with no flags is the
full demo, and it runs green as copied.

## 3. Scaffold

From the app directory (the clone's parent):

```bash
node sleek-geospatial-skills/scripts/sgs-init.mjs . --with popups,settings,tooltips,demo-data
cd . && npm install && npm start
```

The script copies the core set plus the chosen capabilities' components, filters
`index.html`'s stylesheet links down to what was copied, writes `sgs.json` naming ONLY the
copied components, and refuses to scaffold inside the clone itself.

## 4. De-wire what was omitted

The script cannot edit JavaScript, so `app/js/main.js` still wires everything. For each
omitted capability, remove its wiring — this table is checked against the real `main.js`:

| omitted | remove from `main.js` | and elsewhere |
|---|---|---|
| `layer-panel` | `initPanel` + `renderLayerRows` imports and calls | the `#sgs-panel` block in `index.html` |
| `table-dock` | `initDock`, `toggleLayerTable` imports and calls; the `onOpenTable:` line in the `openPopup` call; the row callback passed to `renderLayerRows` | dock tests in `tests/e2e/layout.spec.js` |
| `popups` | `openPopup` import; the whole `map.on('click', glId, …)` block and its `mouseenter`/`mouseleave` cursor lines | `tests/e2e/popup.spec.js` entirely |
| `tooltips` | `installTooltips` import and call | tooltip tests in `layout.spec.js` |
| `settings` | `settingsControl` import and its `addControl` line; `toggleQuickSettings` import; the `?` key handler | settings tests in `layout.spec.js` |
| `about-window` | `openAboutWindow` import; the `makeControl([{ glyph: 'info', … }])` block | the large-window test in `popup.spec.js` |
| `dev-guides` | nothing (CSS-only, opt-in) | — |
| `demo-data` | nothing in `main.js`; edit `LAYERS` in `app/js/layers.js` to describe the real data (an empty array boots cleanly), and set `INITIAL_CENTER`/`INITIAL_ZOOM` in `app/js/map.js` | delete `app/data/*.geojson`; most e2e tests assume the demo layers — rewrite or remove them |

If `settings` stays but other key-bound capabilities go, keep the SHORTCUTS inventory in
`quick-settings.js` matching what is actually bound — `main.js`'s comment states that rule.

## 5. Prove it

```bash
npm run verify
```

All four rungs, from the app directory. A trimmed app is DONE when verify is green, not when
the browser looks right — copied specs for removed capabilities must be deleted or rewritten,
not skipped. Quote the numbers.

## Checklist

- [ ] Clone beside the app; outer `.gitignore` ignores it; `git -C <clone> status` clean.
- [ ] Interview asked capabilities in plain language, one at a time.
- [ ] `sgs.json` lists exactly the copied components, watermarked at the clone's latest tag.
- [ ] Every omitted capability de-wired per the table, tests included.
- [ ] Title, panel heading, map centre and data set to the user's answers.
- [ ] `npm run verify` green, numbers quoted.

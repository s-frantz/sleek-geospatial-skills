---
name: app-start
description: The setup wizard - clone placement, the outer gitignore, reading the decision log before asking anything, a capability interview in plain language, scaffolding via sgs:init, and de-wiring main.js for whatever was left out. Use when creating a new app from this repo, when someone asks "how do I start", or when an app was scaffolded with capabilities it doesn't want.
---

# Starting an app

**Wrong skill if the app already exists.** This one interviews a blank page: it asks whether
you want a layer panel, which is not a question for somebody who has one. Use `app-adopt`
instead, which offers three answers per capability rather than two and knows how to take the
lessons without the files.

Terms are in [VOCABULARY.md](../../../VOCABULARY.md); the filesystem convention is in
[CONTRIBUTING.md](../../../CONTRIBUTING.md). The short version: the APP is a one-time copy
the outer repo tracks normally, the MANIFEST (`sgs.json`) is its pin, and the CLONE is a tool
checkout the app never records a path to.

## 1. Place the clone

One clone serves any number of apps on any number of versions, so put it once, at the top of
whatever repo the apps live in:

```bash
cd path/to/monorepo
git clone https://github.com/s-frantz/sleek-geospatial-skills .sgs
echo '.sgs/' >> .gitignore
```

One clone per app also works, and so does none. Nothing in an app points at it: `sgs:status`
and `sgs:drift` search for a directory named `.sgs` or `sleek-geospatial-skills` in the app
or any ancestor, or take `$SGS_CLONE`. So the placement question is genuinely low stakes, and
"I deleted it" is not a broken app, it is two commands that will ask you to re-clone.

The clone must stay pristine. Never edit it; `git -C .sgs status` should always be clean, and
`git -C .sgs pull` is always safe because an app's pin is its manifest, not the clone's
checkout. Contributions happen on branches in the clone (see `app-contribute`), which
is the one exception to "never touch it".

## 2. Read the decision log before asking anything

If `sgs-decisions.md` exists in the target directory, this app has been through some of this
before. Read it first, and do not re-ask what it already answers at the current version.

That file is the reason this step exists. An interview is expensive for the person answering
it and free for the agent asking, which is a bad ratio, and the failure it produces is not a
re-asked question — it is a *reversed* one: a later session sees no popups, assumes an
oversight, and helpfully adds them back. A decision recorded with its reason cannot be
mistaken for an omission.

Nothing to read on a genuinely new app, and `sgs:init` seeds the file with the capability
choice at the end of this step. Append to it as you go; never rewrite it. A decision that was
later reversed gets a NEW entry saying so, because which way it went first is the useful part.

## 3. Interview, by capability

Ask in plain language, one at a time — the questions live in
`scripts/sgs-capabilities.json` (`asks` field), and the core set ships regardless. Do NOT ask
about component ids; the capability map resolves those. Also collect, while you are here:

- the app's name (for `<title>` and the panel heading),
- whether the demo data stays, and if not, roughly where on earth the map should open.

Someone who says "just give me everything" gets everything: `sgs:init` with no flags is the
full demo, and it runs green as copied.

## 4. Scaffold

From the repo root, naming where the app should go:

```bash
node .sgs/scripts/sgs-init.mjs products/my-app --with popups,settings,tooltips,demo-data
cd products/my-app && npm install && npm start
```

The script copies the core set plus the chosen capabilities' components, filters
`index.html`'s stylesheet links down to what was copied, writes `sgs.json` naming ONLY the
copied components, and refuses to scaffold inside the clone itself.

It also copies, capability-scoped, the SKILLS for what it copied, into
`<app>/.claude/skills/`, plus a generated `CLAUDE.md` listing them and `VOCABULARY.md` for
the terms. So an agent opening the app finds instructions for the code that is actually there
at the version it is pinned to, without knowing the clone exists. If you are in the app
directory from here on, those are the skills you are reading.

Tell the user to open their session IN the app directory. Skills are discovered from the
working directory downward: from the app they are there at startup, and only that app's set.
From the monorepo root they arrive lazily, the first time Claude reads a file inside the app,
so a root-started session can answer its first question without them.

## 5. De-wire what was omitted

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

## 6. Prove it

```bash
npm run verify
```

All four rungs, from the app directory. A trimmed app is DONE when verify is green, not when
the browser looks right — copied specs for removed capabilities must be deleted or rewritten,
not skipped. Quote the numbers.

## Checklist

- [ ] Clone placed (root is the default); outer `.gitignore` ignores it; `git -C <clone>
      status` clean.
- [ ] `<app>/.claude/skills/` holds only the skills for the capabilities taken, and
      `<app>/CLAUDE.md` lists the same set.
- [ ] `sgs-decisions.md` read BEFORE the interview, and nothing it already answers at the
      current version was asked again.
- [ ] Interview asked capabilities in plain language, one at a time.
- [ ] Every answer that was a JUDGMENT rather than a default is appended to
      `sgs-decisions.md` with its reason and the version it was decided at.
- [ ] `sgs.json` lists exactly the copied components, watermarked at the clone's latest tag.
- [ ] Every omitted capability de-wired per the table, tests included.
- [ ] Title, panel heading, map centre and data set to the user's answers.
- [ ] `npm run verify` green, numbers quoted.

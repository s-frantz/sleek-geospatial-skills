# sleek geospatial skills

Conventions for building MapLibre applications, written as agent skills, with a small runnable
app to practise them on.

Most MapLibre tutorials stop at "here is a map". The awkward part starts afterwards: a panel
over one side, a table across the foot, popups that must not land on either, a control stack
whose icons never quite look the same size, and a camera that keeps centring things underneath
the furniture. This repo is about that part.

```bash
git clone https://github.com/s-frantz/sleek-geospatial-skills
cd sleek-geospatial-skills
npm install
npm start          # http://localhost:4173
```

No build step, no bundler, no API key. The basemap is
[OpenFreeMap](https://openfreemap.org/) Liberty, which is free and keyless, and the two demo
layers are GeoJSON files in the repo.

## What is in the app

| | |
|---|---|
| **Left panel** | four postures (docked, manual width, manual height, floating), a pin, edge grips that double-click back to automatic, and a stow that gives the pixels back |
| **Bottom dock** | a band that folds, and goes on reporting what is in it while folded |
| **Popups** | two placement strategies, leader lines, and a refusal to cover the app's own furniture |
| **Control stack** | custom MapLibre controls that look native, with glyphs sized and centred by measurement |
| **Large window** | one modal shell with layout slots, placeholder content, and an Escape key that closes only the topmost thing |
| **Settings** | a small popover: theme, popup placement, shortcut hints |

The panel's INTERIOR is deliberately thin: a checkbox, a colour swatch, zoom-to, and open-in-
table, built from a hardcoded array in `app/js/layers.js`. There is no layer model, no config
schema and no symbology, because those are the parts most likely to be wrong for your data. The
geometry and the relationships are the parts worth taking.

## Building your own app on this

```bash
cd my-app
git clone https://github.com/s-frantz/sleek-geospatial-skills
node sleek-geospatial-skills/scripts/sgs-init.mjs . --with popups,settings,demo-data
```

The clone plays `node_modules` (gitignored by your repo, never edited, kept at latest); the
scaffold is a one-time copy your repo tracks normally; and `sgs.json` — not the clone — is
your version pin. Nothing is ever imported live from this repo, so your app stays runnable if
this one disappears. `--with` picks capabilities in plain language (see
`scripts/sgs-capabilities.json`); no flags copies the whole demo. The
[`starting-an-app`](.claude/skills/starting-an-app/SKILL.md) skill is the full wizard,
interview included.

What travels: a small token canon (`app/css/tokens.css`, referenced elsewhere with a CSS
fallback), self-contained components (`app/css/components/*.css` + paired `.js`), and a
framework CONTRACT rather than fixed code — mark any element `data-sgs-furniture` and it
participates in camera padding and popup obstacle avoidance with nothing to register anywhere
else. The demo furniture (`main.js`, `panel.js`, `dock.js`, `popup.js`, `furniture.css`) is
yours from the moment it's copied.

```bash
npm run sgs:status path/to/your-app    # did upstream move past my watermarks?
npm run sgs:drift  path/to/your-app    # did MY COPY move away from my watermarks?
```

Both read the clone's git history against `sgs.json`'s per-component watermarks; neither is
fooled by tag churn or by your customizations. Status feeds the
[`upgrading-an-app`](.claude/skills/upgrading-an-app/SKILL.md) skill; drift feeds
[`contributing-upstream`](.claude/skills/contributing-upstream/SKILL.md). Terms:
[VOCABULARY.md](VOCABULARY.md). Full detail: [CONTRIBUTING.md](CONTRIBUTING.md).

## What is in the skills

`.claude/skills/`, fourteen of them. Each points at real files and a runnable command.

| skill | the short version |
|---|---|
| [`boot-order`](.claude/skills/boot-order/SKILL.md) | vendored globals with `defer`, a module entry that cannot race them |
| [`theme-tokens`](.claude/skills/theme-tokens/SKILL.md) | three theme states, not two, and no flash on load |
| [`map-control-icons`](.claude/skills/map-control-icons/SKILL.md) | the specificity trap that silently ignores your control CSS |
| [`icon-centering`](.claude/skills/icon-centering/SKILL.md) | size and centring are two problems; measure both |
| [`panel-anatomy`](.claude/skills/panel-anatomy/SKILL.md) | four postures, one applier, geometry as CSS variables |
| [`stow`](.claude/skills/stow/SKILL.md) | FOLD, CLOSE, MARK, BERTH, and the test that picks one |
| [`overlay-window`](.claude/skills/overlay-window/SKILL.md) | one modal shell, and one owner for the Escape key |
| [`popup-placement`](.claude/skills/popup-placement/SKILL.md) | CLEAN versus ADJACENT, and what a popup refuses to sit on |
| [`chrome-aware-camera`](.claude/skills/chrome-aware-camera/SKILL.md) | why `fitBounds` puts your feature under the panel |
| [`verify-in-the-browser`](.claude/skills/verify-in-the-browser/SKILL.md) | four rungs of proof, and the one rung not shipped |
| [`upgrading-an-app`](.claude/skills/upgrading-an-app/SKILL.md) | two mechanical steps, then two that need real judgment |
| [`starting-an-app`](.claude/skills/starting-an-app/SKILL.md) | the setup wizard: clone placement, capability interview, de-wiring |
| [`contributing-upstream`](.claude/skills/contributing-upstream/SKILL.md) | drift triage, and the clean-room path back |
| [`maintenance`](.claude/skills/maintenance/SKILL.md) | the anti-bloat laws, and the skill-accuracy audit ritual |

If you use Claude Code, cloning the repo is enough: skills in `.claude/skills/` are picked up
automatically. If you do not, they are ordinary Markdown and read fine on their own.

## Verification

Four rungs, each exiting non-zero on failure.

```bash
npm run typecheck   # 1 TYPE      tsc --noEmit over JSDoc-annotated JS
npm run test:unit   # 2 UNIT      placement arithmetic, bounding boxes
npm test            # 3 GEOMETRY  Playwright, getBoundingClientRect
npm run icons       # 4 INK       pixel measurement of every icon glyph
npm run verify      # all four
```

`npm run icons` prints a table like this, and fails the build when a glyph is out of tolerance:

```
  glyph            ink w x h     want     dx      dy    headroom T/R/B/L
  gear             17.00 x 17.00  17.00    0.50    0.50    7.00  6.00  6.00  7.00
  info             17.50 x 17.50  17.00    0.25    0.25    6.50  6.00  6.00  6.50
```

There is no golden-image comparison anywhere in this repo, on purpose.
[`verify-in-the-browser`](.claude/skills/verify-in-the-browser/SKILL.md) explains why, and when
you might reasonably disagree.

## Types without a build step

The app is JavaScript with JSDoc annotations, checked by `tsc --noEmit` with `allowJs` and
`checkJs`. Real type errors and real editor intellisense; nothing is transpiled, and what you
read in `app/js/` is exactly what the browser runs.

## Layout

```
app/          the runnable application
  index.html  data/  vendor/
  css/        tokens.css  components/*.css  furniture.css
  js/         main.js map.js layers.js icons.js  ui/  utils/
scripts/      serve.mjs  icon-ink.mjs  icon-targets.json
               sgs-init.mjs  sgs-status.mjs  sgs-drift.mjs
               sgs-components.json (the registry)  sgs-capabilities.json (the interview map)
tests/        unit/ (rung 2)  e2e/ (rung 3)
.claude/skills/   the fourteen skills
types/        ambient declarations for the vendored globals
VOCABULARY.md     every framework term, defined once
CONTRIBUTING.md   the filesystem convention; starting, upgrading, contributing
CHANGELOG.md      one entry per release; Breaking: lines name affected components
```

## Licence

MIT. Take what is useful.

# sleek geospatial skills

Components for MapLibre apps, each paired with an agent skill that explains how to use it,
change it, and keep it up to date.

The components are the parts of a map app that sit around the map: a side panel, a table
along the bottom, popups, map controls, a modal window, and light and dark themes. The skills
are opinionated, and each one records a decision and the alternative it beat. They are also
flexible. You copy only the components you want and change them however you like. Two
commands then tell you what has been fixed here since, and which of your own changes might
be worth sending back.

## Run the demo

```bash
git clone https://github.com/s-frantz/sleek-geospatial-skills
cd sleek-geospatial-skills
npm install
npm start          # http://localhost:4173
```

No build step and no API key. The basemap is [OpenFreeMap](https://openfreemap.org/) Liberty.
The data is eight Portland neighborhoods (public domain) and six invented points. Sources are
in [app/data/README.md](app/data/README.md).

| | |
|---|---|
| **Left panel** | docked or undocked, width and height set independently, a dock button, edge grips that double-click back to automatic, and a stow that gives the pixels back |
| **Table** | a band that folds, goes on reporting what is in it while folded, and rises to symmetric margins while folding the panel out of its way |
| **Popups** | two placement strategies, leader lines, and a refusal to cover the app's own furniture |
| **Control stack** | custom MapLibre controls that look native, with glyphs sized and centred by measurement |
| **Large window** | one modal shell with layout slots, placeholder content, and an Escape key that closes only the topmost thing |
| **Settings** | a small popover: theme, popup placement, shortcut hints |

The panel's contents are deliberately thin: a checkbox, a colour swatch, zoom-to and
open-in-table per layer, from a hardcoded array in `app/js/layers.js`. There is no layer
model, config schema or symbology, because those are the parts most likely to be wrong for
your data.

## Start an app

```bash
git clone https://github.com/s-frantz/sleek-geospatial-skills .sgs
echo '.sgs/' >> .gitignore
node .sgs/scripts/sgs-init.mjs products/my-app --with popups,settings,demo-data
```

This copies the components you asked for into `products/my-app`, along with their skills, and
writes `sgs.json` recording which version each came from. No `--with` copies the whole demo;
the capability names are in `scripts/sgs-capabilities.json`. From then on the app is yours:
it runs, tests and ships without the clone.

The [`app-start`](.claude/skills/app-start/SKILL.md) skill walks through this as an interview.
If the app already exists, use [`app-adopt`](.claude/skills/app-adopt/SKILL.md) instead.

## Pull in upstream changes

```bash
git -C .sgs pull
npm run sgs:status path/to/your-app    # which components have changed here since you copied them?
```

Nothing is applied for you. For each component that is behind, read the
[CHANGELOG](CHANGELOG.md) and decide whether the fix applies to your copy. The
[`app-upgrade`](.claude/skills/app-upgrade/SKILL.md) skill walks through it.

## Send changes back

```bash
npm run sgs:drift path/to/your-app     # which of your copied files have you changed?
```

For each changed file, decide whether it is a fix any app would want, a deliberate split
(eject it), or just your app being your app. Fixes come back as a pull request against this
repo's demo, never as a paste of your app's code. The
[`app-contribute`](.claude/skills/app-contribute/SKILL.md) skill walks through it.

Run status and drift together: a file that is both behind and changed is where the same
lesson was learned twice.

## Verify

```bash
npm run typecheck   # 1 TYPE      tsc --noEmit over JSDoc-annotated JS
npm run test:unit   # 2 UNIT      placement arithmetic, bounding boxes
npm test            # 3 GEOMETRY  Playwright, getBoundingClientRect
npm run icons       # 4 INK       pixel measurement of every icon glyph
npm run verify      # all four
```

The JavaScript is type-checked but never transpiled: what is in `app/js/` is what the browser
runs. There are no golden screenshots; [`app-verify`](.claude/skills/app-verify/SKILL.md)
explains why.

## Skills

In `.claude/skills/`. Claude Code picks them up automatically; without it they are ordinary
Markdown. A skill that describes a component travels into an app with that component; the
ones for starting an app and for maintaining this repo stay here.

**Procedures** are run by name, roughly in this order. `app-` acts on your app, `repo-` on
this one.

| # | skill | when |
|---|---|---|
| 1 | [`app-start`](.claude/skills/app-start/SKILL.md) | once, at the beginning, on a blank page: clone placement, the capability interview, scaffolding, de-wiring what you left out |
| 1b | [`app-adopt`](.claude/skills/app-adopt/SKILL.md) | instead of the above when the app already exists: the shape question, three answers per capability, the bake-off protocol |
| 2 | [`app-verify`](.claude/skills/app-verify/SKILL.md) | constantly, from then on: the four rungs, and the rule that if you cannot print the number you are asserting, you are eyeballing |
| 3 | [`app-upgrade`](.claude/skills/app-upgrade/SKILL.md) | periodically: did upstream move past me, and does the lesson apply |
| 4 | [`app-contribute`](.claude/skills/app-contribute/SKILL.md) | periodically, paired with the above: did I move past my watermark, and does it belong back here |
| - | [`repo-maintain`](.claude/skills/repo-maintain/SKILL.md) | only in this repo: the five admission gates, and the skill-accuracy audit |

**Conventions** are consulted while building; an agent loads them when the work matches. `ui-`
is the app's own chrome, `map-` is what MapLibre makes you decide.

| skill | the short version |
|---|---|
| [`ui-boot`](.claude/skills/ui-boot/SKILL.md) | vendored globals with `defer`, a module entry that cannot race them |
| [`ui-theme`](.claude/skills/ui-theme/SKILL.md) | three theme states, every colour defined once, a dark palette of adjacent tones, no flash on load |
| [`ui-furniture`](.claude/skills/ui-furniture/SKILL.md) | the panel and the table: three facts not four postures, one applier, TIGHT/MANUAL/FULL |
| [`ui-stow`](.claude/skills/ui-stow/SKILL.md) | FOLD, CLOSE, MARK, DOCK, SNAP, and the test that picks one |
| [`ui-window`](.claude/skills/ui-window/SKILL.md) | one modal shell, a rail of pages, and one owner for the Escape key |
| [`ui-icons`](.claude/skills/ui-icons/SKILL.md) | size and centring are two problems; measure both |
| [`map-controls`](.claude/skills/map-controls/SKILL.md) | the specificity trap that silently ignores your control CSS |
| [`map-popups`](.claude/skills/map-popups/SKILL.md) | CLEAN versus ADJACENT, and what a popup refuses to sit on |
| [`map-camera`](.claude/skills/map-camera/SKILL.md) | why `fitBounds` puts your feature under the panel |

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
.claude/skills/   the skills, one directory each
types/        ambient declarations for the vendored globals
VOCABULARY.md     every framework term, defined once
CONTRIBUTING.md   how apps relate to this repo, how a change reaches main, naming, the decision log
CHANGELOG.md      one entry per release; Breaking: lines name affected components
```

## Licence

MIT. Take what is useful.

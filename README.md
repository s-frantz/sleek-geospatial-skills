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
layers are GeoJSON files in the repo: Portland's 94 real neighborhood boundaries, public
domain from the city's own open data, and a scatter of invented points to go with them. See
[app/data/README.md](app/data/README.md) for provenance.

## What is in the app

| | |
|---|---|
| **Left panel** | docked or floating, width and height independently pinnable, a pin, edge grips that double-click back to automatic, and a stow that gives the pixels back |
| **Bottom dock** | a band that folds, goes on reporting what is in it while folded, and rises to symmetric margins while folding the panel out of its way |
| **Popups** | two placement strategies, leader lines, and a refusal to cover the app's own furniture |
| **Control stack** | custom MapLibre controls that look native, with glyphs sized and centred by measurement |
| **Large window** | one modal shell with layout slots, placeholder content, and an Escape key that closes only the topmost thing |
| **Settings** | a small popover: theme, popup placement, shortcut hints |

The panel's INTERIOR is deliberately thin: a checkbox, a colour swatch, zoom-to, and open-in-
table, built from a hardcoded array in `app/js/layers.js`. There is no layer model, no config
schema and no symbology, because those are the parts most likely to be wrong for your data. The
geometry and the relationships are the parts worth taking. The DATA is real so that the demo
exercises real shapes: 94 polygons with genuine topology, not rectangles that happen to render.

## Building your own app on this

```bash
git clone https://github.com/s-frantz/sleek-geospatial-skills .sgs
echo '.sgs/' >> .gitignore
node .sgs/scripts/sgs-init.mjs products/my-app --with popups,settings,demo-data
```

The scaffold is a one-time copy your repo tracks normally, and `sgs.json` is your version
pin. `--with` picks capabilities in plain language (see `scripts/sgs-capabilities.json`); no
flags copies the whole demo. The
[`app-start`](.claude/skills/app-start/SKILL.md) skill is the full wizard,
interview included.

**The clone is a tool checkout, not a dependency.** Your app builds, runs, tests and ships
with no clone of this repo on the machine: it carries its own tooling, and its own skills,
scoped to the capabilities it took. Only `sgs:status` and `sgs:drift` want a clone, because
only they read release history, and they find one themselves rather than following a path
your app recorded. One clone at latest serves any number of apps pinned to any number of
older versions.

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

Both read a clone's git history against `sgs.json`'s per-component watermarks; neither is
fooled by tag churn or by your customizations, and neither reports an all-clear for a
watermark it could not read. Status feeds the
[`app-upgrade`](.claude/skills/app-upgrade/SKILL.md) skill; drift feeds
[`app-contribute`](.claude/skills/app-contribute/SKILL.md). Terms:
[VOCABULARY.md](VOCABULARY.md). Full detail: [CONTRIBUTING.md](CONTRIBUTING.md).

## What is in the skills

`.claude/skills/`, fifteen of them. Each points at real files and a runnable command.

A skill's name says which of two kinds it is, and the two kinds are used completely
differently:

- **Procedures** — things you RUN, with a beginning, an end and a checklist. You invoke these
  by name, and they come in a rough order. Prefixed `app-` when they act on YOUR app,
  `repo-` when they act on this repo.
- **Conventions** — things you CONSULT while building. You rarely type their names; an agent
  pulls them in because the description matches what you are touching. Prefixed by domain:
  `ui-` for the app's own chrome, `map-` for what MapLibre makes you decide.

### Procedures, in the order you meet them

| # | skill | when |
|---|---|---|
| 1 | [`app-start`](.claude/skills/app-start/SKILL.md) | once, at the beginning, on a blank page: clone placement, the capability interview, scaffolding, de-wiring what you left out |
| 1b | [`app-adopt`](.claude/skills/app-adopt/SKILL.md) | instead of the above when the app already exists: the shape question, three answers per capability, the bake-off protocol |
| 2 | [`app-verify`](.claude/skills/app-verify/SKILL.md) | constantly, from then on: the four rungs, and the rule that if you cannot print the number you are asserting, you are eyeballing |
| 3 | [`app-upgrade`](.claude/skills/app-upgrade/SKILL.md) | periodically: did upstream move past me, and does the lesson apply |
| 4 | [`app-contribute`](.claude/skills/app-contribute/SKILL.md) | periodically, paired with the above: did I move past my watermark, and does it belong back here |
| — | [`repo-maintain`](.claude/skills/repo-maintain/SKILL.md) | only in this repo: the five admission gates, and the skill-accuracy audit |

Steps 3 and 4 are one habit, not two chores: a file that is both drifted AND behind is exactly
where a lesson was learned twice independently.

### Conventions, by subject

| skill | the short version |
|---|---|
| [`ui-boot`](.claude/skills/ui-boot/SKILL.md) | vendored globals with `defer`, a module entry that cannot race them |
| [`ui-theme`](.claude/skills/ui-theme/SKILL.md) | three theme states, not two, and no flash on load |
| [`ui-furniture`](.claude/skills/ui-furniture/SKILL.md) | the panel and the dock: three facts not four postures, one applier, TIGHT/PINNED/FULL |
| [`ui-stow`](.claude/skills/ui-stow/SKILL.md) | FOLD, CLOSE, MARK, BERTH, PIN, SNAP, and the test that picks one |
| [`ui-window`](.claude/skills/ui-window/SKILL.md) | one modal shell, a rail of pages, and one owner for the Escape key |
| [`ui-icons`](.claude/skills/ui-icons/SKILL.md) | size and centring are two problems; measure both |
| [`map-controls`](.claude/skills/map-controls/SKILL.md) | the specificity trap that silently ignores your control CSS |
| [`map-popups`](.claude/skills/map-popups/SKILL.md) | CLEAN versus ADJACENT, and what a popup refuses to sit on |
| [`map-camera`](.claude/skills/map-camera/SKILL.md) | why `fitBounds` puts your feature under the panel |

If you use Claude Code, cloning the repo is enough: skills in `.claude/skills/` are picked up
automatically. If you do not, they are ordinary Markdown and read fine on their own.

Twelve of the fifteen also travel INTO an app, scoped to its capabilities, because a
component owns the skill that describes it. `app-start`, `app-adopt` and `repo-maintain` stay
here: two are for a decision taken before the app has any of these files, the third is for this
repo.

### The naming law

**A skill is named for its category and its subject, and nothing else.** No version, no
adjective, no "-guide" or "-conventions" suffix. Adding one means picking its prefix first,
and if no prefix fits, that is a signal about the skill rather than about the scheme.

The scheme's first real test was `app-adopt`, which the naming made obvious before the skill
existed: `app-start` interviews a blank page, so the person arriving with an application
already written had no entry point. It has one now, and `sgs:init` grew the two flags it needs
(`--eject` and `--manifest-only`) rather than the skill describing a workflow the tools could
not perform.

### The decision log

An app scaffolded here gets `sgs-decisions.md` beside its `sgs.json`, and the two are a pair:
the manifest records WHAT the app took and at which version, the log records WHY, in the words
the question was asked in.

It exists because the interview is expensive and agents have no memory of it. Without a log,
the next session opens the app, cannot tell a deliberate omission from an oversight, and asks
again — or worse, quietly re-adds something that was refused on purpose. `app-start` writes it,
`app-upgrade` and `app-contribute` append to it, and all three READ IT BEFORE ASKING ANYTHING.

A question already answered at the CURRENT version is not re-asked. A question answered at an
older version is re-asked only if `sgs:status` says that component actually moved in between,
which is the whole point of stamping each entry with a version.

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
[`app-verify`](.claude/skills/app-verify/SKILL.md) explains why, and when
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

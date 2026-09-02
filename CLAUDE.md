# Working in this repo

This is a conventions repo. The app exists so the conventions have something to be true about,
which means a change that makes the app better while making a convention less clear is a bad
trade.

## Read the skill first

`.claude/skills/` holds fourteen skills. Before changing anything, read the one that covers it.

Names carry their category: `app-` procedures act on an app, `repo-` procedures act on this
repo, `ui-` and `map-` conventions are consulted while building. Procedures run in a rough
order (`app-start`, then `app-verify` forever, then `app-upgrade` paired with
`app-contribute`); conventions have no order, only a subject. See README.md for the map.

| touching | read |
|---|---|
| `index.html`, `app/vendor/` | `ui-boot` |
| colours, `css/tokens.css`, theme | `ui-theme` |
| map controls, `control-stack.js` | `map-controls` |
| `icons.js`, any glyph art | `ui-icons` |
| `panel.js`, `css/furniture.css` | `ui-furniture` |
| any collapse, hide or minimise | `ui-stow` |
| modals, dialogs, the Escape key | `ui-window` |
| popups, tooltips, anything anchored | `map-popups` |
| `fitBounds`, `easeTo`, zoom-to | `map-camera` |
| tests, or claiming something works | `app-verify` |
| `furniture.js`, `data-sgs-furniture`, the camera/popup contract | `map-camera` |
| `sgs.json`, `sgs:status`, syncing an app against this repo | `app-upgrade` |
| creating a new app, `sgs:init`, the capability interview | `app-start` |
| `sgs:drift`, sending a fix back, ejecting a component | `app-contribute` |
| adding a component id, a capability, a skill, or anything at all | `repo-maintain` |

Framework terms (clone, app, manifest, watermark, drift, ejected, tier, capability) are
defined once, in `VOCABULARY.md` — link there, never redefine.

Twelve of these fourteen also travel into apps: a component owns the SKILL.md that describes
it, listed among its files in `sgs-components.json`, so `sgs:init` copies it exactly when it
copies the code. Writing or moving a skill means editing that file too. `app-start` and
`repo-maintain` belong to no component and stay here.

## Editing sgs-components.json or sgs-capabilities.json

Adding a file to an existing component's list is a normal change, and that includes a
`.claude/skills/<name>/SKILL.md`: a skill is one of the component's files. Minting, renaming or
splitting a component id is bigger than it looks: every existing app's `sgs.json` still names
the old id, and `sgs:status`/`sgs:drift` report it as unknown until the manifest is updated —
so the CHANGELOG entry must say what manifests should do. The `repo-maintain` skill carries the
tests an addition must pass; read it before growing either file.

## House rules

**Measure, do not eyeball.** Never put a number in `SIZE_FACTOR` or `NUDGE` that did not come
out of `npm run icons`. A guess reads exactly like a result, which makes it worse than leaving
the entry out.

**Say what you ran.** "13 passed" is a result. "Looks right" is not. If you skipped a rung, say
which and why.

**Comments explain WHY.** The what is in the code. Most doc comments here record a decision and
the alternative it beat, and several record a bug that has actually happened. That is the
repo's main content, so do not compress it away.

**Avoid em-dashes** in code, comments, docs and UI copy. Commas, colons and full stops.

Stated as a practice rather than an absolute, because the absolute was not true: the rule
read "no em-dashes" while the corpus carried hundreds, so a contributor reading this file and
a contributor reading any other one got different instructions. The rule now says what is
actually enforced. Do not open a pull request that sweeps them out of files you were not
otherwise touching: it would collide with everything in flight and show up as drift in every
downstream app at once, for a change with no behaviour in it. Remove them from lines you are
editing anyway, and the count goes down without anyone running a campaign.

**No decorative accent stripes.** A coloured bar down the left of a callout, along the top of
a card, or beside a heading is the most reliable visual tell of generated UI. It is decoration
standing in for hierarchy, and it is almost always a second copy of something the reader can
already see: the popup's accent stripe repeated what its swatch said, and the aside's left
border repeated what its tinted background said. Earn the distinction with the border, the
background, the type and the spacing you already have. Colour is for things that carry
information, which here means the layer swatches and the focus ring.

The broader rule this is one instance of: **an element that repeats information already
present next to it is decoration, not design.** Before adding an accent, name the fact it
carries and check nothing adjacent carries it already.

**Keep decisions pure.** A function that reads the document can only be tested by building a
document. If a decision can take its inputs as arguments, it should, and the DOM-reading
wrapper goes next to it. `popup-placement.js` is the pattern.

**One owner per shared thing.** Escape has one owner. Panel geometry has one applier. Glyph
sizing has one table. When two features want the same resource, the answer is a stack or a
registry owned once, not a cleverer guard in each of them.

**No golden screenshots.** See `app-verify`.

## Before you say it works

```bash
npm run verify
```

Types, unit, geometry, ink. All four, and quote what came back.

## Scope

Kept deliberately small, and deliberately not here: a real layer model, a group tree, drag
reordering, a config schema, symbology, a basemap switcher, a minimap. Each is a reasonable
addition; none is required to demonstrate a convention, and every one of them makes the repo
harder to read as a set of examples. Add one only when it teaches something the current ten
skills do not.

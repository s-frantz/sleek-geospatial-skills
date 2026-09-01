# Working in this repo

This is a conventions repo. The app exists so the conventions have something to be true about,
which means a change that makes the app better while making a convention less clear is a bad
trade.

## Read the skill first

`.claude/skills/` holds fourteen skills. Before changing anything, read the one that covers it:

| touching | read |
|---|---|
| `index.html`, `app/vendor/` | `boot-order` |
| colours, `css/tokens.css`, theme | `theme-tokens` |
| map controls, `control-stack.js` | `map-control-icons` |
| `icons.js`, any glyph art | `icon-centering` |
| `panel.js`, `css/furniture.css` | `panel-anatomy` |
| any collapse, hide or minimise | `stow` |
| modals, dialogs, the Escape key | `overlay-window` |
| popups, tooltips, anything anchored | `popup-placement` |
| `fitBounds`, `easeTo`, zoom-to | `chrome-aware-camera` |
| tests, or claiming something works | `verify-in-the-browser` |
| `furniture.js`, `data-sgs-furniture`, the camera/popup contract | `chrome-aware-camera` |
| `sgs.json`, `sgs:status`, syncing an app against this repo | `upgrading-an-app` |
| creating a new app, `sgs:init`, the capability interview | `starting-an-app` |
| `sgs:drift`, sending a fix back, ejecting a component | `contributing-upstream` |
| adding a component id, a capability, a skill, or anything at all | `maintenance` |

Framework terms (clone, app, manifest, watermark, drift, ejected, tier, capability) are
defined once, in `VOCABULARY.md` — link there, never redefine.

## Editing sgs-components.json or sgs-capabilities.json

Adding a file to an existing component's list is a normal change. Minting, renaming or
splitting a component id is bigger than it looks: every existing app's `sgs.json` still names
the old id, and `sgs:status`/`sgs:drift` report it as unknown until the manifest is updated —
so the CHANGELOG entry must say what manifests should do. The `maintenance` skill carries the
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

**No em-dashes** in code, comments, docs or UI copy. Commas, colons and full stops.

**Keep decisions pure.** A function that reads the document can only be tested by building a
document. If a decision can take its inputs as arguments, it should, and the DOM-reading
wrapper goes next to it. `popup-placement.js` is the pattern.

**One owner per shared thing.** Escape has one owner. Panel geometry has one applier. Glyph
sizing has one table. When two features want the same resource, the answer is a stack or a
registry owned once, not a cleverer guard in each of them.

**No golden screenshots.** See `verify-in-the-browser`.

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

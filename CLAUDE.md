# Working in this repo

This is a conventions repo. The app exists so the conventions have something to be true about,
which means a change that makes the app better while making a convention less clear is a bad
trade.

## Read the skill first

`.claude/skills/` holds eleven skills. Before changing anything, read the one that covers it:

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

## Editing sgs-components.json

Adding a file to an existing component's list is a normal change. Adding a NEW component id
is bigger than it looks: every app that has already run `sgs:init` gets a component in its
`sgs.json` the next time someone regenerates it, or is simply missing one if they don't. Prefer
folding a new file into the nearest existing component over minting a new id, unless it is
genuinely likely to change on its own schedule.

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

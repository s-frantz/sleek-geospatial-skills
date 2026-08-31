---
name: popup-placement
description: Decide where a map popup opens - CLEAN column versus ADJACENT to the feature, refusing to cover the app's own furniture, and covering the anchor as the last resort rather than fleeing to a corner. Use when building popups, tooltips, or anything that opens at a point on a map.
---

# Popup placement

`app/js/ui/popup-placement.js` decides; `app/js/ui/popup.js` applies.

## Two strategies, one word each

**CLEAN** - popups stack in a tidy column down one side, out of the map's way. The centre of the
map stays readable and you look to the SIDE for what you clicked.

**ADJACENT** - the popup opens beside the feature: right if it fits, else left, else below, else
above. You look AT what you clicked.

Neither is more correct. They trade "keep the map legible" against "keep the answer near the
question", and which one a person wants depends on what they are doing. So it is a **setting**,
not an opinion baked into the code.

## What counts as "fits"

A candidate is rejected if it would leave the visible area, or land on anything marked
`data-sgs-furniture` WHILE it occludes an edge (see the `chrome-aware-camera` skill and
`app/js/utils/furniture.js`), plus any popup already on screen. This file names no ids — the
control stack, the panel, an open dock all qualify because they carry the attribute, not
because `popup-placement.js` knows they exist.

Everything else is fair game, including the map and the feature itself.

Note what is deliberately NOT furniture: the basemap attribution. It is small and fixed, and
avoiding it would push popups around for no benefit.

## The clean column clears the LEFT edge; it does not currently watch the top

`cleanBaseLeft()` starts the column just right of whatever furniture hugs the left edge (the
panel, in this demo) — recomputed per open, from live geometry, never cached. The column's
top is a fixed constant (`CLEAN_TOP` in `popup.js`), not obstacle-checked. This is a real,
known gap rather than a design decision: `obstacles()`/`edgeFurniture()` currently only feed
ADJACENT mode's placement search (below). If your app puts furniture near the top of the clean
column's path — a tall top-right control stack a long cascade could reach, say — that's the
first place to look before assuming the bug is somewhere cleverer. Fixing it would mean
folding the same `edgeFurniture()` check CLEAN already uses for its left edge into a top
clearance too.

## Slide on the CROSS axis only

Each adjacent candidate names the axis its side is DEFINED by. A `right` placement is defined
by x, so it may be nudged vertically to make room and **never horizontally**. Slide it on x and
it drifts back over the anchor, reports that it fits, and the popup never tries the left side at
all.

That is not hypothetical. It is what the first version of this function did, and a unit test is
what found it.

## The last resort is over the anchor

When nothing fits, the popup goes **over the anchor**, not wherever there is room. A popup
jammed into a far corner is worse than one sitting on its own feature: at least the second is
obviously about the thing underneath it.

What is protected is the anchor POINT the leader line comes from, not the geometry. A large
polygon can be covered without much being lost.

## Keep the decision pure — as a DEFAULT, not a second function

`adjacentPlacement(anchor, size, blocked, safe)` is the one function, and the DOM boundary is
its two trailing parameters' DEFAULT VALUES rather than a separate wrapper:

```js
export function adjacentPlacement(anchor, size, blocked = obstacles(), safe = safeArea()) {
```

Call it bare at runtime and it reads the live document through `obstacles()`/`safeArea()`. Call
it from a test with explicit arrays and it never touches a browser — the arithmetic is
identical either way, because it's the same function, not a pure core plus a thin caller.

That is what makes `tests/unit/placement.spec.js` possible: the decision is arithmetic, and
arithmetic can be tested without a browser or a fixture. A function that reads the document
directly can only be tested by building a document, and then the test is mostly about the
fixture.

## Take the leader line with it

In CLEAN mode a popup deliberately sits far from its feature. Without a line drawn back to the
anchor, a reader cannot tell which of three open popups belongs to which of thirty features. If
you take the placement strategy, take the leader line too.

## Checklist

- [ ] New furniture carries `data-sgs-furniture`, or popups will sit on it. Nothing to add
      here — `obstacles()` asks the DOM via `furniture.js`, it holds no list of its own.
- [ ] The placement decision takes its inputs as arguments; only their DEFAULT values touch
      the DOM, so a test can override them without building a fixture.
- [ ] Placement re-runs on `move`, `resize`, and any furniture change.
- [ ] Changing the setting re-places what is ALREADY open. A setting that only applies to the
      next click cannot be evaluated by the person changing it.

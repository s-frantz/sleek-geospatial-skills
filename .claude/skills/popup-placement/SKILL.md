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

A candidate is rejected if it would leave the visible area, or land on the app's own
**furniture**: the control stack, the panel while it occludes the left edge, an open dock, and
any popup already on screen. Those are things a person needs to keep reaching.

Everything else is fair game, including the map and the feature itself.

Note what is deliberately NOT furniture: the basemap attribution. It is small and fixed, and
avoiding it would push popups around for no benefit.

## The clean column descends past furniture, it does not surrender

The control stack lives at the top right and the clean column runs down the right edge, so they
collide immediately. The correct response is to start the column BELOW the stack, not to
abandon the strategy:

```js
for (const b of furniture) {
    if (b.right > column.left && b.left < column.right) top = Math.max(top, b.bottom + GAP);
}
```

Without this the first popup fails to fit, falls through to the adjacent search, and CLEAN
quietly stops being clean. It looks like a placement bug and is really a control-flow one.

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

## Keep the decision pure

`choosePlacement` takes the visible area, the furniture and the existing popups as **arguments**
rather than reading them from the document. `placementFor` is the thin wrapper that goes and
gets the real numbers.

That split is what makes `tests/unit/placement.spec.js` possible: the decision is arithmetic,
and arithmetic can be tested without a browser or a fixture. A function that reads the document
can only be tested by building a document, and then the test is mostly about the fixture.

## Take the leader line with it

In CLEAN mode a popup deliberately sits far from its feature. Without a line drawn back to the
anchor, a reader cannot tell which of three open popups belongs to which of thirty features. If
you take the placement strategy, take the leader line too.

## Checklist

- [ ] New furniture is added to `furnitureRects()`, or popups will sit on it.
- [ ] The placement decision stays pure; only the wrapper touches the DOM.
- [ ] Placement re-runs on `move`, `resize`, and any furniture change.
- [ ] Changing the setting re-places what is ALREADY open. A setting that only applies to the
      next click cannot be evaluated by the person changing it.

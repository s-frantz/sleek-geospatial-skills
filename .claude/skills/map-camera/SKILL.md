---
name: map-camera
description: Fit and ease a map camera in an app that has furniture, so features never land underneath the panel or the dock - visiblePadding, the declarative furniture contract, and clamping so fitBounds cannot throw. Use when implementing zoom-to, fitBounds, easeTo, adding a new piece of furniture, or when "zoom to layer" appears to do nothing.
---

# Chrome-aware camera

`app/js/utils/furniture.js`, `app/js/utils/visible-area.js`.

## The problem

An app with furniture has two rectangles: the **viewport**, and the smaller, differently shaped
region a person can actually see the map through. `fitBounds` knows about the first one. Left
to itself it centres a feature in the middle of the canvas, which in an app with a left panel
and a bottom dock is a spot that is half covered.

The user-visible symptom is not "the padding is slightly off". It is **"zoom to layer does
nothing"**, because the thing it zoomed to is underneath the layer list you clicked it from.

## The fix

```js
map.fitBounds(bbox, { padding: visiblePadding(), duration: 600 });
```

`visiblePadding(base)` starts from a uniform padding and grows the edges that are covered,
reading geometry off the **live** furniture each time. It has to be live: furniture can float,
fold, or open and close, so a value computed at startup is wrong within one click.

## New furniture needs no code, only an attribute

```html
<div id="my-inspector" data-sgs-furniture></div>
```

That is the entire contract. `visible-area.js` and `popup-placement.js` do not hold a list of
ids — they ask the DOM, every time, via `furniture.js`. Adding a second panel, a right-side
inspector, or replacing the whole layer list with a form changes nothing in either file.

| function (`furniture.js`) | answers |
|---|---|
| `furnitureRects(root?)` | every visible `[data-sgs-furniture]` element and its live rect |
| `edgeOf(rect, viewport, home?)` | which edge, if any, a rect is hugging — pure, DOM-free |
| `edgeFurniture(root?)` | furniture rects tagged with the edge each occludes |
| `edgeCover(root?)` | how far edge-docked furniture intrudes from each side, max per edge |

| function (`visible-area.js`) | answers |
|---|---|
| `visiblePadding(base)` | the MapLibre padding object for a camera move |
| `visibleRect(edge)` | the visible region as a rectangle, for placing things |

## The marker carries no value, on purpose

An earlier draft used `data-sgs-furniture="left"` — the edge written statically in markup.
Rejected: this app already paid once to learn that trusting a LABEL for where something is,
rather than its live rect, is the wrong move (a `position: fixed` element's
`offsetParent === null`, true by definition on screen or not, once silently zeroed the camera's
bottom padding). A static edge string goes stale the moment something floats, redocks, or is
dragged. `edgeOf()` reads the rect fresh, every call, so there is nothing to go stale.

## Shape resolves ambiguity that distance alone cannot

A band spanning nearly the full viewport width — this app's own dock, inset 10px on left,
right, AND bottom — sits within the "hugging" threshold of three edges simultaneously, and all
three distances are equal, so nothing can pick a winner by distance. `edgeOf()` checks shape
first: something spanning nearly the full width can only sensibly be a top or bottom edge,
which rules out left/right before distance has to break a tie it cannot break. This was a real,
caught regression — see `tests/unit/furniture.spec.js` for the pinned case, found originally by
a Playwright zoom-to test rather than by inspection.

## A floating piece of furniture counts for nothing

Furniture parked away from every edge — an unpinned panel dragged to the middle of the map —
returns `null` from `edgeOf()` and is left out of both padding and popup obstacles entirely.
This is the case people get wrong: reserving a band for wherever it currently sits would make
the camera jump every time it moved. Occlusion is only worth modelling when it is
**predictable**, which for furniture means "at an edge."

## A folded dock still counts

It covers its own head, which is a real band. A feature centred under the fold bar is a feature
you cannot see. Folding changes the furniture's rect (and so its contribution); it does not
remove the element or its `data-sgs-furniture` marker.

## Clamp, or `fitBounds` throws

MapLibre requires the padding to leave a positive drawing area. Enough furniture on opposing
edges can otherwise ask for more padding than there is screen. When the clamp bites the camera
is merely imperfect; without it, `fitBounds` throws and the button looks broken.

## Degenerate bounds need a different call

A single point has zero-area bounds, and `fitBounds` on it is meaningless. Branch to `easeTo`
with an explicit zoom. See `zoomToFeature` in `app/js/layers.js` and `isDegenerate` in
`app/js/utils/geo.js`.

## Testing it

Two rungs, deliberately different shapes of proof:

- **Rung 2**, `tests/unit/furniture.spec.js`: `edgeOf` and the aggregation over a synthetic
  furniture list, pure arithmetic. This is also the ONLY place the N-ARY case (three or four
  pieces of furniture on different edges at once) is exercised at all — the demo app never
  ships more than two, so this file is where a bug in that case would actually be caught.
- **Rung 3**, `tests/e2e/layout.spec.js`: fit the camera, then **project the geometry back to
  the screen** and assert it landed clear of the furniture's rectangles. That tests the outcome
  a person cares about rather than the padding number, and it catches the case where the
  padding is right but something else moved the camera afterwards.

## Checklist

- [ ] Every `fitBounds` and `easeTo` passes `visiblePadding()`. No bare calls.
- [ ] New furniture carries `data-sgs-furniture`. Nothing else to wire.
- [ ] Furniture that moves triggers a re-place of anything anchored.
- [ ] Degenerate bounds branch to `easeTo`.

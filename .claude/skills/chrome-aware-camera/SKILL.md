---
name: chrome-aware-camera
description: Fit and ease a map camera in an app that has furniture, so features never land underneath the panel or the dock - visiblePadding, the floating-panel exception, and clamping so fitBounds cannot throw. Use when implementing zoom-to, fitBounds, easeTo, or when "zoom to layer" appears to do nothing.
---

# Chrome-aware camera

`app/js/utils/visible-area.js`.

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
reading the numbers off the **live** furniture each time. It has to be live: the panel has four
postures and the dock folds, so a value computed at startup is wrong within one click.

Three functions, three questions:

| function | answers |
|---|---|
| `dockedPanelRight()` | how far the panel occludes the left edge, in px |
| `dockCover()` | how much of the bottom the dock covers |
| `visiblePadding(base)` | the MapLibre padding object for a camera move |
| `visibleRect(edge)` | the visible region as a rectangle, for placing things |

## A folded dock still counts

It covers its own head, which is a real band. A feature centred under the fold bar is a feature
you cannot see. Fold changes the number; it does not zero it.

## A floating panel counts for nothing

```js
if (panel.classList.contains('sgs-panel--float')) return 0;
```

This is the case people get wrong. An unpinned panel sits wherever it was dragged, so reserving
a left band for it buys nothing, and reserving a band around wherever it currently is would
make the camera jump every time it moved. Occlusion is only worth modelling when it is
**predictable**.

## Clamp, or `fitBounds` throws

MapLibre requires the padding to leave a positive drawing area. A panel dragged to 60% of the
window plus an open dock can ask for more padding than there is screen. When the clamp bites
the camera is merely imperfect; without it, `fitBounds` throws and the button looks broken.

## Degenerate bounds need a different call

A single point has zero-area bounds, and `fitBounds` on it is meaningless. Branch to `easeTo`
with an explicit zoom. See `zoomToFeature` in `app/js/layers.js` and `isDegenerate` in
`app/js/utils/geo.js`.

## Testing it

Rung 3, in `tests/e2e/layout.spec.js`: fit the camera, then **project the geometry back to the
screen** and assert it landed clear of the furniture's rectangles. That tests the outcome a
person cares about rather than the padding number, and it catches the case where the padding is
right but something else moved the camera afterwards.

## Checklist

- [ ] Every `fitBounds` and `easeTo` passes `visiblePadding()`. No bare calls.
- [ ] New furniture is reported by `visible-area.js`.
- [ ] Furniture that moves triggers a re-place of anything anchored.
- [ ] Degenerate bounds branch to `easeTo`.

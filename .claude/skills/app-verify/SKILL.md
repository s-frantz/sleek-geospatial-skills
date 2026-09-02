---
name: app-verify
description: A four-rung ladder for proving a UI claim - types, unit arithmetic, browser geometry, and pixel ink - with the rule that if you cannot print the number you are asserting, you are eyeballing. Use before claiming any layout, placement or icon change works, and when deciding what kind of test a change needs.
---

# Verify in the browser

The rule underneath everything here:

> **If you cannot print the number you are asserting, you are eyeballing.**

## The ladder

| rung | command | proves | costs |
|---|---|---|---|
| 1 TYPE | `npm run typecheck` | contracts hold, nothing calls a function that moved | seconds |
| 2 UNIT | `npm run test:unit` | decisions that are arithmetic: placement, bounds | seconds |
| 3 GEOMETRY | `npm test` | the popup is not on the panel, the camera cleared the dock | ~1 min |
| 4 INK | `npm run icons` | the glyph is centred within half a pixel | ~20s |

`npm run verify` runs all four. Each exits non-zero on failure, so they chain.

## Which rung does this change need

- Changed a **type or a signature**: rung 1 catches it, and it is free.
- Changed a **decision**: placement, bounds, a posture transition. Rung 2. If it needs a browser
  to test, that is usually a sign it reads the document when it could have been handed the
  numbers. Fix the function, not the test.
- Changed **where something sits**: rung 3.
- Changed **glyph art or icon sizing**: rung 4. Always. Icons are never right by accident.

## Write rung 3 as numbers, not pictures

```js
const popup = await box(page, '.sgs-popup');
const panel = await box(page, '#sgs-panel');
expect(overlaps(popup, panel)).toBe(false);
```

When this fails it says which edge is on the wrong side of which. That is a diagnosis. Compare
with a golden-image failure, which says `12,431 pixels differ`.

## The rung this repo does not ship

**Golden screenshots** (`toHaveScreenshot`, `toMatchSnapshot`). Deliberately absent, and the
reasons are worth knowing rather than inheriting:

- It **catches everything and explains nothing**. A pixel count is not a diagnosis.
- It breaks on things that are not your change: font rendering, GPU, OS, a new CI image, a
  driver update. Every one of those is a red build with no bug behind it.
- Because those failures are usually noise, the accepted response becomes "update the
  snapshots", and at that point it asserts nothing at all.

It does earn its keep in one situation: whole-page regression on a locked CI image where you
genuinely cannot enumerate what might change. That is not this repo, and it is probably not
your app either. If you add it, add it **alongside** the measured rungs, never instead of them.

## Fixtures are code too

Two bugs in this repo's own tests, both worth generalising:

1. A helper clicked the centre of the viewport to hit a polygon. The centre falls in a gap
   between demo features, so every popup test failed for a reason unrelated to popups. It now
   **asks the map** what it has rendered.
2. The same helper then found a point that was on a polygon but underneath the panel, so the
   click went to the layer list. It now checks `document.elementFromPoint` as well:
   `queryRenderedFeatures` answers about the MAP and knows nothing about the DOM over it.
3. Selectors used `[title^="Show"]` to find a button. `tooltip.js` LIFTS an element's `title`
   into `data-tip` the first time it is hovered, so the attribute is gone by the second
   interaction — a test that hovers once (to trigger a tooltip check) and then tries to
   select by `title` again passes on the first pass and hangs on the second. `aria-label` is
   never rewritten, so every spec here selects by that instead.

**A test whose setup is a guess reports on the guess.**

## Reporting

State what you ran and what it said. "13 passed" and a measured table are results. "Looks
right" and "should be fine" are not, and neither is a screenshot you looked at yourself.

If a rung fails, say which and quote the number. If you skipped a rung, say which and why.

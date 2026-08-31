---
name: icon-centering
description: Size and centre icons objectively by measuring the drawn ink with npm run icons, treating SIZE and CENTRING as the two separate problems they are. Use whenever an icon "looks off", a new control button is added, or glyph art changes.
---

# Icon centering

Where an icon sits and how big it is are settled by measurement, not by eye and not by
arithmetic on path data.

## Why both of the obvious approaches fail

Glyphs here share a 24-unit viewBox and a 2-unit stroke. Two things follow that are not
obvious, and each has already shipped as a bug in this repo.

**1. Equal art boxes do not give equal-looking icons.** Each glyph fills its viewBox by a
different fraction. Measured, in this app: at the same nominal size, the gear drew **17.00px**
of ink and the info circle drew **15.50px**, because the gear runs to the edge of its box and
the circle stops short. The CSS insisted they matched. They did not.

**2. A centred art box does not give a centred icon.** `place-items: center` and `margin: auto`
centre the BOX. If the ink sits high inside the art, the glyph draws high, and no size change
will ever fix it.

So there are **two independent problems**, SIZE and CENTRING, with two independent fixes, and
conflating them is why "I fixed the icons" gets said more than once.

## The loop

### 1. Measure

```bash
npm run icons
```

It starts the app, screenshots each on-screen icon button at 2x, finds the ink by pixel
difference against the button's own face colour, and prints:

```
  glyph            ink w x h     want     dx      dy    headroom T/R/B/L
  gear             17.00 x 17.00  17.00    0.50    0.50    7.00  6.00  6.00  7.00
  info             17.50 x 17.50  17.00    0.25    0.25    6.50  6.00  6.00  6.50
```

| column | meaning | passes when |
|---|---|---|
| `ink w x h` | the glyph's real bounding box, CSS px | long axis within `sizeTolerance` of `want` |
| `want` | the intended size — see below | |
| `dx`, `dy` | ink centre minus BUTTON centre | both within `centreTolerance` |
| `headroom` | ink to each button edge | left equals right, top equals bottom |

Negative `dy` means the glyph sits high. Left and right headroom that disagree is the thing the
eye registers as "that one looks pushed over" without being able to say why.

It exits non-zero when anything of ours is out of tolerance, so it belongs in a verify chain.
A row for a button the measurer found but this app didn't draw (a third-party control it
doesn't recognise) prints `(not ours)` and is informational only — it never fails the build.

### Where `want` comes from

Three sources, in priority order, from `scripts/icon-ink.mjs`:

```js
const want = TARGETS.want[name] ?? meta.ink ?? TARGETS.defaultWant;
```

1. **`scripts/icon-targets.json`'s `want` block** — an explicit override for one glyph, used
   ONLY when the glyph genuinely should read a different size than its neighbours (see below).
2. **`data-ink`**, the size the glyph's own caller asked for via `icon(name, size)`. Most
   glyphs are covered here — a 17px control glyph and a 13px row glyph are measured against
   their own request, not one repo-wide number.
3. **`defaultWant`** in the same JSON file, the fallback for a glyph nobody has opinionated
   about at all.

The override in (1) exists for exactly one documented reason today: a plus and a minus are
bare strokes reaching the full extent of their box with nothing in between, so the eye reads
their whole box as the glyph. A gear measured to the same number is a dense shape whose bulk
sits inboard of its widest teeth — matched by the ruler, the cross reads a size larger than
its neighbours. `icon-targets.json` sets `plus`/`minus` to 14.5 against everything else's 17,
**with the reasoning written in the file itself**, because this is the one place in the repo
where a number is an optical judgement rather than a measurement — writing it out loud in the
targets file is what keeps it from being quietly mistaken for one if it moved into
`SIZE_FACTOR`.

### 2. Fix ONE problem

Both tables are in `app/js/icons.js`.

**Size** is `SIZE_FACTOR`. New factor = old factor x want / measured. The info glyph:
`1.1 x 17 / 15.5 = 1.21`.

**Centring** is `NUDGE`, in viewBox units, positive `y` moving the glyph down. Convert the
reported `dy` in CSS pixels: `nudge_y = -dy x 24 / renderedBoxPx`.

### 3. Re-measure

Every time. A size change moves the ink centre, so a centring correction computed before a size
change is stale.

## Rules

- **Never** put a number in `SIZE_FACTOR` or `NUDGE` that did not come from the measurer. An
  entry is a result. A guess reads exactly like a result and is worth less than an omission,
  which is why unmeasured glyphs are simply absent from both tables rather than set to a
  plausible value.
- **Never** adjust a number because a screenshot looked better afterwards.
- Guides (`document.body.classList.add('sgs-guides')`) draw the button's centre lines in red.
  They SHOW a problem; they do not measure it.
- The measurer insets **2 CSS px** (`INSET_CSS` in `scripts/icon-ink.mjs`) before it starts
  looking for the button's own face colour. A rounded corner's pixels are transparent, which
  resolved to black in the very first version of this script, made the whole button read as
  "ink", and reported every glyph as filling its box — a caught bug, not a hypothetical one.

## When to run it

- A new control button.
- Any change to glyph art in `icons.js`.
- An icon that "looks off". Measure before touching anything: about half the time the ink is
  correct and what is actually wrong is the button's padding.

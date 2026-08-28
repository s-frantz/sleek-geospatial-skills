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
| `want` | what the CALLER asked for, read off `data-ink` | |
| `dx`, `dy` | ink centre minus BUTTON centre | both within `centreTolerance` |
| `headroom` | ink to each button edge | left equals right, top equals bottom |

Negative `dy` means the glyph sits high. Left and right headroom that disagree is the thing the
eye registers as "that one looks pushed over" without being able to say why.

It exits non-zero when anything of ours is out of tolerance, so it belongs in a verify chain.

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

## When to run it

- A new control button.
- Any change to glyph art in `icons.js`.
- An icon that "looks off". Measure before touching anything: about half the time the ink is
  correct and what is actually wrong is the button's padding.

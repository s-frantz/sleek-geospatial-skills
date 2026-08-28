---
name: map-control-icons
description: Style MapLibre's control stack without fighting it - the specificity trap that silently ignores your CSS, currentColor glyphs, and why the library's own baked-image buttons need dark-mode treatment yours do not. Use when adding a custom map control, or when control CSS "does nothing".
---

# Map control icons

MapLibre's control API is small: an object with `onAdd` returning an element. Easy to add, easy
to make look foreign. Three things decide whether a custom control reads as native.

## 1. The specificity trap

MapLibre styles its buttons through `.maplibregl-ctrl-group button`: a class plus a type, which
beats a single class. So this **silently does nothing**:

```css
.sgs-ctrl-btn { width: 30px; }        /* loses */
```

Two ways out. Match the specificity:

```css
.maplibregl-ctrl-group.sgs-ctrl button.sgs-ctrl-btn { width: var(--sgs-ctrl-size); }
```

or reach for `!important`. Matching is better: it stays readable, it keeps working when
MapLibre adds a state class, and it does not train the next person to reach for `!important`
first. This is one of the few places where `!important` is a legitimate answer rather than a
smell, which is exactly why it should still be the second choice.

The symptom when you get this wrong is not an error. It is CSS that appears to be ignored, and
half an hour in devtools.

## 2. Let the glyph inherit `color`

Every glyph in `app/js/icons.js` is stroked with `currentColor` and carries no fill. One
declaration then colours the whole stack, in every theme and every state:

```css
.maplibregl-ctrl-group.sgs-ctrl button.sgs-ctrl-btn { color: var(--sgs-fg-dim); }
.maplibregl-ctrl-group.sgs-ctrl button.sgs-ctrl-btn:hover { color: var(--sgs-fg); }
```

The counter-example is in the same stylesheet. MapLibre's own zoom buttons carry their glyphs
as background images baked in one colour, so dark mode needs:

```css
:root[data-theme="dark"] .maplibregl-ctrl-group button .maplibregl-ctrl-icon {
    filter: invert(1) brightness(1.4);
}
```

An inverted PNG in a dark theme is a compromise, not a result. That asymmetry is the whole
argument for `currentColor`.

## 3. One shell, many buttons

Every custom button goes through `makeControl` in `app/js/ui/control-stack.js`. One place
decides sizing, padding and the focus ring, so a second control cannot drift from the first.
Adding a control is a spec, not a class:

```js
map.addControl(makeControl([{ glyph: 'info', title: 'About', onClick: () => {} }]), 'top-right');
```

## Checklist

- [ ] Container wears `maplibregl-ctrl maplibregl-ctrl-group`.
- [ ] Button built through `makeControl`, not by hand.
- [ ] Glyph from `icons.js`, stroked `currentColor`, no fill.
- [ ] `title` AND `aria-label`, saying the same thing.
- [ ] Rules that must beat MapLibre's are written at matching specificity.
- [ ] Run `npm run icons`. A new control is a new glyph, and it will not be the right size by
      accident. See `icon-centering`.

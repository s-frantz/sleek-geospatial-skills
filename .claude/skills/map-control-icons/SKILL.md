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

MapLibre's OWN zoom, compass, and geolocate buttons do not have this property — their glyphs
are background images baked in one fixed colour, which reads as a different visual family next
to `currentColor` glyphs, and in dark mode stays black unless inverted. **Do not reach for an
invert filter to fix this.** `app/js/ui/control-glyphs.js` (`adoptControlGlyphs()`) replaces
the baked artwork with this app's own glyph inside the same `<span>` MapLibre already renders,
so the whole stack becomes one family with one set of colour rules and dark mode needs nothing
special at all:

```js
map.addControl(new maplibregl.NavigationControl(), 'top-right');
// ...every control that should get this treatment...
adoptControlGlyphs();   // call once, after every control for this session is mounted
```

**The reset itself is INLINE, in `control-glyphs.js`, not a stylesheet rule** — this is the
one place in the app that deliberately breaks rule 1's own advice. It was a stylesheet rule
first, and it half worked: MapLibre writes its icon rules at several different specificities,
so a single rule caught the zoom buttons and silently missed the compass and geolocate, whose
baked artwork went on rendering UNDERNEATH the adopted svg — a glyph with a phantom extra bar
through it, and `npm run icons` reporting 22.5px of ink in a 17px box, which is what actually
found it. An inline style beats every stylesheet rule without `!important`'s side effect of
stopping the next person reasoning about the cascade, and it sits two lines from the thing it
undoes instead of in a file that has to be found. See `app/css/components/map-controls.css`
for what's left in the stylesheet once the reset itself moved out: only state colour, which
the cascade genuinely is the right tool for.

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
- [ ] Rules that must beat MapLibre's are written at matching specificity, not `!important`.
- [ ] Adopting one of MapLibre's own controls (zoom, compass, geolocate)? Use
      `adoptControlGlyphs()`, never an invert filter, and never a stylesheet reset — inline
      only, right where the glyph is injected.
- [ ] Run `npm run icons`. A new control is a new glyph, and it will not be the right size by
      accident. See `icon-centering`.

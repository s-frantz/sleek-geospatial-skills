---
name: ui-theme
description: Light, dark and system themes defined in ONE place - three states not two, every colour a light-dark() pair picked by color-scheme, a mid-grey dark family built from adjacent tones, and no flash on load. Use when adding a colour, a surface, a theme toggle, a dark-mode fix, or when a white flash appears on load.
---

# Theme

## Three states, not two

`light`, `dark`, and **system**. System is the important one and it is easy to get wrong:

| state | root attribute | what decides |
|---|---|---|
| light | `data-theme="light"` | the reader chose |
| dark | `data-theme="dark"` | the reader chose |
| system | *no attribute* | `prefers-color-scheme` |

System is the ABSENCE of the attribute. Writing `data-theme="system"` gives you a fourth thing
every rule has to handle and buys nothing: the absence already says it. See `app/js/ui/theme.js`.

## One place

Every colour is defined once, as a pair, and one property picks the half. This is the top of
`app/css/tokens.css`:

```css
:root                     { color-scheme: light dark; }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }

:root {
    --sgs-bg:      light-dark(#ffffff, #2a2d34);
    --sgs-bg-sunk: light-dark(#f4f5f7, #31343c);
    /* ...every colour token, one line each */
}
```

`color-scheme: light dark` lets the operating system choose, which IS the system state. An
explicit choice narrows it to one half. Those three lines are the only place in the stylesheet
that names a theme state: no `@media (prefers-color-scheme)`, no `[data-theme="dark"] .thing`,
in `tokens.css` or anywhere else.

Why this shape and not the familiar one. The familiar one writes every dark value twice, once
inside `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }` for
system and again under `:root[data-theme="dark"]` for the explicit choice, and every component
that wants a dark tweak grows the same pair of blocks. Two copies of a value drift, and the
drift shows only in the one state nobody opened. With a pair on one line there is no second
copy to forget. `color-scheme` also themes what CSS cannot reach otherwise: native checkboxes,
scrollbars and form controls follow the theme for free.

`tests/unit/theme.spec.js` enforces it, reading the stylesheets as text: no file but
`tokens.css` may mention a theme state, and every colour token must be a `light-dark()` pair.
`tests/e2e/theme.spec.js` checks that all three states actually paint.

**Browser floor.** `light-dark()` needs Chrome and Edge 123, Firefox 120, Safari 17.5, all
from 2024. Below that the whole declaration is invalid at computed-value time, and that
resolves to `unset`, NOT to the `var()` fallback, so an older browser gets transparent
surfaces rather than light ones. If you must support one, this convention is not for you yet.

**Adopting it into an app with a different switch.** Nothing here depends on the attribute.
Whatever your toggle is (a class, a two-state setting, a user preference from a server), make
it end by setting `color-scheme` on the root, and every token follows.

## Derive, do not pick

A component that needs a colour to differ by theme mixes it from the theme's own tokens,
rather than naming a second hex:

```css
/* A plate that darkens in light and lifts in dark: the text colour, at 5%. */
background: color-mix(in srgb, var(--sgs-fg) 5%, transparent);

/* A category colour: one hue, and the theme supplies the rest. */
color:      color-mix(in srgb, var(--sgs-pill-hue) 50%, var(--sgs-fg));
background: color-mix(in srgb, var(--sgs-pill-hue) 16%, var(--sgs-bg));
```

Mixing toward `--sgs-fg` moves toward the text, which is darker in light and lighter in dark,
so one rule is right in both. `app/css/components/source-pill.css` replaced 28 hand-picked
hexes (seven kinds, text and plate, two themes) with seven hues this way, and every pill now
measures at least 4.5:1 in both themes, where the hand-picked light ones were near 3:1. See
also `field-badge.css` and `swatch.css`.

If a surface needs a shade that cannot be mixed from what exists, it needs a new TOKEN in
`tokens.css`, never a literal in the component. Per-surface CSS does not hand-pick a dark hex.

## Adjacent tones: how dark gets its contrast

Dark mode is not the light theme inverted. It is a short ladder of greys, and contrast between
surfaces comes from each one sitting ONE STEP from its neighbour, not from borders and not
from black.

**Mid-grey, not near-black.** The ground is `#2a2d34` (L\* ~18). A near-black ground (L\* ~9)
reads as too dark everywhere, and it leaves no room underneath it: a shadow cannot darken
what is already nearly black, so every raised surface has to separate itself with a border
instead, and the chrome goes heavy. Starting mid-grey leaves room in both directions.

**One step between neighbours.** Adjacent surfaces differ by about 3 L\* in dark. That is
enough to read as two surfaces and little enough to read as one card. A divider sits one step
off the ground; a real edge sits well past every surface step, so it is never confused with
one.

**The order is decided per theme, not mirrored.** In dark, raised reads as LIGHTER. So the
panel head, which light sinks a step darker than the body, is lifted a step lighter in dark.
Both are "one step off the ground"; only the direction changes. `tests/e2e/theme.spec.js`
asserts it.

For an app with cards on a canvas, the same rule gives this order, lightest first:

- light: selected card and the chrome frame (both white), then the canvas, then a resting card
- dark: selected card, then the canvas, then a resting card, then the chrome frame

A resting card sits a step BELOW its canvas and a selected one clearly ABOVE it in both themes.
What moves is the frame: light frames in the lightest tone, dark in the darkest.

**The ladder.** Rows with a token name are what `app/css/tokens.css` defines. The others are
steps this demo has no surface for: they are the starting values for when your app has one,
and each becomes a token when it is first used, not before.

| role | token | light | dark | dark L\* |
|---|---|---|---|---|
| chrome frame, the ground | `--sgs-bg` | `#ffffff` | `#2a2d34` | 18.4 |
| adjacent step: heads, sidebars, table heads | `--sgs-bg-sunk` | `#f4f5f7` | `#31343c` | 21.7 |
| resting card | none here | `#e8e8e8` | `#33363d` | 22.6 |
| divider | `--sgs-line-soft` | `#e9ebef` | `#3a3b45` | 25.1 |
| solid hover, where translucent will not do | none here | `#e8e8e8` | `#3d4150` | 27.7 |
| canvas that cards sit on | none here | `#f3f3f3` | `#41454c` | 29.2 |
| edge | `--sgs-line` | `#d9dce2` | `#63656f` | 42.9 |
| selected card | none here | `#ffffff` | `#7a7c88` | 52.2 |
| text | `--sgs-fg` | `#1b1e24` | `#e8eaf0` | |
| quiet text | `--sgs-fg-dim` | `#5c636e` | `#949ab0` | |
| accent | `--sgs-accent` | `#2f6fd0` | `#3b82f6` | |

The selected card is lifted far enough that `--sgs-fg` on it measures about 3.4:1. Keep its
label heavy, or take the step down, before putting body text on it.

**What else changes with the ground.**

- **Hover moves toward the text.** `--sgs-hover` is translucent (a dark tint in light, a white
  one in dark), so a single value is correct on the ground and on every adjacent step.
- **Shadows need about three times the alpha** on a dark ground to register at all (`0.16`
  against `0.45` in `--sgs-shadow`). A shadow tuned in light vanishes in dark.
- **Highlights need about a fifth.** An inset white top bevel at 0.8 makes a light card look
  raised; the same bevel on a dark card is a hot white line. Around 0.16 reads as the same
  lift.
- **Identity colours brighten.** The accent goes from `#2f6fd0` to `#3b82f6` so it still reads
  on a dark panel. Text ON the accent flips to dark ink in dark (5.1:1, where white is 3.7:1).
- **Library chrome needs a token too.** A map library's own controls ship fixed colours (a
  white group, a `#ddd` divider, a black hover tint) that are invisible or glaring on a dark
  ground. `app/css/components/map-controls.css` points each at a token, one rule for both
  themes.

## Unstyled text is themed at the body

`html, body { color: var(--sgs-fg) }` in `tokens.css`. A label with no colour rule of its own
then inherits the theme instead of the browser's black, which is the source of a whole class
of dark-on-dark text. Fix that class at the body, once, never surface by surface.

## The flash

Restoring the theme from a module is too late: modules are deferred, so the page has already
painted. The restore is an inline blocking script in `<head>`, before the stylesheet:

```html
<script>
    try {
        var stored = localStorage.getItem('sgs-theme');
        if (stored === 'light' || stored === 'dark') {
            document.documentElement.setAttribute('data-theme', stored);
        }
    } catch (e) { /* private mode: system theme is a fine answer */ }
</script>
```

The `try` matters. `localStorage` does not merely return null in some privacy modes, it
throws, and an unguarded throw here means the page never renders at all.

## Adding a colour

- [ ] Can it be mixed from existing tokens? Then mix it, in the component, with no theme
      state named.
- [ ] If not, add a token to `tokens.css` as a `light-dark(<light>, <dark>)` pair. Pick the
      dark half from the ladder above by the role the surface plays, one step from whatever it
      sits against.
- [ ] Never write `[data-theme]` or `prefers-color-scheme` outside those three lines.
- [ ] Measure text contrast in both themes when a colour sits under text. A number, not a
      glance.
- [ ] `npm run verify`. The theme specs run in the unit and e2e rungs.

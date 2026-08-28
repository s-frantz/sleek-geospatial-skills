---
name: panel-anatomy
description: The side panel's geometry - four postures (auto, manual width, manual height, float), pin as the docked toggle, geometry passed to CSS as custom properties, and postures as viewer preferences rather than shared state. Use when building or changing a docked panel, adding resize grips, or deciding where panel state lives.
---

# Panel anatomy

`app/js/ui/panel.js`, `#sgs-panel` in `app/index.html`, and the `.sgs-panel` block in
`app/style.css`.

## Four postures

| posture | class | geometry |
|---|---|---|
| `auto` | *none* | docked top-left, width fits content, reaches the bottom inset. **No inline styles at all.** |
| `manual-w` | `sgs-panel--manual-w` | right grip pins `--sgs-panel-w` |
| `manual-h` | `sgs-panel--manual-h` | bottom grip pins `--sgs-panel-h`; the panel releases its bottom anchor |
| `float` | `sgs-panel--float` | unpinned, dragged by its head, hugs its content |

That `auto` sets no inline styles is what makes "double-click a grip to return to automatic" a
genuine return to the default rather than a guess at what the default was.

## One applier

Every control mutates the frame object and calls one `apply()`. Grips, the pin, the
window-resize clamp, the restore from storage: one path. The alternative, where each control
writes the styles it cares about, is how a panel ends up floating and 320px wide and anchored
to the bottom simultaneously, in a state no code intended.

## Geometry reaches CSS as a variable

```js
p.style.setProperty('--sgs-panel-w', `${frame.w}px`);   // yes
p.style.width = `${frame.w}px`;                          // no
```

The stylesheet stays in charge of what the number MEANS: the minimum, the maximum, and what
else in the layout responds. JavaScript supplies a number; CSS decides the consequences. It
also means a posture can be inspected and overridden from devtools without reading the module.

## Postures are a viewer preference

They live in `localStorage` via `app/js/utils/prefs.js`, and never in anything shared. Where
you like your panel is a fact about you, not about the map. Ship a panel width in a shared
document and you have made one person's screen size everyone's problem.

## Every posture carries its own undo

There is no "restore defaults" button, because there does not need to be one: a grip
double-clicks back to `auto`, the pin toggles back to docked. A separate reset control is a
confession that the controls do not reverse.

## Floating changes what the panel IS

A docked panel occludes the left edge, so the camera pads for it and popups avoid it. A
floating panel sits anywhere, so `dockedPanelRight()` returns 0 and both stop treating it as an
obstacle. Reserving a band for something that may be in the middle of the map buys nothing, and
reserving a band around wherever it currently is would make the camera jump every time it
moved. See `chrome-aware-camera`.

## Checklist

- [ ] New geometry is a new posture and a new branch in `apply()`, never a style written from a
      handler.
- [ ] Anything the camera must avoid is reported by `visible-area.js`, not hardcoded.
- [ ] New persisted geometry goes in `prefs.js` and stays out of anything shared.
- [ ] The panel's interior is your business. The panel's frame is this file's.

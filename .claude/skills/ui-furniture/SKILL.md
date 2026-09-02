---
name: ui-furniture
description: The geometry every piece of this app's large furniture shares - three independent facts behind one applier, why that is not the four-posture enum it looks like, TIGHT/PINNED/FULL as the three things an axis can be, FULL as a takeover that overwrites nothing, geometry passed to CSS as custom properties, folding that may not resize sideways, and postures as viewer preferences. Use when building or changing a docked panel or a bottom dock, adding resize grips or a maximise control, deciding where geometry state lives, or when one piece of geometry keeps clearing another.
---

# Panel anatomy

`app/js/ui/panel.js`, `#sgs-panel` in `app/index.html`, and the `.sgs-panel` block in
`app/css/furniture.css`.

**This is not only the panel.** The bottom dock (`app/js/ui/dock.js`) is the same model rotated:
same three facts, same single applier, same three things an axis can be, same pin-and-snap pair
from the `ui-stow` skill. Read it as the geometry contract for any large piece of furniture in an
app built from this repo, and when you add a third one, add it here rather than inventing a
fourth arrangement.

## Three facts, not four postures

The panel's state is three independent variables. They combine freely, and nothing stores a
posture name.

| fact | class | geometry |
|---|---|---|
| `float` | `sgs-panel--float` | docked into the top-left inset, or loose and dragged by its head |
| `w` set | `sgs-panel--manual-w` | right grip pins `--sgs-panel-w`; unset means the width fits the content |
| `h` set | `sgs-panel--manual-h` | bottom grip pins `--sgs-panel-h` and releases the bottom anchor; unset means it reaches the bottom inset |

With every fact at its default the panel sets **no inline styles at all**, which is what makes
"double-click a grip to return to automatic" a genuine return to the default rather than a
guess at what the default was.

## Three things an axis can be: TIGHT, PINNED, FULL

"Automatic" is not one behaviour and calling it one hides the interesting half. The panel's
automatic WIDTH is `max-content` — it fits its content. Its automatic HEIGHT reaches the bottom
inset — it takes everything going. Those are opposites, and they had the same name.

| word | means | how a reader gets there |
|---|---|---|
| **TIGHT** | the axis fits its content | double-click that grip |
| **PINNED** | the axis is a number the reader dragged | drag that grip |
| **FULL** | the whole section takes the room the app can spare | the section's own FULL button |

Two consequences worth stating, because both were bugs first:

**TIGHT means measured, not remembered.** The dock's grip used to double-click back to a
constant 250px, which on a three-row table opened a box mostly full of nothing and on a
400-row table was indistinguishable from any other number. TIGHT reads the content and answers
the question the reader is actually asking: show me this, and no more screen than it needs.

**FULL is a takeover, not a size.** It is a class that outranks both size axes in the cascade,
and it overwrites neither. Releasing it therefore restores the reader's own pinned numbers
exactly, because they were never touched — no save, no restore, nothing to get out of step. A
maximise implemented as "write the big numbers, stash the old ones" is the version that
eventually loses somebody's width, and it loses it silently.

And FULL yields to the reader without argument: dragging a grip while FULL is on cancels FULL
rather than being outranked by it, and the button's own state changes to say so. A control that
appears to do nothing because an invisible mode outranks it is worse than one that is missing.

### Why this is not an enum

It was one: `auto | manual-w | manual-h | float`. That reads beautifully and it is wrong,
because those four names describe a SINGLE state variable and the panel does not have one.

The enum forced the two size axes to be mutually exclusive, so pinning a height silently threw
away a pinned width. Widen the panel with the right grip, then shorten it with the bottom one,
and the width snapped back to automatic: the mode had become `manual-h`, and the applier, doing
exactly what it was told, cleared `--sgs-panel-w`. Nobody wrote that bug. It is what the model
says.

**A state variable that can hold only one of several things people expect to combine is the
thing to look for.** The tell is an applier whose `else` branch ERASES rather than leaves alone:

```js
if (mode === 'manual-w' && w) el.style.setProperty('--sgs-panel-w', `${w}px`);
else el.style.removeProperty('--sgs-panel-w');   // <- clears on behalf of an unrelated axis
```

The four names survive as a description of where you can end up, and `getPosture()` still
derives one for anything that wants a single word. Nothing stores one, and no CSS rule assumes
the absence of another class.

## Folding may not resize the other axis

The panel's automatic width is `width: max-content`, so collapsing the body shrinks it to the
width of its own header and the fold reads as the panel jumping rather than closing. Folding
therefore pins the width the panel already had, and unfolding releases it again **only if the
fold is what pinned it**; a width the reader chose with the grip is theirs and survives both.

Two things this costs, both worth knowing before you copy it:

- The width has to be measured BEFORE the body is hidden. `makeFoldable` hides the body and
  toggles the class before it calls `onChange`, so measuring in the callback reads the already
  collapsed panel and pins the header's width, which is the bug wearing a fix. `panel.js` takes
  the measurement in a CAPTURE-phase listener on the fold button, which reaches it ahead of the
  bubble-phase handler whatever order the two were attached in.
- The CSS has to agree. `.sgs-panel--folded` sets `width: max-content` and wins on source order
  over `.sgs-panel--manual-w`, so it is written `.sgs-panel--folded:not(.sgs-panel--manual-w)`.

The general form: **a gesture named for one axis may not change the other.** Fold is vertical.
So is the dock's height, which is why growing the dock folds the panel rather than narrowing it.

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

## Every axis carries its own undo

There is no "restore defaults" button, because there does not need to be one: a grip
double-clicks back to `auto`, the pin toggles back to docked. A separate reset control is a
confession that the controls do not reverse.

## The pin has two gestures, and one of them is a drag

The pin button and the drag-back-to-the-berth are halves of one gesture; shipping only the
button leaves a reader able to drag the panel out and unable to drag it back. Both land in the
same state through the same function, the catch radius is `SNAP` in `furniture.js`, and
re-berthing has to clear every inline property the drag wrote rather than the two that visibly
moved. All of that is the `ui-stow` skill — read it before adding a berth to anything.

## Floating changes what the panel IS

A docked panel hugs the left edge, so the camera pads for it and popups avoid it. A floating
panel sits anywhere, so `edgeOf()` (`app/js/utils/furniture.js`) reads its rect as hugging no
edge at all and both stop treating it as an obstacle — the SAME `data-sgs-furniture` marker
stays on the element the whole time; only its live geometry changes. Reserving a band for
something that may be in the middle of the map buys nothing, and reserving a band around
wherever it currently is would make the camera jump every time it moved. See
`map-camera`.

## Checklist

- [ ] New geometry is a new FACT on the frame and a new branch in `apply()` that touches only
      that fact, never a style written from a
      handler.
- [ ] The panel element keeps its `data-sgs-furniture` attribute through every posture — the
      camera and popup placement read it generically, so there is nothing else to wire.
- [ ] New persisted geometry goes in `prefs.js` and stays out of anything shared.
- [ ] Every size axis can answer all three of TIGHT, PINNED and FULL, and TIGHT is measured
      from the content rather than being a constant with a comfortable-looking value.
- [ ] FULL overrides through the cascade and writes over no stored number, so releasing it
      restores the reader's own geometry exactly.
- [ ] A grip drag cancels FULL rather than being silently outranked by it.
- [ ] The panel's interior is your business. The panel's frame is this file's.

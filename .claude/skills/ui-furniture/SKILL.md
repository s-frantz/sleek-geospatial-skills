---
name: ui-furniture
description: The geometry every piece of this app's large furniture shares - three independent facts behind one applier, why that is not the four-posture enum it looks like, TIGHT/MANUAL/FULL as the three things an axis can be, FULL as a takeover that overwrites nothing, geometry passed to CSS as custom properties, folding that may not resize sideways, and postures as viewer preferences. Use when building or changing a docked panel or a table along an edge, adding resize grips or a maximise control, deciding where geometry state lives, or when one piece of geometry keeps clearing another.
---

# Panel anatomy

`app/js/ui/panel.js`, `#sgs-panel` in `app/index.html`, and the `.sgs-panel` block in
`app/css/furniture.css`.

**This is not only the panel.** The table (`app/js/ui/table.js`) is the same model rotated:
same three facts, same single applier, the same chevron, the same dock-and-snap pair from the
`ui-stow` skill. It is the same surface too: one rule each in `furniture.css` for the card, the
head, the title and the grip, shared by the panel, the table and the popups, so a change to one
is a change to all three rather than a third copy drifting. The same goes for the words: both
dock buttons say Dock and Undock, and the code says docked and undocked as well. Read it as the
geometry contract for any large piece of furniture in an app built from this repo, and when
you add a third one, add it here rather than inventing a fourth arrangement.

## Three facts, not four postures

The panel's state is three independent variables. They combine freely, and nothing stores a
posture name.

| fact | class | geometry |
|---|---|---|
| `undocked` | `sgs-panel--undocked` | docked in the top-left inset, or undocked and dragged by its head |
| `w` set | `sgs-panel--manual-w` | the right grip sets `--sgs-panel-w`; unset means the width fits the content |
| `h` set | `sgs-panel--manual-h` | the bottom grip sets `--sgs-panel-h` and releases the bottom anchor; unset means it reaches the bottom inset |

With every fact at its default the panel sets **no inline styles at all**, which is what makes
"double-click a grip to return to automatic" a genuine return to the default rather than a
guess at what the default was.

## Three things an axis can be: TIGHT, MANUAL, FULL

"Automatic" is not one behaviour and calling it one hides the interesting half. The panel's
automatic WIDTH is `max-content`: it fits its content. Its automatic HEIGHT reaches the bottom
inset: it takes everything going. Those are opposites, and they had the same name.

| word | means | how a reader gets there |
|---|---|---|
| **TIGHT** | the axis fits its content | double-click that grip |
| **MANUAL** | the axis is a number the reader dragged | drag that grip |
| **FULL** | the table takes the room the app can spare | the table's own FULL button; the panel has none |

Two consequences worth stating, because both were bugs first:

**TIGHT means measured, not remembered.** The table's grip used to double-click back to a
constant 250px, which on a three-row table opened a box mostly full of nothing and on a
400-row table was indistinguishable from any other number. TIGHT reads the content and answers
the question the reader is actually asking: show me this, and no more screen than it needs.

**FULL is a takeover, not a size.** It is a class that outranks both size axes in the cascade,
and it overwrites neither. Releasing it therefore restores the reader's own numbers exactly,
because they were never touched: no save, no restore, nothing to get out of step. A maximise
implemented as "write the big numbers, stash the old ones" is the version that eventually
loses somebody's width, and it loses it silently.

And FULL yields to the reader without argument: dragging a grip while FULL is on cancels FULL
rather than being outranked by it, and the button's own state changes to say so. A control that
appears to do nothing because an invisible mode outranks it is worse than one that is missing.

**FULL belongs to the table, not the panel.** The panel had one, and all it could add was width:
a docked panel's automatic height already reaches the bottom inset, and a list of layers gains
nothing from 60% of the screen. A maximise on a section whose content does not want the room is a
button whose meaning shifts from one piece of furniture to the next, so it went.

**FULL is a takeover wherever the table is.** On an undocked table it fills the map exactly as on
a docked one, while its undocked position and its width wait underneath untouched, so releasing
FULL puts the table back where it was. A table that has taken the map is standing on the panel's
room, docked or not, so it folds the panel either way.

## One chevron, four views

The chevron steps through four views, the same cycle on the panel and the table, owned once by
`nextFoldMode()` in `app/js/ui/stow.js`. The chevron points one way per view, the same on both:

| view | chevron | the section shows |
|---|---|---|
| **NATURAL** | ↓ | its own size: the reader's, or FULL's |
| **TIGHT** | → | its rows and no blank band, growing or shrinking to fit them |
| **HEAD** | ↑ | its head alone, still reporting |
| **SNUG** | ← | TIGHT, and as narrow as its content: the table's columns, the panel's rows |

NATURAL, TIGHT, HEAD, SNUG, and round again. A fitted view is skipped only when it cannot do its
job: TIGHT when the rows could not all fit on screen, since "fitted to its rows" would then be a
lie, and SNUG when there is no width to take in, since it would then be TIGHT again. SNUG's
height follows TIGHT's rule: fitted when the rows fit, the natural height when they do not. SNUG
narrows a section from its far side, so its left edge stays where it was. On the panel, whose
automatic width is already its content's, SNUG appears only once a grip has set a wider one.
Every view but NATURAL writes over no stored size, so stepping back to NATURAL restores the
reader's numbers exactly. The button's label names what the NEXT press does.

When the controls combine, the stronger wins, strongest first:

| view or size | wins over |
|---|---|
| HEAD | everything: a folded section is as tall as its head |
| TIGHT, SNUG | FULL and the reader's size: the content, inside whatever room there is |
| FULL | the reader's size, left untouched underneath |
| MANUAL | the automatic size |

Two resets keep that honest. Pressing FULL puts the chevron back to NATURAL, because asking for
the room is asking to see the rows, and giving the room back returns the view the table was in
before, so a folded table folds again and a fitted one fits again: the view is part of the state
FULL took over, and it overwrites nothing. Dragging a grip or the head cancels FULL and the
fitted views, because the reader has just said what the size is. A view chosen on the chevron
while FULL is on is the reader's newer choice, so releasing FULL keeps it.

Undocking changes where a section is, never its size: a table picked up from its edge keeps its
full width. Narrowing it is SNUG's job. A folded section unfolds from its chevron alone; its
head is a handle to drag, on the table as on the panel.

### Why this is not an enum

It was one: `auto | manual-w | manual-h | undocked`. That reads beautifully and it is wrong,
because those four names describe a SINGLE state variable and the panel does not have one.

The enum forced the two size axes to be mutually exclusive, so setting a height silently threw
away a width the reader had set. Widen the panel with the right grip, then shorten it with the
bottom one, and the width snapped back to automatic: the mode had become `manual-h`, and the
applier, doing exactly what it was told, cleared `--sgs-panel-w`. Nobody wrote that bug. It is
what the model says.

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
width of its own head and the fold reads as the panel jumping rather than closing. Folding
therefore sets the width the panel already had, and unfolding releases it again **only if the
fold is what set it**; a width the reader chose with the grip is theirs and survives both.

Two things this costs, both worth knowing before you copy it:

- The width has to be measured BEFORE the body is hidden. `makeFoldable` hides the body and
  toggles the class before it calls `onChange`, so measuring in the callback reads the already
  collapsed panel and sets the head's width, which is the bug wearing a fix. `panel.js` takes
  the measurement in a CAPTURE-phase listener on the fold button, which reaches it ahead of the
  bubble-phase handler whatever order the two were attached in.
- The CSS has to agree. `.sgs-panel--folded` sets `width: max-content` and wins on source order
  over `.sgs-panel--manual-w`, so it is written `.sgs-panel--folded:not(.sgs-panel--manual-w)`.

The general form: **a gesture named for one axis may not change the other.** Fold is vertical.
So is the table's height, which is why growing the table folds the panel rather than narrowing it.

## One applier

Every control mutates the frame object and calls one `apply()`. Grips, the dock button, the
window-resize clamp, the restore from storage: one path. The alternative, where each control
writes the styles it cares about, is how a panel ends up undocked and 320px wide and anchored
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
double-clicks back to `auto`, the dock button toggles back to docked. A separate reset control
is a confession that the controls do not reverse.

## Docking has two gestures, and one of them is a drag

The dock button and the drag back to the edge are halves of one gesture; shipping only the
button leaves a reader able to drag the panel out and unable to drag it back. Both land in the
same state through the same function, the catch radius is `SNAP` in `furniture.js`, and
docking again has to clear every inline property the drag wrote rather than the two that
visibly moved. All of that is the `ui-stow` skill: read it before making anything dock.

## One group for a head's buttons

Every furniture head (panel, table, popup) puts its buttons in one `.sgs-head-actions` group,
and that group's `gap` in `app/css/furniture.css` is the only thing spacing them. Each head
has its own `gap` too, for its title, swatch and count, and when the buttons were plain
children of the head they inherited it: the same four buttons sat 8px apart in the table,
6px in the popup, and 2px and 6px within one panel head, because the panel's dock button sat
in a wrapper of its own. The wrapper is gone and the dock button is a plain button in the
group, spaced like its neighbours. A new head, or a new button in an old one, goes into the
group; the test that holds it is in `tests/e2e/layout.spec.js`.

Every icon button in a head, or anywhere else, is made by `iconButton()` and changed by
`setButton()` in `app/js/ui/buttons.js`, which set the tooltip and the accessible name from one
text, so a toggle that changes its label cannot change one and forget the other.

## Undocking changes what the panel IS

A docked panel hugs the left edge, so the camera pads for it and popups avoid it. An undocked
panel sits anywhere, so `edgeOf()` (`app/js/utils/furniture.js`) reads its rect as hugging no
edge at all and both stop treating it as an obstacle. The SAME `data-sgs-furniture` marker
stays on the element the whole time; only its live geometry changes. Reserving a band for
something that may be in the middle of the map buys nothing, and reserving a band around
wherever it currently is would make the camera jump every time it moved. See `map-camera`.

## Checklist

- [ ] New geometry is a new FACT on the frame and a new branch in `apply()` that touches only
      that fact, never a style written from a handler.
- [ ] The panel element keeps its `data-sgs-furniture` attribute through every posture: the
      camera and popup placement read it generically, so there is nothing else to wire.
- [ ] New persisted geometry goes in `prefs.js` and stays out of anything shared.
- [ ] Every size axis can answer TIGHT and MANUAL, TIGHT measured from the content rather than
      a constant with a comfortable-looking value; FULL only where the content wants the screen.
- [ ] The chevron steps NATURAL, TIGHT, HEAD, SNUG through `nextFoldMode()`, skips a fitted view
      when it cannot do its job, and none of its views writes over a stored size.
- [ ] FULL overrides through the cascade and writes over no stored number, so releasing it
      restores the reader's own geometry exactly.
- [ ] A grip drag cancels FULL rather than being silently outranked by it.
- [ ] The panel's interior is your business. The panel's frame is this file's.

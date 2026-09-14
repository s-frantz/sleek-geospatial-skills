---
name: ui-stow
description: The vocabulary for putting a section away and for where it lives - FOLD, CLOSE, MARK, DOCK, SNAP - the one test that decides which applies, why the panel and the table both offer both, and the borrow contract for one section changing another. Use when adding a collapse, hide, minimise, close, undock or drag affordance to any panel or section, or when an app has grown several different gestures for "make this go away".
---

# Stow

An app grows several gestures for "make this go away" and no word for any of them, so each new
panel invents another one. Two verbs for putting a section away, one noun for what it leaves
behind, one pair for where it lives, and one test.

## The vocabulary

**FOLD**: the content collapses, the head stays in its slot, a chevron rotates.
**CLOSE**: the whole section leaves the layout and gives its pixels back.
**MARK**: what a close leaves behind, the section's own glyph on the viewport edge the section
came from, which brings it back. Never a lane of its own.
**DOCK**: a DOCKED section sits against its edge of the viewport, placed by the stylesheet.
UNDOCKED, it sits on the map where it was dragged, placed by coordinates. The dock button in
its head (drawn as a pin) says which, and switches.
**SNAP**: an undocked section dropped near its edge docks itself.

One word for each, in the code as on screen. The code once had five words for the two
positions and another for the table's mark, while every button said Dock and Undock, so a
reader of the code had to guess which of them the screen meant. `tests/unit/vocabulary.spec.js`
lists the old words and keeps them out.

A close shows where the section went in two quick steps: the section shrinks into its mark
(`stowInto()` in `stow.js`, 160ms, one transform on its own box), then the mark pulses once
(`flashMark()`), going to full ink on a sunk ground in the chrome's own greys. A tab designed
to be quiet is also easy to miss, and the reader's eye is on the section, not the far edge, so
the section leads the eye there. Only a close does this, never the initial state and never an
open; reduced motion skips the shrink and the pulse.

FOLD is one chevron with four steps: the section's natural size, then TIGHT (its rows and no
blank band), then the head alone, then SNUG (its rows and its content's width), and round again.
A fitted step is skipped only when it cannot do its job: TIGHT when the rows could not all fit
on screen, SNUG when there is no width to take in. The cycle has one owner, `nextFoldMode()` in
`app/js/ui/stow.js`, so the panel and the table cannot grow two orders; the `ui-furniture`
skill has what each view does to the geometry and which wins when they combine.

`app/js/ui/stow.js`: `makeClosable()` for CLOSE and its MARK, `makeFoldable()` for FOLD.
`nearLeftEdge()`, `nearBottomEdge()` and `SNAP` in `app/js/utils/furniture.js` for the snap
test; `makeDraggable()` in `app/js/utils/draggable.js` for the drag it answers.

The five words split cleanly in two, and the split is worth saying out loud because it decides
where a control goes. FOLD and CLOSE answer **is the content showing**. DOCK and SNAP answer
**where it is and how much room it gets**. In this app the dock button (and the table's FULL)
come first among a head's buttons and the chevron and the close come last, in that order, in
both the panel and the table.

## The test

> **Does the thing still have something to say when it is shut?**

Yes, so FOLD. The table's head goes on reporting `Stations, 24 rows` while folded. That
sentence is worth a row of pixels.

No, so CLOSE. Folding a minimap yields a bar reading "Minimap", which is no information at
all; it should leave and give the space back.

A chevron is a **list** affordance. Alone on screen it is a switch wearing a disclosure
costume, which is exactly why folding a single lone panel reads cheap.

## Docking, and the drag that has to agree with it

A section that docks needs two gestures, and the second one is the one that gets forgotten:

- **The dock button**: says, and shows, which state the section is in.
- **The drag**: grabbing the head undocks it, and dropping it back near its edge docks it.

Shipping only the first half is the common failure and it does not look like a bug. A reader
drags the panel back to the corner it came from, lets go, and gets a panel sitting exactly AT
the corner while still undocked: still placed by coordinates, still hugging its content
instead of reaching the bottom inset, still needing the button pressed to actually be docked.
The app and the reader disagree about a thing the reader can see.

**The catch radius is not a new number.** `SNAP` in `furniture.js` is a multiple of `HOME`, the
distance at which `edgeOf()` already attributes a rect to a viewport edge. So anything inside
snapping range is already close enough that the framework is padding the camera as though the
section were docked. Snapping does not introduce a behaviour; it ends a disagreement that had
already started. Larger than `HOME` rather than equal to it, because `HOME` judges a rect at
rest and `SNAP` is a target a moving hand has to hit.

**The snap test has the shape of where the section docks.** A section that docks at a corner
docks at a point, and a drop snaps when it lands within `SNAP` of it on both axes,
`nearDockPoint()`. A section that docks along an edge docks along a line, and a drop snaps when
it is held against that line ANYWHERE along it: `nearBottomEdge()` for the table (y alone) and
`nearLeftEdge()` for the panel (x alone). Testing an edge against one of its corners is the bug
this avoids: an undocked table dropped at the foot of the map, in the middle where a hand
naturally aims, stayed undocked because it was 500px from the bottom-left corner it was being
compared to, and the panel had the same miss halfway down the left edge. The edge tests are
one-sided, because a section pushed PAST its docked place is being held against the edge
harder, not missing it.

**Ctrl held turns the snap off**, for both sections: the drag reports it, and each piece of
furniture skips its snap, so a reader can park a section just off its edge on purpose.

Two rules keep it honest:

- **Show it before they let go.** A class while the section is inside the radius, drawn as an
  outline rather than as anything that moves the element: the geometry being outlined is the
  geometry the snap test is reading.
- **One outcome, two gestures.** The drop and the dock button must land in the SAME state,
  through the same function. A drop that docks into a subtly different state than the button is
  two outcomes wearing one name, and it will be found by whoever wires the next feature to one
  of them.

### The drag leaves residue

A drag promotes an element out of flow and writes `position`, `margin`, `left`, `top`, `right`
and `bottom` inline. Docking again has to remove **all six**, not the two that obviously moved.
Clearing left and top alone gives a section in the right corner at the wrong size: the
surviving `bottom: auto` means the docked bottom anchor never comes back, and the section hugs
its content while every class on it says it is docked. `releaseDrag()` lives in
`draggable.js` for that reason: the residue belongs to whoever created it, or it gets cleaned
up wrongly once per caller.

## Both verbs on one section

The panel and the table each offer BOTH FOLD and CLOSE, and that is deliberate rather than
indecisive. They are the two largest things on screen, and the two questions a reader actually
has are different: "let me see the map behind this for a second" (fold: the head stays where
my eye expects it) versus "I am not using this at all right now" (close: give me the pixels).
Offering only the first makes a permanently unwanted panel permanently present; offering only
the second throws away the head's report every time someone peeks.

The grammar is identical in both places, which is the part worth taking: same chevron in the
same corner, same close beside it, same kind of tab left behind on the nearest viewport edge.
Learn the panel and you already know the table.

## One section may fold another, if it gives it back

The table folds the layer panel once it has grown past the height the panel needs to be worth
reading, and unfolds it on the way back down. Three rules make that acceptable rather than
presumptuous:

- **Only undo what you did.** The table records that IT folded the panel. A reader who folded
  the panel themselves and then dragged the table around does not find it reopened, because
  that would be the app overruling a choice it was not asked about.
- **Only take what was there.** If the panel was ALREADY folded when the table rose, the table
  has taken nothing and has nothing to give back. This is the same bug entered from the other
  side, and a bare "did I fold it" boolean cannot express it: the boolean gets set, the table
  comes down, and it hands back a fold that was never its to hand back.
- **Fold, never close.** The panel's head still says "Layers" and still carries its controls,
  so the reader can see where it went and bring it back in one click. Closing another
  section's furniture on its behalf removes the evidence that anything happened.

The first two rules are `makeBorrow()` in `furniture.js`, and it is a shared helper rather than
a convention because the convention did not hold: the shape had been written by hand three
times (the table folding the panel, the fold setting the panel's width, the undock setting the
table's width) and each copy got a different half of it right.

```js
const panelRoom = makeBorrow({
    available: () => !isPanelFolded(),   // nothing to take if it is already folded
    take: () => foldPanel(true),
    give: () => foldPanel(false),
});
panelRoom.want(iAmTallEnoughToNeedTheRoom);   // idempotent; decides both directions
```

When one gesture changes state on behalf of another, the state needs to record who changed it,
or the undo cannot tell an inherited value from a chosen one.

## Why marks sit at edges, not in a lane

The obvious design is a RAIL: a thin dedicated row holding the marks. It does not survive
contact with a real layout. A lane that exists to hold one or two small glyphs spends a whole
row of a narrow panel on chrome, and it reads as new furniture rather than as the section
having moved.

So a mark parks against the viewport edge the section came from: the panel's on the left, the
table's on the bottom, the same edge `data-sgs-furniture`'s `edgeOf()` would attribute the
section to while it was open (see the `map-camera` skill). No lane, no extra line, and
nothing on screen when nothing is closed.

The consequence worth knowing: **a mark and a fold control are not the same element** in this
app. A section's head keeps its own fold chevron while open, and a SEPARATE mark, created once
and living in the document permanently, is what CSS reveals only once the section is closed.
Creating and destroying the mark per state would mean the reopen control does not exist at the
exact moment somebody needs it, which shows up as a tab that flickers on resize.

## A close is not a setting

A setting decides whether a thing exists for this map at all. A close is this reader, right
now, wanting the pixels. Wiring them to the same switch means a reader who tidies their screen
has silently changed the map for everybody.

## Using it

```js
const closable = makeClosable({ section: tableEl, markId: 'sgs-table-mark', markClass: 'sgs-mark--bottom', glyph: 'chevron', label: 'the table', onChange });
const fold = makeFoldable({ section: tableEl, control: foldBtn, body: tableBody, onChange });
```

`onChange` fires on every change, including the initial one, so the camera and any open popups
get told once and do not need to poll.

## Checklist

- [ ] Applied the test out loud before choosing FOLD or CLOSE.
- [ ] A closed section's MARK is its OWN glyph, not a generic close or eye.
- [ ] The mark parks at an existing viewport edge, not in a new row.
- [ ] Anything that depends on the section's size or presence is wired through `onChange`.
- [ ] The gesture is not also a settings toggle.
- [ ] A section that docks has BOTH the dock button and the snap, and they land in the same
      state through the same function.
- [ ] Docking again after a drag clears all six inline properties (`releaseDrag`), not the two
      that visibly moved.
- [ ] Anything one section changes on another's behalf goes through `makeBorrow`, so it cannot
      give back what it never took or take what was already gone.
- [ ] If the section participates in camera padding or popup obstacle avoidance, its
      `data-sgs-furniture` marker stays on the element through both fold and close. Closing
      it already zeroes its rect (see `map-camera`), so nothing extra is needed there.
- [ ] The words are this skill's: docked and undocked, the mark, the table. Not a sixth one.

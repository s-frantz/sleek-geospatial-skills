---
name: ui-stow
description: The vocabulary for putting a section away and for where it lives - FOLD, CLOSE, MARK, BERTH, PIN, SNAP - the one test that decides which applies, why the panel and dock both offer both, and the borrow contract for one section changing another. Use when adding a collapse, hide, minimise, close, undock or drag affordance to any panel or section, or when an app has grown several different gestures for "make this go away".
---

# Stow

An app grows several gestures for "make this go away" and no word for any of them, so each new
panel invents another one. Two verbs and two nouns, and one test.

## The vocabulary

**FOLD** — the content collapses, the header stays in its slot, a chevron rotates.
**CLOSE** — the whole section leaves the layout and gives its pixels back.
**MARK** — what a close leaves behind: the section's own glyph, which brings it back.
**BERTH** — where a section belongs: the edge or corner of existing chrome it sits against
when pinned, and where its mark parks when closed. Never a lane of its own.
**PIN** — the section IS in its berth. Unpinned, it is loose on the map, positioned by
coordinates rather than by the stylesheet.
**SNAP** — an unpinned section dropped near its berth re-pins itself.

A mark pulses once, briefly, at the moment of the close (`flashMark()` in `stow.js`), because
a tab designed to be quiet is also easy to miss: one pulse teaches where it lives, and after
that it stays quiet. Only a close pulses, never the initial state and never an open.

`app/js/ui/stow.js` — `makeClosable()` for the FOLD/close pair's CLOSE half and its MARK,
`makeFoldable()` for FOLD. `nearBerth()`, `nearBottomBerth()` and `SNAP` in
`app/js/utils/furniture.js` for the snap test; `makeDraggable()` in
`app/js/utils/draggable.js` for the drag it answers.

The six words split cleanly in two, and the split is worth saying out loud because it decides
where a control goes. FOLD and CLOSE answer **is the content showing**. BERTH, PIN and SNAP
answer **where it is and how much room it gets**. In this app the second pair sits in the
section's berth strip and the first pair sits at the far end of its head, in that order, in
both the panel and the dock.

## The test

> **Does the thing still have something to say when it is shut?**

Yes, so FOLD. The bottom dock's bar goes on reporting `Stations, 24 rows` while folded. That
sentence is worth a row of pixels.

No, so CLOSE. Folding a minimap yields a bar reading "Minimap", which is no information at
all; it should leave and give the space back.

A chevron is a **list** affordance. Alone on screen it is a switch wearing a disclosure
costume, which is exactly why folding a single lone panel reads cheap.

## Pin, and the drag that has to agree with it

A section with a berth needs two gestures, and the second one is the one that gets forgotten:

- **The pin** — a button that says, and shows, which state the section is in.
- **The drag** — grabbing the head pulls it out of its berth, and dropping it back near the
  berth puts it back.

Shipping only the first half is the common failure and it does not look like a bug. A reader
drags the panel back to the corner it came from, lets go, and gets a panel sitting exactly AT
the corner while still unpinned: still positioned by coordinates, still hugging its content
instead of reaching the bottom inset, still needing the pin pressed to actually be docked. The
app and the reader disagree about a thing the reader can see.

**The catch radius is not a new number.** `SNAP` in `furniture.js` is a multiple of `HOME`, the
distance at which `edgeOf()` already attributes a rect to a viewport edge. So anything inside
snapping range is already close enough that the framework is padding the camera as though the
section were docked. Snapping does not introduce a behaviour; it ends a disagreement that had
already started. Larger than `HOME` rather than equal to it, because `HOME` judges a rect at
rest and `SNAP` is a target a moving hand has to hit.

**The snap test has the shape of the berth.** A corner berth (the panel's) is a point, and a
drop snaps when it lands within `SNAP` of it on both axes, `nearBerth()`. An edge berth (the
dock's, the whole bottom) is a line, and a drop snaps when it is held against that line
ANYWHERE along it, `nearBottomBerth()`, which reads y alone. Testing an edge berth against one
of its corners is the bug this avoids: a loose table dropped at the foot of the map, in the
middle where a hand naturally aims, stayed loose because it was 500px from the bottom-left
corner it was being compared to. The edge test is also one-sided, because a section pushed
down PAST its berth is being held against the edge harder, not missing it.

Two rules keep it honest:

- **Show it before they let go.** A class while the section is inside the radius, drawn as an
  outline rather than as anything that moves the element — the geometry being outlined is the
  geometry the snap test is reading.
- **One outcome, two gestures.** The drop and the pin must land in the SAME state, through the
  same function. A drop that re-berths into a subtly different state than the button is two
  outcomes wearing one name, and it will be found by whoever wires the next feature to one of
  them.

### The drag leaves residue

A drag promotes an element out of flow and writes `position`, `margin`, `left`, `top`, `right`
and `bottom` inline. Re-berthing has to remove **all six**, not the two that obviously moved.
Clearing left and top alone gives a section in the right corner at the wrong size — the
surviving `bottom: auto` means the docked bottom anchor never comes back, and the section hugs
its content while every class on it says it is berthed. `releaseDrag()` lives in
`draggable.js` for that reason: the residue belongs to whoever created it, or it gets cleaned
up wrongly once per caller.

## Both verbs on one section

The panel and the dock each offer BOTH FOLD and CLOSE, and that is deliberate rather than
indecisive. They are the two largest things on screen, and the two questions a reader actually
has are different: "let me see the map behind this for a second" (fold — the head stays where
my eye expects it) versus "I am not using this at all right now" (close — give me the pixels).
Offering only the first makes a permanently unwanted panel permanently present; offering only
the second throws away the head's report every time someone peeks.

The grammar is identical in both places, which is the part worth taking: same chevron in the
same corner, same close beside it, same kind of tab left behind on the nearest viewport edge.
Learn the panel and you already know the dock.

## One section may fold another, if it gives it back

The dock folds the layer panel once it has grown past the height the panel needs to be worth
reading, and unfolds it on the way back down. Two rules make that acceptable rather than
presumptuous:

- **Only undo what you did.** The dock records that IT folded the panel. A reader who folded
  the panel themselves and then dragged the table around does not find it reopened, because
  that would be the app overruling a choice it was not asked about.
- **Only take what was there.** If the panel was ALREADY folded when the dock rose, the dock
  has taken nothing and has nothing to give back. This is the same bug entered from the other
  side, and a bare "did I fold it" boolean cannot express it — the boolean gets set, the dock
  comes down, and it hands back a fold that was never its to hand back.
- **Fold, never close.** The panel's head still says "Layers" and still carries its controls,
  so the reader can see where it went and bring it back in one click. Closing another
  section's furniture on its behalf removes the evidence that anything happened.

The first two rules are `makeBorrow()` in `furniture.js`, and it is a shared helper rather than
a convention because the convention did not hold: the shape had been written by hand three
times (the dock folding the panel, the fold pinning the panel's width, the undock pinning the
dock's width) and each copy got a different half of it right.

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
dock's on the bottom — the same edge `data-sgs-furniture`'s `edgeOf()` would attribute the
section to while it was open (see the `map-camera` skill). No lane, no extra line, and
nothing on screen when nothing is closed.

The consequence worth knowing: **a mark and a fold control are not the same element** in this
app — a section's head keeps its own fold chevron while open, and a SEPARATE mark, created once
and living in the document permanently, is what CSS reveals only once the section is closed.
Creating and destroying the mark per state would mean the reopen control does not exist at the
exact moment somebody needs it, which shows up as a tab that flickers on resize.

## A close is not a setting

A setting decides whether a thing exists for this map at all. A close is this reader, right
now, wanting the pixels. Wiring them to the same switch means a reader who tidies their screen
has silently changed the map for everybody.

## Using it

```js
const dock = makeClosable({ section: dockEl, markId: 'sgs-dock-sliver', markClass: 'sgs-mark--bottom', glyph: 'chevron', label: 'the table', onChange });
const fold = makeFoldable({ section: dockEl, control: foldBtn, body: dockBody, onChange });
```

`onChange` fires on every change, including the initial one, so the camera and any open popups
get told once and do not need to poll.

## Checklist

- [ ] Applied the test out loud before choosing FOLD or CLOSE.
- [ ] A closed section's MARK is its OWN glyph, not a generic close or eye.
- [ ] The mark parks at an existing viewport edge, not in a new row.
- [ ] Anything that depends on the section's size or presence is wired through `onChange`.
- [ ] The gesture is not also a settings toggle.
- [ ] A section with a berth has BOTH the pin and the snap, and they land in the same state
      through the same function.
- [ ] Re-berthing after a drag clears all six inline properties (`releaseDrag`), not the two
      that visibly moved.
- [ ] Anything one section changes on another's behalf goes through `makeBorrow`, so it cannot
      give back what it never took or take what was already gone.
- [ ] If the section participates in camera padding or popup obstacle avoidance, its
      `data-sgs-furniture` marker stays on the element through both fold and close — closing
      it already zeroes its rect (see `map-camera`), so nothing extra is needed there.

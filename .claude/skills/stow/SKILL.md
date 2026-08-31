---
name: stow
description: The vocabulary for putting a section away - FOLD, CLOSE, MARK, BERTH - and the one test that decides which applies, plus why the panel and dock both offer both. Use when adding a collapse, hide, minimise or close affordance to any panel or section, or when an app has grown several different gestures for "make this go away".
---

# Stow

An app grows several gestures for "make this go away" and no word for any of them, so each new
panel invents another one. Two verbs and two nouns, and one test.

## The vocabulary

**FOLD** — the content collapses, the header stays in its slot, a chevron rotates.
**CLOSE** — the whole section leaves the layout and gives its pixels back.
**MARK** — what a close leaves behind: the section's own glyph, which brings it back.
**BERTH** — where a mark parks. An edge or corner of chrome that already exists, never a lane
of its own.

`app/js/ui/stow.js` — `makeClosable()` for the FOLD/close pair's CLOSE half and its MARK,
`makeFoldable()` for FOLD.

## The test

> **Does the thing still have something to say when it is shut?**

Yes, so FOLD. The bottom dock's bar goes on reporting `Stations, 24 rows` while folded. That
sentence is worth a row of pixels.

No, so CLOSE. Folding a minimap yields a bar reading "Minimap", which is no information at
all; it should leave and give the space back.

A chevron is a **list** affordance. Alone on screen it is a switch wearing a disclosure
costume, which is exactly why folding a single lone panel reads cheap.

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

## Why marks sit at edges, not in a lane

The obvious design is a RAIL: a thin dedicated row holding the marks. It does not survive
contact with a real layout. A lane that exists to hold one or two small glyphs spends a whole
row of a narrow panel on chrome, and it reads as new furniture rather than as the section
having moved.

So a mark parks against the viewport edge the section came from: the panel's on the left, the
dock's on the bottom — the same edge `data-sgs-furniture`'s `edgeOf()` would attribute the
section to while it was open (see the `chrome-aware-camera` skill). No lane, no extra line, and
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
- [ ] If the section participates in camera padding or popup obstacle avoidance, its
      `data-sgs-furniture` marker stays on the element through both fold and close — closing
      it already zeroes its rect (see `chrome-aware-camera`), so nothing extra is needed there.

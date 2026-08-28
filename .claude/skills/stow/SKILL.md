---
name: stow
description: The vocabulary for putting a section away - FOLD, STOW, MARK, BERTH - and the one test that decides which applies. Use when adding a collapse, hide, minimise or close affordance to any panel or section, or when an app has grown several different gestures for "make this go away".
---

# Stow

An app grows several gestures for "make this go away" and no word for any of them, so each new
panel invents another one. Two verbs and two nouns, and one test.

## The vocabulary

**FOLD** - the content collapses, the header stays in its slot, a chevron rotates.
**STOW** - the whole section leaves the layout and gives its pixels back.
**MARK** - what a stow leaves behind: the section's own glyph, which brings it back.
**BERTH** - where a container's marks park. A corner, not a lane.

## The test

> **Does the thing still have something to say when it is shut?**

Yes, so FOLD. The bottom dock's bar goes on reporting `Stations, 24 rows` while folded. That
sentence is worth a row of pixels.

No, so STOW. Folding a minimap yields a bar reading "Minimap", which is no information at all;
it should leave and give the space back.

A chevron is a **list** affordance. Alone on screen it is a switch wearing a disclosure
costume, which is exactly why folding a single lone panel reads cheap.

## Why marks sit at corners

The obvious design is a RAIL: a thin dedicated row holding the marks. It does not survive
contact with a real layout. A lane that exists to hold one or two small glyphs spends a whole
row of a narrow panel on chrome, and it reads as new furniture rather than as the section
having moved.

So marks park at corners of chrome that already exists: the panel's in its title row. No lane,
no extra line, and nothing on screen when nothing is stowed.

The consequence worth knowing: **a mark and a stow control can be the same element.** When a
section's control already lives in the berth, stowing does not spawn a twin beside it; the
control simply becomes the thing that brings the section back. One glyph per section, in one
place, whatever its state. `makeStowable` in `app/js/ui/stow.js` does exactly this.

## A stow is not a setting

A setting decides whether a thing exists for this map at all. A stow is this reader, right now,
wanting the pixels. Wiring them to the same switch means a reader who tidies their screen has
silently changed the map for everybody.

## Using it

```js
makeStowable({ section: panel, berth, glyph: 'layers', label: 'the layer panel', onChange });
makeFoldable({ section: dock, control, body, folded: true, onChange });
```

`onChange` fires on every change including the initial one, so the camera and any open popups
get told once and do not need to poll.

## Checklist

- [ ] Applied the test out loud before choosing the verb.
- [ ] A stowed section's MARK is its OWN glyph, not a generic close or eye.
- [ ] The mark parks in an existing corner, not in a new row.
- [ ] Anything that depends on the section's size is wired through `onChange`.
- [ ] The gesture is not also a settings toggle.

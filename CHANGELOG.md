# Changelog

Every release is a tag (`vX.Y.Z`). `npm run sgs:status`, run from an app's directory, diffs
your `sgs.json` watermarks against this repo's history between the tag you last synced from
and the latest one. It does not read this file for that. What THIS file is for: a `Breaking:`
line names which component ids changed in a way that isn't just "pull the new version," so
`sgs:status` can flag it rather than reporting a silent content diff.

A line here should say what changed and, if relevant, what a consuming app needs to check.
It should not narrate the commit that produced it.

## [0.2.0] - 2026-09-13

One release for everything below; each line has its own test.

### Theme

- **The theme is defined in one place.** Every colour token is a `light-dark()` pair, and
  three `color-scheme` lines in `tokens.css` are the only place a theme state is named. No
  component carries a dark block any more; components derive colours with `color-mix()`.
  Components: `tokens`, `theme`, `swatch`, `source-pill`, `field-badge`, `map-controls`.
- **A mid-grey dark palette of adjacent tones** (ground `#2d2d33`), and **a faint warm cast**
  in both themes: every opaque token blended 1.25% toward `rgb(255, 80, 0)`. The `ui-theme`
  skill has the ladder.
- **MapLibre's own chrome follows the theme**: the control group, its hover, its divider.
- **The chosen segment in quick settings is monochrome**: the text colour as a plate, not the
  accent blue. Component: `quick-settings`.

### Furniture (panel and table)

- **One model for the head buttons.** One chevron with three views on the panel and the table
  alike (natural, fitted to its rows, head alone), skipping the fitted view when it would change
  nothing; one owner for the cycle, `nextFoldMode()` in `stow.js`. The chevron only ever flips.
- **FULL belongs to the table.** The panel's FULL is gone. FULL on a loose table takes the map
  and gives it back where it floated. Its glyphs sit on opposite diagonals now (FULL bottom-left
  to top-right, its release top-left to bottom-right).
- **The table drags like the panel.** Its head is grabbable berthed or loose, folded or not, and
  dragging it unpins it. Loose, it snaps back when held against the bottom edge anywhere, not
  only near the left corner (new `nearBottomBerth()` in `furniture.js`).
- **Head buttons are spaced by one rule** (`.sgs-head-actions`, 4px) in every furniture head.
- **A closed section's mark pulses once** (`flashMark()` in `stow.js`), so the reader sees
  where it went.
- Fixed: a folded panel stretched to full height under a loose table.
- Components: `panel`, `dock`, `edge-mark`, `app-shell` (`furniture.css`), `framework`
  (`furniture.js`), `primitives` (`prefs.js`).

### Features and tables

- **Zoom-to flashes the feature once**, on the press, while the camera is still moving (new
  `flashFeature()` in `layers.js`). `LayerDef` gains `key`, the property that tells features
  apart; without one a row still zooms and simply does not flash.
- **A popup's table button is a toggle.** Table closed: it opens on the feature's layer with its
  row lit and scrolled into view. Table open: it closes. The row a popup or a zoom pointed at is
  the one lit row, announced with `aria-current`.
- **Faint row stripes on the dock's table** (the text colour at 2.5%); the popup's field table
  stays plain. Component: `field-table`.
- Components: `app-shell` (`layers.js`, `main.js`), `dock`, `popups`.

### Smaller

- **The compass is a hollow notched arrowhead**, its ink centred so it spins in place.
  Component: `icons`.
- **A shorter nudge line** in the shortcut inventory: "Nudge the top popup". Component:
  `quick-settings`.

Breaking: `tokens` now needs `light-dark()` (Chrome and Edge 123, Firefox 120, Safari 17.5).
Below that floor surfaces render transparent, not light. An app that switches theme some way
other than `data-theme` must end its switch by setting `color-scheme` on the root; see the
`ui-theme` skill.

Breaking: `panel` no longer has `.sgs-panel-full`, `.sgs-panel--full` or the `panelFull`
preference; an app that styled or scripted the panel's FULL should drop it (a stored
`panelFull` is ignored). `makeFoldable()` stays backward compatible: without `tightClass` it
folds in two steps as before, and `onChange` gains a second argument. A new `dock.js` needs
`furniture.js` at this version for `nearBottomBerth()`.

## [0.1.0] - 2026-09-02

The first release. Everything below is what the repo IS, not what changed in it.

### What this is

A small runnable MapLibre application, and fourteen skills that explain the decisions inside
it. The app is not a demo of the skills; the app is what the skills are ABOUT. Every claim in
a skill points at a file you can open and a command you can run.

You do not depend on this at runtime. `sgs:init` copies a chosen subset of it into your
repository once, records which components it copied and at which tag (`sgs.json`), and gets
out of the way. From then on `sgs:status` answers "did upstream move past me" and `sgs:drift`
answers "did I move past my watermark", and neither one ever edits your files.

### The app

- **No build step.** Vendored MapLibre as a global with `defer`, one ES module entry point that
  cannot race it, types from JSDoc checked by `tsc --noEmit`.
- **Three tiers**: design tokens, a framework of pure geometry contracts
  (`furniture.js`, `visible-area.js`, `popup-placement.js`), and components on top. The
  framework knows nothing about any specific panel: a `data-sgs-furniture` attribute plus a
  live geometric read, never a static label saying where something is.
- **A left panel and a bottom dock**, sharing one geometry model: three independent facts
  behind one applier, a berth each, pin and snap, and TIGHT / PINNED / FULL as the three things
  a size axis can be.
- **Popups** that choose between a CLEAN column and an ADJACENT anchor, refuse to cover the
  app's own furniture, and cover the anchor only as a last resort.
- **A camera** that pads around whatever furniture is currently on screen, so zoom-to never
  lands a feature underneath the panel it was found in.
- **Light, dark and system themes** with no flash of the wrong colours, and glyphs whose size
  and centring are measured rather than eyeballed (`npm run icons`).
- **Real data**: eight adjacent inner Portland neighborhoods from the city's own open data,
  under a public domain dedication, plus six invented points. Small enough to read, real enough
  to have honest geometry.

### The framework around it

- `sgs:init` scaffolds an app from a capability interview, copying each capability's components
  AND the skills that describe them, so an agent opening the app finds instructions for the
  code that is actually there at the version it is pinned to.
- **An app that already exists has its own way in.** `app-adopt` offers three answers per
  capability instead of two, and the third is the one that matters: `--eject` records a
  component as yours, copies its SKILL.md and none of its code, so you adopt the lessons
  without adopting the files. `--manifest-only` goes further, for an application whose layout
  is too far from this one to scaffold into: skills, vocabulary, tools and a manifest of
  ejections, no application code, and nothing existing overwritten. `sgs:init` also reports
  what it could NOT eject and why, because "the dock imports foldPanel from the panel" is the
  coupling that makes adoption hard and silence about it teaches nobody anything.
- `sgs:status` and `sgs:drift` locate a clone themselves and fail loudly rather than reporting
  confident nonsense when they cannot answer.
- `sgs-decisions.md` records why an app is shaped the way it is, so the next session reads a
  decision instead of re-asking the question that produced it.
- Contribution is CLEAN-ROOM: a lesson is reproduced against this repo's own demo, never
  diffed out of the app where it was learned. That is what lets a private application
  contribute on the same terms as a public one.

### Why this is 0.1.0, and why the history behind it is not in this file

An earlier draft of this repo tagged four releases in two days. Each one was a genuine
improvement and none of them was a release anybody could have consumed: nothing had been
cloned, so every `Breaking:` line was a warning addressed to no one. A version number that moves faster than its
consumers is not information, it is noise wearing a contract's clothing. Those tags are gone
and this is the first entry.

It is 0.1.0 rather than 1.0.0 because 1.0.0 is a promise about stability, and the conventions
here are still moving: the skills were renamed into categories the same week this shipped, and
`app-adopt` is a named gap rather than a file. 0.x says what is true, which is that the ideas
are worth using and the names may still shift under you.

**From here on, every change arrives as a pull request**, every merged PR bumps the version
(enforced), and every merge tags a release. That is the point at which a version number starts
meaning something to somebody, and it is why the pace slows down rather than up.

`main` is protected accordingly: pull request required, one approving review dismissed on
push, the version-bump check required, branch up to date before merge, no force pushes or
deletions. The repository owner can bypass all of it, deliberately, because on a
single-maintainer repository an approval only the author could give would mean nothing merges
at all. CONTRIBUTING.md documents the flow and which number to bump.

One house rule was corrected rather than enforced: CLAUDE.md said "no em-dashes" while the
corpus carried hundreds, so the file stating the rule and every other file gave contributors
different instructions. It now states the practice, and explicitly forbids the repo-wide sweep
that would collide with everything in flight for a change with no behaviour in it.

# Changelog

Every release is a tag (`vX.Y.Z`) with a GitHub release page, whose notes are that version's
section below. `npm run sgs:status`, run from an app's directory, diffs
your `sgs.json` watermarks against this repo's history between the tag you last synced from
and the latest one. It does not read this file for that. What THIS file is for: a `Breaking:`
line names which component ids changed in a way that isn't just "pull the new version," so
`sgs:status` can flag it rather than reporting a silent content diff.

A line here should say what changed and, if relevant, what a consuming app needs to check.
It should not narrate the commit that produced it.

## [0.2.1] - 2026-09-15

- **Every release gets a release page.** `tag-release.yml` now also creates the GitHub release
  for the tag it makes, with this file's section for that version as its notes, and skips a
  release that already exists. Nothing an app copies changes.

## [0.2.0] - 2026-09-14

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
- **The chosen segment in quick settings is a quiet grey plate** (`--sgs-fg-dim`), not the
  accent blue. Component: `quick-settings`.
- **Quick settings stay open** through clicks on the map, closing on the gear or Escape, so its
  shortcuts can be tried while it shows. Component: `quick-settings`.
- **The arrows pan the map without clicking it first**; Shift + ←/→ rotates and Shift + ↑/↓
  tilts. MapLibre only hears them on its focused canvas, so `main.js` takes them anywhere else.
  Component: `app-shell`.

### Furniture (panel and table)

- **One model for the head buttons.** One chevron with four views on the panel and the table
  alike, pointing one way per view: natural ↓, fitted to its rows →, head alone ↑, fitted to
  its rows and width ←. A fitted view is skipped only when it cannot do its job (the rows could
  not all fit on screen; there is no width to take in). One owner for the cycle,
  `nextFoldMode()` in `stow.js`, which now takes `{tight, snug}`; `makeFoldable()` gains
  `snugClass`, `tightFits` and `snugDiffers`. A folded table unfolds from its chevron, not its
  bar, as the panel does.
- **FULL belongs to the table.** The panel's FULL is gone. FULL on an undocked table takes the
  map, and giving the room back returns the table to the state it was in before: where it was,
  its size, and its chevron view, so a folded or fitted table folds or fits again. Its glyphs
  sit on opposite diagonals now (FULL bottom-left to top-right, its release top-left to
  bottom-right).
- **The table drags like the panel.** Its head is grabbable docked or undocked, folded or not, and
  dragging it undocks it. Undocking, by drag or button, keeps the table's width; narrowing it is
  the chevron's fourth view.
- **Both sections snap back anywhere along their edge**: the table along the bottom, the panel
  along the left, not only near one corner (new `nearBottomEdge()` and `nearLeftEdge()` in
  `furniture.js`). Ctrl held while dragging turns the snap off; `makeDraggable()` reports it.
- **Head buttons are spaced by one rule** (`.sgs-head-actions`, 4px) in every furniture head.
- **One card, one head, one title, one grip.** The panel, the table and the popups share one
  rule for each in `furniture.css` instead of three drifting copies: the popup's head now sits
  one step off the ground like the others, the heads share one padding and gap, and the panel's
  grips show the table's quiet pill instead of an accent wash on hover.
- **One vocabulary in the copy**: both pins say "Dock" and "Undock" (the table's said
  "Berth"), the panel is "the layer panel" everywhere, the popup's close says "Close the popup",
  and the four grips read "Drag to set the width/height, double-click to …".
- **A closing section shrinks into its tab** (160ms, `stowInto()` in `stow.js`), **and the tab
  pulses once** in the chrome's own greys, its outline held for 300ms of a 1s pulse
  (`flashMark()`), so the reader sees where it went.
- Fixed: a folded panel stretched to full height under an undocked table.
- Components: `panel`, `table`, `edge-mark`, `app-shell` (`furniture.css`), `framework`
  (`furniture.js`), `primitives` (`prefs.js`).

### Features and tables

- **Zoom-to flashes the feature once**, on the press, while the camera is still moving (new
  `flashFeature()` in `layers.js`). `LayerDef` gains `key`, the property that tells features
  apart; without one a row still zooms and simply does not flash.
- **A popup's table button takes three presses: find, clear, close.** The first lights the
  feature's row (opening or switching the table as needed) and shows the button pressed, drawn
  as a table with a row lit; the second clears the row; the third closes the table. A table
  opened any other way gets its row lit, never closed. Closing the popup puts out a row its
  button lit. The lit row is announced with `aria-current`. New `featureTableState()` and
  `releaseFeatureRow()` in `table.js`; `openPopup()` gains `tableButtonState` and `onClose`.
- **A feature with a popup open is drawn selected**: a quiet neutral edge on a polygon, a ring
  hugging a point, gone when its popup closes (`markSelected()` in `layers.js`).
- **Faint row stripes on the table** (the text colour at 2.5%); the popup's field table stays
  plain. Component: `field-table`.
- Components: `app-shell` (`layers.js`, `main.js`), `table`, `popups`.

### Code vocabulary

- **One word per thing, in the code as on screen.** The screen already said Dock, Undock and
  "the table". The code said berth, berthed, pinned, float, floating and loose for two
  positions, "sliver" for the table's tab, and "dock" for the table itself, so the button "Dock
  the table" was, in the code, docking the dock. Now the section across the bottom is the
  **table**, a section is **docked** or **undocked**, a closed section leaves a **mark**, a size
  the reader dragged is **manual** (as its class already said), and the chevron's third view is
  the **head**. `VOCABULARY.md` states it; `tests/unit/vocabulary.spec.js` keeps the retired
  words out of the app, the skills and the docs.
- Why rename the code and not only its comments: identifiers are what a reader or an agent
  searches for, and an app scaffolded from this repo copies them, so a codebase whose names
  disagree with its own buttons teaches both vocabularies to every app made from it. In 0.x,
  this is the cheapest the rename will ever be. The cost is the Breaking list below.
- **Icon buttons are made in one place.** `iconButton()` and `setButton()` in the new
  `app/js/ui/buttons.js` set the glyph, the tooltip and the accessible name from one call (and
  `aria-pressed` for a toggle). The thirteen hand-built icon buttons in six files, and the
  places in eight files that relabelled them, now go through it, so a label cannot reach the
  tooltip and miss the screen reader. The buttons with words on them (window tabs, footer
  actions, quick-settings segments) keep their own code: each has its own role, and a shared
  helper would need a branch per caller.
- The panel's dock button is in `index.html` beside its fold and close, instead of being
  injected into a `display: contents` wrapper, which is gone.
- The fitted view ← narrows the table from the right again, so its left edge stays put.

### Smaller

- **The compass is a hollow notched arrowhead**, its ink centred so it spins in place, with a
  measured half-pixel `NUDGE` so it no longer sits low and right. Component: `icons`.
- **Shorter shortcut lines**: "Nudge the top popup", "Keep multiple popups open". Component:
  `quick-settings`.
- **The attribution is a small-cornered card**, not MapLibre's round pill. Component:
  `map-controls`.
- **The README is ordered by task**: run the demo, start an app, pull in upstream changes,
  send changes back, verify. The naming law and the decision log moved to CONTRIBUTING.md. No
  doc states how many skills there are any more; the tables are the list.

Breaking: `tokens` now needs `light-dark()` (Chrome and Edge 123, Firefox 120, Safari 17.5).
Below that floor surfaces render transparent, not light. An app that switches theme some way
other than `data-theme` must end its switch by setting `color-scheme` on the root; see the
`ui-theme` skill.

Breaking: `panel` no longer has `.sgs-panel-full`, `.sgs-panel--full` or the `panelFull`
preference; an app that styled or scripted the panel's FULL should drop it (a stored
`panelFull` is ignored). `makeFoldable()` stays backward compatible: without `tightClass` it
folds in two steps as before, and `onChange` gains a second argument. `table.js` needs
`furniture.js` at this version for `nearBottomEdge()`.

Breaking: the `dock` component is now `table` (`app/js/ui/dock.js` is `app/js/ui/table.js`),
and the `table-dock` capability is `table`. In an app's `sgs.json`, rename the `"dock"` key to
`"table"`; `sgs:status` and `sgs:drift` report `dock` as an unknown component until you do.

Breaking: names in `table`, `panel`, `edge-mark`, `framework`, `app-shell` and `primitives`,
for an app that scripts or styles them:
- ids and classes: `#sgs-dock` and every `.sgs-dock-*` become `#sgs-table` and `.sgs-table-*`;
  `.sgs-dock--float` and `.sgs-panel--float` end in `--undocked`; `body.sgs-dock-open` and
  `body.sgs-dock-float` are `sgs-table-open` and `sgs-table-undocked`; `--sgs-dock-h` and
  `--sgs-dock-w` are `--sgs-table-h` and `--sgs-table-w`; the dock buttons `.sgs-dock-pin` and
  `.sgs-panel-pin` are `.sgs-table-dock` and `.sgs-panel-dock`; the marks `#sgs-dock-sliver`
  and `#sgs-panel-sliver` are `#sgs-table-mark` and `#sgs-panel-mark`. The `<table>` inside the
  table, which was `.sgs-table`, is `.sgs-grid` (component `field-table`).
- functions: `initDock` and `isDockOpen` are `initTable` and `isTableOpen`; `nearBerth`,
  `nearBottomBerth` and `nearLeftBerth` are `nearDockPoint`, `nearBottomEdge` and `nearLeftEdge`.
- values: the fold view `'header'` is `'head'` (`FoldMode`, `makeFoldable()`'s labels), and the
  posture `'float'` is `'undocked'` (`getPosture()`, `setPosture()`).
- preferences: `dockFloat`, `dockFull` and `dockH/W/X/Y` are `tableUndocked`, `tableFull` and
  `tableH/W/X/Y`; `panelFloat` is `panelUndocked`. They are not migrated, so a reader's saved
  panel and table layout resets once.
- `.sgs-berth` and `#sgs-panel-berth` are gone: the panel's dock button is a plain button in
  `index.html`.

Breaking: `buttons` now has JavaScript, `app/js/ui/buttons.js`, which `map-controls`,
`edge-mark`, `panel`, `table`, `popups` and `overlay-window` import. It imports `icons`; both
are in `core`.

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

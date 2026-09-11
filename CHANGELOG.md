# Changelog

Every release is a tag (`vX.Y.Z`). `npm run sgs:status`, run from an app's directory, diffs
your `sgs.json` watermarks against this repo's history between the tag you last synced from
and the latest one. It does not read this file for that. What THIS file is for: a `Breaking:`
line names which component ids changed in a way that isn't just "pull the new version," so
`sgs:status` can flag it rather than reporting a silent content diff.

A line here should say what changed and, if relevant, what a consuming app needs to check.
It should not narrate the commit that produced it.

## [0.2.0] - 2026-09-11

### The theme is defined in one place

Components: `tokens`, `theme`, `swatch`, `source-pill`, `field-badge`, `map-controls`.

- **Every colour token is a `light-dark(<light>, <dark>)` pair**, and three `color-scheme`
  lines at the top of `tokens.css` are the only place a theme state is named. The dark values
  used to be written twice (a system block and an explicit block), and four component files
  carried their own pairs of dark blocks. All of that is gone. `tests/unit/theme.spec.js`
  keeps it gone.
- **A new dark palette: mid-grey, built from adjacent tones.** The ground moves from `#171a20`
  to `#2a2d34`, with every other dark token re-picked so neighbouring surfaces sit one step
  apart. The `ui-theme` skill carries the full ladder with its roles, and explains why
  near-black was the wrong floor.
- **Components derive their colours from tokens** with `color-mix()` instead of naming a dark
  hex. Source pills are one hue per kind now; every kind measures at least 4.5:1 in both
  themes (the light pills were near 3:1, which the new e2e spec caught on the old code).
- **MapLibre's own chrome follows the theme** with one rule each: the control group, its hover
  patch, and the divider between stacked buttons, which was a fixed `#ddd` hairline across the
  dark group. The attribution now shares the scale bar's translucent card.

Light-mode changes you will see: pills are darker text on softer plates, the attribution card
is 88% opaque instead of 50%, its links are the quiet text colour instead of near-black, and
the control-group divider is `--sgs-line-soft` instead of `#ddd`.

Breaking: `tokens` now needs `light-dark()` (Chrome and Edge 123, Firefox 120, Safari 17.5).
Below that floor surfaces render transparent, not light, because an invalid-at-computed-time
value resolves to `unset` rather than to the `var()` fallback. An app that switches theme some
way other than `data-theme` must now end its switch by setting `color-scheme` on the root; see
the `ui-theme` skill. The four component files work against the old `tokens.css` as well as
the new one, so they can be taken without it.

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

---
name: maintenance
description: The anti-bloat laws - what earns a new component id, a new skill, a new capability, or a place in the demo, and the audit ritual that keeps every skill true to the code it describes. Use when reviewing a PR that adds anything, when the repo feels like it is growing, or periodically as a standalone audit.
---

# Maintenance

This repo's value is DENSITY: a small demo where every file teaches, and skills that are true.
Every addition spends that. These are the tests an addition must pass, and the ritual that
catches drift between the skills and the code.

## The laws

**A component id must change on its own schedule, or it is not a component.** Before minting
an id in `sgs-components.json`, ask: would this file ever be upgraded separately from an
existing component's files? If not, fold it into the nearest one. Minting is also a breaking
event for consumers — every existing app's manifest predates the new id — so the CHANGELOG
entry must say what old id (if any) it came from and what an app should write in its
manifest.

**A capability is a user-visible feature, not a grouping convenience.** An entry in
`sgs-capabilities.json` earns its place only if a person starting an app could want it or not
want it in plain language. "Which CSS files load" is not a capability; "a table across the
bottom" is.

**A skill must point at real files and a runnable command.** A skill that describes intent
rather than code is a blog post, and it will be wrong within three releases. If the thing it
would point to does not exist yet, the skill waits.

**The demo teaches; it does not grow.** The scope list in CLAUDE.md is a refusal, not a
backlog: no layer model, no group tree, no config schema, no symbology engine, no basemap
switcher, no minimap. A new behaviour enters the demo only when it demonstrates a convention
the existing skills cannot — and then the question is which EXISTING piece it replaces or
rides on, not where it is added.

**One definition per term.** New vocabulary goes in VOCABULARY.md, once; everything else
links. Two definitions of one word is how FOLD/STOW survived in a skill for a month after the
code said FOLD/CLOSE.

**Comments record decisions, not narration.** The repo's main content is WHY-comments carrying
the alternative that lost and the bug that actually happened. Do not compress them away, and
do not add comments that restate the code.

## The audit ritual

Run it when a release touched several components, or when nobody remembers the last time.

1. For each skill, open the files its front section names. Do they exist? Do the function
   names, class names and vocabulary in the skill appear in the code? (`grep` each named
   identifier — a skill naming `choosePlacement` when the code says `adjacentPlacement` has
   happened here.)
2. For each skill's code snippets: is the snippet still what the file contains, or a
   paraphrase of an older version?
3. Does any skill describe behaviour that was never implemented? (A furniture-avoidance
   algorithm for the clean column's top edge lived in a skill, with a code snippet, while the
   code had a constant. Say "this is a known gap" out loud rather than describing fiction.)
4. `sgs-components.json` coverage: every file under `app/js` and `app/css` belongs to exactly
   one id. Diff the file list against the union of the catalog.
5. VOCABULARY.md against the code: does every term still match? Any new term defined ad hoc
   in a skill or comment that belongs there?
6. Skills count in README and CLAUDE.md matches `ls .claude/skills/`.

File findings as ordinary fixes with a version bump — the audit is maintenance, not a
special event.

## What removal looks like

Removal is a first-class change, with the same rigor as addition: a component that no app
would miss gets removed from the catalog and the demo, with a CHANGELOG `Breaking:` line
telling manifest-holders to drop the id. Shrinking the repo is a feature; a catalog that only
ever grows is how the interview stops fitting in one screen.

## Checklist for reviewing any PR

- [ ] New component id? Applied the own-schedule test; CHANGELOG says what manifests should do.
- [ ] New capability? Passes the plain-language test.
- [ ] New skill? Points at real files and a runnable command that exist in this PR.
- [ ] New term? Defined in VOCABULARY.md, linked everywhere else.
- [ ] Demo grew? Named which convention could not be demonstrated without it.
- [ ] Version bumped; `Breaking:` line if any contract moved.

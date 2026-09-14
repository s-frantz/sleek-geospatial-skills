---
name: app-upgrade
description: How an app built from this repo checks whether it has fallen behind, and what to actually do about it. Two mechanical steps, then two that need judgment. Use when asked to "upgrade", "check for updates", or "sync" an app against sleek-geospatial-skills, or when sgs.json's watermarks haven't moved in a while.
---

# Upgrading an app

An app built from this repo does not depend on it at runtime — every file was copied once, at
`sgs:init`. "Upgrading" is not a version bump; it's deciding, component by component, whether
something that changed upstream is worth pulling into a copy that may have since diverged.

Four steps. The first two are commands; the last two are the actual work.

Before any of them, read `sgs-decisions.md`. An upgrade re-opens exactly the questions that
file was written to answer, and the ones already settled at a version this component has not
moved past do not need re-litigating with the owner. What you are looking for is the opposite
case: a decision made at an OLD version, on a component `sgs:status` now reports as behind.
That pairing is the real agenda for this session.

## 1. Run the status check

```bash
npm run sgs:status          # from the app; it takes a path too
```

This diffs the SKILLS REPO's own history between each component's watermark and the latest
release, never the app's files, which may be customized. It needs a CLONE to read that
history from and finds one itself: `$SGS_CLONE`, or a directory named `.sgs` or
`sleek-geospatial-skills` in the app or any ancestor. If it cannot find one it says so and
exits 1 rather than reporting a cheerful nothing; clone one anywhere convenient and re-run.
Output looks like:

```
  tooltip      v0.1.0 → v0.4.0  (3 releases, 1+ breaking)
  source-pill  v0.2.0 → v0.4.0  (2 releases)
  panel        ejected — upstream changed since v0.1.0, FYI only
```

A component reading `current` needs nothing further. Everything else is your list. A
component whose watermark the clone cannot resolve is NOT current: the command says so, exits
1, and the fix is usually `git -C <clone> fetch --tags`.

## 2. Read what actually changed

For each behind component, read the clone's `CHANGELOG.md` for every release between its
watermark and the target, not the raw commits. A changelog entry says what a
change means for a consumer; a commit diff only says what moved. A `Breaking:` line naming the
component means the fix isn't a drop-in — read that entry closely before step 3.

## 3. Decide what applies — the judgment step

For each changed component, in order:

- **Is this component ejected** (`"panel": "ejected@v0.1.0"` in the app's `sgs.json`)? Then the
  upstream change is informational only — the app owns its own implementation now. Read it
  anyway; it may still be worth hand-porting the lesson, just not the file.
- **Has the app's copy diverged from what it started as?** Don't guess — `npm run sgs:drift`
  answers this exactly, per file (see the `app-contribute` skill). A component drift
  reports clean can take the upstream version wholesale.
- **If it has diverged**, the question is not "does the diff apply" but "does the LESSON
  apply": what problem did the upstream change solve, and does this app have that problem too?

This is the step worth interrogating rather than rushing. If you're an agent doing this with a
human, walk each changed component one at a time and ask — don't propose a bundled "apply
everything" plan. A change that's obviously right for one component (a components/ CSS fix,
say) can be entirely wrong for another (a framework-tier change the app's furniture already
works around differently). Treat each component as its own decision with its own answer, the
same way a `/grill-me`-style interview would.

## 4. Apply, move the watermark, and record the answer

Whatever was decided in step 3, applying it ends with TWO things: an entry in
`sgs-decisions.md` saying what was decided and why, and `sgs.json`'s value for that component
updated to the tag it was checked against.

The entry matters most for the changes you decided NOT to take. A watermark that moved with no
diff behind it looks, six months later, exactly like a watermark nobody thought about — and the
next session re-reads the same changelog entry and re-reaches the same conclusion, slowly. One
line saying "the lesson does not apply here, our panel never undocks" saves that entirely. A component you decided NOT to change
still gets its watermark moved forward — "I checked and it doesn't apply" is a real answer, and
leaving the old tag in place means the next upgrade re-asks the same question for no reason.

## A component's skill upgrades with it

A component owns the `SKILL.md` that describes it, so an app's `.claude/skills/` is pinned the
same way its code is: pull a component forward and its skill comes along in the same file
list. That is the point. A skill describing behaviour the app does not have yet is worse than
no skill, so do not refresh `.claude/skills/` wholesale from the clone; move it component by
component, with the code.

New capabilities are the exception: taking one that was omitted at scaffold time means
copying its components AND its skill, then adding the id to `sgs.json` at the tag you copied
from.

## What this skill does not do

It does not pull anything automatically. There is no `sgs:upgrade` command that edits an app's
files — on purpose. A tool that silently rewrites a customized component is a tool nobody would
trust with a customized component, which defeats the entire point of watermarking instead of
importing live. See CONTRIBUTING.md for the tiers this reasons about, and the `map-controls` /
`ui-furniture` / `map-popups` skills for what specific components actually promise.

It also does not cover the opposite direction — the app's own changes flowing back up. That is
`sgs:drift` plus the `app-contribute` skill, and running both directions together is the
healthy habit: a file that is both drifted and behind is a lesson learned twice independently.

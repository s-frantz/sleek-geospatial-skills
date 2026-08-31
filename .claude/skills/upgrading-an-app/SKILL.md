---
name: upgrading-an-app
description: How an app built from this repo checks whether it has fallen behind, and what to actually do about it. Two mechanical steps, then two that need judgment. Use when asked to "upgrade", "check for updates", or "sync" an app against sleek-geospatial-skills, or when sgs.json's watermarks haven't moved in a while.
---

# Upgrading an app

An app built from this repo does not depend on it at runtime — every file was copied once, at
`sgs:init`. "Upgrading" is not a version bump; it's deciding, component by component, whether
something that changed upstream is worth pulling into a copy that may have since diverged.

Four steps. The first two are commands; the last two are the actual work.

## 1. Run the status check

```bash
npm run sgs:status path/to/the/app
```

This diffs THIS repo's own history between each component's watermark and the latest release —
never the app's files, which may be customized. Output looks like:

```
  tooltip      v0.2.0 → v0.5.0  (3 releases, 1+ breaking)
  source-pill  v0.3.0 → v0.5.0  (2 releases)
  panel        ejected — upstream changed since v0.2.0, FYI only
```

A component reading `current` needs nothing further. Everything else is your list.

## 2. Read what actually changed

For each behind component, read [CHANGELOG.md](../../../CHANGELOG.md) for every release
between its watermark and the target — not the raw commits. A changelog entry says what a
change means for a consumer; a commit diff only says what moved. A `Breaking:` line naming the
component means the fix isn't a drop-in — read that entry closely before step 3.

## 3. Decide what applies — the judgment step

For each changed component, in order:

- **Is this component ejected** (`"panel": "ejected@v0.2.0"` in the app's `sgs.json`)? Then the
  upstream change is informational only — the app owns its own implementation now. Read it
  anyway; it may still be worth hand-porting the lesson, just not the file.
- **Has the app's copy diverged from what it started as?** If not — the file is still
  essentially what `sgs:init` wrote — the upstream version can usually be taken wholesale.
- **If it has diverged**, the question is not "does the diff apply" but "does the LESSON
  apply": what problem did the upstream change solve, and does this app have that problem too?

This is the step worth interrogating rather than rushing. If you're an agent doing this with a
human, walk each changed component one at a time and ask — don't propose a bundled "apply
everything" plan. A change that's obviously right for one component (a components/ CSS fix,
say) can be entirely wrong for another (a framework-tier change the app's furniture already
works around differently). Treat each component as its own decision with its own answer, the
same way a `/grill-me`-style interview would.

## 4. Apply, and move the watermark

Whatever was decided in step 3, applying it ends with one thing: updating `sgs.json`'s value
for that component to the tag it was checked against. A component you decided NOT to change
still gets its watermark moved forward — "I checked and it doesn't apply" is a real answer, and
leaving the old tag in place means the next upgrade re-asks the same question for no reason.

## What this skill does not do

It does not pull anything automatically. There is no `sgs:upgrade` command that edits an app's
files — on purpose. A tool that silently rewrites a customized component is a tool nobody would
trust with a customized component, which defeats the entire point of watermarking instead of
importing live. See CONTRIBUTING.md for the tiers this reasons about, and the `map-control-icons` /
`panel-anatomy` / `popup-placement` skills for what specific components actually promise.

---
name: app-contribute
description: Turn an app's local changes into upstream contributions - run sgs:drift for the candidate list, triage which changes are lessons versus app-being-an-app, and ship the keepers as clean-room issues or PRs. Use when asked "should any of this go back?", after fixing a bug in a copied component, or periodically alongside app-upgrade.
---

# Contributing upstream

Two mirrored questions keep an app and this repo honest, and each has its own skill:

- **"Did upstream move past me?"** → `sgs:status`, the `app-upgrade` skill.
- **"Did I move past my watermark?"** → `sgs:drift`, this skill.

Run both when doing either; they are cheap and their outputs feed each other (a file both
drifted AND behind is exactly where a lesson was learned twice independently — the strongest
possible contribution signal).

## 1. Get the candidate list

```bash
npm run sgs:drift           # from the app; it takes a path too
```

Every watermarked component whose files differ from what the watermark shipped, file by file.
Drift is information, not error — a clean report just means nothing to consider, and exit 0
means the question was actually answered (a watermark the clone cannot resolve exits 1 and
says so instead of reading as clean).

Drift needs a CLONE to read watermarks out of, and finds one itself: `$SGS_CLONE`, or a
directory named `.sgs` or `sleek-geospatial-skills` in the app or any ancestor. If there is
none, clone one anywhere convenient. You will need it for step 3 regardless: a contribution
is a branch in the clone. To see one diff:

```bash
git -C <clone> show v0.1.0:app/js/ui/tooltip.js > /tmp/upstream.js
diff /tmp/upstream.js path/to/app/app/js/ui/tooltip.js
```

## 2. Triage each drifted file — the judgment step

The tier decides the prior; the diff decides the answer:

| where the drift is | prior |
|---|---|
| **framework** (`furniture.js`, `visible-area.js`, `popup-placement.js`) | almost always interesting. These are contracts every app relies on; a change here is a bug found or a case the contract missed |
| **components** | often interesting. Ask: does this fix something ANY app using the component would hit, or does it bend the component to this app's taste? The first goes up; the second is a candidate for ejecting instead |
| **tokens** | usually app theming — an alias block should have carried it. Aliasing that goes wrong IS worth an issue |
| **app-shell / furniture** (`main.js`, panel, table, popups) | usually the app being an app. Escalate only when the change is a transplantable LESSON (an ordering bug in boot, a posture case the panel mishandles), not a feature |

Walk them one at a time with the user; do not propose a bundle. Three honest outcomes per
file, and all three are wins. Each one gets a line in `sgs-decisions.md` — the triage is the
expensive part and it is worth exactly once:

1. **Contribute** — a lesson with a reproduction. Continue below.
2. **Keep, and eject** — deliberate permanent divergence. Set `"<id>": "ejected@<tag>"` in
   `sgs.json` so drift and status stop nagging and start informing.
3. **Keep, no action** — drift that is simply the app's own content. Leave the watermark
   alone; drift will keep listing it, which is correct: it IS drifted.

## 3. Ship the keepers, clean-room

The protocol is the clone's CONTRIBUTING.md, and it is the only path: **reproduce against
this repo's demo, never diff the app's code into the PR.** Nothing in the contribution may say where the
lesson was actually learned — no app names, no client names, no "in our project". This is
what lets any application, however private, contribute identically.

**As an issue** (lower bar — can't spare the time, or unsure of the fix): describe the
problem in the demo's own terms, with steps that reproduce it on a fresh clone.

**As a PR** (the full contribution), on a branch in the clone — the one time the clone is
deliberately written to:

```bash
git -C <clone> switch -c fix-tooltip-clamp     # BEFORE editing: a commit on no branch
                                               # is silently lost on the next pull
```

1. A failing test in `tests/unit/` or `tests/e2e/`, using only the demo and its data.
2. The fix, restated against the demo's code (not pasted from the app — re-derive it).
3. The relevant `SKILL.md` updated, if a convention changed and not just a bug.
4. `package.json` version bumped (required check; see CONTRIBUTING.md), CHANGELOG entry,
   `Breaking:` line naming component ids if the contract moved.
5. `npm run verify` green in the clone, then `gh pr create`.

After it merges and releases: run the `app-upgrade` flow on your own app to adopt the
released version of your own fix, and move the watermark. Your app then holds the fix at a
tag rather than as drift — which is the whole loop closing.

## Checklist

- [ ] `sgs:drift` AND `sgs:status` both run; both outputs in front of you.
- [ ] Every drifted file got one of the three outcomes, decided with the user, one at a time.
- [ ] Ejections recorded in `sgs.json`, not just decided verbally.
- [ ] Every triage outcome appended to `sgs-decisions.md` with its reason and the version it
      was decided at, so the next drift report over the same file is read rather than
      re-triaged. Keep provenance OUT of the contribution itself; the log is the app's, and
      the app's alone.
- [ ] Contributions carry zero provenance — reread the diff and the test for app names.
- [ ] PR branch created in the clone BEFORE editing; clone back to clean + pulled after.

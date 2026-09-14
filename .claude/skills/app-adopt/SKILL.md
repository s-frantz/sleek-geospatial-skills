---
name: app-adopt
description: Bring these conventions into an application that already exists - the shape question, a three-answer interview instead of two, ejecting at scaffold time so you take the lessons without the files, a bake-off protocol for anything genuinely contested, and the argument for when to keep your own architecture. Use when somebody says "I already have an app", when adopting into a repo with its own layout, single-file or otherwise, or when a scaffolded app and an existing one need comparing.
---

# Adopting into an app that exists

`app-start` interviews a blank page. Its questions ("A left panel with layer rows?") are the
wrong questions for somebody who already has one, and it has no branch for "I have that
already, here it is."

This is that branch. The person in front of you is not choosing features, they are RECONCILING
two implementations, and the useful output is a decision per overlap rather than a scaffold.

Terms are in [VOCABULARY.md](../../../VOCABULARY.md). Read `app-start` too: steps 1 and 4 to 6
are shared and not repeated here.

## 1. Ask why the layout is what it is

Before any capability question. An existing app has a shape, and the reason for the shape
decides which of three workflows this is. Ask it plainly: **why is the code arranged this
way?**

**"It has to ship as one file"** (an embed, an email, a drop-on-a-server page). A real
constraint. Note, once, that *authored* single-file and *shipped* single-file are different
problems and about twenty lines of concatenation separates them; if they want the split, that
is the cheap way to it. If a build step is genuinely off the table, do not scaffold:

```bash
node .sgs/scripts/sgs-init.mjs . --manifest-only
```

Skills, vocabulary, the two version tools, and a manifest with every component
`ejected@<tag>`. No application code, no package.json rewrite, and nothing existing
overwritten. The manifest is what makes this more than having read some documentation:
`sgs:status` can still say "the lesson in `map-popups` moved since you read it", which is the
only thing an app that took no code could ever want from upstream.

**"It just grew that way."** Scaffold normally and port into it. This is the common answer and
they will usually be glad of the split.

**"I like it tight."** The middle path, and the one worth taking seriously rather than
talking them out of. Scaffold to a scratch directory as a read-only QUARRY, build in their
layout, take lessons rather than files, and record the ejections. Delete or gitignore the
quarry when done.

## 2. Interview with three answers, not two

Then go capability by capability as `app-start` does, but every question has a third answer:

| answer | what happens | when |
|---|---|---|
| **take ours** | copied and watermarked normally | they have nothing here, or theirs is worse and they know it |
| **skip it** | no files, no watermark, invisible to both tools | they do not want the feature at all |
| **I have one** | `--eject`: no code, but the SKILL and an `ejected@<tag>` watermark | they have their own and are keeping it |

The third one is the whole point, and the asymmetry inside it is the lesson worth stating out
loud: **you can adopt the LESSONS without adopting the FILES.** The reason to keep your own
panel is never that you did not want to know how this one works.

Skip and eject are not the same answer and must not be recorded as the same answer. An omitted
capability is absent, and a month later it is indistinguishable from one nobody thought about.
An ejected one is a decision on the record that `sgs:status` keeps reporting against.

```bash
node .sgs/scripts/sgs-init.mjs ../their-app --with popups,tooltips --eject layer-panel,tooltip
```

`--eject` takes capability names OR component ids, unlike `--with`, because an app arriving
with code of its own rarely overlaps this repo along capability lines.

### Read the coupling report

`sgs:init` prints what it could NOT eject, and this is the most useful thing it says:

```
NOT ejected, because something you took needs the file:
  panel          needed by table
```

The table imports `foldPanel` from the panel. So "eject the panel, keep the table" is not a
decision anyone can act on until one of two things happens: eject the table as well, or keep
this copy and make their own panel satisfy what the table imports. Both are fine. Silence is
not, which is why the tool says it rather than quietly keeping the file.

Every one of these goes in `sgs-decisions.md`. This is the coupling that makes adoption hard,
and the next person hits it in the same place.

## 3. The bake-off, for anything genuinely contested

Sometimes they cannot say which is better, and want to see both. That is a reasonable request
and it goes wrong in a predictable way: both versions stay, because nobody scheduled the
decision.

So it is a protocol, and the last line is the one that matters:

1. **Mount both**, under names that say which is which. No abstraction layer, no flag to
   choose between them at runtime: this lives for hours, not for a release.
2. **Name ONE behavioural difference** before looking at either. "Which do you like" has no
   answer; "which one keeps the popup on screen when the feature is behind the table" has one.
3. **Verify it on the ladder** (`app-verify`). If the difference cannot be printed as a
   number, it is a taste question, and taste questions are settled by whoever owns the app in
   about ten seconds rather than by a bake-off.
4. **Delete the loser the same day**, and write the reason in `sgs-decisions.md`.

A bake-off still running next week has already told you its answer: the difference did not
matter.

## 4. The architecture argument, honestly

They will ask whether to keep their tighter layout or adopt the wider one. Do not answer with
"this is how we do it". The honest arguments:

**Keep yours** when the app is one person's, will not be upgraded from upstream, and the split
buys nothing. Fewer files genuinely is fewer files. Ejection exists precisely so this is a
RECORDED choice rather than a silent one.

**Take the split** when any of these matter, and this is what the file boundaries actually buy:

- **The boundary is the upgrade unit.** Merge two components into one file and you merge their
  upgrade decisions forever: you can no longer take the tooltip fix without taking your own
  popup changes back out.
- **The boundary is the skill unit.** Files map to instructions an agent reads. A denser file
  means an agent loading guidance for code that is not the code it is editing, and a skill
  that is not true about the file it names is the one failure `repo-maintain` treats as fatal.
- **Tiers encode direction of dependence.** tokens, framework, components, app-shell.
  Collapsing tiers is how a contract ends up knowing about a specific panel.

The rule to hand them: **collapse within a tier freely, never across one.** Merging two
components in the same tier is taste, and it is theirs. Merging a component into the framework
or into `main.js` trades away the upgrade path, which is fine if deliberate and worth naming
before they find out at the first `sgs:status`.

## 5. Capture the friction, because they are the only ones who can

Somebody adopting this into an existing app is the only person who ever sees where it does not
fit. That experience is a contribution and it evaporates within a day.

- **Keep a running friction log** while building: one line each, what they expected and what
  happened. Triage at the end, not mid-build, or the build never finishes.
- **A skill that was WRONG about the code outranks a skill that was merely annoying.** The
  first is a `repo-maintain` audit failure and should be filed immediately.
- **File the keepers as issues**, phrased against this repo's own demo. `app-contribute`'s
  clean-room rule applies to friction exactly as it applies to fixes: no app names, no client
  names, no "in our project". An issue without a patch is a real contribution and the bar is
  deliberately low.

## 6. Prove it, and record it

`npm run verify` from the app, as `app-start` says, and every decision from steps 1 to 4 in
`sgs-decisions.md` with the version it was made at. The log matters more here than in a fresh
scaffold: an adopted app is a pile of judgment calls, and without the reasons the next session
sees only an app that looks half-converted.

## Checklist

- [ ] Asked WHY the layout is what it is before asking any capability question.
- [ ] A single-file or otherwise irreconcilable app took `--manifest-only`, not a scaffold it
      was going to delete.
- [ ] Every capability got three answers offered, not two, and skip versus eject was recorded
      as the different decision it is.
- [ ] The coupling report was read aloud and each entry resolved, not scrolled past.
- [ ] Any bake-off named one measurable difference up front and ended the same day.
- [ ] The keep-mine-or-take-yours conversation happened on the merits, with the
      within-a-tier-never-across rule stated.
- [ ] A friction log exists, was triaged, and the keepers were filed clean-room.
- [ ] `sgs-decisions.md` carries every judgment with its reason and version.
- [ ] `npm run verify` green, numbers quoted.

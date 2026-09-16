# Contributing

This repo ships two things: a set of agent skills (`.claude/skills/`), and a small runnable
app that exists so those skills point at real files and real measurements instead of
describing conventions in the abstract. This doc covers three things people do with it:
starting an app from it, upgrading one, and contributing a fix back. Terms used here are
defined once, in [VOCABULARY.md](VOCABULARY.md).

## The filesystem convention

An app is a full copy. Nothing in it imports from this repo at runtime, and an app builds,
runs, tests and ships with no clone of this repo anywhere on the machine.

That makes the clone a TOOL CHECKOUT, not a dependency. Exactly two commands want it,
`sgs:status` and `sgs:drift`, because both answer their question by reading release history
(`git show v0.1.0:app/...`) and a copied directory has none. Everything else in an app is
already there.

```
monorepo/                        (or a single app repo; the shape is the same)
  .gitignore                     <- contains: .sgs/
  .sgs/                          <- a CLONE. Optional, disposable, never edited.
  products/my-app/
    sgs.json                     <- the MANIFEST: the app's version pin
    CLAUDE.md                    <- generated: which skills this app has
    .claude/skills/              <- the skills for the capabilities it took
    app/  tests/  scripts/ ...   <- the APP: copied once by sgs:init, tracked normally
```

Rules that make it work:

- **The app records no path to the clone.** `sgs:status` and `sgs:drift` LOCATE one at
  runtime: `$SGS_CLONE`, then a directory named `.sgs` or `sleek-geospatial-skills` in the
  app or any ancestor of it. A recorded path is a fact that goes stale the first time
  somebody moves or re-clones; a search does not. So `sgs.json` stays purely a version pin.
- **The clone is not the pin.** `git -C .sgs pull` is always safe: every watermark stays
  reachable through the clone's history whatever is checked out. One clone at latest serves
  twenty apps on twenty different versions.
- **The clone is never edited.** `git -C .sgs status` is always clean. The one exception is a
  contribution branch (see `app-contribute`), returned to clean after the PR. Gitignore
  cannot hide edits to the clone's own tracked files, and nothing can: a dirty clone is
  loudly visible, which is the point.
- **Where you put it is your business.** One at the monorepo root is the documented default
  because it is one clone and one gitignore line for any number of apps. One per app also
  works. So does none, until you next want to ask a version question.

## Three tiers, one rule each

| tier | where | the rule |
|---|---|---|
| **Tokens** | `app/css/tokens.css` | ~20 names, referenced elsewhere with a CSS fallback. Alias them into your own vocabulary; never rename this file to match yours. |
| **Components** | `app/css/components/*.css` + their paired `.js` | Self-contained — a component never knows what it sits next to. Copied, then watermarked. |
| **Framework** | `app/js/utils/furniture.js`, `app/js/utils/visible-area.js`, `app/js/ui/popup-placement.js` | A CONTRACT, not fixed code: mark any element `data-sgs-furniture` and it participates in camera padding and popup obstacle avoidance, with nothing to register anywhere else. |
| **Demo furniture** | `app/css/furniture.css`, `app/js/main.js`, `app/js/map.js`, `app/js/layers.js`, `app/js/ui/panel.js`, `app/js/ui/table.js`, `app/js/ui/popup.js`, `app/index.html` | Yours the moment you copy it. A second panel, a form instead of a layer list — none of that happens by editing a shared file; it happens by writing new furniture here. |

Nothing is ever imported live from this repo into an app. Every app is a full copy, and stays
runnable if this repo disappears entirely.

## Starting an app

The full flow, a capability interview and the de-wiring of whatever you leave out, is the
`app-start` skill. The mechanical core:

```bash
cd monorepo
git clone https://github.com/s-frantz/sleek-geospatial-skills .sgs
echo '.sgs/' >> .gitignore
node .sgs/scripts/sgs-init.mjs products/my-app                        # everything, or:
node .sgs/scripts/sgs-init.mjs products/my-app --with popups,settings,demo-data
cd products/my-app && npm install && npm start
```

With no flags you get the complete demo, green as copied. `--with` takes capability names
from `scripts/sgs-capabilities.json` (the core set ships regardless); the script then filters
`index.html`'s stylesheet links to what was copied and writes `sgs.json` naming only those
components. JS wiring for omitted capabilities is agent work, and the skill carries the table.

### Skills come with the app, capability-scoped

Each component in `scripts/sgs-components.json` owns the `SKILL.md` that describes it, so
choosing a capability decides which instructions land in the app, and an app pinned to an old
watermark keeps the skill that describes what it actually has rather than silently tracking
the clone's latest. They land at `<app>/.claude/skills/`, alongside a generated `CLAUDE.md`
listing what is there.

Some skills stay behind on purpose: `app-start` and `app-adopt` (both are decisions taken
before the app has any of these files) and `repo-maintain` (the laws for this repo, not for an
app).

Discovery, measured against Claude Code 2.1.185 rather than assumed:

- Start a session IN the app directory and its skills are available immediately, and only its
  skills. A clone sitting at the monorepo root does not leak `app-start` or
  `repo-maintain` in, because discovery runs from the working directory downward, and the clone
  is a sibling, not a child.
- Start at the monorepo ROOT and an app's skills arrive lazily: they load the first time
  Claude reads or edits a file inside that app, then stay for the session. So the first
  question of a root-started session may be answered without them. Working in the app
  directory avoids that entirely, and is the recommended habit.
- If two skills share a name across directories, both stay available and the nested one takes
  a directory-qualified name (`products/app-1:ui-furniture`).

### The decision log

An app scaffolded here gets `sgs-decisions.md` beside its `sgs.json`, and the two are a pair:
the manifest records WHAT the app took and at which version, the log records WHY, in the words
the question was asked in.

It exists because the interview is expensive and agents have no memory of it. Without a log,
the next session opens the app, cannot tell a deliberate omission from an oversight, and asks
again, or worse, quietly re-adds something that was refused on purpose. `app-start` writes it,
`app-upgrade` and `app-contribute` append to it, and all three READ IT BEFORE ASKING ANYTHING.

A question already answered at the CURRENT version is not re-asked. A question answered at an
older version is re-asked only if `sgs:status` says that component actually moved in between,
which is the whole point of stamping each entry with a version.

## Checking your own changes

```bash
npm run sgs:drift path/to/your-app
```

The mirror of `sgs:status`: instead of asking whether upstream moved past your watermark, it
asks whether YOUR COPY did — each file diffed against what its watermark tag shipped, read
straight out of the clone's history. Drift is information, not error (the furniture tier
exists to drift); what it produces is the candidate list for contributing back. The
`app-contribute` skill triages it.

## Checking for updates

```bash
npm run sgs:status path/to/your-app
```

Every component in an app's `sgs.json` carries a **watermark**: the release tag it was last
synced from, not a live version pin. This command diffs THIS repo's own history between that
tag and the latest release, for exactly the files that make up the component — it never
touches your app's copy at all, so customizing a component doesn't confuse it. A component you
haven't touched reports current no matter how many releases have shipped since; a component
that changed in the very next release reports behind. That's deliberate: a whole-repo tag
bump should never read as false staleness on every component nobody actually touched.

```
$ npm run sgs:status apps/flood-intake
  tooltip      v0.2.0 → v0.5.0  (3 releases, 1+ breaking)
  source-pill  v0.3.0 → v0.5.0  (2 releases)
  panel        ejected — upstream changed since v0.2.0, FYI only

Everything else watermarked is current.
```

## Upgrading

Two of these steps are mechanical; two require a judgment call. Doing them in order matters —
each narrows what the next one has to think about.

1. **Run `sgs:status`.** Mechanical. This is your list.
2. **Read [CHANGELOG.md](CHANGELOG.md)** for every release strictly between your watermark and
   the target, for each behind component. Also mechanical: it's reading, not archaeology —
   a release that changed a component's contract says so there, not just in its diff.
3. **Decide what applies.** This is where judgment lives, and it's real judgment: has your
   copy of this component diverged enough that the upstream fix doesn't even apply the same
   way? Does the lesson matter for your app at all? If you're using an AI agent for this step,
   `/grill-me`-style interrogation (ask it to walk each changed component one at a time,
   resolving whether and how to apply each) tends to produce a better outcome than "just
   apply the diff."
4. **Apply, and bump the watermark.** For an unmodified component this is usually "take the
   new file wholesale." For one you've customized, it's applying just the lesson and then
   updating `sgs.json`'s value for that component to the tag you upgraded to.

### Ejecting a component

If a component needs to diverge permanently — you've rewritten `panel.js` into something the
upstream contract can't express — record it rather than silently drifting:

```json
"panel": "ejected@v0.2.0"
```

`sgs:status` keeps reporting on it (informationally: "upstream changed since v0.2.0, FYI
only") without ever suggesting you pull the new version wholesale.

## How a change reaches main

`main` is protected. Every change arrives as a pull request, and there is no exception for
small ones:

- **A pull request is required.** Direct pushes to `main` are refused.
- **One approving review is required**, and a review is dismissed if the branch is pushed to
  again, so an approval always refers to the code that will actually merge.
- **`Version bump required` must pass.** `package.json`'s version has to increase, because a
  merge to `main` tags a release automatically (`.github/workflows/tag-release.yml`) and a tag
  that does not move on every merge is a tag consuming apps cannot trust.
- **The branch must be up to date with `main` before merging**, so the checks that passed are
  the checks for the merged result rather than for a stale base.
- **Force pushes and branch deletion are refused**, and review conversations must be resolved.

The repository owner can bypass these, which is deliberate and not an oversight: on a
single-maintainer repository, requiring an approval that only the author can give would mean
nothing could ever merge. The rules are there so that everybody ELSE goes through review, and
so the owner has to choose to bypass rather than doing it by accident.

### Which number to bump

Patch for a fix or a doc change, minor for a new component, capability or convention. The
version is `0.x` on purpose: `1.0.0` is a promise about stability, and the conventions here are
still moving. Do not bump to `1.0.0` to mark a big change; that number means something
different, and it will be spent once.

Every merge is a release, so keep a pull request to one idea. Two unrelated changes in one
merge means one tag that two different apps each want half of.

## Proposing an addition

A fix to something that already exists follows the section below. Something the repo does not
have yet is a CANDIDATE, and it goes through the [proposal
form](.github/ISSUE_TEMPLATE/proposal.yml) first, before any code.

The form is the `repo-maintain` skill's admission test in order, so filling it in is the review.
Candidates are refused by default and most should be: this is a conventions repo, and the
scope list in CLAUDE.md is a refusal rather than a backlog. The gate that does the real work is
the second one, naming the existing skill that should have covered this and does not. The
strongest proposals point at a sentence already in a skill that promises behaviour with no code
behind it; those usually turn out to be a fix to an existing component rather than a new id,
which is the best outcome available and the smallest PR.

A candidate that passes all five gates then follows the fix path below, reproduction and all.
Passing the test earns a PR, not a merge.

### Naming a skill

**A skill is named for its category and its subject, and nothing else.** No version, no
adjective, no "-guide" or "-conventions" suffix. Procedures are prefixed `app-` when they act
on an app and `repo-` when they act on this repo; conventions are prefixed `ui-` for the app's
own chrome and `map-` for what MapLibre makes you decide. Adding a skill means picking its
prefix first, and if no prefix fits, that is a signal about the skill rather than about the
scheme.

The scheme's first real test was `app-adopt`, which the naming made obvious before the skill
existed: `app-start` interviews a blank page, so the person arriving with an application
already written had no entry point. It has one now, and `sgs:init` grew the two flags it needs
(`--eject` and `--manifest-only`) rather than the skill describing a workflow the tools could
not perform.

## Contributing a fix back

**The unit of contribution is a reproduction against this repo's own demo app — never a diff
of your application's code.** This is not a special case for anyone in particular; it is the
only path, for everyone, which is what makes it something this file can describe without
knowing who's reading it.

1. Reproduce the problem as a failing test in `tests/unit/` or `tests/e2e/`, using only this
   repo's demo app and its example data.
2. Fix it here.
3. Update the relevant `SKILL.md` with why, if the fix changes a convention rather than just a
   bug.
4. Bump `package.json`'s `"version"` — usually the patch number (`1.0.0` → `1.0.1`); reach for
   minor or major only when the change is genuinely bigger than a fix. This is enforced: a PR
   whose version isn't strictly greater than `main`'s fails the required `Version bump
   required` check and cannot merge (`.github/workflows/version-check.yml`).
5. If the fix is contract-breaking for anything downstream, add a `Breaking:` line to the
   CHANGELOG entry for this version, naming the affected component ids.
6. Open a PR carrying all of the above.

Nothing in the PR needs to say — or should say — where the underlying issue was actually
found.

**A merge to main IS a release.** `.github/workflows/tag-release.yml` tags `v<version>`
automatically on every push to `main`, reading the version straight from `package.json`, and
creates that tag's GitHub release page from the version's section in `CHANGELOG.md`. There
is no separate "cut a release" step — bumping the version in your PR is that step, which is
also why the bump is required rather than suggested: a tag that doesn't move on every merge is
a tag `sgs:status` can no longer trust.

PRs are reviewed and merged by maintainers only. This is what makes the demo trustworthy as
the thing every app's `sgs:status` diffs against — an unreviewed merge into it would be wrong
for every app checking against it at once, not just for the one PR.

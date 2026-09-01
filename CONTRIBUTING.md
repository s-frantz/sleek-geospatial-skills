# Contributing

This repo ships two things: a set of agent skills (`.claude/skills/`), and a small runnable
app that exists so those skills point at real files and real measurements instead of
describing conventions in the abstract. This doc covers three things people do with it:
starting an app from it, upgrading one, and contributing a fix back. Terms used here are
defined once, in [VOCABULARY.md](VOCABULARY.md).

## The filesystem convention

The model is npm's, adapted: the **clone plays `node_modules`** and the **manifest plays
`package.json`**.

```
my-app/                          (its own repo, or one folder of a monorepo)
  .gitignore                     <- contains: sleek-geospatial-skills/
  sleek-geospatial-skills/       <- the CLONE: gitignored, never edited, kept at latest
  sgs.json                       <- the MANIFEST: the app's actual version pin
  app/  tests/  package.json ... <- the APP: copied once by sgs:init, tracked normally
```

Rules that make it work:

- **The clone is never edited.** `git -C sleek-geospatial-skills status` is always clean. The
  one exception is a contribution branch (see `contributing-upstream`), returned to clean
  after the PR.
- **The clone is not the pin.** `git -C sleek-geospatial-skills pull` is always safe: every
  watermark in `sgs.json` stays reachable through the clone's history (`git show
  v1.0.0:app/...`), whatever is checked out. Tooling reads the manifest, the way npm reads an
  old `package.json` regardless of npm's own version.
- **One clone per app**, beside it — the same trade as one `node_modules` per project, and it
  is also what puts `.claude/skills/` where an agent working on the app will find it.
- Note that gitignore cannot hide edits to the clone's own tracked files — nothing can. A
  dirty clone is loudly visible in `git status`, which is the point: it means a mistake
  happened, and the fix is moving the edit out to the app (or onto a contribution branch).

## Three tiers, one rule each

| tier | where | the rule |
|---|---|---|
| **Tokens** | `app/css/tokens.css` | ~20 names, referenced elsewhere with a CSS fallback. Alias them into your own vocabulary; never rename this file to match yours. |
| **Components** | `app/css/components/*.css` + their paired `.js` | Self-contained — a component never knows what it sits next to. Copied, then watermarked. |
| **Framework** | `app/js/utils/furniture.js`, `app/js/utils/visible-area.js`, `app/js/ui/popup-placement.js` | A CONTRACT, not fixed code: mark any element `data-sgs-furniture` and it participates in camera padding and popup obstacle avoidance, with nothing to register anywhere else. |
| **Demo furniture** | `app/css/furniture.css`, `app/js/main.js`, `app/js/map.js`, `app/js/layers.js`, `app/js/ui/panel.js`, `app/js/ui/dock.js`, `app/js/ui/popup.js`, `app/index.html` | Yours the moment you copy it. A second panel, a form instead of a layer list — none of that happens by editing a shared file; it happens by writing new furniture here. |

Nothing is ever imported live from this repo into an app. Every app is a full copy, and stays
runnable if this repo disappears entirely.

## Starting an app

The full flow — clone placement, a capability interview, de-wiring what you leave out — is the
`starting-an-app` skill. The mechanical core:

```bash
cd my-app
git clone https://github.com/s-frantz/sleek-geospatial-skills
node sleek-geospatial-skills/scripts/sgs-init.mjs .                        # everything, or:
node sleek-geospatial-skills/scripts/sgs-init.mjs . --with popups,settings,demo-data
npm install && npm start
```

With no flags you get the complete demo, green as copied. `--with` takes capability names
from `scripts/sgs-capabilities.json` (the core set ships regardless); the script then filters
`index.html`'s stylesheet links to what was copied and writes `sgs.json` naming only those
components. JS wiring for omitted capabilities is agent work — the skill carries the table.

The scripts take paths, so other layouts (a single shared clone at a monorepo root, a fork)
work too; per-app clone is simply the documented default, for the reasons in the convention
above.

`.claude/skills/` is not copied. It lives once, in the clone — two copies of the same skill
visible to one agent at once is a bug generator, not a convenience.

## Checking your own changes

```bash
npm run sgs:drift path/to/your-app
```

The mirror of `sgs:status`: instead of asking whether upstream moved past your watermark, it
asks whether YOUR COPY did — each file diffed against what its watermark tag shipped, read
straight out of the clone's history. Drift is information, not error (the furniture tier
exists to drift); what it produces is the candidate list for contributing back. The
`contributing-upstream` skill triages it.

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
automatically on every push to `main`, reading the version straight from `package.json`. There
is no separate "cut a release" step — bumping the version in your PR is that step, which is
also why the bump is required rather than suggested: a tag that doesn't move on every merge is
a tag `sgs:status` can no longer trust.

PRs are reviewed and merged by maintainers only. This is what makes the demo trustworthy as
the thing every app's `sgs:status` diffs against — an unreviewed merge into it would be wrong
for every app checking against it at once, not just for the one PR.

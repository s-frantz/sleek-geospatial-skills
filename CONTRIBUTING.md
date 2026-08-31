# Contributing

This repo ships two things: a set of agent skills (`.claude/skills/`), and a small runnable
app that exists so those skills point at real files and real measurements instead of
describing conventions in the abstract. This doc covers three things people do with it:
starting an app from it, upgrading one, and contributing a fix back.

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

```bash
node scripts/sgs-init.mjs path/to/your-app
cd path/to/your-app
npm install
npm start
```

This works identically whether `path/to/your-app` is a sibling repo (you forked this one) or a
directory inside an existing monorepo of several apps (you cloned this repo once, into
`.sgs/`, and run `sgs:init` from there for each app). Nothing about the tooling assumes one
layout over the other — see the file layout your own repo already uses and put apps wherever
that convention says to.

`.claude/skills/` is not copied. It lives once — in this repo, or in your monorepo's shared
`.sgs/` clone — because two copies of the same skill visible to one agent at once is a bug
generator, not a convenience.

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
4. Open a PR carrying exactly those three things.

Nothing in the PR needs to say — or should say — where the underlying issue was actually
found. If a change is contract-breaking for anything downstream, flag it with a `Breaking:`
line in the CHANGELOG entry for the release that ships it, naming the affected component ids.

PRs are reviewed and merged by maintainers only. This is what makes the demo trustworthy as
the thing every app's `sgs:status` diffs against — an unreviewed merge into it would be wrong
for every app checking against it at once, not just for the one PR.

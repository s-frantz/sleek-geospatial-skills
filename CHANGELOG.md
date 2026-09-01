# Changelog

Every release is a tag (`vX.Y.Z`). `npm run sgs:status`, run from an app's directory, diffs
your `sgs.json` watermarks against this repo's history between the tag you last synced from
and the latest one — it does not read this file for that. What THIS file is for: a `Breaking:`
line names which component ids changed in a way that isn't just "pull the new version," so
`sgs:status` can flag it rather than reporting a silent content diff.

A line here should say what changed and, if relevant, what a consuming app needs to check —
not narrate the commit that produced it.

## [1.1.2] - 2026-09-01

- `sgs:status` and `sgs:drift` now fail loudly when the clone cannot answer, instead of
  reporting confident nonsense. Both read release history from the clone; pointed at a
  directory copied without `.git`, drift previously reported EVERY file as "newer than the
  watermark" and status reported "no releases yet". Both now check up front and exit 1 with
  the fix.
- A watermark naming a tag the clone doesn't have (a stale clone, or a typo) now says so per
  component and suggests `git -C <clone> fetch --tags`, rather than silently treating every
  file as new.

## [1.1.1] - 2026-09-01

Fixes a scaffolding bug that broke a new app's very first commands.

- `sgs:init` now copies `scripts/serve.mjs`, `scripts/icon-ink.mjs` and
  `scripts/icon-targets.json` into the app. Previously the app received a `package.json`
  referencing all three but no `scripts/` directory, so `npm start`, `npm run icons` and
  `npm run verify` failed immediately in every scaffolded app.
- `sgs:init` now REWRITES `package.json` instead of copying it: the app gets its own name
  (from its directory) and version `0.1.0` rather than inheriting this package's identity,
  and `sgs:status`/`sgs:drift` are re-pointed at the clone by a computed relative path, so
  they work from inside the app whatever the layout. `sgs:init` is dropped from an app's
  scripts, since an app does not scaffold.
- The scaffold report now points at `npm run typecheck` as the de-wiring checklist (dangling
  imports for omitted capabilities are exactly what it lists), and warns that a trimmed
  scaffold reports `app-shell` drift on day one because `index.html` was filtered — drift
  working, not a fault.

## [1.1.0] - 2026-09-01

Breaking: furniture-demo

- The `furniture-demo` component id is SPLIT into `app-shell` (index.html, main.js, map.js,
  layers.js, furniture.css), `panel` (panel.js, layer-rows.js), `dock`, `popups`,
  `about-window`, and `demo-layers` (the two GeoJSON files) — the pieces change on their own
  schedules and the setup interview needs to omit them independently. An app whose `sgs.json`
  says `"furniture-demo"` should replace that line with the six new ids at the same tag.
- `npm run sgs:drift` (new): the mirror of `sgs:status` — diffs the APP'S OWN copies against
  what their watermark tag shipped, per file, straight out of the clone's history. Drift is
  the candidate list for contributing upstream.
- `sgs:init` learns capability selection: `--with popups,settings,demo-data` copies the core
  set plus the named capabilities (`scripts/sgs-capabilities.json`), filters `index.html`'s
  stylesheet links to match, writes a manifest naming only what was copied, and refuses to
  scaffold inside the clone. No flags still means the full demo.
- Three new skills: `starting-an-app` (the setup wizard: clone placement, outer gitignore,
  the capability interview, the de-wiring table), `contributing-upstream` (drift triage and
  the clean-room flow), and `maintenance` (the anti-bloat laws and the skill-accuracy audit
  ritual).
- `VOCABULARY.md` (new): every framework term — clone, app, manifest, watermark, drift,
  behind, ejected, tier, component, capability — defined once; everything else links.
- CONTRIBUTING.md documents the filesystem convention: clone-beside-app, gitignored by the
  outer repo, never edited, not the version pin (the manifest is).

## [1.0.0] - 2026-08-31

First stable release. Baseline watermark for every component in `scripts/sgs-components.json`.
Starting here, every merged PR is required to bump this file's version (see CONTRIBUTING.md) —
a release tag is cut automatically on every push to `main`, so a merge and a release are the
same event from here on.

- Three sharing tiers made explicit: `app/css/tokens.css` (the canon, referenced with
  fallbacks), `app/css/components/*.css` + their paired `.js` (self-contained, watermarked
  individually), and the framework contract (`app/js/utils/furniture.js`,
  `app/js/utils/visible-area.js`, `app/js/ui/popup-placement.js`).
- The furniture contract: any element carrying `data-sgs-furniture` participates in camera
  padding and popup obstacle avoidance. No id is hardcoded anywhere in the framework tier.
- `npm run sgs:init <dir>` scaffolds a new, fully self-contained app. `npm run sgs:status
  [dir]` reports which watermarked components have genuinely changed upstream since the app's
  tag (not merely how many releases have passed).
- Every skill in `.claude/skills/` audited against the code it describes. Two had drifted
  materially: `map-control-icons` still taught an invert-filter fix for MapLibre's baked
  glyphs, superseded by the adopted-glyph approach; `stow` still used FOLD/STOW/MARK/BERTH
  vocabulary the code had already moved on from (FOLD/CLOSE). `popup-placement` described a
  furniture-avoidance algorithm for CLEAN mode's top edge that was never actually implemented
  — corrected to say so plainly rather than describe fictional code.

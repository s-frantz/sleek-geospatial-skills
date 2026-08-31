# Changelog

Every release is a tag (`vX.Y.Z`). `npm run sgs:status`, run from an app's directory, diffs
your `sgs.json` watermarks against this repo's history between the tag you last synced from
and the latest one — it does not read this file for that. What THIS file is for: a `Breaking:`
line names which component ids changed in a way that isn't just "pull the new version," so
`sgs:status` can flag it rather than reporting a silent content diff.

A line here should say what changed and, if relevant, what a consuming app needs to check —
not narrate the commit that produced it.

## [0.1.0] - 2026-08-31

First tagged release. Baseline watermark for every component in `scripts/sgs-components.json`.

- Three sharing tiers made explicit: `app/css/tokens.css` (the canon, referenced with
  fallbacks), `app/css/components/*.css` + their paired `.js` (self-contained, watermarked
  individually), and the framework contract (`app/js/utils/furniture.js`,
  `app/js/utils/visible-area.js`, `app/js/ui/popup-placement.js`).
- The furniture contract: any element carrying `data-sgs-furniture` participates in camera
  padding and popup obstacle avoidance. No id is hardcoded anywhere in the framework tier.
- `npm run sgs:init <dir>` scaffolds a new, fully self-contained app. `npm run sgs:status
  [dir]` reports which watermarked components have genuinely changed upstream since the app's
  tag (not merely how many releases have passed).

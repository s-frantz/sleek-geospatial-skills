# Vocabulary

The framework's terms, defined once. Docs and skills link here instead of redefining; if a
word here stops matching the code, fix one or the other in the same PR.

## The filesystem

**CLONE** — a git clone of this repo, sitting beside an app it serves, gitignored by the
outer repo and never edited. It plays the role `node_modules/` plays for npm: the skills live
in it, the scripts run from it, and its full git history is the reference every watermark and
drift check reads. It is NOT the version pin — the manifest is — so keeping it at latest
(`git pull`) is always safe.

**APP** — a directory of files copied out of the clone by `sgs:init`, tracked normally by
whatever repo it lives in, owned outright from the moment of copying. Nothing in an app
imports from the clone at runtime; deleting the clone breaks tooling and skills, never the
app.

**SCAFFOLD** — the one-time copy that creates an app (`sgs:init`). There is no ongoing sync:
after scaffolding, changes travel only by deliberate upgrade (downstream) or contribution
(upstream).

**MANIFEST** — the app's `sgs.json`: the tag it was instantiated from, and one watermark per
copied component. The manifest is the app's version pin, the way `package.json` is an npm
project's.

## Versioning

**WATERMARK** — the release tag a component was last synced from, recorded in the manifest.
Not a live dependency: a watermark says "checked against this," never "loads from this."

**DRIFT** — the app's copy of a component differing from what its watermark shipped
(`sgs:drift`). Drift is information, not error: the furniture tier exists to drift. Drift is
the candidate list for contribution.

**BEHIND** — upstream's copy of a component differing from what the app's watermark shipped
(`sgs:status`). Content-diffed, so an untouched component is never "behind" merely because
the repo's tag moved.

**EJECTED** — a component the app has permanently rewritten, recorded as
`"ejected@<tag>"` in the manifest. Status and drift keep reporting on it informationally;
neither ever suggests pulling upstream's version wholesale again.

## The tiers

Every copied file belongs to exactly one **COMPONENT** (an id in
`scripts/sgs-components.json` — the registry), and every component to one tier:

| tier | rule |
|---|---|
| **TOKENS** | ~20 CSS custom property names, referenced everywhere with a fallback. Aliased into an app's own vocabulary, never renamed. |
| **COMPONENTS** | self-contained pieces (swatch, tooltip, overlay window…). A component never knows what it sits next to. Upgraded file-wholesale when unmodified. |
| **FRAMEWORK** | the contracts BETWEEN pieces: `data-sgs-furniture`, camera padding, popup obstacle avoidance. The contract is stable; the implementation is copyable and rewritable. |
| **APP-SHELL / FURNITURE** | this app's specific chrome and wiring (`main.js`, panel, dock, popups, `furniture.css`). Expected to be rewritten; drift here is the app being an app. |

**CAPABILITY** — a plain-language feature ("a table across the bottom") that resolves to a
set of components (`scripts/sgs-capabilities.json`). The `starting-an-app` interview asks in
capabilities; the registry answers in components.

## Contribution

**CLEAN-ROOM RESTATEMENT** — the only unit of contribution: a lesson reproduced as a failing
test against THIS repo's demo, fixed here, with no provenance of where it was really found.
See CONTRIBUTING.md.

## UI vocabulary

Owned by the skills, not restated here: **FURNITURE / MARK / BERTH / FOLD / CLOSE** (`stow`,
`chrome-aware-camera`), **CLEAN / ADJACENT** popup placement (`popup-placement`), postures
**auto / manual-w / manual-h / float** (`panel-anatomy`), **INK / WANT / NUDGE**
(`icon-centering`).

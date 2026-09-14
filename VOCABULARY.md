# Vocabulary

The framework's terms, defined once. Docs and skills link here instead of redefining; if a
word here stops matching the code, fix one or the other in the same PR.

## The filesystem

**CLONE** - a git clone of this repo. It is a TOOL CHECKOUT, not a dependency: an app
builds, runs, tests and ships without one. Exactly two commands want it, `sgs:status` and
`sgs:drift`, because both answer their question out of release history (`git show
v0.1.0:app/...`) and a copied directory has none. Never edited; not the version pin (the
manifest is), so `git pull` on it is always safe and one clone at latest serves any number of
apps on any number of older versions. Apps record no path to it: the tools LOCATE one at
runtime (`$SGS_CLONE`, then `.sgs` or `sleek-geospatial-skills` in the app or any ancestor).

**APP** — a directory of files copied out of the clone by `sgs:init`, tracked normally by
whatever repo it lives in, owned outright from the moment of copying. It carries its own
skills, its own tooling and its own manifest. Nothing in it imports from the clone at
runtime; deleting the clone costs `sgs:status` and `sgs:drift` and nothing else.

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
| **APP-SHELL / FURNITURE** | this app's specific chrome and wiring (`main.js`, panel, table, popups, `furniture.css`). Expected to be rewritten; drift here is the app being an app. |

**CAPABILITY** — a plain-language feature ("a table across the bottom") that resolves to a
set of components (`scripts/sgs-capabilities.json`). The `app-start` interview asks in
capabilities; the registry answers in components.

A component owns the **SKILL** that describes it, listed among its files, so a capability
also decides which instructions reach the app and an old watermark keeps the skill that
matches what it actually has. Two skills belong to no component and stay in the clone:
`app-start` and `repo-maintain`.

## Contribution and admission

**LESSON** — the transferable content of a change: the convention it establishes, plus the
bug that proves the convention was needed. A lesson is not code. The same lesson can be
carried by two files that share no lines, which is why a lesson can move between codebases
that may never reference each other, and why `sgs:drift` produces candidates rather than
patches. Both directions of travel deal in lessons: `app-upgrade` hand-ports one into a
customized component, `app-contribute` sends one back.

**CLEAN-ROOM RESTATEMENT** — the only unit of contribution: a lesson reproduced as a failing
test against THIS repo's demo, fixed here, with no provenance of where it was really found.
See CONTRIBUTING.md.

**CANDIDATE** — a lesson proposed for admission, before it has passed the admission test. A
candidate names a convention, not a file to copy. It arrives as an issue (the proposal
template) or out of `sgs:drift`, and it is refused by default: the `repo-maintain` skill's
admission test is what turns one into a component, a capability or a skill. Most candidates
should lose, which is the point.

## UI vocabulary

Owned by the skills, not restated here: **FURNITURE / MARK / DOCK / SNAP / FOLD /
CLOSE** (`ui-stow`, `map-camera`), **CLEAN / ADJACENT** popup placement
(`map-popups`), **TIGHT / MANUAL / FULL** sizing and the postures **auto / manual-w /
manual-h / undocked** (`ui-furniture`), **INK / WANT / NUDGE** (`ui-icons`).

One word per thing, the same in the code as on screen: the section across the bottom is
the **TABLE**, a section is **DOCKED** or **UNDOCKED**, and a closed one leaves a **MARK**.
`tests/unit/vocabulary.spec.js` lists the words these replaced and keeps them from coming
back one comment at a time.

### BORROW

A change one piece of furniture makes to ANOTHER, which it may only undo while it is still the
one holding it — and may only make if the other piece has it to give. `makeBorrow` in
`app/js/utils/furniture.js`.

Defined here rather than in a skill because it is not about furniture: it is about any state
one control changes on another control's behalf. The name exists because the shape was written
by hand three times before anyone noticed it was the same shape, and each hand-written copy got
the same half wrong. Taking is easy; the two ways of getting GIVING BACK wrong are giving back
something you never took, and taking something that was already gone.

#!/usr/bin/env node
/**
 * sgs-init.mjs — scaffold a new app from this repo.
 *
 * Copies the CORE component set plus whichever CAPABILITIES you ask for into a target
 * directory, along with the vendored MapLibre build, tooling config, and the test suites.
 * NOTHING is imported live afterward: the copy is the whole relationship, and the app stays
 * runnable if this clone disappears. See VOCABULARY.md for the terms and CONTRIBUTING.md for
 * the filesystem convention (clone beside the app, gitignored by the outer repo, never
 * edited).
 *
 * The interview that decides which capabilities an app wants — and the de-wiring of main.js
 * for the ones it doesn't — is the `app-start` skill's job. This script stays
 * mechanical: it copies files, filters index.html's stylesheet links to the chosen set, and
 * writes the manifest. It cannot edit JavaScript wiring, on purpose.
 *
 * Usage:
 *   node scripts/sgs-init.mjs <target-dir>                      everything (the full demo)
 *   node scripts/sgs-init.mjs <target-dir> --with popups,settings,demo-data
 *   node scripts/sgs-init.mjs <target-dir> --components popups,tooltip   (explicit ids; core still ships)
 *
 * SKILLS COME TOO, and they come capability-scoped: each component in the registry owns the
 * SKILL.md that describes it, so an app that took no popups gets no popup-placement skill,
 * and an app pinned to an old watermark keeps the skill that describes what it actually has.
 * They land at <app>/.claude/skills/, where an agent working in the app finds them without
 * knowing the clone exists. Two skills stay behind on purpose: `app-start` (the app has
 * already started) and `repo-maintain` (the laws for this repo, not for an app).
 *
 * Earlier versions kept skills only in the clone, reasoning that two copies visible to one
 * agent is a bug generator. That is handled: Claude Code scopes skills by directory and
 * resolves a name collision most-specific-first, so the app's copy wins while you work in the
 * app. The cost of NOT copying was worse: an app's instructions would silently track the
 * clone's latest instead of the app's own pin.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);

// ── Arguments ────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const targetArg = args.find((a) => !a.startsWith('--'));
/** @param {string} flag @returns {string[]|null} */
const listArg = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    const v = args[i + 1];
    if (!v || v.startsWith('--')) {
        console.error(`${flag} needs a comma-separated list after it.`);
        process.exit(1);
    }
    return v.split(',').map((s) => s.trim()).filter(Boolean);
};
const withCaps = listArg('--with');
const explicitComponents = listArg('--components');

if (!targetArg) {
    console.error('Usage: node scripts/sgs-init.mjs <target-dir> [--with cap1,cap2 | --components id1,id2]');
    process.exit(1);
}
const target = path.resolve(targetArg);

// Refuse to scaffold INSIDE the clone: app files in here would sit untracked in a repository
// that deliberately ignores nothing of its own, and one `git clean -xdf` would erase them.
// The convention is clone-beside-app, never app-inside-clone. See CONTRIBUTING.md.
if ((target + path.sep).startsWith(REPO_ROOT + path.sep)) {
    console.error(`Refusing to scaffold inside the clone itself (${REPO_ROOT}).`);
    console.error('Put the app beside the clone, not in it: node scripts/sgs-init.mjs ../my-app ...');
    process.exit(1);
}
if (existsSync(path.join(target, 'sgs.json'))) {
    console.error(`${target} already has an sgs.json — refusing to overwrite an existing app.`);
    process.exit(1);
}

// ── Resolve the component set ────────────────────────────────────────────────────────────
const catalog = JSON.parse(readFileSync(path.join(SCRIPT_DIR, 'sgs-components.json'), 'utf8'));
delete catalog._comment;
const capMap = JSON.parse(readFileSync(path.join(SCRIPT_DIR, 'sgs-capabilities.json'), 'utf8'));

const chosen = new Set(capMap.core);
/** @type {string[]} capability names actually taken, for the report */
const capsTaken = [];

if (explicitComponents) {
    for (const id of explicitComponents) {
        if (!catalog[id]) {
            console.error(`Unknown component id "${id}". Known: ${Object.keys(catalog).join(', ')}`);
            process.exit(1);
        }
        chosen.add(id);
    }
} else if (withCaps) {
    for (const cap of withCaps) {
        const entry = capMap.capabilities[cap];
        if (!entry) {
            console.error(`Unknown capability "${cap}". Known: ${Object.keys(capMap.capabilities).join(', ')}`);
            process.exit(1);
        }
        capsTaken.push(cap);
        for (const id of entry.components) chosen.add(id);
    }
} else {
    // No selection: the full demo, capability names included so the report reads honestly.
    for (const [cap, entry] of Object.entries(capMap.capabilities)) {
        capsTaken.push(cap);
        for (const id of entry.components) chosen.add(id);
    }
}

const omittedCaps = Object.keys(capMap.capabilities).filter((c) => !capsTaken.includes(c));
const omittedComponents = Object.keys(catalog).filter((id) => !chosen.has(id));

// ── Copy ─────────────────────────────────────────────────────────────────────────────────
/** @param {string[]} gitArgs @returns {string|null} */
function gitOrNull(gitArgs) {
    try {
        return execFileSync('git', ['-C', REPO_ROOT, ...gitArgs], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}
const latestTag = gitOrNull(['describe', '--tags', '--abbrev=0']);
const tag = latestTag ?? 'unreleased';
if (!latestTag) {
    console.warn('No release tags found — watermarking every component as "unreleased".');
}

mkdirSync(target, { recursive: true });

for (const id of chosen) {
    for (const rel of catalog[id]) {
        const dst = path.join(target, rel);
        mkdirSync(path.dirname(dst), { recursive: true });
        cpSync(path.join(REPO_ROOT, rel), dst);
    }
}

// Tooling and vendor: everything an app needs to RUN and VERIFY on its own, none of it
// watermarked. Tests are copied as a starting point; specs for omitted capabilities will fail
// and should be deleted or rewritten — the app-start skill walks that.
//
// The tooling every script in package.json calls by path comes with the app: without it the
// app ships a package.json that lies about what it can do. Each of these resolves its own
// paths from `import.meta.url`, so they work unchanged from the app's own scripts/ directory.
//
// sgs-status and sgs-drift come too, which they did not before. They need a clone to read
// release history from, but they now LOCATE one at runtime (sgs-clone.mjs) rather than being
// run from a path the app hardcoded. That is the difference between the clone being a
// dependency and being a tool checkout: the app carries the tools, and the clone is only
// where they read history, findable wherever it sits and re-clonable whenever it is gone.
//
// sgs-init is NOT copied. An app does not scaffold apps.
const EXTRA = [
    'app/vendor', 'tsconfig.json', 'playwright.config.js', 'vitest.config.js', 'types', 'tests',
    'scripts/serve.mjs', 'scripts/icon-ink.mjs', 'scripts/icon-targets.json',
    'scripts/sgs-clone.mjs', 'scripts/sgs-status.mjs', 'scripts/sgs-drift.mjs',
];
for (const rel of EXTRA) {
    const src = path.join(REPO_ROOT, rel);
    if (!existsSync(src)) continue;
    const dst = path.join(target, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true });
}

// package.json is REWRITTEN rather than copied: an app is not a copy of this package. It gets
// its own name and a 0.1.0 version (this repo's version lives in the manifest as the
// watermark, and letting an app inherit "1.1.0" would misreport it as a release of the
// framework).
//
// The sgs:* scripts point at the app's OWN copies, with no path to the clone recorded
// anywhere in the app. A recorded path is a fact that goes stale the first time somebody
// moves or re-clones it; the search in sgs-clone.mjs cannot. So sgs.json stays what it claims
// to be: a version pin, and nothing else.
const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
pkg.name = path.basename(target).toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'my-app';
pkg.version = '0.1.0';
pkg.description = `A MapLibre application built from sleek-geospatial-skills @ ${tag}.`;
pkg.private = true;
delete pkg.keywords;
delete pkg.scripts['sgs:init'];
pkg.scripts['sgs:status'] = 'node scripts/sgs-status.mjs .';
pkg.scripts['sgs:drift'] = 'node scripts/sgs-drift.mjs .';
writeFileSync(path.join(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

// index.html links every component stylesheet; drop the lines for CSS files that were not
// copied, so a trimmed app boots with no 404s. JS wiring in main.js cannot be filtered this
// mechanically and is left intact — see the printed report.
const omittedCss = new Set();
for (const id of omittedComponents) {
    for (const rel of catalog[id]) if (rel.endsWith('.css')) omittedCss.add(path.posix.basename(rel));
}
if (omittedCss.size > 0) {
    const htmlPath = path.join(target, 'app/index.html');
    if (existsSync(htmlPath)) {
        const kept = readFileSync(htmlPath, 'utf8').split('\n').filter((line) => {
            const m = line.match(/href="css\/components\/([^"]+)"/);
            return !(m && omittedCss.has(m[1]));
        });
        writeFileSync(htmlPath, kept.join('\n'));
    }
}

// ── Manifest ─────────────────────────────────────────────────────────────────────────────
// Only the components actually copied. sgs:status and sgs:drift iterate this list, so an
// omitted component is invisible to both rather than reported as missing.
/** @type {Record<string, string>} */
const components = {};
for (const id of Object.keys(catalog)) if (chosen.has(id)) components[id] = tag;
writeFileSync(path.join(target, 'sgs.json'), JSON.stringify({ instantiated: tag, components }, null, 2) + '\n');

// ── The app's CLAUDE.md ──────────────────────────────────────────────────────────────────
// An agent opening the app needs to know which skills are here and which are not, and the
// answer is different per app because skills are capability-scoped. Generating this beats
// copying the clone's CLAUDE.md, which opens "This is a conventions repo" and would list
// skills the app does not have. Written only if absent: on a second run it is yours.
//
// The left column is what a person is about to touch. Keep it phrased that way; a table of
// skill names indexed by skill name helps nobody.
const SKILL_TRIGGERS = {
    'ui-boot': '`app/index.html`, `app/vendor/`, adding a library',
    'ui-theme': 'colours, `css/tokens.css`, the theme toggle',
    'map-controls': 'map controls, `control-stack.js`',
    'ui-icons': '`icons.js`, any glyph art',
    'ui-furniture': '`panel.js`, `css/furniture.css`',
    'ui-stow': 'any collapse, hide or minimise affordance',
    'ui-window': 'modals, dialogs, the Escape key',
    'map-popups': 'popups, tooltips, anything anchored to a point',
    'map-camera': '`fitBounds`, `easeTo`, zoom-to, `data-sgs-furniture`',
    'app-verify': 'tests, or claiming something works',
    'app-upgrade': '`sgs.json`, `sgs:status`, syncing against upstream',
    'app-contribute': '`sgs:drift`, sending a fix back, ejecting a component',
};
// The decision log. `sgs.json` records WHAT this app took and at which version; this records
// WHY, in the words the question was asked in.
//
// It exists because the interview is expensive and the next agent has no memory of it. Without
// a log, a later session cannot tell a deliberate omission from an oversight: it asks the same
// questions again, or quietly re-adds something that was refused on purpose. Seeded here with
// the one decision `sgs:init` already knows (which capabilities were taken), so the file is
// never an empty template nobody fills in.
//
// Written only if absent, like CLAUDE.md: on a second run it is yours.
const decisionsPath = path.join(target, 'sgs-decisions.md');
if (!existsSync(decisionsPath)) {
    const taken = [...capsTaken].sort();
    const skipped = [...omittedCaps].sort();
    writeFileSync(decisionsPath, `# Decisions

Why this app is shaped the way it is. Paired with \`sgs.json\`: that file records WHAT and at
which version, this one records WHY.

**Read this before asking anything.** \`app-start\`, \`app-upgrade\` and \`app-contribute\` all
consult it first. A question already answered AT THE CURRENT VERSION is not asked again; a
question answered at an older version is re-asked only if \`npm run sgs:status\` says that
component actually moved in between. That is what the version stamp on each entry is for.

Append, never rewrite. A decision that was reversed gets a new entry saying so, because the
reversal is itself the useful part.

## Format

    ### <short title>
    - **asked:** the question, in the words it was put
    - **answered:** what was decided
    - **because:** the reason, in one sentence
    - **at:** ${tag}

---

### Capabilities taken at scaffold
- **asked:** which capabilities should this app start with?
- **answered:** took ${taken.length ? taken.join(', ') : 'core only'}${skipped.length ? `; skipped ${skipped.join(', ')}` : ''}
- **because:** chosen in the \`app-start\` interview. If a skipped capability was refused for a
  reason rather than merely not needed yet, replace this line with that reason.
- **at:** ${tag}
`);
}

const claudePath = path.join(target, 'CLAUDE.md');
if (!existsSync(claudePath)) {
    const copiedSkills = [...chosen]
        .flatMap((id) => catalog[id])
        .filter((f) => f.startsWith('.claude/skills/'))
        .map((f) => f.split('/')[2]);
    const rows = Object.entries(SKILL_TRIGGERS)
        .filter(([name]) => copiedSkills.includes(name))
        .map(([name, touching]) => `| ${touching} | \`${name}\` |`)
        .join('\n');
    writeFileSync(claudePath, `# Working in ${pkg.name}

A MapLibre application scaffolded from sleek-geospatial-skills @ ${tag}. Every file here was
COPIED and is yours: nothing is imported from that repo at runtime, and this app builds, runs
and ships with no clone of it anywhere on the machine.

## Read the skill first

\`.claude/skills/\` holds the ${copiedSkills.length} skills covering what this app actually
has, at the version \`sgs.json\` pins it to. Capabilities taken:
${capsTaken.length ? capsTaken.map((c) => `\`${c}\``).join(', ') : 'an explicit component list'}.

| touching | read |
|---|---|
${rows}

Framework terms (watermark, drift, ejected, tier, capability) are defined once, in
[VOCABULARY.md](VOCABULARY.md).

## Read the decision log before asking

[sgs-decisions.md](sgs-decisions.md) records why this app is shaped the way it is: what was
asked, what was answered, and at which version. Read it before interviewing anyone about
capabilities or geometry, and append to it whenever a judgment is made. A capability that is
absent because it was refused looks exactly like one absent by oversight, and only that file
tells the two apart.

## Versioning

\`sgs.json\` is the version pin: one watermark per component, the release it was last synced
from. \`npm run sgs:status\` asks whether upstream has moved past it; \`npm run sgs:drift\`
asks whether this app has moved away from it. Both read release history out of a CLONE of
sleek-geospatial-skills, which they LOCATE (\`$SGS_CLONE\`, then \`.sgs/\` or
\`sleek-geospatial-skills/\` here or in any parent directory). No path to it is recorded
anywhere in this app, and nothing else needs it.

## House rules inherited from the framework

**Measure, do not eyeball.** No number in \`SIZE_FACTOR\` or \`NUDGE\` that did not come out of
\`npm run icons\`. A guess reads exactly like a result.

**Say what you ran.** "13 passed" is a result. "Looks right" is not.

**Comments explain WHY.** Most doc comments in the copied files record a decision and the
alternative it beat, and several record a bug that has actually happened. Do not compress
them away.

**No em-dashes** in code, comments, docs or UI copy. Commas, colons and full stops.

**One owner per shared thing.** Escape has one owner (\`dismiss-stack.js\`). Panel geometry has
one applier. When two features want the same resource, the answer is a stack or a registry
owned once, not a cleverer guard in each of them.

## Before you say it works

\`\`\`bash
npm run verify
\`\`\`

Types, unit, geometry, ink. All four, and quote what came back.
`);
}

// ── Report ───────────────────────────────────────────────────────────────────────────────
const rel = path.relative(process.cwd(), target) || '.';
console.log(`Scaffolded ${rel} from sleek-geospatial-skills @ ${tag}.`);
console.log(`  capabilities: ${capsTaken.length ? capsTaken.join(', ') : '(explicit component list)'}`);
if (omittedCaps.length) console.log(`  omitted:      ${omittedCaps.join(', ')}`);
console.log('');
console.log('What is here:');
console.log('  app/ tests/ scripts/  the app, yours outright, tracked by whatever repo it lives in');
console.log('  .claude/skills/       the skills for the capabilities above, at this pin');
console.log('  CLAUDE.md             generated: which skills are here and what they cover');
console.log('  sgs.json              the version pin, one watermark per component');
console.log('  sgs-decisions.md      why this app is shaped this way; read it before asking');
console.log('');
console.log('What is NOT here, and does not need to be: any path to the clone. The app runs,');
console.log('builds, tests and ships with no clone on the machine. `npm run sgs:status` and');
console.log('`npm run sgs:drift` are the only things that want one, and they find it themselves');
console.log('($SGS_CLONE, or .sgs/ or sleek-geospatial-skills/ here or in any parent). If you');
console.log('keep a clone, gitignore it in the OUTER repo and never edit it:');
console.log('        .sgs/');
if (omittedCaps.length) {
    console.log('');
    console.log('Omitted capabilities still have WIRING in app/js/main.js (imports, control');
    console.log('registrations, key handlers) and copied test specs that exercise them.');
    console.log('`npm run typecheck` lists every dangling import — that IS your de-wiring');
    console.log('checklist. The app-start skill has the table; then npm run verify.');
    console.log('');
    console.log('Expect `npm run sgs:drift` to report app-shell drifted on day one: index.html');
    console.log('was trimmed to the capabilities you chose. That is drift working, not a fault.');
}
console.log('');
console.log('Next:');
console.log(`  cd ${rel} && npm install && npm start   # http://localhost:4173`);

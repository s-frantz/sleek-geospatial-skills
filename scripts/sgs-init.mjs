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

/**
 * Capabilities the app ALREADY HAS its own version of.
 *
 * Not the same as leaving one out, and the difference is the whole point of the flag. An
 * omitted capability is absent: no files, no watermark, invisible to sgs:status and sgs:drift,
 * and indistinguishable a month later from one nobody thought about. An EJECTED one is a
 * decision on the record: no code copied, but the component watermarked `ejected@<tag>` in
 * sgs.json so status reports upstream movement as FYI, and its SKILL.md copied, because the
 * reason to keep your own panel is never that you did not want to know how this one works.
 *
 * That asymmetry is the thing worth taking: you can adopt the LESSONS without adopting the
 * FILES. Before this flag the only route to an ejected component was to scaffold it, delete
 * the code, and hand-edit the manifest, which is three steps to express one decision and
 * quietly loses the skill along the way.
 *
 * Takes CAPABILITY names or COMPONENT ids, unlike --with. An app arriving with code of its own
 * rarely overlaps this repo along capability lines: it has a tooltip but no table, or its own
 * popup and nothing else. Making the adopter round their real situation up to the nearest
 * capability would be asking them to eject files they wanted.
 */
const ejectCaps = listArg('--eject');

/**
 * Adopt the conventions without taking any of the code.
 *
 * For an application whose layout is too far from this one to scaffold into: a single file, a
 * bundler, a framework, anything where copying `app/js/ui/panel.js` would put a file nobody is
 * going to import next to code that already does that job. `--eject` answers "I have my own
 * panel"; this answers "I have my own everything, including the boot path and the contracts",
 * which `--eject` refuses because core is what the rest is written against.
 *
 * What lands: the skills, the vocabulary, the two version tools, and a manifest with every
 * component marked `ejected@<tag>`. What does not: any application code, any test, any vendor
 * file, and the package.json, because the target already has one.
 *
 * The manifest is the point. Without it the app has read some documentation; with it,
 * `sgs:status` can still say "the lesson in map-popups moved since you read it", which is the
 * only thing an app that took no code could ever want from upstream.
 *
 * NOTHING existing is overwritten in this mode, because unlike a fresh scaffold the target is
 * somebody's working repository.
 */
const manifestOnly = args.includes('--manifest-only');

if (!targetArg) {
    console.error('Usage: node scripts/sgs-init.mjs <target-dir> [--with cap1,cap2 | --components id1,id2] [--eject cap-or-component,...] [--manifest-only]');
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
    // No selection: the full demo, minus anything named to --eject, and capability names
    // recorded so the report reads honestly. Without the subtraction, `--eject layer-panel`
    // on its own would take the panel by default and then refuse itself for the conflict,
    // which is the script arguing with a flag the caller passed on purpose.
    const ejectedTokens = new Set(ejectCaps ?? []);
    for (const [cap, entry] of Object.entries(capMap.capabilities)) {
        if (ejectedTokens.has(cap)) continue;
        capsTaken.push(cap);
        for (const id of entry.components) chosen.add(id);
    }
}

// Ejected components: resolved from capability names OR component ids, then subtracted from
// `chosen` so nothing copies their code.
/** @type {Set<string>} */
const ejected = new Set();
/** @type {string[]} the capability-shaped tokens, so the report can name them as given */
const ejectedCapNames = [];
/** @type {Array<{id: string, neededBy: string[]}>} ejections a taken capability overruled */
const overruled = [];
if (ejectCaps) {
    for (const token of ejectCaps) {
        const entry = capMap.capabilities[token];
        if (entry) {
            if (capsTaken.includes(token) && withCaps) {
                console.error(`"${token}" is in both --with and --eject. Taking it and owning it are different answers; pick one.`);
                process.exit(1);
            }
            ejectedCapNames.push(token);
            for (const id of entry.components) ejected.add(id);
        } else if (catalog[token]) {
            ejected.add(token);
        } else {
            console.error(`Unknown capability or component "${token}".`);
            console.error(`Capabilities: ${Object.keys(capMap.capabilities).join(', ')}`);
            console.error(`Components:   ${Object.keys(catalog).join(', ')}`);
            process.exit(1);
        }
    }

    // Core is not ejectable. It is the boot path and the contracts every other component is
    // written against, so an app that ejects it is not an app built from this repo, it is an
    // app that read the skills. That is a legitimate outcome and the app-adopt skill covers
    // it, but it ends with a manifest and no scaffold, which is not something this script
    // should pretend to have done.
    for (const id of capMap.core) {
        if (ejected.has(id)) {
            console.error(`Refusing to eject "${id}": it is core, and everything else is written against it.`);
            console.error('If you are keeping your own boot path and contracts, do not scaffold at all.');
            console.error('The app-adopt skill covers that case: a manifest, the skills, and no code.');
            process.exit(1);
        }
    }

    // A component reachable from a TAKEN capability outranks the ejection, because the taken
    // capability needs the file to work. Ejecting the layer panel while keeping popups must
    // not remove the swatch: popups draws one too, and half a capability is not an answer
    // anybody gave. Only components nothing taken depends on are actually ejected.
    //
    // But it is not enough to quietly keep the file. "I asked to own the panel and the panel
    // is still here" is the adopter learning nothing, and the first version of this flag did
    // exactly that: `--eject layer-panel` on a default scaffold reported no ejections at all,
    // because the table imports foldPanel from the panel. That coupling is the single most
    // useful thing the flag can tell somebody adopting this into an app they already have, so
    // it is collected and printed rather than resolved in silence.
    for (const id of [...ejected]) {
        if (!chosen.has(id)) continue;
        const neededBy = capsTaken.filter((c) => capMap.capabilities[c].components.includes(id));
        overruled.push({ id, neededBy });
        ejected.delete(id);
    }
    for (const id of ejected) chosen.delete(id);
}

const omittedCaps = Object.keys(capMap.capabilities)
    .filter((c) => !capsTaken.includes(c) && !ejectedCapNames.includes(c));
const omittedComponents = Object.keys(catalog).filter((id) => !chosen.has(id) && !ejected.has(id));

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

/**
 * Copy, refusing to clobber. In manifest-only mode the target is an existing repository, so a
 * file already there is the app's own and always wins; a fresh scaffold has nothing to
 * protect and copies unconditionally.
 * @param {string} rel @returns {boolean} did it write?
 */
function place(rel) {
    const dst = path.join(target, rel);
    if (manifestOnly && existsSync(dst)) {
        skipped.push(rel);
        return false;
    }
    mkdirSync(path.dirname(dst), { recursive: true });
    cpSync(path.join(REPO_ROOT, rel), dst, { recursive: true });
    return true;
}
/** @type {string[]} */
const skipped = [];

if (manifestOnly) {
    // Every component is ejected, so every component-owned skill travels, plus VOCABULARY.md
    // and the version tools. The app keeps its own everything else.
    for (const id of Object.keys(catalog)) {
        for (const rel of catalog[id]) {
            if (rel.startsWith('.claude/skills/') || rel === 'VOCABULARY.md') place(rel);
        }
    }
    for (const rel of ['scripts/sgs-clone.mjs', 'scripts/sgs-status.mjs', 'scripts/sgs-drift.mjs']) place(rel);
}

for (const id of manifestOnly ? [] : chosen) {
    for (const rel of catalog[id]) {
        const dst = path.join(target, rel);
        mkdirSync(path.dirname(dst), { recursive: true });
        cpSync(path.join(REPO_ROOT, rel), dst);
    }
}

// Ejected: the skill, not the code. See --eject above for why that asymmetry is the point.
for (const id of manifestOnly ? [] : ejected) {
    for (const rel of catalog[id]) {
        if (!rel.startsWith('.claude/skills/')) continue;
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
for (const rel of manifestOnly ? [] : EXTRA) {
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
if (!manifestOnly) writeFileSync(path.join(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

// index.html links every component stylesheet; drop the lines for CSS files that were not
// copied, so a trimmed app boots with no 404s. JS wiring in main.js cannot be filtered this
// mechanically and is left intact — see the printed report.
const omittedCss = new Set();
for (const id of omittedComponents) {
    for (const rel of catalog[id]) if (rel.endsWith('.css')) omittedCss.add(path.posix.basename(rel));
}
if (omittedCss.size > 0 && !manifestOnly) {
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
// The components actually copied, plus the ones deliberately owned. sgs:status and sgs:drift
// iterate this list, so an OMITTED component is invisible to both rather than reported as
// missing, while an EJECTED one is reported as informational. That is the difference between
// "not here" and "here, mine": only the second is a decision the tools can tell you about.
/** @type {Record<string, string>} */
const components = {};
for (const id of Object.keys(catalog)) {
    if (manifestOnly) components[id] = `ejected@${tag}`;
    else if (chosen.has(id)) components[id] = tag;
    else if (ejected.has(id)) components[id] = `ejected@${tag}`;
}
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
if (manifestOnly) {
    console.log(`Adopted sleek-geospatial-skills @ ${tag} into ${rel}, conventions only.`);
    console.log('');
    console.log('What is here:');
    console.log('  .claude/skills/       every skill, at this pin');
    console.log('  VOCABULARY.md         the terms the skills use');
    console.log('  scripts/sgs-*.mjs     the two version tools and the clone finder');
    console.log('  sgs.json              every component marked ejected: you own all of it');
    console.log('  sgs-decisions.md      why this app is shaped this way; read it before asking');
    if (skipped.length) {
        console.log('');
        console.log(`Left alone, because they already existed (${skipped.length}):`);
        for (const rel2 of skipped.slice(0, 8)) console.log(`  ${rel2}`);
        if (skipped.length > 8) console.log(`  ... and ${skipped.length - 8} more`);
        console.log('Nothing is overwritten in this mode. Diff any of these against the clone');
        console.log('yourself if you want the newer version.');
    }
    console.log('');
    console.log('No application code was copied, which is the point: your app keeps its own');
    console.log('boot path, its own contracts, its own layout. The manifest is what makes this');
    console.log('more than having read some documentation, because `sgs:status` can now tell');
    console.log('you when a lesson you adopted has moved.');
    console.log('');
    console.log('Add these to your package.json scripts, since yours was not touched:');
    console.log('  "sgs:status": "node scripts/sgs-status.mjs"');
    console.log('  "sgs:drift":  "node scripts/sgs-drift.mjs"');
    console.log('');
    console.log('`sgs:drift` will report nothing: it does not diff files you own, and you own');
    console.log('all of them. `sgs:status` is the one that has something to say.');
    console.log('');
    console.log('Next: the app-adopt skill, which is the interview for exactly this situation.');
} else {
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
if (ejected.size > 0) {
    console.log('');
    console.log(`Ejected (skill copied, code not): ${[...ejected].sort().join(', ')}`);
    console.log('Those are watermarked ejected@' + tag + '. sgs:status will report upstream');
    console.log('movement on them as FYI, and sgs:drift will not diff files you own.');
    console.log('Record WHY in sgs-decisions.md while the reason is still fresh.');
}
if (overruled.length > 0) {
    console.log('');
    console.log('NOT ejected, because something you took needs the file:');
    for (const { id, neededBy } of overruled) {
        console.log(`  ${id.padEnd(14)} needed by ${neededBy.join(', ')}`);
    }
    console.log('');
    console.log('The file is here and watermarked normally. You have two honest ways forward:');
    console.log('eject the capability that needs it as well, or keep this copy and make your');
    console.log('own version satisfy what the dependent component imports from it. Whichever');
    console.log('you pick, write it down in sgs-decisions.md: this is the coupling that makes');
    console.log('adoption hard, and the next person will hit it in the same place.');
}
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
}

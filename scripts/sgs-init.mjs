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
 * for the ones it doesn't — is the `starting-an-app` skill's job. This script stays
 * mechanical: it copies files, filters index.html's stylesheet links to the chosen set, and
 * writes the manifest. It cannot edit JavaScript wiring, on purpose.
 *
 * Usage:
 *   node scripts/sgs-init.mjs <target-dir>                      everything (the full demo)
 *   node scripts/sgs-init.mjs <target-dir> --with popups,settings,demo-data
 *   node scripts/sgs-init.mjs <target-dir> --components popups,tooltip   (explicit ids; core still ships)
 *
 * `.claude/skills/` is deliberately NOT copied. The skills live once, in this clone — two
 * copies of the same skill visible to one agent is a bug generator, not a convenience.
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
// and should be deleted or rewritten — the starting-an-app skill walks that.
//
// serve.mjs and icon-ink.mjs come too, because package.json's `start`, `icons` and `verify`
// call them by path: an app without them has a package.json that lies about what it can do.
// Both resolve their own paths from `import.meta.url`, so they work unchanged from the app's
// own scripts/ directory. sgs-init/status/drift deliberately do NOT come — those must run
// from the clone, whose git history is the reference they read.
const EXTRA = [
    'app/vendor', 'tsconfig.json', 'playwright.config.js', 'vitest.config.js', 'types', 'tests',
    'scripts/serve.mjs', 'scripts/icon-ink.mjs', 'scripts/icon-targets.json',
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
// framework). The sgs:* scripts are re-pointed at the clone by relative path, computed here,
// so `npm run sgs:status` works from inside the app whatever the layout — clone beside the
// app, clone at a monorepo root, anywhere.
const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
const cloneRel = path.relative(target, REPO_ROOT).split(path.sep).join('/');
pkg.name = path.basename(target).toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'my-app';
pkg.version = '0.1.0';
pkg.description = `A MapLibre application built from sleek-geospatial-skills @ ${tag}.`;
pkg.private = true;
delete pkg.keywords;
delete pkg.scripts['sgs:init'];
pkg.scripts['sgs:status'] = `node ${cloneRel}/scripts/sgs-status.mjs .`;
pkg.scripts['sgs:drift'] = `node ${cloneRel}/scripts/sgs-drift.mjs .`;
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

// ── Report ───────────────────────────────────────────────────────────────────────────────
const rel = path.relative(process.cwd(), target) || '.';
console.log(`Scaffolded ${rel} from sleek-geospatial-skills @ ${tag}.`);
console.log(`  capabilities: ${capsTaken.length ? capsTaken.join(', ') : '(explicit component list)'}`);
if (omittedCaps.length) console.log(`  omitted:      ${omittedCaps.join(', ')}`);
console.log('');
console.log('Filesystem convention (see CONTRIBUTING.md):');
console.log('  - This clone stays beside the app, PRISTINE: never edit it, `git -C <clone> pull`');
console.log('    to refresh. Your version pin is sgs.json, not the clone\'s checkout.');
console.log('  - In the OUTER repo\'s .gitignore, ignore the clone directory:');
console.log('        sleek-geospatial-skills/');
console.log('    The app files this script just wrote are tracked normally.');
if (omittedCaps.length) {
    console.log('');
    console.log('Omitted capabilities still have WIRING in app/js/main.js (imports, control');
    console.log('registrations, key handlers) and copied test specs that exercise them.');
    console.log('`npm run typecheck` lists every dangling import — that IS your de-wiring');
    console.log('checklist. The starting-an-app skill has the table; then npm run verify.');
    console.log('');
    console.log('Expect `npm run sgs:drift` to report app-shell drifted on day one: index.html');
    console.log('was trimmed to the capabilities you chose. That is drift working, not a fault.');
}
console.log('');
console.log('Next:');
console.log(`  cd ${rel} && npm install && npm start   # http://localhost:4173`);

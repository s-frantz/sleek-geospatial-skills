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

// Tooling and vendor: everything an app needs to run and verify, none of it watermarked.
// Tests are copied as a starting point; specs for omitted capabilities will fail and should
// be deleted or rewritten — the starting-an-app skill walks that.
const EXTRA = ['app/vendor', 'package.json', 'tsconfig.json', 'playwright.config.js', 'vitest.config.js', 'types', 'tests'];
for (const rel of EXTRA) {
    const src = path.join(REPO_ROOT, rel);
    if (existsSync(src)) cpSync(src, path.join(target, rel), { recursive: true });
}

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
    console.log('registrations, key handlers) and copied test specs that exercise them. Use the');
    console.log('starting-an-app skill to de-wire and trim tests — then run npm run verify.');
}
console.log('');
console.log('Next:');
console.log(`  cd ${rel} && npm install && npm start   # http://localhost:4173`);

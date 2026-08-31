#!/usr/bin/env node
/**
 * sgs-init.mjs — scaffold a new app from this repo.
 *
 * Copies every tier — tokens, components, the framework contract, and the demo furniture —
 * into a target directory, plus the vendored MapLibre build, the example data, and the test
 * suites as a starting point. NOTHING is imported live afterward: the copy is the whole
 * relationship. See CONTRIBUTING.md for what that means for upgrades.
 *
 * `.claude/skills/` is deliberately NOT copied. The skills live once, in this clone (or the
 * shared `.sgs/` clone in a monorepo) — see CONTRIBUTING.md § "why nothing is copied live"
 * for why two copies of the same skill visible to one agent is worse than one copy a
 * directory away.
 *
 * Usage:
 *   node scripts/sgs-init.mjs <target-dir>
 *
 * Typical monorepo call, from inside the shared `.sgs/` clone:
 *   node .sgs/scripts/sgs-init.mjs apps/flood-intake
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);

const targetArg = process.argv[2];
if (!targetArg) {
    console.error('Usage: node scripts/sgs-init.mjs <target-dir>');
    process.exit(1);
}
const target = path.resolve(targetArg);

if (existsSync(target) && existsSync(path.join(target, 'sgs.json'))) {
    console.error(`${target} already has an sgs.json — refusing to overwrite an existing app.`);
    process.exit(1);
}

/** @param {string[]} args @returns {string|null} */
function gitOrNull(args) {
    try {
        return execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

const latestTag = gitOrNull(['describe', '--tags', '--abbrev=0']);
const tag = latestTag ?? 'unreleased';
if (!latestTag) {
    console.warn('No release tags found — watermarking every component as "unreleased".');
    console.warn('Cut a release (see CONTRIBUTING.md) before this is meaningful for sgs:status.');
}

const catalog = JSON.parse(readFileSync(path.join(SCRIPT_DIR, 'sgs-components.json'), 'utf8'));
delete catalog._comment;

mkdirSync(target, { recursive: true });

// Every catalog file, tier-agnostic — the manifest below is what records which tier each one
// belongs to and how it can be upgraded, not which files got copied.
const allFiles = new Set();
for (const files of Object.values(catalog)) for (const f of files) allFiles.add(f);
for (const rel of allFiles) {
    const src = path.join(REPO_ROOT, rel);
    const dst = path.join(target, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    cpSync(src, dst);
}

// Everything else needed to actually run: the vendored build, example data, tooling config,
// and the test suites as a starting point (delete or replace freely — see the README this
// script writes below).
const EXTRA = [
    'app/vendor',
    'app/data',
    'package.json',
    'tsconfig.json',
    'playwright.config.js',
    'vitest.config.js',
    'types',
    'tests',
];
for (const rel of EXTRA) {
    const src = path.join(REPO_ROOT, rel);
    if (!existsSync(src)) continue;
    cpSync(src, path.join(target, rel), { recursive: true });
}

// The manifest: what this app was instantiated from, and where each component's watermark
// currently sits. Every value starts equal to the instantiation tag — there is nothing to be
// behind yet. sgs:status reads this file; nothing else does.
const components = {};
for (const id of Object.keys(catalog)) components[id] = tag;

writeFileSync(
    path.join(target, 'sgs.json'),
    JSON.stringify({ instantiated: tag, components }, null, 2) + '\n',
);

console.log(`Scaffolded ${target} from sleek-geospatial-skills @ ${tag}.`);
console.log('');
console.log('Next:');
console.log(`  cd ${targetArg}`);
console.log('  npm install');
console.log('  npm start                # http://localhost:4173');
console.log('');
console.log('What to touch first: app/js/layers.js (your data), app/js/map.js (your');
console.log('basemap/centre), app/index.html (title). See CONTRIBUTING.md for the tiers —');
console.log('what you can freely rewrite (app/css/furniture.css, the ui/ furniture) versus');
console.log('what stays watermarked (app/css/components/*, app/js/utils/furniture.js and');
console.log('friends) — and `npm run sgs:status` once this repo (or your monorepo\'s `.sgs/`');
console.log('clone) has moved past this tag.');

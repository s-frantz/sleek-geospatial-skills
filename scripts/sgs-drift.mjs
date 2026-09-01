#!/usr/bin/env node
/**
 * sgs-drift.mjs — what has THIS app changed since its watermark?
 *
 * The mirror image of sgs-status.mjs. Status asks "did upstream move past my watermark?"
 * and never reads the app's files. Drift asks "did MY COPY move away from my watermark?"
 * and never reads upstream's later history: each file the manifest's components name is
 * compared against `git show <watermark-tag>:<file>` in this clone, which is exactly the
 * bytes sgs-init copied on the day the watermark was written.
 *
 * Drift is INFORMATION, not error — the furniture tier is expected to drift, that is what
 * copying it is for — so this always exits 0. What drift is FOR: it is the candidate list
 * for contributing upstream. A modified framework or component file is a fix or a lesson
 * somebody may want; the `contributing-upstream` skill triages this output. A modified
 * app-shell is usually just your app being your app.
 *
 * Usage:
 *   node scripts/sgs-drift.mjs [path/to/app]   (defaults to cwd)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);

const appDir = path.resolve(process.argv[2] ?? process.cwd());
const manifestPath = path.join(appDir, 'sgs.json');
if (!existsSync(manifestPath)) {
    console.error(`No sgs.json at ${manifestPath}. Run sgs:init to create an app first.`);
    process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const catalog = JSON.parse(readFileSync(path.join(SCRIPT_DIR, 'sgs-components.json'), 'utf8'));
delete catalog._comment;

// This script's whole answer comes from the clone's git history. Without it, every `git show`
// fails and every file would be reported as "newer than the watermark" — a confident wrong
// answer, which is worse than no answer. So both preconditions are checked up front and
// loudly: the clone must be a git repository, and a component's watermark tag must exist in
// it. A directory copied without .git (or a stale clone missing a newer tag) fails here with
// something a person can act on.
try {
    execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--git-dir'], { stdio: 'pipe' });
} catch {
    console.error(`Not a git repository: ${REPO_ROOT}`);
    console.error('');
    console.error('sgs:drift compares your files against what a release tag shipped, and reads');
    console.error('that from the clone\'s history. A directory copied without .git cannot answer');
    console.error('it. Replace it with a real clone:');
    console.error('    git clone https://github.com/s-frantz/sleek-geospatial-skills');
    process.exit(1);
}

/** @param {string} tag @returns {boolean} */
function tagExists(tag) {
    try {
        execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--verify', `${tag}^{commit}`], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * A file's content at a tag, or null if it did not exist in that release. Callers must have
 * established that the tag itself exists, so null here means "the file is newer than the
 * watermark", never "the reference is unreadable".
 * @param {string} tag @param {string} rel
 * @returns {string|null}
 */
function atTag(tag, rel) {
    try {
        return execFileSync('git', ['-C', REPO_ROOT, 'show', `${tag}:${rel}`], {
            encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch {
        return null;
    }
}

// Compare with line endings normalised: on Windows the working-tree copy is CRLF while
// `git show` emits the blob's LF, and without this every file reports as drifted.
/** @param {string} s */
const norm = (s) => s.replace(/\r\n/g, '\n');

const nameWidth = Math.max(...Object.keys(manifest.components ?? {}).map((k) => k.length), 6);
let anyDrift = false;

for (const [id, value] of Object.entries(manifest.components ?? {})) {
    const files = catalog[id];
    const label = id.padEnd(nameWidth);
    if (!files) {
        console.log(`  ${label}  unknown component (not in sgs-components.json — renamed upstream? see CHANGELOG)`);
        continue;
    }

    const ejected = typeof value === 'string' && value.startsWith('ejected@');
    const tag = ejected ? value.slice('ejected@'.length) : value;

    if (!tagExists(tag)) {
        console.log(`  ${label}  watermark ${tag} is not in this clone — try \`git -C <clone> fetch --tags\``);
        continue;
    }

    /** @type {string[]} */ const modified = [];
    /** @type {string[]} */ const missing = [];
    /** @type {string[]} */ const newer = [];
    for (const rel of files) {
        const upstream = atTag(tag, rel);
        const localPath = path.join(appDir, rel);
        const local = existsSync(localPath) ? readFileSync(localPath, 'utf8') : null;

        if (upstream === null) {
            // The file postdates this watermark upstream; whatever is (or isn't) local, the
            // watermark has nothing to compare it to.
            if (local !== null) newer.push(rel);
            continue;
        }
        if (local === null) missing.push(rel);
        else if (norm(local) !== norm(upstream)) modified.push(rel);
    }

    if (!modified.length && !missing.length && !newer.length) {
        console.log(`  ${label}  ${ejected ? `ejected@${tag} — yet identical to upstream; consider un-ejecting` : 'clean'}`);
        continue;
    }

    anyDrift = true;
    const bits = [];
    if (modified.length) bits.push(`${modified.length} modified`);
    if (missing.length) bits.push(`${missing.length} removed locally`);
    if (newer.length) bits.push(`${newer.length} newer than the watermark upstream`);
    const head = ejected ? `ejected@${tag}, diverged as expected` : `drifted from ${tag}`;
    console.log(`  ${label}  ${head}  (${bits.join(', ')})`);
    for (const f of modified) console.log(`  ${''.padEnd(nameWidth)}    M ${f}`);
    for (const f of missing) console.log(`  ${''.padEnd(nameWidth)}    D ${f}`);
    for (const f of newer) console.log(`  ${''.padEnd(nameWidth)}    ? ${f}`);
}

console.log('');
if (anyDrift) {
    console.log('Drift is a candidate list, not a problem list. To decide what (if anything)');
    console.log('belongs upstream, use the contributing-upstream skill. To see a diff:');
    console.log(`    git -C <clone> show <tag>:<file>   versus the app's copy`);
} else {
    console.log('No drift: every watermarked file matches what its watermark shipped.');
}

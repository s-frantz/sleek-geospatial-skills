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

/**
 * A file's content at a tag, or null if it did not exist there.
 * @param {string} tag @param {string} rel
 * @returns {string|null}
 */
function atTag(tag, rel) {
    try {
        return execFileSync('git', ['-C', REPO_ROOT, 'show', `${tag}:${rel}`], {
            encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
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

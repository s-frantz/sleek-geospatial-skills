#!/usr/bin/env node
/**
 * sgs-status.mjs — is a consuming app's watermark still true?
 *
 * "Watermark" (see docs — CONTRIBUTING.md) means: each component in an app's sgs.json records
 * the release tag it was last synced from, not a live dependency. This script answers the
 * question that matters — did the component's CONTENT actually change upstream since that tag
 * — rather than the question that doesn't — how far apart are the tags. A component untouched
 * for ten releases reports current; a component changed in the very next release reports
 * behind. That distinction is what keeps a whole-repo tag bump from reading as false staleness
 * on every component nobody touched.
 *
 * How: this script never touches the app's copied files at all — it diffs the SKILLS REPO's
 * own history between the watermark tag and the latest tag, for exactly the files
 * sgs-components.json lists for that component. `git show`/`git diff` read any historical
 * revision straight out of one object store; no second checkout, no temporary clone.
 *
 * The clone that history is read from is LOCATED, not hardcoded (see sgs-clone.mjs), so this
 * runs the same whether it sits in the clone or was copied into an app by sgs:init. The app
 * records no path to the clone: sgs.json stays purely a version pin.
 *
 * Usage:
 *   node scripts/sgs-status.mjs [path/to/app]   (defaults to cwd)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { requireClone } from './sgs-clone.mjs';

const appDir = path.resolve(process.argv[2] ?? process.cwd());
const manifestPath = path.join(appDir, 'sgs.json');

if (!existsSync(manifestPath)) {
    console.error(`No sgs.json at ${manifestPath}. Run sgs:init to create an app first.`);
    process.exit(1);
}

const REPO_ROOT = requireClone(appDir, 'which components have changed upstream');
const CATALOG_DIR = path.join(REPO_ROOT, 'scripts');

/** @param {string[]} args @returns {string} */
function git(args) {
    // stderr is piped, not inherited: a watermark naming a tag this clone lacks is a HANDLED
    // case, and letting git's "fatal: bad revision" through makes a handled case read as a
    // crash right above the line that explains it.
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
}

/** @param {string[]} args @returns {{ok: boolean, stdout: string}} */
function gitTry(args) {
    try {
        return { ok: true, stdout: git(args) };
    } catch (err) {
        return { ok: false, stdout: /** @type {any} */ (err).stdout?.toString?.() ?? '' };
    }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const catalog = JSON.parse(readFileSync(path.join(CATALOG_DIR, 'sgs-components.json'), 'utf8'));

// Tags, oldest first. If the repo has none yet (a fresh checkout with no release cut), every
// component simply reads "current" — there is nothing to be behind.
const allTags = gitTry(['tag', '--sort=v:refname']).stdout.split('\n').filter(Boolean);
const latest = allTags.at(-1);

if (!latest) {
    console.log('No release tags in the skills repo yet — nothing to compare watermarks against.');
    process.exit(0);
}

/**
 * Does upstream's content for these files differ between two revisions? A revision that
 * doesn't exist as a tag (an app instantiated before this repo had releases, or a typo)
 * reports unknown rather than guessing.
 * @param {string} from @param {string} to @param {string[]} files
 * @returns {'same'|'changed'|'unknown'}
 */
function contentChanged(from, to, files) {
    if (from === to) return 'same';
    const check = gitTry(['diff', '--quiet', from, to, '--', ...files]);
    if (!allTags.includes(from) && from !== 'HEAD') return 'unknown';
    // `git diff --quiet` exits 0 for no difference, 1 for a difference, so gitTry's "ok"
    // (exit 0) means unchanged.
    return check.ok ? 'same' : 'changed';
}

/**
 * Was this component flagged breaking in any release strictly after `from`, up to and
 * including `to`? Read from CHANGELOG.md's `Breaking:` lines rather than inferred.
 * @param {string} from @param {string} componentId
 * @returns {boolean}
 */
function wasFlaggedBreaking(from, componentId) {
    const changelog = readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
    const fromIndex = allTags.indexOf(from);
    const laterTags = fromIndex === -1 ? allTags : allTags.slice(fromIndex + 1);
    for (const tag of laterTags) {
        const heading = `## [${tag.replace(/^v/, '')}]`;
        const start = changelog.indexOf(heading);
        if (start === -1) continue;
        const nextHeadingIdx = changelog.indexOf('\n## [', start + 1);
        const section = changelog.slice(start, nextHeadingIdx === -1 ? undefined : nextHeadingIdx);
        const breakingLine = section.match(/Breaking:\s*(.+)/);
        if (breakingLine && breakingLine[1].split(',').map((s) => s.trim()).includes(componentId)) {
            return true;
        }
    }
    return false;
}

const nameWidth = Math.max(...Object.keys(manifest.components ?? {}).map((k) => k.length), 6);
let anyBehind = false;
let anyUnreadable = false;

for (const [id, value] of Object.entries(manifest.components ?? {})) {
    const files = catalog[id];
    const label = id.padEnd(nameWidth);
    if (!files) {
        anyUnreadable = true;
        console.log(`  ${label}  unknown component (not in sgs-components.json, renamed upstream?)`);
        continue;
    }

    const ejected = typeof value === 'string' && value.startsWith('ejected@');
    const tag = ejected ? value.slice('ejected@'.length) : value;

    const changed = contentChanged(tag, latest, files);

    if (ejected) {
        if (changed === 'changed') {
            console.log(`  ${label}  ejected — upstream changed since ${tag}, FYI only`);
        } else if (changed === 'same') {
            console.log(`  ${label}  ejected — no upstream change since ${tag}`);
        } else {
            anyUnreadable = true;
            console.log(`  ${label}  ejected — watermark ${tag} not found upstream`);
        }
        continue;
    }

    if (changed === 'unknown') {
        // Not "current": a question that could not be asked, so the summary must not
        // report an all-clear it never checked. Same for the ejected branch above:
        // ejected means "stop suggesting upgrades", not "stop reading".
        anyUnreadable = true;
        console.log(`  ${label}  watermark ${tag} not found upstream, check sgs.json`);
        continue;
    }
    if (changed === 'same') {
        console.log(`  ${label}  current`);
        continue;
    }

    anyBehind = true;
    const fromIdx = allTags.indexOf(tag);
    const releasesBehind = fromIdx === -1 ? '?' : allTags.length - 1 - fromIdx;
    const breaking = wasFlaggedBreaking(tag, id);
    const note = breaking ? `, 1+ breaking` : '';
    console.log(`  ${label}  ${tag} → ${latest}  (${releasesBehind} release${releasesBehind === 1 ? '' : 's'}${note})`);
}

if (!anyBehind && !anyUnreadable) console.log('\nEverything watermarked is current.');
if (anyUnreadable) {
    console.log('');
    console.log('Some watermarks could not be checked, so this is NOT an all-clear. Fetch tags in');
    console.log('the clone, or check sgs.json against the CHANGELOG for a renamed component.');
    process.exit(1);
}
